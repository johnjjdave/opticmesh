import fs from 'node:fs/promises';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {zipSync,strToU8} from 'three/examples/jsm/libs/fflate.module.js';
const vertices=Buffer.from(new Float32Array([0,0,0,2,0,0,0,3,0]).buffer);
const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Assembly',translation:[1,0,0],children:[1]},{name:'Panel',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36,uri:'data:application/octet-stream;base64,'+vertices.toString('base64')}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[2,3,0]}]};
const binaryJson=structuredClone(json);delete binaryJson.buffers[0].uri;
const text=Buffer.from(JSON.stringify(binaryJson)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);
const glb=Buffer.alloc(12+8+padded.length+8+vertices.length);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);const offset=20+padded.length;glb.writeUInt32LE(vertices.length,offset);glb.writeUInt32LE(0x004e4942,offset+4);vertices.copy(glb,offset+8);

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});await page.goto('http://localhost:3000/');await page.getByText('Manual save only',{exact:true}).waitFor();await page.getByRole('button',{name:'3D',exact:true}).click();await page.getByRole('button',{name:'Import Model…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Import 3D model'}),commit=dialog.getByRole('button',{name:'Import into scene',exact:true});assert(await commit.isDisabled());assert.equal(await dialog.getByRole('button',{name:'Choose files…',exact:true}).evaluate(e=>e===document.activeElement),true);await page.screenshot({path:'work/v080-local/import-dialog-empty.png'});
 const obj=`o Stage
v -2 0 -1
v 2 0 -1
v 2 0 1
v -2 0 1
f 1 2 3 4
o Screen
v -2 0 -1
v 2 0 -1
v 2 3 -1
v -2 3 -1
f 5 6 7 8`;
 await dialog.locator('input[type=file]').first().setInputFiles({name:'Stage-reference-with-a-very-long-file-name-for-a-large-production-design-and-full-stage-context.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.locator('.model-preview canvas').waitFor();assert(await commit.isDisabled());await dialog.getByLabel('Source units',{exact:true}).selectOption('m');const previewCanvas=await dialog.locator('.model-preview canvas').elementHandle();
 const dimensionsBefore=await dialog.locator('.model-dimensions').textContent();
 for(const checked of [false,true,false,true,false]){
  await dialog.getByLabel('Import model hierarchy',{exact:true}).setChecked(checked);
  assert.equal(await dialog.getByLabel('Import model hierarchy',{exact:true}).isChecked(),checked);
  assert(await previewCanvas.evaluate(e=>e.isConnected&&e===document.querySelector('.model-preview canvas')),'Hierarchy toggle must retain the preview renderer and camera');
  assert.equal(await dialog.locator('.model-dimensions').textContent(),dimensionsBefore);
 }
 const savedModels=async()=>{
  await page.getByRole('button',{name:'File',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save As…',exact:true}).click();
  const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8')).simulation.models;
 };

 assert.deepEqual(await dialog.locator('.model-dimensions dd').allTextContents(),['4.000','3.000','2.000']);assert(!(await commit.isDisabled()));
 await page.screenshot({path:'work/v080-local/import-dialog-ready.png'});
 for(const width of [1024,700]){await page.setViewportSize({width,height:680});await page.waitForTimeout(100);assert(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;}));assert(await commit.evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.right<=innerWidth;}));const canvas=dialog.locator('.model-preview canvas');assert(await canvas.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return Math.abs(r.width-p.width)<2&&Math.abs(r.height-p.height)<2;}));await page.screenshot({path:`work/v080-local/import-dialog-${width}.png`});}
 await page.setViewportSize({width:1500,height:1000});await commit.click();await dialog.waitFor({state:'detached'});assert.equal(await page.getByRole('tree',{name:'Imported models'}).count(),1);
 assert.equal((await savedModels())[0].hierarchy,false,'Import commits the latest off choice');
 await page.getByRole('button',{name:'Import Model…',exact:true}).click();await dialog.locator('input[type=file]').first().setInputFiles({name:'invalid.obj',mimeType:'text/plain',buffer:Buffer.from('not a model')});await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.getByRole('alert').waitFor();assert(await commit.isDisabled());await dialog.getByRole('button',{name:'Close import',exact:true}).click();assert.equal(await page.getByRole('tree',{name:'Imported models'}).count(),1);await page.getByRole('button',{name:'Import Model…',exact:true}).click();
 const archive=zipSync({'GeneralSceneDescription.xml':strToU8('<GeneralSceneDescription verMajor="1" verMinor="6"><Scene><Layers><Layer name="Stage"><ChildList><SceneObject name="Screen"><Geometries><Geometry3D fileName="mesh.glb"/></Geometries></SceneObject></ChildList></Layer></Layers></Scene></GeneralSceneDescription>'),'mesh.glb':glb});
 await dialog.locator('input[type=file]').first().setInputFiles({name:'stage.mvr',mimeType:'application/zip',buffer:Buffer.from(archive)});await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.getByText('Automatic',{exact:true}).waitFor();assert.equal(await dialog.getByRole('combobox',{name:'Source units',exact:true}).count(),0);assert.equal(await dialog.getByText('Millimetres',{exact:true}).count(),1);assert(!(await commit.isDisabled()));await commit.click();await dialog.waitFor({state:'detached'});assert.equal((await savedModels()).at(-1).hierarchy,true,'Default hierarchy remains enabled on import');
 await page.getByRole('button',{name:'Import Model…',exact:true}).click();
 await dialog.locator('input[type=file]').first().setInputFiles({name:'Stage reference.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.getByLabel('Source units',{exact:true}).selectOption('m');await page.waitForTimeout(150);await dialog.screenshot({path:'work/v080-local/import-dialog-review.png'});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('Import dialog layout, long names, responsive preview, explicit units, hierarchy toggle, import and error/cancel passed.');
}finally{await browser.close();}
