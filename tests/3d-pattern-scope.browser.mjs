import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.textureCanvases=new Set();
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(...args){const result=original.apply(this,args);if(args[0]==='2d'&&result)window.textureCanvases.add(this);return result;};
 window.samplePattern=(canvas,x=0,y=0)=>{
  // Read a copy so repeated checks do not move the retained texture canvas
  // from GPU to CPU rasterization (which changes colour rounding by one unit).
  const copy=document.createElement('canvas');copy.width=800;copy.height=1200;
  const ctx=original.call(copy,'2d',{willReadFrequently:true}),result=[];
  ctx.drawImage(canvas,x,y,800,1200,0,0,800,1200);
  for(const sy of [101,307,713,1197])for(const sx of [31,173,389,617,761])result.push(...ctx.getImageData(sx,sy,1,1).data);
  return result;
 };
});
try{
 await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await loadRegressionScene(page);
 const fill=()=>page.locator('section').filter({has:page.getByRole('heading',{name:'Pattern fill',exact:true})});
 await page.getByRole('button',{name:'Across Map',exact:true}).click();
 for(const name of ['Color Bars','Grayscale','Cabinet IDs','Metric Grid','Cabinet Checker','Pixel Check']){
  await fill().getByRole('button',{name,exact:true}).click();await page.waitForTimeout(80);
  const expected=await page.locator('.canvas-stage canvas').evaluate(c=>[window.samplePattern(c,160,340),window.samplePattern(c,2880,340)]);
  await page.evaluate(()=>window.textureCanvases.clear());
  await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForTimeout(120);
  const actual=await page.evaluate(()=>[...window.textureCanvases].filter(c=>!c.isConnected&&c.width===800&&c.height===1560).map(c=>window.samplePattern(c)));
  for(const crop of expected)assert(actual.some(pixels=>JSON.stringify(pixels)===JSON.stringify(crop)),`${name}: 3D texture matches input-map crop`);
  await page.getByRole('button',{name:'Pixel Map',exact:true}).click();
 }
 // While running in 3D, the next fill must retain Across Map coordinates.
 await fill().getByRole('button',{name:'Color Bars',exact:true}).click();
 await page.clock.install();
 await page.getByRole('button',{name:'Run test sequence',exact:true}).click();
 await page.evaluate(()=>window.textureCanvases.clear());
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.clock.runFor(3100);
 const running=await page.evaluate(()=>[...window.textureCanvases].filter(c=>!c.isConnected&&c.width===800&&c.height===1560).map(c=>window.samplePattern(c)));
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();await page.getByRole('button',{name:'Run test sequence',exact:true}).click();await page.clock.runFor(50);
 assert.equal(await fill().getByRole('button',{name:'Grayscale',exact:true}).getAttribute('aria-pressed'),'true');
 const nextFill=await page.locator('.canvas-stage canvas').evaluate(c=>[window.samplePattern(c,160,340),window.samplePattern(c,2880,340)]);
 for(const crop of nextFill)assert(running.some(pixels=>JSON.stringify(pixels)===JSON.stringify(crop)),'Sequence retains Across Map in 3D');
 // In Per Slice, both towers restart the same color-bar pattern locally.
 await page.getByRole('button',{name:'Per Slice',exact:true}).click();await fill().getByRole('button',{name:'Color Bars',exact:true}).click();
 await page.evaluate(()=>window.textureCanvases.clear());await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForTimeout(120);
 const local=await page.evaluate(()=>[...window.textureCanvases].filter(c=>!c.isConnected&&c.width===800&&c.height===1560).map(c=>window.samplePattern(c)));
 assert.equal(local.length,2);assert.deepEqual(local[0],local[1]);
 assert.deepEqual(errors,[]);console.log('3D Across Map: all six texture fills match input-map crops; sequence retains scope; Per Slice remains local.');
}finally{await browser.close();}
