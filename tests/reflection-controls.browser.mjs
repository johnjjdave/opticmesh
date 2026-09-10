import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();
 await loadRegressionScene(page,'3d');
 const buttons=n=>page.getByRole('button',{name:`HDRI${n}`,exact:true});
 const check=async n=>{assert.equal(await buttons(n).count(),2);for(const b of await buttons(n).all())assert.equal(await b.getAttribute('aria-pressed'),'true');};
 await check(1);await buttons(2).first().click();await check(2);
 await buttons(3).last().click();await check(3);
 await page.keyboard.press('Control+z');await check(2);
 await page.keyboard.press('Control+Shift+z');await check(3);
 const groups=page.getByRole('group',{name:'Reflection environment',exact:true});
 for(const group of await groups.all()){
  const rects=await group.getByRole('button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));
  assert(rects.every(r=>Math.abs(r.y-rects[0].y)<1),'Buttons share one row');
  assert(rects[0].x<rects[1].x&&rects[1].x<rects[2].x);
 }
 await page.getByRole('button',{name:'Output',exact:true}).click();await page.getByRole('button',{name:'Floating Preview',exact:true}).click();
 await page.getByRole('region',{name:'Floating Preview',exact:true}).waitFor();
 await buttons(1).first().click();await check(1);await buttons(3).first().click();await check(3);
 await page.getByRole('button',{name:'Close Floating Preview',exact:true}).click();
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();assert.equal(await buttons(3).count(),0);
 await page.getByRole('button',{name:'3D',exact:true}).click();await check(3);
 await page.getByRole('button',{name:'File',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save As…',exact:true}).click();
 const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));assert.equal(saved.simulation.reflectionPreset,3);
 await buttons(1).first().click();
 await page.locator('input[accept=".lo2s,application/x-opticmesh-project,.json,application/json"]').setInputFiles({name:'reflections.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.getByText('Project loaded: reflections.lo2s',{exact:true}).waitFor();await check(3);
 await page.screenshot({path:'work/v080-local/environment/preset-controls.png'});
 delete saved.simulation.reflectionPreset;
 await page.locator('input[accept=".lo2s,application/x-opticmesh-project,.json,application/json"]').setInputFiles({name:'older.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.getByText('Project loaded: older.lo2s',{exact:true}).waitFor();await check(1);
 assert.deepEqual(errors,[]);console.log('Reflection controls: synchronized horizontal rows, Undo/Redo, preview, mode switching, save/reopen and older-project default passed.');
}finally{await browser.close();}
