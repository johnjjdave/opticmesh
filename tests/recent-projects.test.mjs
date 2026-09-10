import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRecentProjects } from '../desktop/recent-projects.cjs';

test('recent projects persist six unique paths in most recently used order', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-recents-'));
  const file = path.join(dir, 'profile/recent-projects.json');
  try {
    const store = createRecentProjects(file);
    assert.deepEqual(await store.list(), []);
    const projects = Array.from({ length: 8 }, (_, i) => path.join(dir, `Show ${i}.lo2s`));
    await Promise.all(projects.map(project => store.remember(project)));
    assert.deepEqual((await store.list()).map(item => item.path), projects.slice(2).reverse());
    await store.remember(projects[3]);
    await store.remember(projects[3].toUpperCase());
    const restarted = createRecentProjects(file);
    const entries = await restarted.list();
    assert.equal(entries.length, 6);
    assert.equal(entries[0].path, projects[3].toUpperCase());
    assert.equal(entries[0].name, 'SHOW 3.LO2S');
    assert.equal(new Set(entries.map(item => item.path.toLowerCase())).size, 6);
    await store.remember(path.join(dir, 'model.fbx'));
    assert.deepEqual(await store.list(), entries);
    await fs.writeFile(file, 'broken JSON');
    assert.deepEqual(await restarted.list(), []);
    await restarted.remember(projects[0]);
    assert.equal((await restarted.list())[0].path, projects[0]);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
