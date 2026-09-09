import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const bufferData=WebGL2RenderingContext.prototype.bufferData;
    WebGL2RenderingContext.prototype.bufferData=function(...args){
      if(this.canvas===window.retainedCanvas)window.bufferUploads++;
      return bufferData.apply(this,args);
    };
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const draw=WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name]=function(...args){
        if(this.canvas===window.retainedCanvas){window.draws++;if(window.returnStarted&&!window.firstReturnDraw)window.firstReturnDraw=performance.now()-window.returnStarted;}
        return draw.apply(this,args);
      };
    }
  });
  await page.goto('http://localhost:3000/');
  await page.getByText('Manual save only',{exact:true}).waitFor();
  assert.equal(await page.locator('[aria-label="3D viewport"]').count(),0,'First 3D allocation remains lazy');
  const button=name=>page.getByRole('button',{name,exact:true});
  await button('3D').click();await button('Import Model…').click();
  const dialog=page.getByRole('dialog',{name:'Import 3D model'});
  await dialog.locator('input[type=file]').first().setInputFiles(process.env.MODEL_PATH||{name:'stage.obj',mimeType:'text/plain',buffer:Buffer.from('o Stage\nv -2 0 0\nv 2 0 0\nv 2 2 0\nv -2 2 0\nf 1 2 3 4\n')});
  await dialog.getByRole('button',{name:'Read model',exact:true}).click();
  await dialog.locator('.model-preview canvas').waitFor({timeout:240000});
  await dialog.getByLabel('Source units').selectOption(process.env.MODEL_PATH?'cm':'m');
  await dialog.getByRole('button',{name:'Import into scene',exact:true}).click({timeout:240000});
  await dialog.waitFor({state:'detached',timeout:240000});
  await page.getByRole('tree',{name:'Imported models'}).waitFor();
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{window.retainedCanvas=document.querySelector('[aria-label="3D viewport"] canvas');window.draws=0;window.bufferUploads=0;});
  const samples=[];
  for(const mode of ['Pixel Map','Patterns','Pixel Map']){
    await button(mode).click();await page.waitForTimeout(250);
    const hidden=await page.evaluate(()=>({connected:window.retainedCanvas.isConnected,paused:window.retainedCanvas.closest('.three-view').dataset.renderPaused,draws:window.draws}));
    assert(hidden.connected);assert.equal(hidden.paused,'true');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>window.draws),hidden.draws,'Hidden scene issues no GPU draws');
    await page.evaluate(()=>{window.bufferUploads=0;window.returnStarted=performance.now();window.firstReturnDraw=0;});
    await button('3D').click();await page.waitForFunction(()=>window.firstReturnDraw>0);
    await page.waitForTimeout(150);
    const sample=await page.evaluate(()=>({same:window.retainedCanvas===document.querySelector('[aria-label="3D viewport"] canvas'),uploads:window.bufferUploads,firstDrawMs:window.firstReturnDraw}));
    assert(sample.same,'Mode switching must preserve the renderer');
    assert.equal(sample.uploads,0,'No geometry buffer uploads when returning');
    samples.push({mode,...sample});
  }
  await button('File').click();await button('New Project').click();
  await page.getByRole('dialog').getByRole('button',{name:'Continue without saving',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.retainedCanvas.isConnected),false,'Replacing project disposes the retained scene');
  assert.deepEqual(errors,[]);
  console.log('Workspace retention:',JSON.stringify(samples));
}finally{await browser.close();}
