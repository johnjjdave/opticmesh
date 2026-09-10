import { editorWindow, closeTestApp } from './desktop-test-helpers.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-recent-desktop-'));
const documents = path.join(scratch, 'Documents');
await fs.mkdir(documents);
const startup = path.join(documents, 'OpticMesh/Projects/Startup Project.lo2s');
const wrapper = path.join(scratch, 'main.cjs');
await fs.writeFile(wrapper, `const {app,BrowserWindow}=require('electron');BrowserWindow.prototype.show=BrowserWindow.prototype.showInactive;app.setPath('userData',${JSON.stringify(path.join(scratch, 'profile'))});app.setPath('documents',${JSON.stringify(documents)});delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root, 'desktop/electron-main.cjs'))});`);
const launch = () => _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [wrapper] });
const files = Array.from({ length: 8 }, (_, i) => path.join(scratch, `Stage ${i + 1}.lo2s`));
let app = await launch();
try {
  const page = await editorWindow(app), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('File').click(); await button(name).click(); };
  const recents = async () => {
    await button('File').click(); await button('Open Recent').hover();
    const submenu = page.getByRole('menu', { name: 'Recent projects' });
    await submenu.waitFor();
    return submenu;
  };
  await page.getByText('Latest changes autosaved', { exact: true }).waitFor();
  assert(page.url().startsWith('file:'));
  const initial = JSON.parse(await fs.readFile(startup, 'utf8'));
  await Promise.all(files.map((file, i) => fs.writeFile(file, JSON.stringify({ ...initial, config: { ...initial.config, project: `Stage ${i + 1}` } }))));
  await recents(); await page.getByText('No recent projects', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  for (const mode of ['3D', 'Pixel Map']) {
    await button(mode).click();
    assert.equal(await button('Load Demo Scene').count(), 0);
    assert.equal(await button('Load Demo Map').count(), 0);
  }
  await menu('Open Demo');
  await button('Cancel').click();
  assert.equal(await page.locator('div[class*="projectInfo"] > strong').textContent(), initial.config.project);
  for (const file of files) {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await menu('Open Project…');
    const loaded = page.getByText(`Project loaded: ${path.basename(file)}`, { exact: true });
    const proceed = button('Continue without saving');
    await loaded.or(proceed).first().waitFor();
    if (await proceed.isVisible()) await proceed.click();
    await loaded.waitFor();
  }
  // Wait for the async registration IPC, then verify the visible order.
  await page.waitForFunction(async () => (await window.lo2sDesktop.recentProjects())[0]?.name === 'Stage 8.lo2s');
  let submenu = await recents();
  assert.deepEqual(await submenu.getByRole('menuitem').allTextContents(), files.slice(2).reverse().map(file => path.basename(file)));
  const first = submenu.getByRole('menuitem').first();
  assert.equal(await first.getAttribute('title'), files[7]);
  const triggerBox = await button('Open Recent').boundingBox(), submenuBox = await submenu.boundingBox();
  assert(submenuBox.x >= triggerBox.x + triggerBox.width - 1, 'Flyout opens to the right');
  await first.hover();
  assert(await submenu.isVisible(), 'Flyout remains open when moving into it');
  await fs.mkdir(path.join(root, 'work'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'work/recent-projects-menu.png') });
  await first.focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').textContent(), 'Stage 7.lo2s');
  await page.keyboard.press('Escape');
  assert.equal(await button('Open Recent').getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement?.textContent === 'Stage 8.lo2s');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.getByText('Project loaded: Stage 7.lo2s', { exact: true }).waitFor();
  await button('Patterns').click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('Unsaved stage edit');
  submenu = await recents(); await submenu.getByRole('menuitem', { name: 'Stage 6.lo2s', exact: true }).click();
  await button('Cancel').click();
  assert.equal(await page.locator('div[class*="projectInfo"] > strong').textContent(), 'Unsaved stage edit');
  assert.equal((await page.evaluate(() => window.lo2sDesktop.recentProjects()))[0].name, 'Stage 7.lo2s', 'Cancel does not reorder history');
  // Save and continue writes the existing project before opening the chosen file.
  submenu = await recents(); await submenu.getByRole('menuitem', { name: 'Stage 6.lo2s', exact: true }).click();
  await button('Save and continue').click();
  await page.getByText('Project loaded: Stage 6.lo2s', { exact: true }).waitFor();
  assert.equal(JSON.parse(await fs.readFile(files[6], 'utf8')).config.project, 'Unsaved stage edit', 'Save and continue saves the previous named project');
  await fs.unlink(files[7]);
  submenu = await recents(); await submenu.getByRole('menuitem', { name: 'Stage 8.lo2s', exact: true }).click();
  await page.getByText('This project could not be found. It may have been moved or deleted.', { exact: true }).waitFor();
  assert.equal(await page.locator('div[class*="projectInfo"] > strong').textContent(), 'Stage 6');
  // Saving a named project also places it at the head of the list.
  const savedPath = path.join(scratch, 'Saved copy.lo2s');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedPath);
  await menu('Save As…'); await page.getByText('Project saved', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.lo2sDesktop.recentProjects()))[0].name, 'Saved copy.lo2s');
  assert.deepEqual(errors, []);
} finally { await closeTestApp(app); }
app = await launch();
try {
  const page = await editorWindow(app);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Open Recent', exact: true }).hover();
  const submenu = page.getByRole('menu', { name: 'Recent projects' });
  await submenu.getByRole('menuitem', { name: 'Saved copy.lo2s', exact: true }).waitFor();
  assert.equal(await submenu.getByRole('menuitem').count(), 6);
  assert.equal(await submenu.getByRole('menuitem').first().textContent(), 'Saved copy.lo2s');
} finally { await closeTestApp(app); }
console.log('Desktop recent projects: File-only demo, six entries, hover/keyboard flyout, save protection, missing files, Save As and restart persistence passed.');
