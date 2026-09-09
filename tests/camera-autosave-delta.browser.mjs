import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.addInitScript(()=>{
  window.projectSerializations=0;window.autosaves=[];window.deltaKeys=[];let project={},simulation={};
  const stringify=JSON.stringify;JSON.stringify=function(value,...args){if(value?.format==='opticmesh-project')window.projectSerializations++;return stringify.call(this,value,...args);};
  window.lo2sDesktop={onResolumeXmlUpdated:()=>()=>{},onResolumeLinkError:()=>()=>{},loadStartupProject:async()=>({ok:true,restored:false}),autosaveProject:async()=>{throw new Error('Delta-capable desktop must not receive full buffers');},autosaveProjectDelta:async patch=>{
    window.deltaKeys.push({reset:patch.reset,project:Object.keys(patch.project.set),simulation:Object.keys(patch.simulation.set)});
    if(patch.reset){project={};simulation={};}
    for(const key of patch.project.remove)delete project[key];Object.assign(project,patch.project.set);
    for(const key of patch.simulation.remove)delete simulation[key];Object.assign(simulation,patch.simulation.set);
    project.simulation=simulation;window.autosaves.push(structuredClone(project));return {ok:true};}};
 });
 await page.goto('http://localhost:3000/');await page.waitForFunction(()=>window.autosaves.length>0);await loadRegressionScene(page,'3d');
 await page.getByText('Latest changes autosaved',{exact:true}).waitFor();await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>({serializations:window.projectSerializations,saves:window.autosaves.length,camera:window.autosaves.at(-1).simulation.camera}));
 await page.locator('[aria-label="Perspective viewport"]').evaluate(async surface=>{
  const rect=surface.getBoundingClientRect();
  for(let i=0;i<25;i++){surface.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:rect.x+rect.width*.58,clientY:rect.y+rect.height*.45,deltaY:-12}));await new Promise(resolve=>setTimeout(resolve,30));}
 });
 assert.equal(await page.evaluate(()=>window.projectSerializations),before.serializations,'No full project serialization during continuous zoom');
 assert.equal(await page.evaluate(()=>window.autosaves.length),before.saves,'No intermediate camera autosaves during continuous zoom');
 await page.waitForFunction(count=>window.autosaves.length>count,before.saves);await page.waitForTimeout(1000);
 const after=await page.evaluate(()=>({serializations:window.projectSerializations,saves:window.autosaves.length,camera:window.autosaves.at(-1).simulation.camera}));
 assert.equal(after.saves,before.saves+1,'One settled camera autosave');assert.equal(after.serializations,before.serializations,'Autosave serialization stays off the interface thread');
 assert.deepEqual(await page.evaluate(()=>window.deltaKeys.at(-1)),{reset:false,project:[],simulation:['camera']},'Only camera data crosses the desktop bridge');assert.notDeepEqual(after.camera,before.camera,'Autosave contains the new camera pose');assert.deepEqual(errors,[]);
 console.log('Desktop camera delta: 25 wheel events, no full-buffer bridge calls, one camera-only save with the new pose.');
}finally{await browser.close();}
