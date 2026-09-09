import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadRegressionScene} from './browser-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try {
 const seed=await browser.newPage();
 await seed.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await seed.goto('http://localhost:3000/');await seed.getByText('Manual save only',{exact:true}).waitFor();
 await loadRegressionScene(seed,'3d');
 await seed.getByRole('button',{name:'Select Centre Wall',exact:true}).click();
 await seed.locator('aside[class*="inspector"]').last().locator(':scope > nav').getByRole('button',{name:/^source$/i}).click();
 await seed.getByRole('combobox',{name:'Selected',exact:true}).selectOption('ndi');
 await seed.getByRole('button',{name:'File',exact:true}).click();
 const download=seed.waitForEvent('download');await seed.getByRole('button',{name:'Save As…',exact:true}).click();
 const project=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));await seed.close();
 project.simulation.floorVisible=false;project.simulation.gridVisible=false;
 // Persisted routing includes both global and slice-specific live inputs.
 for(const source of ['spout','ndi','video']) {
  project.simulation.source=source;assert(Object.keys(project.simulation.sourceOverrides).length>0);
  const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(content=>{
   const context=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,options){return context.call(this,kind,kind==='webgl2'?{...options,preserveDrawingBuffer:true}:options);};
   window.__startupCalls=0;
   window.lo2sDesktop={
    onResolumeXmlUpdated:()=>()=>{},onResolumeLinkError:()=>()=>{},
    loadStartupProject:async()=>{window.__startupCalls++;return {ok:true,restored:true,content};},
    autosaveProject:async bytes=>{window.__saved=JSON.parse(new TextDecoder().decode(bytes));return {ok:true};},
    disconnectNativeSource:async()=>({ok:true}),
    listNativeSources:async()=>({ok:true,sources:[{id:'fixture',name:'Fixture'}]}),
    onNativeSourceStatus:fn=>{window.__sourceStatus=fn;return ()=>{};},
    onNativeSourceFrame:fn=>{window.__sourceFrame=fn;return ()=>{};},nativeSourceFrameReady:()=>{},
    connectNativeSource:async()=>{
     window.__sourceStatus({status:'connected',name:'Fixture',width:16,height:16});
     window.__sourceFrame({width:16,height:16,data:new Uint8Array(16*16*4).fill(255)});
     return {ok:true};
    }
   };
  },JSON.stringify(project));
  await page.goto('http://localhost:3000/');
  await page.getByRole('heading',{name:'Scene hierarchy',exact:true}).waitFor();
  await page.waitForFunction(()=>window.__saved?.workspaceMode==='simulation');
  const inspector=page.locator('aside[class*="inspector"]').last();
  const tab=name=>inspector.locator(':scope > nav').getByRole('button',{name:new RegExp('^'+name+'$','i')});
  assert.match(await tab('Scene').getAttribute('class'),/active/);
  const restored=await page.evaluate(()=>({source:window.__saved.simulation.source,overrides:window.__saved.simulation.sourceOverrides,calls:window.__startupCalls}));
  assert.deepEqual(restored,{source:'pattern',overrides:{},calls:1});
  await tab('Source').click();assert.equal(await page.getByRole('combobox',{name:'Global feed',exact:true}).inputValue(),'pattern');
  // Inspect real displayed pixels: a disconnected feed must not turn the faces white.
  const brightness=async()=>{await page.waitForTimeout(300);return page.getByRole('region',{name:'3D viewport',exact:true}).locator('canvas').evaluate(c=>{
   const gl=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
   let white=0,coloured=0;for(let i=0;i<p.length;i+=4){if(p[i]>220&&p[i+1]>220&&p[i+2]>220)white++;if(Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])>80)coloured++;}return {white,coloured};
  });};
  const pattern=await brightness();assert(pattern.coloured>100,'Restored pattern textures are visible');
  await page.getByRole('combobox',{name:'Global feed',exact:true}).selectOption(source);
  const empty=await brightness();assert(empty.white<20,`${source}: disconnected LED faces are black: ${JSON.stringify(empty)}`);
  if(source==='ndi') {
   await page.getByRole('button',{name:'Connect source',exact:true}).click();
   const live=await brightness();assert(live.white>1000,'Connected texture renders without black tint');
   await page.evaluate(()=>window.__sourceStatus({status:'disconnected',name:'No signal'}));
   const lost=await brightness();assert(lost.white<20,'Signal loss clears the live texture to black');
   await page.getByRole('button',{name:'Connect source',exact:true}).click();
   assert((await brightness()).white>1000,'Reconnection restores the texture');
  }
  // Opening another project from Source must also choose a valid inspector.
  await page.locator('input[accept*=".lo2s"]').first().setInputFiles({name:'restored.lo2s',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.getByRole('heading',{name:'Scene hierarchy',exact:true}).waitFor();
  await tab('Source').click();assert.equal(await page.getByRole('combobox',{name:'Global feed',exact:true}).inputValue(),'pattern');
  console.log(`${source}: startup restores Scene + patterns; no-signal faces black; explicit project load resets inspector/source.`);
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
