import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {_electron}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-startup-'));
const documents=path.join(scratch,'Documents'),projects=path.join(documents,'OpticMesh','Projects');
await fs.mkdir(projects,{recursive:true});
const startup=path.join(projects,'Startup Project.lo2s');
await fs.writeFile(startup,JSON.stringify({format:'opticmesh-project',version:3,workspaceMode:'simulation',config:{project:'Startup regression'},rawXml:await fs.readFile(new URL('./fixtures/six-screen-regression.xml',import.meta.url),'utf8'),simulation:{source:'spout',sourceOverrides:{},quality:'quality'}}));
const wrapper=path.join(scratch,'main.cjs');
await fs.writeFile(wrapper,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.setPath('documents',${JSON.stringify(documents)});delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
for(let boot=0;boot<2;boot++){
 const app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'Scene hierarchy',exact:true}).waitFor();
  assert(page.url().startsWith('file:'));
  assert.equal(await page.locator('.hierarchy-row.child').count(),6);
  const inspector=page.locator('aside[class*="inspector"]').last(),source=inspector.locator(':scope > nav').getByRole('button',{name:/^source$/i});
  await source.click();assert.equal(await page.getByRole('combobox',{name:'Global feed',exact:true}).inputValue(),'pattern');
  if(boot===0){
   await page.getByRole('combobox',{name:'Global feed',exact:true}).selectOption('ndi');
   await page.getByText('Latest changes autosaved',{exact:true}).waitFor();
   let saved;for(let i=0;i<30;i++){saved=JSON.parse(await fs.readFile(startup,'utf8'));if(saved.simulation.source==='ndi')break;await page.waitForTimeout(100);}
   assert.equal(saved.simulation.source,'ndi');assert.equal(saved.workspaceMode,'simulation');
  }
  assert.deepEqual(errors,[]);
 }finally{await app.close();}
}
console.log('Actual desktop startup and reopen: Scene inspector visible, all six slices restored, saved NDI/Spout replaced by Pattern Generator.');
