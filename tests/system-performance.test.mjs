import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import os from 'node:os';import {UiCadence} from '../app/system-performance.ts';
const {createSystemPerformance,parseGpuCsv}=createRequire(import.meta.url)('../desktop/system-performance.cjs');
test('UI cadence tracks idle callbacks and stall intervals without pretending to render',()=>{
 const probe=new UiCadence(0);for(let i=0;i<=60;i++)probe.record(i*1000/60);
 assert(Math.abs(probe.snapshot(1000).fps-60)<2);probe.record(1250);assert.equal(probe.snapshot(1250).peakMs,250);assert(probe.snapshot(1250).fps<60);
 probe.reset(2000);assert.equal(probe.snapshot(2100).fps,null);
});
test('GPU telemetry preserves unavailable fields instead of reporting zero',()=>{
 const [gpu]=parseGpuCsv('0, Example GPU, 42, 1024, 8192');assert.equal(gpu.utilizationPercent,42);assert.equal(gpu.memoryUsedBytes,1073741824);
 assert.equal(parseGpuCsv('1, Another GPU, [N/A], [N/A], 4096')[0].memoryUsedBytes,null);assert.throws(()=>parseGpuCsv('malformed'));
});
test('Hardware sampler controls its interval, normalizes CPU, caches and retries missing telemetry slowly',async t=>{
 t.mock.timers.enable({apis:['Date'],now:10000});let seconds=2,gpuCalls=0;
 const sample=createSystemPerformance(()=>[{pid:1,creationTime:1,cpu:{cumulativeCPUUsage:seconds},memory:{privateBytes:1024}}],async()=>{gpuCalls++;throw new Error('unsupported');});
 assert.equal((await sample()).cpuPercent,null);assert.equal((await sample()).appMemoryBytes,1048576);assert.equal(gpuCalls,1);
 t.mock.timers.tick(1000);seconds+=1;const next=await sample();assert(Math.abs(next.cpuPercent-100/os.cpus().length)<1e-6);assert.equal(next.gpus,null);assert.equal(gpuCalls,1);
 t.mock.timers.tick(6000);assert.equal((await sample()).cpuPercent,null,'Long inactive gap starts a fresh baseline');
 t.mock.timers.tick(30000);await sample();assert.equal(gpuCalls,2);
});
