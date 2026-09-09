import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
 await page.addInitScript(()=>{
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
   const original=WebGL2RenderingContext.prototype[name];
   WebGL2RenderingContext.prototype[name]=function(...args){
    const key=this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)===null?'displayDraws':'offscreenDraws';
    this.canvas.dataset[key]=String(Number(this.canvas.dataset[key]||0)+1);
    return original.apply(this,args);
   };
  }
  // Exercise real WebGL output capture, replacing only the native transport.
  window.__outputFrames=[];
  window.lo2sDesktop={onResolumeXmlUpdated:()=>()=>{},onResolumeLinkError:()=>()=>{},onNativeSourceFrame:()=>()=>{},onNativeSourceStatus:()=>()=>{},startPatternOutput:async()=>({ok:true}),stopPatternOutput:async()=>({ok:true}),sendPatternOutputFrame:async(width,height,data,fps)=>{
   window.__outputFrames.push({width,height,bytes:data.byteLength,fps});return {ok:true};
  }};
 });
 await page.goto('http://localhost:3000/');
 await page.getByRole('button',{name:'Guide',exact:true}).waitFor(); await page.waitForTimeout(1000);
 const button=name=>page.getByRole('button',{name,exact:true});
 await loadRegressionScene(page,'3d');
 await button('Output').click(); assert(await button('Pause main viewport').isDisabled());
 await button('Windowed').click();
 const panel=page.getByRole('region',{name:'Windowed output',exact:true});
 await panel.waitFor();
 const move=await panel.boundingBox();
 await page.mouse.move(move.x+12,move.y+12);await page.mouse.down();await page.mouse.move(move.x+762,move.y+12);await page.mouse.up();
 await button('Pixel Map').click();await button('Color Bars').click();await button('Run test sequence').click();await button('3D').click();
 const main=page.getByRole('region',{name:'3D viewport',exact:true}).locator('canvas');
 const preview=page.getByRole('region',{name:'Windowed 3D preview',exact:true}).locator('canvas');
 const draws=canvas=>canvas.evaluate(c=>({display:Number(c.dataset.displayDraws||0),offscreen:Number(c.dataset.offscreenDraws||0)}));
 await page.waitForTimeout(1600);
 await button('Output').click();await button('Pause main viewport').click();
 await page.getByText('Main viewport paused',{exact:true}).waitFor();
 await button('Performance').click();
 const metric=page.locator('[class*="performancePanel"]').locator('div').filter({has:page.locator('dt',{hasText:/^Viewport redraws \/ s$/})});
 assert.equal(await metric.locator('dd').innerText(),'Paused');
 const before=await draws(main), liveBefore=await draws(preview);
 await page.getByRole('button',{name:'All Views',exact:true}).first().click();
 await page.waitForTimeout(3500);
 assert.deepEqual(await draws(main),before,'Paused main viewport issues no GPU draws during changing patterns');
 assert((await draws(preview)).display>liveBefore.display,'Undocked preview keeps rendering changing patterns');
 await page.screenshot({path:'work/v080-local/viewport-paused.png'});
 await button('Output').click(); await button('NDI').click();
 await page.waitForFunction(()=>window.__outputFrames.length>=2);
 const withOutput=await draws(main);
 assert.equal(withOutput.display,before.display,'Native output capture does not draw paused display');
 assert(withOutput.offscreen>before.offscreen,'Active native output still renders offscreen');
 assert(await page.evaluate(()=>window.__outputFrames.every(f=>f.width===1920&&f.height===1080&&f.fps===30&&f.bytes===1920*1080*4)));
 await button('Resume viewport').click();await page.waitForTimeout(500);
 assert((await draws(main)).display>before.display,'Resume draws current scene immediately');
 await button('Output').click();await button('Pause main viewport').click();
 await button('Pixel Map').click();await button('Run test sequence').click();await button('3D').click();
 await page.getByText('Main viewport paused',{exact:true}).waitFor();
 await button('Close windowed output').click();await page.waitForTimeout(500);
 assert.equal(await page.getByText('Main viewport paused',{exact:true}).count(),0,'Closing preview automatically resumes editor');
 assert.equal(await page.getByRole('region',{name:'3D viewport',exact:true}).getAttribute('inert'),null);
 await button('Output').click();await button('OFF').click();
 assert.deepEqual(errors,[]);
 console.log('Pause viewport: zero editor GPU draws, live preview sequence, real native-output capture, resume and workspace/close lifecycle passed.');
}catch(error){console.log('Renderer errors',errors);console.log((await page.locator('body').innerText()).slice(0,850));throw error;}finally{await browser.close();}
