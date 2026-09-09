import { confirmProjectReplacement } from "./browser-fixture.mjs";
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();
 const canvas=page.locator('.canvas-stage canvas');
 assert(await canvas.isVisible());
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 const verifyEmpty=async()=>{
  await page.locator('.map-empty').waitFor();await page.waitForTimeout(80);
  assert.equal(await canvas.isVisible(),false);
  assert.deepEqual(await canvas.evaluate(c=>[c.width,c.height,...c.getContext('2d').getImageData(0,0,1,1).data]),[1,1,0,0,0,0]);
  const bounds=await page.locator('.canvas-stage').boundingBox(),message=await page.locator('.map-empty strong').boundingBox();
  assert(Math.abs(message.x+message.width/2-bounds.x-bounds.width/2)<2);
  assert(Math.abs(message.y+message.height/2-bounds.y-bounds.height/2)<30);
 };
 await verifyEmpty();
 await page.getByRole('button',{name:'Output Map',exact:true}).first().click();await verifyEmpty();
 await page.screenshot({path:'work/v080-local/pixel-map-empty.png'});
 await page.getByRole('button',{name:'Patterns',exact:true}).click();assert(await canvas.isVisible());assert.equal(await page.locator('.map-empty').count(),0);
 await loadRegressionScene(page);await page.waitForTimeout(80);assert(await canvas.isVisible());assert.equal(await page.locator('.map-empty').count(),0);assert((await canvas.evaluate(c=>c.width))>1);
 await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('button',{name:'New Project',exact:true}).click();await confirmProjectReplacement(page);
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();await verifyEmpty();
 assert.deepEqual(errors,[]);console.log('Pixel Map empty canvas: fresh project, input/output, centred prompt, Patterns switch, XML load and New Project reset passed.');
}finally{await browser.close();}
