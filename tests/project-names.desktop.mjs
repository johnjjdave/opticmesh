import { editorWindow, closeTestApp } from "./desktop-test-helpers.mjs";
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-project-names-'));
const documents = path.join(scratch, 'Documents');
await fs.mkdir(documents);
const startup = path.join(documents, 'OpticMesh/Projects/Startup Project.lo2s');
const wrapper = path.join(scratch, 'main.cjs');
const main = path.join(process.env.OPTICMESH_PACKAGED_APP || path.join(root, 'desktop'), 'electron-main.cjs');
await fs.writeFile(wrapper, `const {app,BrowserWindow}=require('electron');BrowserWindow.prototype.show=BrowserWindow.prototype.showInactive;app.setPath('userData',${JSON.stringify(path.join(scratch, 'profile'))});app.setPath('documents',${JSON.stringify(documents)});delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(main)});`);
const launch = () => _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [wrapper] });
let app = await launch();
try {
  const page = await editorWindow(app), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('File').click(); await button(name).click(); };
  const title = page.locator('div[class*="projectInfo"] > strong');
  await page.getByText('Latest changes autosaved', { exact: true }).waitFor();
  const initial = JSON.parse(await fs.readFile(startup, 'utf8'));
  const legacyPath = path.join(scratch, 'Summer Stage.lo2s');
  await fs.writeFile(legacyPath, JSON.stringify(initial));
  const open = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await menu('Open Project…');
    const loaded = page.getByText(`Project loaded: ${path.basename(file)}`, { exact: true });
    const proceed = button('Continue without saving');
    await loaded.or(proceed).first().waitFor();
    if (await proceed.isVisible()) await proceed.click();
    await loaded.waitFor();
  };
  await open(legacyPath);
  assert.equal(await title.textContent(), 'Summer Stage', 'Legacy files with a default title must use their filename');
  await menu('Save');
  await page.getByText('Saved Summer Stage.lo2s', { exact: true }).waitFor();
  assert.equal(JSON.parse(await fs.readFile(legacyPath, 'utf8')).config.project, 'Summer Stage');

  const customPath = path.join(scratch, 'Delivery Copy.lo2s');
  await fs.writeFile(customPath, JSON.stringify({ ...initial, config: { ...initial.config, project: 'Custom Show Title' } }));
  await open(customPath);
  assert.equal(await title.textContent(), 'Custom Show Title', 'Explicit embedded titles must be preserved');

  const namedPath = path.join(scratch, 'Evening Show 2026.lo2s');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, namedPath);
  await menu('Save As…');
  await page.getByText('Project saved', { exact: true }).waitFor();
  assert.equal(await title.textContent(), 'Evening Show 2026');
  const saved = JSON.parse(await fs.readFile(namedPath, 'utf8'));
  assert.equal(saved.config.project, 'Evening Show 2026', 'Save As must write the new title on its first write');
  const previousConfig = { ...initial.config }, nextConfig = { ...saved.config };
  delete previousConfig.project; delete nextConfig.project;
  assert.deepEqual(nextConfig, previousConfig, 'Naming must not alter unrelated settings');
  await open(namedPath);
  assert.equal(await title.textContent(), 'Evening Show 2026');
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await menu('Save As…');
  await page.waitForTimeout(250);
  assert.equal(await title.textContent(), 'Evening Show 2026', 'Cancelled saves must not rename the project');

  // Read-only migration: opening a legacy file alone does not overwrite it.
  const readOnlyPath = path.join(scratch, 'Opening Only.lo2s');
  await fs.writeFile(readOnlyPath, JSON.stringify(initial));
  await open(readOnlyPath);
  assert.equal(await title.textContent(), 'Opening Only');
  assert.equal(JSON.parse(await fs.readFile(readOnlyPath, 'utf8')).config.project, initial.config.project);
  await page.waitForTimeout(1000);
  assert.equal(JSON.parse(await fs.readFile(startup, 'utf8')).config.project, 'Opening Only');
  assert.deepEqual(errors, []);
} finally { await closeTestApp(app); }
app = await launch();
try {
  const page = await editorWindow(app);
  await page.getByText('Restored latest working project', { exact: true }).waitFor();
  assert.equal(await page.locator('div[class*="projectInfo"] > strong').textContent(), 'Opening Only', 'Startup must keep the project title, not the recovery filename');
} finally { await closeTestApp(app); }
console.log('Desktop project names: legacy open, custom titles, Save As, overwrite, cancellation and startup restore passed.');
