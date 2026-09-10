import { editorWindow, closeTestApp } from './desktop-test-helpers.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-import-cancel-'));
const wrapper=path.join(scratch,'main.cjs'),folder=path.join(scratch,'Assets');await fs.mkdir(folder);
await fs.writeFile(path.join(folder,'stage.obj'),'o Stage\nv 0 0 0\nv 10 0 0\nv 0 5 0\nf 1 2 3');
await fs.writeFile(wrapper,`const {app,BrowserWindow}=require('electron');BrowserWindow.prototype.show=BrowserWindow.prototype.showInactive;app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.setPath('documents',${JSON.stringify(scratch)});delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
const app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
try{
 const page=await editorWindow(app),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'3D',exact:true}).click();
 const open=()=>page.getByRole('button',{name:'Import Model…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Import 3D model',exact:true});await open();
 const picker=async name=>{const waiting=page.waitForEvent('filechooser');await dialog.getByRole('button',{name,exact:true}).click();return await waiting;};
 const cancelPicker=async name=>{
  const chooser=await picker(name);
  // Chromium's HTML file input emits this bubbling notification when its
  // chooser is cancelled. Playwright intercepts the native chooser for the test.
  await chooser.element().evaluate(input=>input.dispatchEvent(new Event('cancel',{bubbles:true})));
  assert(await dialog.isVisible(),`${name}: cancelling the chooser must leave the import dialog open`);
 };
 for(const name of ['Choose files…','Choose folder…'])await cancelPicker(name);
 assert(await dialog.getByRole('button',{name:'Read model',exact:true}).isDisabled());
 const chosen=await picker('Choose folder…');await chosen.setFiles(folder);
 await dialog.getByRole('button',{name:'Read model',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Source units',exact:true}).selectOption('cm');
 await dialog.getByRole('combobox',{name:'Source up axis',exact:true}).selectOption('z');
 await dialog.getByRole('checkbox',{name:'Import model hierarchy',exact:true}).uncheck();
 const preview=await dialog.locator('.model-preview canvas').elementHandle();
 const summary=await dialog.locator('.model-preview-summary').innerText();
 for(const name of ['Choose files…','Choose folder…']){
  await cancelPicker(name);
  assert.equal(await dialog.getByRole('combobox',{name:'Source units',exact:true}).inputValue(),'cm');
  assert.equal(await dialog.getByRole('combobox',{name:'Source up axis',exact:true}).inputValue(),'z');
  assert.equal(await dialog.getByRole('checkbox',{name:'Import model hierarchy',exact:true}).isChecked(),false);
  assert.equal(await dialog.locator('.model-preview-summary').innerText(),summary);
  assert(await preview.evaluate(canvas=>canvas.isConnected),'Prepared preview survives cancellation');
  assert(await dialog.getByRole('button',{name:'Import into scene',exact:true}).isEnabled());
 }
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await open();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});
 await open();await dialog.getByRole('button',{name:'Close import',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 console.log('Import chooser cancellation: files/folder keep empty and prepared dialogs open; preview/options retained; Escape, Cancel and Close import still dismiss.');
}finally{await closeTestApp(app);}
