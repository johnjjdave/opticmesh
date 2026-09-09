import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined;});
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 const screen=(name,w,h,id)=>`<Screen><Param name="Name" value="${name}"/><OutputDeviceVirtual width="${w}" height="${h}"/><layers><Slice uniqueId="${id}"><Param name="Name" value="${name} slice"/><InputRect><v x="0" y="0"/><v x="${w}" y="0"/><v x="${w}" y="${h}"/><v x="0" y="${h}"/></InputRect><OutputRect><v x="0" y="0"/><v x="${w}" y="0"/><v x="${w}" y="${h}"/><v x="0" y="${h}"/></OutputRect></Slice></layers></Screen>`;
 const xml=parts=>`<XmlState name="Screens"><ScreenSetup><CurrentCompositionTextureSize width="600" height="400"/><screens>${parts.join('')}</screens></ScreenSetup></XmlState>`;
 const first=screen('Stage',400,200,'stage'),second=screen('Side',200,100,'side');
 const load=async parts=>{await page.locator('input[accept=".xml,text/xml"]').setInputFiles({name:'screens.xml',mimeType:'text/xml',buffer:Buffer.from(xml(parts))});await page.getByText(`Loaded ${parts.length} screens and ${parts.length} slices`,{exact:true}).waitFor();};
 const canvas=page.locator('.canvas-stage canvas'),selector=page.getByRole('combobox',{name:'Screen',exact:true});
 const check=async(w,h)=>{await page.waitForFunction(([w,h])=>{const c=document.querySelector('.canvas-stage canvas');return c?.width===w&&c?.height===h;},[w,h]);assert(await canvas.evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]&&(pixels[i]>20||pixels[i+1]>20||pixels[i+2]>20))return true;return false;}),'Map contains visible pixels');};
 await load([first,second]);await check(600,400);assert.equal(await selector.count(),0);assert.equal(await page.getByRole('button',{name:'All Screens',exact:true}).count(),0);
 await page.getByRole('button',{name:'Output Map',exact:true}).first().click();assert.equal(await selector.inputValue(),'0');assert.deepEqual(await selector.locator('option').allTextContents(),['Stage','Side']);await check(400,200);
 await selector.selectOption('1');await check(200,100);await page.getByRole('button',{name:'Input Map',exact:true}).first().click();await check(600,400);await page.getByRole('button',{name:'Output Map',exact:true}).first().click();assert.equal(await selector.inputValue(),'1');await check(200,100);
 await page.getByRole('button',{name:'Export',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Current Output PNG',exact:true}).click();const bytes=await fs.readFile(await(await pending).path());assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[200,100]);
 await load([first]);assert.equal(await selector.inputValue(),'0');await check(400,200);
 await page.screenshot({path:'work/v080-local/pixel-map-screen.png'});
 assert.deepEqual(errors,[]);console.log('Output Map: only real screens, first-screen default, retained selection, full input composition, matching PNG export and XML replacement fallback passed.');
}finally{await browser.close();}
