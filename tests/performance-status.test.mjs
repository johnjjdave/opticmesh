import test from 'node:test';import assert from 'node:assert/strict';import {usageLevel,memoryPercent,fpsLevel} from '../app/performance-status.ts';
test('pressure thresholds cover boundaries and keep missing data unrated',()=>{
 for(const value of [null,undefined,NaN,Infinity,-1,101])assert.equal(usageLevel(value),null);
 assert.equal(usageLevel(0),'normal');assert.equal(usageLevel(79.99),'normal');assert.equal(usageLevel(80),'warning');assert.equal(usageLevel(94.99),'warning');assert.equal(usageLevel(95),'critical');assert.equal(usageLevel(100),'critical');
 assert.equal(usageLevel(89.99,90,98),'normal');assert.equal(usageLevel(90,90,98),'warning');assert.equal(usageLevel(98,90,98),'critical');
 assert.equal(memoryPercent(8,10),80);assert.equal(memoryPercent(0,10),0);for(const pair of [[null,10],[1,null],[1,0],[-1,10],[11,10],[Infinity,10]])assert.equal(memoryPercent(...pair),null);
 for(const value of [null,undefined,NaN,Infinity,-1])assert.equal(fpsLevel(value),null);assert.equal(fpsLevel(0),'critical');assert.equal(fpsLevel(24.99),'critical');assert.equal(fpsLevel(25),'warning');assert.equal(fpsLevel(44.99),'warning');assert.equal(fpsLevel(45),'normal');assert.equal(fpsLevel(144),'normal');
});
