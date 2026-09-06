import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderPerformance, createGpuTimer } from '../app/render-performance.ts';

test('redraw rate and CPU statistics use a rolling window, retain last draw at idle, and reset', () => {
  const metrics = new RenderPerformance(); metrics.reset(0);
  const work = { width: 100, height: 50, calls: 12, triangles: 40 };
  metrics.record(2, work, 100); metrics.record(8, work, 400);
  const live = metrics.snapshot(1000);
  assert.equal(live.fps, 2); assert.equal(live.cpuMs, 5); assert.equal(live.maxCpuMs, 8);
  assert.equal(live.last.calls, 12);
  const idle = metrics.snapshot(1500);
  assert.equal(idle.fps, 0); assert.equal(idle.cpuMs, null); assert.equal(idle.last.cpuMs, 8);
  metrics.record(NaN, work, 1501); assert.equal(metrics.snapshot(1501).frames, 0);
  metrics.reset(1600); assert.equal(metrics.snapshot(1601).last, null);
});

function fakeGl(supported = true) {
  const state = { available: false, disjoint: false, lost: false, deleted: 0, results: 0, began: 0, ended: 0 };
  return { state, gl: {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, CURRENT_QUERY: 3,
    getExtension: () => supported ? { TIME_ELAPSED_EXT: 4, GPU_DISJOINT_EXT: 5 } : null,
    createQuery: () => ({}), deleteQuery: () => state.deleted++,
    isContextLost: () => state.lost, getParameter: () => state.disjoint, getQuery: () => null,
    beginQuery: () => state.began++, endQuery: () => state.ended++,
    getQueryParameter: (_query, key) => { if (key === 1) return state.available; state.results++; return 2500000; },
  } };
}

test('GPU queries are asynchronous, bounded, converted from ns and discarded on disjoint/loss', () => {
  const metrics = new RenderPerformance(), { gl, state } = fakeGl();
  const timer = createGpuTimer(gl, metrics);
  timer.begin(1); timer.end(); timer.begin(2); timer.poll(3);
  assert.equal(state.began, 1); assert.equal(state.results, 0);
  state.available = true; timer.poll(4);
  assert.equal(metrics.snapshot(4).gpu.ms, 2.5); assert.equal(state.deleted, 1);
  timer.begin(5); timer.end(); state.disjoint = true; timer.poll(6);
  assert.equal(metrics.snapshot(6).gpu, null); assert.equal(state.results, 1);
  state.disjoint = false; timer.begin(7); timer.end(); state.lost = true; timer.poll(8);
  assert.equal(metrics.snapshot(8).gpuStatus, 'lost'); assert.equal(state.results, 1);
  state.lost = false; timer.restore(); assert.equal(metrics.snapshot(9).gpuStatus, 'pending');
  timer.begin(10); timer.end(); timer.dispose(); assert.equal(state.deleted, 4);
});

test('unsupported and timed-out GPU measurements stay unavailable without waiting', () => {
  const metrics = new RenderPerformance(), unsupported = fakeGl(false);
  const timer = createGpuTimer(unsupported.gl, metrics); timer.begin(1); timer.end(); timer.poll(3);
  assert.equal(metrics.snapshot().gpuStatus, 'unsupported'); assert.equal(unsupported.state.began, 0);
  const { gl, state } = fakeGl(), supported = createGpuTimer(gl, metrics);
  supported.begin(1); supported.end(); supported.poll(2002);
  assert.equal(state.deleted, 1); assert.equal(state.results, 0);
  assert.equal(metrics.snapshot().gpu, null);
});
