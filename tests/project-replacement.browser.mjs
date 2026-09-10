import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await loadRegressionScene(page,'3d');
 const dialog=page.locator('.project-replacement-dialog');
 const menu=async(name)=>{await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();};
 const slices=()=>page.locator('.hierarchy-row.child').count();assert.equal(await slices(),6);
 await menu('Open Demo');await dialog.waitFor({state:'visible'});
 assert.equal(await slices(),6);assert.equal(await dialog.locator('button:focus').count(),0);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await slices(),6);
 await menu('New Project');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await slices(),6);
 await menu('Open Demo');await dialog.waitFor({state:'visible'});await page.screenshot({path:'work/v080-local/project-replacement.png'});
 // Modal keyboard focus stays inside, and the action area fits smaller windows.
 await page.keyboard.press('Tab');assert(await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');assert(await dialog.getByRole('button',{name:'Continue without saving',exact:true}).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');assert(await dialog.getByRole('button',{name:'Save and continue',exact:true}).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');assert(await dialog.getByRole('button',{name:'Cancel',exact:true}).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Shift+Tab');assert(await dialog.getByRole('button',{name:'Save and continue',exact:true}).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');
 for(const width of [1024,420]){
  await page.setViewportSize({width,height:680});
  assert(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;}));
  for(const button of await dialog.getByRole('button').all())assert(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
  await dialog.screenshot({path:`work/v080-local/project-replacement-${width}.png`});
 }
 await page.setViewportSize({width:1500,height:1000});

 // Browser picker cancellation and failed writes must never replace the scene.
 await page.evaluate(()=>{window.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError');};});
 await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await dialog.getByRole('status').filter({hasText:'Save cancelled'}).waitFor();assert.equal(await slices(),6);
 await page.evaluate(()=>{window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{throw new Error('Disk full');},close:async()=>{}})});});
 await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await dialog.getByRole('status').filter({hasText:'could not be saved'}).waitFor();assert.equal(await slices(),6);
 // Download-only browsers require a further explicit choice, because delivery cannot be confirmed.
 await page.evaluate(()=>{window.showSaveFilePicker=undefined;});const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();
 const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));assert(saved.rawXml.includes('Centre Wall'));await dialog.getByRole('status').filter({hasText:'Download requested'}).waitFor();assert.equal(await slices(),6);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 // Native cancellation, rejection, delayed success and active named-project overwrite.
 await page.evaluate(()=>{window.saveCalls=0;window.saveMode='cancel';window.lo2sDesktop={saveProject:async(name,data)=>{window.saveCalls++;window.savedProject=JSON.parse(new TextDecoder().decode(data));if(window.saveMode==='cancel')return {cancelled:true};if(window.saveMode==='fail')throw new Error('Write failed');await new Promise(resolve=>{window.releaseSave=resolve;});return {ok:true,path:'C:/Example/Stage.lo2s'};},overwriteProject:async(path,data)=>{window.overwrittenPath=path;window.savedProject=JSON.parse(new TextDecoder().decode(data));return {ok:true};}};});
 await menu('New Project');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await dialog.getByRole('status').filter({hasText:'Save cancelled'}).waitFor();assert.equal(await slices(),6);
 await page.evaluate(()=>window.saveMode='fail');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await dialog.getByRole('status').filter({hasText:'could not be saved'}).waitFor();assert.equal(await slices(),6);
 await page.evaluate(()=>window.saveMode='success');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 // Save As first establishes the named destination, without replacing the project.
 await menu('Save As…');await page.waitForFunction(()=>!!window.releaseSave);await page.evaluate(()=>window.releaseSave());await page.getByText('Project saved',{exact:true}).waitFor();
 await menu('New Project');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.overwrittenPath),'C:/Example/Stage.lo2s');assert((await page.evaluate(()=>window.savedProject.rawXml)).includes('Centre Wall'));assert.equal(await slices(),0);
 // The File demo entry requires confirmation from both map and 3D; explicit discard loads demo.
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();await menu('Open Demo');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'3D',exact:true}).click();await menu('Open Demo');await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await page.waitForFunction(()=>window.saveCalls===4);assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);assert.equal(await slices(),0);await page.evaluate(()=>window.releaseSave());await dialog.waitFor({state:'detached'});assert.equal(await slices(),7);
 await menu('New Project');await dialog.getByRole('button',{name:'Continue without saving',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await slices(),0);
 assert.deepEqual(errors,[]);console.log('Project replacement: all entry points, cancel, Escape, save failures/cancellation, downloads, native save/overwrite, busy lock and explicit discard passed.');
}finally{await browser.close();}
