import { editorWindow, closeTestApp } from "./desktop-test-helpers.mjs";
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const {chromium,_electron}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const root=fileURLToPath(new URL('../',import.meta.url)),native=process.env.OPTICMESH_TEST_DESKTOP==='1';let browser,app,page;
if(native){
 const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'opticmesh-performance-'));await fs.mkdir(path.join(scratch,'Documents'));
 const wrapper=path.join(scratch,'main.cjs');
 await fs.writeFile(wrapper,`const {app,ipcMain}=require('electron');app.setPath('userData',${JSON.stringify(path.join(scratch,'profile'))});app.setPath('documents',${JSON.stringify(path.join(scratch,'Documents'))});process.env.OPTICMESH_DEV_URL='http://localhost:3000/';global.performanceRequests=0;const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,callback)=>handle(channel,channel==='performance:snapshot'? (...args)=>{global.performanceRequests++;return callback(...args);}:callback);require(${JSON.stringify(path.join(root,'desktop/electron-main.cjs'))});`);
 app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[wrapper]});page=await editorWindow(app);
}else{browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1500,height:1000}});await page.goto('http://localhost:3000/');}
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.waitForTimeout(1000);
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.getByRole('button',{name:'Performance',exact:true}).click();
 const panel=page.getByRole('region',{name:'Render performance'}),value=label=>panel.locator('dl > div').filter({has:page.locator('dt').filter({hasText:new RegExp(`^${label}$`)})}).locator('dd');
 await page.waitForTimeout(4200);
 assert(parseFloat(await value('UI FPS').textContent())>10,'UI cadence continues while scene is idle');
 assert.equal(await value('Viewport redraws / s').textContent(),'Idle');
 if(native){
  const samples=await page.evaluate(()=>window.lo2sDesktop.getSystemPerformance());console.log('Actual desktop readings:',samples);
  assert(samples.cpuPercent>=0&&samples.cpuPercent<=100);assert(samples.systemCpuPercent>=0&&samples.systemCpuPercent<=100);assert(samples.appMemoryBytes>0);assert(samples.systemMemoryTotalBytes>samples.systemMemoryUsedBytes);
  if(samples.gpus?.length){assert(samples.gpus[0].memoryTotalBytes>0);assert(samples.gpus[0].memoryUsedBytes>0);}
 }else assert.equal(await value('CPU · app').textContent(),'Desktop only');
 await page.evaluate(()=>{const end=performance.now()+220;while(performance.now()<end){/* Deliberate main-thread stall validates the cadence probe. */}});
 await page.waitForTimeout(550);assert(parseFloat(await value('UI frame · peak').textContent())>=150,'UI gap detects stalled main thread');
 await page.screenshot({path:`work/v080-local/performance-${native?'desktop':'browser'}.png`});
 await page.getByRole('button',{name:'Validation',exact:false}).first().click();
 if(native){await page.waitForTimeout(300);const before=await app.evaluate(()=>global.performanceRequests);await page.waitForTimeout(2200);assert.equal(await app.evaluate(()=>global.performanceRequests),before,'Closing the panel stops native polling');}
 assert.deepEqual(errors,[]);console.log('Performance live cadence, idle rendering, stall detection and telemetry lifecycle passed.');
}finally{if(app)await closeTestApp(app);if(browser)await browser.close();}
