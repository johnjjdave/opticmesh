import { editorWindow, closeTestApp } from "./desktop-test-helpers.mjs";
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {_electron}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-delta-'));
await fs.mkdir(path.join(scratch,'Documents'));
const wrapper=path.join(scratch,'main.cjs');
await fs.writeFile(wrapper,`const {app,BrowserWindow}=require('electron');BrowserWindow.prototype.show=function(){};app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.setPath('documents',${JSON.stringify(path.join(scratch,'Documents'))});process.env.OPTICMESH_DEV_URL='http://localhost:3000/';require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
const app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
try{
 const page=await editorWindow(app);await page.getByText('Latest changes autosaved',{exact:true}).waitFor();
 const result=await page.evaluate(async()=>{
  const bridge=window.lo2sDesktop,delta=(set={},remove=[])=>({set,remove});
  const first={reset:true,project:delta({format:'opticmesh-project',version:4,testAsset:'A'.repeat(8*1024*1024)}),simulation:delta({models:[],camera:{position:[1,2,3]}})};
  const saved=await bridge.autosaveProjectDelta(first);
  const moved=await bridge.autosaveProjectDelta({reset:false,project:delta(),simulation:delta({camera:{position:[4,5,6]}})});
  const restored=await bridge.loadStartupProject();
  const document=JSON.parse(restored.content);
  return {saved,moved,restored:restored.ok,position:document.simulation.camera.position,assetBytes:document.testAsset.length};
 });
 assert(result.saved.ok,result.saved.error);assert(result.moved.ok,result.moved.error);assert(result.restored);
 assert.deepEqual(result.position,[4,5,6]);assert.equal(result.assetBytes,8*1024*1024);
 const backup=JSON.parse(await fs.readFile(path.join(scratch,'Documents','OpticMesh','Projects','Startup Project.previous.lo2s'),'utf8'));
 assert.deepEqual(backup.simulation.camera.position,[1,2,3]);assert.equal(backup.testAsset.length,result.assetBytes);
 console.log('Real desktop delta bridge: camera patch, unchanged asset, startup restore and previous recovery file passed.');
}finally{await closeTestApp(app);}
