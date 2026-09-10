import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const {_electron}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=process.cwd(),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-device-'));
const wrapper=path.join(scratch,'main.cjs');
await fs.writeFile(wrapper,`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({show:false,webPreferences:{preload:${JSON.stringify(path.join(root,'desktop/preload.cjs'))},contextIsolation:true,sandbox:false}});w.loadURL('data:text/html,<h1>Device connection test</h1>');});`);
const app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});
try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.lo2sDesktop);const result=await page.evaluate(()=>{const b=window.lo2sDesktop.spaceMouse;const state={matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,10,1],target:[0,0,0],pivot:[0,5,0],selectionBounds:[-2,3,-1,2,7,1],bounds:[-5,0,-5,5,10,5],extents:[-4,-3,-500,4,3,-.01],frustum:[-.01,.01,-.01,.01,.01,500],plane:[0,1,0,0],perspective:true,distance:10};const opened=b.open(state);if(opened){b.sync(state);b.focus(false);}const idle=b.poll();b.close();const reopened=b.open(state);b.close();return {opened,idle,reopened};});assert.equal(result.opened,true,'Installed 3DxWare navigation library connects');assert.equal(result.idle,null);assert.equal(result.reopened,true);console.log('Native SpaceMouse driver open/sync/inactive/reconnect/close passed.');}finally{await app.close();}
