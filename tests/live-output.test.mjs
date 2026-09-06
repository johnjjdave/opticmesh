import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationOutputSize } from '../app/live-output.ts';

test('3D output caps either composition axis before capture without upscaling', () => {
  for (const [source, expected] of [
    [[7680, 4320], [2048, 1152]], [[4320, 7680], [1152, 2048]],
    [[3940, 2710], [2048, 1409]], [[32000, 32000], [2048, 2048]],
    [[640, 360], [640, 360]], [[100000, 1], [2048, 1]],
  ]) {
    const actual = simulationOutputSize(...source);
    assert.deepEqual([actual.width, actual.height], expected);
  }
  assert.deepEqual(simulationOutputSize(7680, 4320, 1024), { width: 1024, height: 576 });
  assert.deepEqual(simulationOutputSize(NaN, Infinity), { width: 1, height: 1 });
});
