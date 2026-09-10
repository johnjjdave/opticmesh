import {createRequire} from 'node:module';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {editorWindow,closeTestApp} from './desktop-test-helpers.mjs';
const {_electron}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=process.cwd(),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-navigation-'));
const preload=path.join(scratch,'preload.cjs'),wrapper=path.join(scratch,'main.cjs');
await fs.writeFile(preload,`const {contextBridge}=require('electron');const addon=require(${JSON.stringify(process.env.SPACEMOUSE_ADDON_PATH || path.join(root,'desktop/native/lo2s-spacemouse.node'))});require.cache[${JSON.stringify(path.join(root,'desktop/native/lo2s-spacemouse.node'))}]={exports:addon};const stats={opens:0,connected:false,active:false,last:null,frames:0};let queued=null;for(const name of ['open','sync','focus','poll']){const original=addon[name];addon[name]=(...args)=>{if(name==='open'){stats.opens++;stats.last=args[0];const result=original(...args);stats.connected=result;return result;}if(name==='sync')stats.last=args[0];if(name==='focus')stats.active=args[0];if(name==='poll'&&queued){const frame=queued;queued=null;stats.frames++;addon.sync({...stats.last,matrix:frame.matrix,extents:frame.extents,target:frame.target || stats.last.target});return frame;}return original(...args);};}contextBridge.exposeInMainWorld('__deviceTest',{stats:()=>stats,navigation:()=>addon.navigationState(),roll:()=>{const matrix=[...stats.last.matrix],c=Math.cos(.7),s=Math.sin(.7);for(let i=0;i<3;i++){matrix[i]=c*stats.last.matrix[i]+s*stats.last.matrix[4+i];matrix[4+i]=-s*stats.last.matrix[i]+c*stats.last.matrix[4+i];}queued={matrix,extents:stats.last.extents,target:stats.last.target};},move:()=>{const matrix=[...stats.last.matrix];matrix[12]+=2;queued={matrix,extents:stats.last.extents};}});require(${JSON.stringify(path.join(root,'desktop/preload.cjs'))});`);
await fs.writeFile(wrapper,`const electron=require('electron'),Module=require('module');electron.app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});electron.app.setPath('documents',${JSON.stringify(scratch)});const original=Module._load,childProcess=require('node:child_process'),{EventEmitter}=require('node:events');global.__deviceSettingsLaunches=[];const Wrapped=function(options){if(options.webPreferences?.preload===${JSON.stringify(path.join(root,'desktop/preload.cjs'))})options.webPreferences.preload=${JSON.stringify(preload)};return new electron.BrowserWindow(options);};Wrapped.getAllWindows=electron.BrowserWindow.getAllWindows;Wrapped.fromWebContents=electron.BrowserWindow.fromWebContents;Wrapped.fromId=electron.BrowserWindow.fromId;Module._load=function(name,...args){if(name==='node:child_process')return {...childProcess,spawn:(file,args,options)=>{if(file.endsWith('3DxService.exe')){global.__deviceSettingsLaunches.push({file,args});const child=new EventEmitter();child.unref=()=>{};process.nextTick(()=>child.emit('spawn'));return child;}return childProcess.spawn(file,args,options);}};return name==='electron'?{...electron,BrowserWindow:Wrapped}:original.call(this,name,...args);};delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
const app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
try{const page=await editorWindow(app);await page.getByRole('button',{name:'Guide',exact:true}).waitFor();await page.waitForTimeout(700);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')).focus());
 const stats=()=>page.evaluate(()=>window.__deviceTest.stats());assert.equal((await stats()).opens,0,'Patterns does not open device');
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForFunction(()=>window.__deviceTest.stats().active);assert((await stats()).connected,'Real installed driver connected in main viewport');
 const before=(await stats()).last.matrix;await page.evaluate(()=>window.__deviceTest.move());await page.waitForFunction(()=>window.__deviceTest.stats().frames>0);await page.waitForTimeout(600);
 let saved;for(let i=0;i<30;i++){saved=JSON.parse(await fs.readFile(path.join(scratch,'OpticMesh/Projects/Startup Project.lo2s'),'utf8'));if(saved.simulation.camera)break;await page.waitForTimeout(100);}assert(Math.abs(saved.simulation.camera.position[0]-before[12]-2)<1e-5,'Device pose updates persisted camera');
 const surface=page.locator('.three-view-surface').first();const box=await surface.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-120);await page.waitForTimeout(350);assert.notDeepEqual((await stats()).last.matrix,before,'Regular wheel continues working');
 // Import an off-origin reference and verify selection context reaches the driver without a camera gesture.
 await page.getByRole('button',{name:'Import Model…',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.locator('input[type=file]').first().setInputFiles({name:'offset-navigation.obj',mimeType:'text/plain',buffer:Buffer.from('o Stage\nv 100 0 0\nv 110 0 0\nv 100 5 0\nf 1 2 3')});
 await dialog.getByRole('button',{name:'Read model',exact:true}).click();await dialog.getByRole('combobox',{name:'Source units',exact:true}).selectOption('m');
 await dialog.getByRole('button',{name:'Import into scene',exact:true}).click();await dialog.waitFor({state:'detached'});
 await page.waitForFunction(()=>Math.abs(window.__deviceTest.stats().last.pivot[0]-105)<.01);
 await page.getByRole('treeitem').filter({hasText:'offset-navigation.obj'}).click();
 await page.waitForFunction(()=>window.__deviceTest.stats().last.selectionBounds.length===6);
 assert.deepEqual((await stats()).last.selectionBounds,[100,0,0,110,5,0]);
 assert.deepEqual((await stats()).last.pivot,[105,2.5,0]);
 const locked=await page.evaluate(()=>window.__deviceTest.navigation());assert.equal(locked.fixedPivot,true,'Real navlib locks to the selected reference');assert.deepEqual(locked.pivot,[105,2.5,0]);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-120);await page.waitForTimeout(200);
 assert.deepEqual((await page.evaluate(()=>window.__deviceTest.navigation())).pivot,[105,2.5,0],'Mouse zoom cannot replace the selected driver pivot');
 await page.getByRole('treeitem').filter({hasText:'offset-navigation.obj'}).click({modifiers:['Control']});
 await page.waitForFunction(()=>window.__deviceTest.stats().last.selectionBounds.length===0);
 assert.equal((await page.evaluate(()=>window.__deviceTest.navigation())).fixedPivot,false,'Clearing selection restores automatic driver pivot');
 // Both Fit Scene and its F shortcut clear a device-rolled camera.
 const cameraPose=async()=>JSON.parse(await fs.readFile(path.join(scratch,'OpticMesh/Projects/Startup Project.lo2s'),'utf8')).simulation.camera;
 for(const keyboard of [false,true]){
  const frames=(await stats()).frames;await page.evaluate(()=>window.__deviceTest.roll());await page.waitForFunction(n=>window.__deviceTest.stats().frames>n,frames);await page.waitForTimeout(900);
  assert.notDeepEqual((await cameraPose()).up,[0,1,0]);
  if(keyboard){await surface.focus();await page.keyboard.press('f');}else await page.getByRole('button',{name:'Fit Scene',exact:true}).first().click();
  await page.waitForTimeout(900);assert.deepEqual((await cameraPose()).up,[0,1,0]);
 }
 await page.getByRole('button',{name:'Tools',exact:true}).click();await page.getByRole('button',{name:'3Dconnexion Settings…',exact:true}).click();
 let launches=[];for(let i=0;i<30;i++){launches=await app.evaluate(()=>global.__deviceSettingsLaunches);if(launches.length)break;await page.waitForTimeout(100);}assert.deepEqual(launches[0]?.args,['-showGUI']);
 await page.getByRole('button',{name:'Pixel Map',exact:true}).click();await page.waitForFunction(()=>!window.__deviceTest.stats().active);
 await page.getByRole('button',{name:'Tools',exact:true}).click();assert.equal(await page.getByRole('button',{name:'3Dconnexion Settings…',exact:true}).count(),0);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForFunction(()=>window.__deviceTest.stats().active);
 await page.getByRole('button',{name:'Output',exact:true}).click();const opened=app.waitForEvent('window');await page.getByRole('button',{name:'Floating Preview',exact:true}).click();const preview=await opened;await preview.getByRole('region',{name:'Floating Preview',exact:true}).waitFor();assert.equal(await preview.evaluate(()=>!!window.lo2sDesktop?.spaceMouse),false,'Floating Preview has no SpaceMouse interface');
 console.log('Desktop viewport: driver connection, camera save, normal mouse, model selection/clearing, workspace routing and windowed exclusion passed.');
}finally{await closeTestApp(app);}
