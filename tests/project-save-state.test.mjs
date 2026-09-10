import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsavedProjectChanges } from '../app/project-save-state.ts';
test('exit safety tracks saved content independently of recovery autosave and navigation', () => {
  const geometry = new Proxy({}, { ownKeys() { throw new Error('Unchanged geometry should not be scanned'); } });
  const saved = { config: { project: 'Show' }, workspaceMode: 'patterns', simulation: { models: [{ geometry, name: 'Stage' }], camera: { position: [0, 0, 10] }, tool: 'translate' } };
  assert.equal(hasUnsavedProjectChanges(saved, saved), false);
  assert.equal(hasUnsavedProjectChanges(null, saved), true);
  assert.equal(hasUnsavedProjectChanges(saved, { ...saved, workspaceMode: 'simulation', simulation: { ...saved.simulation, camera: { position: [5, 2, 10] }, tool: 'rotate' } }), false);
  assert.equal(hasUnsavedProjectChanges(saved, { ...saved, config: { project: 'Another Show' } }), true);
  assert.equal(hasUnsavedProjectChanges(saved, { ...saved, simulation: { ...saved.simulation, models: [{ geometry, name: 'Renamed stage' }] } }), true);
  assert.equal(hasUnsavedProjectChanges(saved, { ...saved, simulation: { ...saved.simulation, models: [] } }), true);
});
