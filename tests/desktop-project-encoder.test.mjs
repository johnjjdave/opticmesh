import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
const { DesktopProjectEncoder } = createRequire(import.meta.url)('../desktop/project-encoder.cjs');
const delta = (set = {}, remove = []) => ({ set, remove });
const initial = (extra = {}) => ({ reset: true, project: delta({ format: 'opticmesh-project', version: 4, ...extra }), simulation: delta({ models: [], camera: { position: [1, 2, 3] } }) });
const decode = bytes => JSON.parse(bytes.toString('utf8'));

test('desktop worker retains assets for camera deltas and clears replaced projects', async () => {
  const encoder = new DesktopProjectEncoder();
  try {
    const first = initial({ logo: 'old', title: 'Stage — 道' });
    first.simulation.set.models = [{ id: 'stage', geometries: { data: 'A'.repeat(8 * 1024 * 1024) } }];
    const pending = encoder.encode(first);
    await assert.rejects(encoder.encode(first), /already in progress/);
    assert.equal(decode(await pending).title, 'Stage — 道');
    const patch = { reset: false, project: delta(), simulation: delta({ camera: { position: [4, 5, 6] } }) };
    const saved = decode(await encoder.encode(patch));
    assert.deepEqual(saved.simulation.camera.position, [4, 5, 6]);
    assert.equal(saved.simulation.models[0].geometries.data.length, 8 * 1024 * 1024);
    const next = decode(await encoder.encode({ reset: false, project: delta({}, ['logo']), simulation: delta({ models: [] }, ['camera']) }));
    assert(!('logo' in next)); assert(!('camera' in next.simulation)); assert.deepEqual(next.simulation.models, []);
    const fresh = decode(await encoder.encode(initial()));
    assert(!('title' in fresh)); assert.deepEqual(fresh.simulation.models, []);
  } finally { encoder.dispose(); }
});

test('desktop worker rejects invalid state, schema and oversized output, then accepts a full retry', async () => {
  const encoder = new DesktopProjectEncoder();
  try {
    await assert.rejects(encoder.encode({ reset: false, project: delta(), simulation: delta() }), /complete project snapshot/);
    await assert.rejects(encoder.encode(initial({ format: 'other' })), /not a LO2S/);
    await assert.rejects(encoder.encode(initial({ version: 999 })), /unsupported schema/);
    await assert.rejects(encoder.encode(initial({ asset: 'A'.repeat(193 * 1024 * 1024) })), /192 MiB/);
    assert.equal(decode(await encoder.encode(initial())).version, 4);
    encoder.dispose();
    assert.equal(decode(await encoder.encode(initial())).format, 'opticmesh-project');
  } finally { encoder.dispose(); }
});
