import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;window.projectSerializations=0;const stringify=JSON.stringify;JSON.stringify=function(value,...args){if(value?.format==="opticmesh-project")window.projectSerializations++;return stringify.call(this,value,...args);};});await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await loadRegressionScene(page,'3d');
 const button=name=>page.getByRole('button',{name,exact:true}),view=page.getByRole('region',{name:'3D viewport',exact:true});
 const save=async()=>{await button('File').click();const event=page.waitForEvent('download');await button('Save As…').click();return JSON.parse(await fs.readFile(await (await event).path(),'utf8'));};
 const pose=async()=> (await save()).simulation.camera;
 const same=(a,b)=>{const compare=(x,y)=>{if(typeof x==='number'){assert(Math.abs(x-y)<1e-3,`${x} != ${y}`);return;}assert.deepEqual(Object.keys(x),Object.keys(y));for(const key of Object.keys(x))compare(x[key],y[key]);};compare(a,b);};
 const move=async(name,orbit=false)=>{const serialized=await page.evaluate(()=>window.projectSerializations);const pane=view.locator(`[aria-label="${name} viewport"]`),r=await pane.boundingBox();const x=r.x+r.width*.6,y=r.y+r.height*.55;await page.mouse.move(x,y);await page.mouse.down({button:orbit?'left':'right'});await page.mouse.move(x+38,y+24,{steps:7});await page.mouse.up({button:orbit?'left':'right'});await page.mouse.wheel(0,-190);await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.projectSerializations),serialized,'Navigation must not serialize embedded assets in manual-save mode');};
 const roundtrip=async(mode)=>{const before=await pose();await button(mode).click();assert.equal(await view.count(),0,'Hidden main view should not keep rendering');if(mode==='Pixel Map')await button('Output Map').first().click();await button('3D').click();await view.waitFor();await page.waitForTimeout(350);same(before,await pose());};
 await view.focus();await page.keyboard.press('f');await move('Perspective',true);await roundtrip('Pixel Map');
 await button('Select Centre Wall').click();await view.focus();await page.keyboard.press('s');await move('Perspective',true);await roundtrip('Patterns');
 for(const [mode,name] of [['top','Top'],['right','Right'],['front','Front']]){await page.getByLabel('Camera view',{exact:true}).selectOption(mode);await move(name);await roundtrip('Pixel Map');assert.equal(await page.getByLabel('Camera view',{exact:true}).inputValue(),mode);}
 await page.getByLabel('Camera view',{exact:true}).selectOption('four');
 for(const name of ['Perspective','Top','Right','Front'])await move(name,name==='Perspective');
 await roundtrip('Patterns');const four=await pose();assert.deepEqual(Object.keys(four.orthographic).sort(),['front','right','top']);
 // A fresh fit remains a command and does change the current framing.
 await view.focus();await page.keyboard.press('f');await page.waitForTimeout(300);assert.notDeepEqual(await pose(),four);await move('Perspective',true);await roundtrip('Pixel Map');
 const saved=await save();
 await button('File').click();await button('New Project').click();await page.getByRole('dialog').getByRole('button',{name:'Continue without saving',exact:true}).click();await button('3D').click();await page.waitForTimeout(250);assert.notDeepEqual(await pose(),saved.simulation.camera,'New projects must not inherit the old view');
 await page.locator('input[accept=".lo2s,application/x-opticmesh-project,.json,application/json"]').setInputFiles({name:'camera.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.getByText('Project loaded: camera.lo2s',{exact:true}).waitFor();await page.waitForTimeout(300);same(saved.simulation.camera,await pose());
 assert.deepEqual(errors,[]);console.log('Camera preservation: Perspective, orthographic panes, All Views, previous Fit/Focus, mode changes, fresh Fit, new projects and saved-camera restore passed.');
}finally{await browser.close();}
