import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1700,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/');await page.waitForTimeout(1000);await page.getByRole('button',{name:'3D',exact:true}).click();await page.evaluate(()=>{window.testHardware={cpuPercent:10,systemCpuPercent:82,appMemoryBytes:1073741824,systemMemoryTotalBytes:16*1073741824,systemMemoryUsedBytes:15.5*1073741824,gpus:[{index:0,name:'Example GPU',utilizationPercent:92,memoryUsedBytes:7*1073741824,memoryTotalBytes:8*1073741824}]};window.lo2sDesktop={getSystemPerformance:async()=>({...window.testHardware,sampledAt:Date.now()-(window.staleHardware?10000:0)})};});
 await page.getByRole('button',{name:'Performance',exact:true}).click();const panel=page.getByRole('region',{name:'Render performance'});
 const reading=label=>panel.locator(`[data-metric="${label}"] [data-performance-state]`);

 await reading('CPU \u00b7 system').filter({hasText:'Attention'}).waitFor();assert.equal(await reading('CPU \u00b7 app').getAttribute('data-performance-state'),'normal');assert.equal(await reading('RAM \u00b7 system').getAttribute('data-performance-state'),'critical');assert.equal(await reading('GPU 0 usage').getAttribute('data-performance-state'),'warning');assert.equal(await reading('GPU 0 VRAM').getAttribute('data-performance-state'),'warning');
 assert.equal(await reading('CPU \u00b7 system').evaluate(e=>getComputedStyle(e).color),'rgb(255, 189, 99)');assert.equal(await reading('RAM \u00b7 system').evaluate(e=>getComputedStyle(e).color),'rgb(255, 104, 104)');assert.match(await reading('RAM \u00b7 system').textContent(),/96.9%/);assert.match(await reading('GPU 0 VRAM').textContent(),/87.5%/);
 await page.evaluate(()=>{window.testHardware.cpuPercent=96;window.testHardware.systemCpuPercent=20;window.testHardware.gpus[0].utilizationPercent=20;window.testHardware.gpus[0].memoryUsedBytes=7.8*1073741824;});
 await reading('CPU \u00b7 app').filter({hasText:'High pressure'}).waitFor();assert.equal(await reading('CPU \u00b7 system').getAttribute('data-performance-state'),'normal');assert.equal(await reading('GPU 0 usage').getAttribute('data-performance-state'),'normal');assert.equal(await reading('GPU 0 VRAM').getAttribute('data-performance-state'),'critical');assert.equal(await reading('App memory \u00b7 private').getAttribute('data-performance-state'),'unrated');
 await page.waitForTimeout(1200);assert.match(await reading('Viewport redraws / s').textContent(),/Idle/);assert.equal(await reading('Viewport redraws / s').getAttribute('data-performance-state'),'unrated');
 await page.screenshot({path:'work/v080-local/performance-pressure.png'});
 await page.setViewportSize({width:1100,height:900});assert(await panel.evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>window.staleHardware=true);await reading('CPU \u00b7 app').filter({hasText:'Unavailable'}).waitFor();assert.equal(await reading('CPU \u00b7 app').getAttribute('data-performance-state'),'unrated');
 assert.deepEqual(errors,[]);console.log('Semantic pressure colours, independent GPU/VRAM, percentages, recovery, stale data, idle state and narrow layout passed.');
}finally{await browser.close();}
