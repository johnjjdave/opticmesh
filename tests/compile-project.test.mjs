import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import compile from '../desktop/compile-project.cjs';
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const project = JSON.stringify({ format: 'opticmesh-project', version: 3, config: { project: 'Original' }, rawXml: '<xml>Exact source</xml>', simulation: { snapEnabled: true } });
test('compiled folder contains named project/XML and all maps without overwriting an existing job', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-compile-test-'));
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  try {
    const payload = { project, files: [{ filename: 'Input Map.png', data: png }, { filename: 'Output 001 - Main.png', data: png }, { filename: 'Output 002 - Main.png', data: png }] };
    const target = path.join(root, 'My Show');
    const result = await compile.writeCompiledProject(target, payload);
    assert.equal(result.count, 5);
    assert.equal(await fs.readFile(path.join(target, 'My Show.xml'), 'utf8'), '<xml>Exact source</xml>');
    const saved = JSON.parse(await fs.readFile(path.join(target, 'My Show.lo2s'), 'utf8'));
    assert.equal(saved.config.project, 'My Show'); assert.equal(saved.xmlName, 'My Show.xml'); assert.equal(saved.simulation.snapEnabled, true);
    await assert.rejects(compile.writeCompiledProject(target, payload), { code: 'EEXIST' });
    assert.equal((await fs.readdir(target)).length, 5);
    await assert.rejects(compile.writeCompiledProject(path.join(root, 'Bad'), { project, files: [{ filename: '../escape.png', data: png }] }), /Invalid/);
    await assert.rejects(fs.stat(path.join(root, 'Bad')), { code: 'ENOENT' });
    for (const name of ['..', 'CON', 'Job.', 'a/b', 'a\\b']) assert.throws(() => compile.validateName(name));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('native compile IPC presents the filename Save dialog and cancellation never writes', async () => {
  const source = await fs.readFile(new URL('../desktop/electron-main.cjs', import.meta.url), 'utf8');
  const handlerSource = source.slice(source.indexOf('  ipcMain.handle("project:compile"'), source.indexOf('  ipcMain.handle("export:save-batch"'));
  let handler, options, writes = 0, cancelled = true;
  vm.runInNewContext(handlerSource, {
    path,
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    ensureWorkspaceDirectories: async () => ({ projects: path.resolve('Example Projects') }),
    dialog: { showSaveDialog: async settings => { options = settings; return cancelled ? { canceled: true } : { filePath: path.resolve('Example Projects', 'Named Show') }; } },
    writeCompiledProject: async (folder, payload) => { writes++; assert.equal(path.basename(folder), 'Named Show'); assert.equal(payload.project, project); return { ok: true, path: folder }; },
  });
  let result = await handler(null, { name: 'Suggested Show', project });
  assert.equal(result.cancelled, true); assert.equal(writes, 0);
  assert.equal(path.basename(options.defaultPath), 'Suggested Show'); assert.equal(options.buttonLabel, 'Compile');
  cancelled = false; result = await handler(null, { name: 'Suggested Show', project });
  assert.equal(result.ok, true); assert.equal(writes, 1);
});
