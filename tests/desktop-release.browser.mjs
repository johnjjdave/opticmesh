// Run only on an isolated CI Windows runner after installing the candidate.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

if (!process.env.CI || !process.env.OPTICMESH_INSTALLED_APP) {
  throw new Error('This installation check requires an isolated CI runner and OPTICMESH_INSTALLED_APP.');
}
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executablePath = process.env.OPTICMESH_INSTALLED_APP;
const app = await _electron.launch({ executablePath });
try {
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Guide', exact: true }).waitFor();
  await page.waitForFunction(() => !!window.lo2sDesktop);
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), '0.7.0-beta');
  const documents = await app.evaluate(({ app }) => app.getPath('documents'));
  for (const folder of ['Projects', 'Exports', 'Test Patterns']) {
    assert((await fs.stat(path.join(documents, 'OpticMesh', folder))).isDirectory());
  }
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Load Demo Scene', exact: true }).click();
  const viewport = page.getByRole('region', { name: '3D viewport', exact: true });
  await viewport.focus();
  for (const [key, mode] of [['F2', 'top'], ['F3', 'right'], ['F4', 'front'], ['F5', 'four'], ['F1', 'perspective']]) {
    await page.keyboard.press(key);
    await page.waitForFunction(mode => document.querySelector('[aria-label="Camera view"]').value === mode, mode);
  }
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  const manual = page.getByRole('dialog');
  assert((await manual.innerText()).includes('Compile Project'));
  assert.equal(await manual.locator('a[href^="#manual-"]').count(), 17);
  await page.getByRole('button', { name: 'Close manual', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Latest changes autosaved' }).waitFor({ timeout: 15000 });
  const startupPath = path.join(documents, 'OpticMesh', 'Projects', 'Startup Project.lo2s');
  const project = JSON.parse(await fs.readFile(startupPath, 'utf8'));
  assert.equal(project.format, 'opticmesh-project');
  assert.equal((project.rawXml.match(/<Slice\s/g) || []).length, 7);
  for (const name of ['OpticMesh-MIT.txt', 'Spout2-BSD.txt', 'THIRD_PARTY_NOTICES.md']) {
    assert((await fs.stat(path.join(path.dirname(executablePath), 'resources', 'licenses', name))).size > 0);
  }
  console.log('PASS: installed version, desktop bridge, workspace folders, 3D function keys, offline Manual, autosave, and license files.');
} finally {
  await app.close();
}
