import { editorWindow, closeTestApp } from "./desktop-test-helpers.mjs";
// Exercise the bundled worker over file: with isolated desktop project storage.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-model-'));
await fs.mkdir(path.join(scratch, 'Documents'));
const wrapper = path.join(scratch, 'main.cjs');
await fs.writeFile(wrapper, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.setPath('documents',${JSON.stringify(path.join(scratch,'Documents'))});delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
const app = await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
try {
  const page = await editorWindow(app), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Guide',exact:true}).waitFor();
  assert(page.url().startsWith('file:'));
  const environments=await page.evaluate(async()=>Promise.all([1,2,3].map(async id=>{const data=await (await fetch(`./reflections/hdri${id}.hdr`)).arrayBuffer();return {bytes:data.byteLength,header:new TextDecoder().decode(data.slice(0,100))};})));
  for(const environment of environments){assert(environment.bytes>100000);assert.match(environment.header,/#\?RADIANCE/);}
  await page.getByRole('button',{name:'3D',exact:true}).click();
  await page.getByRole('button',{name:'Import Model…',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('input[type=file]').first().setInputFiles({name:'stage.obj',mimeType:'text/plain',buffer:Buffer.from('o Platform\nv 0 0 0\nv 2 0 0\nv 0 2 0\nf 1 2 3')});
  await dialog.getByRole('button',{name:'Read model',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Source units',exact:true}).selectOption('m');await dialog.getByRole('button',{name:'Import into scene',exact:true}).click();
  await page.getByRole('tree',{name:'Imported models'}).waitFor();
  const projectPath=path.join(scratch,'Documents','OpticMesh','Projects','Startup Project.lo2s');
  let saved;
  for(let i=0;i<30;i++){try{saved=JSON.parse(await fs.readFile(projectPath,'utf8'));if(saved.simulation?.models?.length)break;}catch{}await page.waitForTimeout(200);}
  assert.equal(saved?.version,4);assert.equal(saved.simulation.models.length,1);
  await page.getByRole('button',{name:'Output',exact:true}).click();
  const opened=app.waitForEvent('window');await page.getByRole('button',{name:'Floating Preview',exact:true}).click();
  const preview=await opened;await preview.getByRole('region',{name:'Floating Preview',exact:true}).waitFor();
  await preview.getByRole('button',{name:'Close Floating Preview',exact:true}).click();
  await page.getByRole('button',{name:'Guide',exact:true}).click();
  await page.getByLabel('Search manual',{exact:true}).fill('stage model import');
  await page.locator('.manual-sidebar').getByRole('link',{name:'Stage model import (v0.8.0)',exact:true}).click();
  await page.waitForFunction(()=>{const image=document.querySelector('.manual-figure img');return image?.complete&&image.naturalWidth>0;});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Bundled desktop worker, model import, schema 4 autosave and native Floating Preview passed.');
} finally {await closeTestApp(app);}
