import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationOutputSize } from '../app/live-output.ts';

test('fixed 1080p 3D output rejects unsupported GPU allocation without resizing the stream', () => {
  for (const limit of [2048, 4096, 16384, Infinity]) assert.deepEqual(simulationOutputSize(limit), { width: 1920, height: 1080 });
  for (const limit of [1024, 0, NaN]) assert.throws(() => simulationOutputSize(limit), /cannot capture 1920 × 1080/);
});
