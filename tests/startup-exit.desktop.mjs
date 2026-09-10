// Local development only: no installer build, real desktop IPC, isolated projects.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-startup-exit-'));
const documents = path.join(scratch, 'Documents'), projects = path.join(documents, 'OpticMesh/Projects');
await fs.mkdir(projects, { recursive: true });
const wrapper = path.join(scratch, 'main.cjs');
await fs.writeFile(wrapper, `const {app,BrowserWindow,ipcMain}=require('electron');BrowserWindow.prototype.show=BrowserWindow.prototype.showInactive;app.setPath('userData',${JSON.stringify(path.join(scratch, 'profile'))});app.setPath('documents',${JSON.stringify(documents)});process.env.OPTICMESH_DEV_URL='http://localhost:3000/';const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(name,fn)=>handle(name,name==='project:load-startup'?async(...args)=>{await new Promise(r=>setTimeout(r,2200));return fn(...args);}:fn);require(${JSON.stringify(path.join(root, 'desktop/electron-main.cjs'))});`);
const launch = () => _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [wrapper] });
const cleanup = async app => { try { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())); } catch {} await app.close(); };
const editor = async app => { for (let i=0;i<200;i++) { const page=app.windows().find(page=>page.url().startsWith("http://localhost:3000")); if(page)return page; await new Promise(resolve=>setTimeout(resolve,50)); } throw new Error("Editor did not navigate"); };
let app = await launch();
let initial;
try {
  const page = await editor(app);
  await page.getByRole('button', { name: 'Guide', exact: true }).waitFor();
  const loading = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({ title: window.getTitle(), visible: window.isVisible() })));
  assert(loading.some(window => window.title === 'OpticMesh — Starting' && window.visible), 'Splash visible during project loading');
  assert(loading.some(window => window.title !== 'OpticMesh — Starting' && !window.visible), 'Editor stays hidden while loading');
  await app.windows().find(page=>page.url().startsWith("data:")).screenshot({path:path.join(root,"work/startup-loading.png")});
  await page.getByText('Latest changes autosaved', { exact: true }).waitFor();
  await page.waitForTimeout(100);
  initial = JSON.parse(await fs.readFile(path.join(projects, 'Startup Project.lo2s'), 'utf8'));
  for(let i=0;i<100 && await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length>1);i++) await page.waitForTimeout(100);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('File').click(); await button(name).click(); };
  const close = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.getByLabel('Project name', { exact: true }).fill('Unsaved Show');
  await close();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Do you want to save your project?' }).waitFor();
  await dialog.screenshot({path:path.join(root,"work/project-exit-dialog.png")});
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Unsaved Show');
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await close(); await dialog.getByRole('button', { name: 'Save As…', exact: true }).click();
  await dialog.getByText('Save cancelled. Your current project is still open.', { exact: true }).waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  const badPath = path.join(scratch, 'missing-parent', 'Show.lo2s');
  // A file in place of a directory makes the write fail without changing permissions.
  await fs.writeFile(path.join(scratch, 'missing-parent'), 'not a directory');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, badPath);
  await close(); await dialog.getByRole('button', { name: 'Save As…', exact: true }).click();
  await dialog.getByText('The project could not be saved. Your current project is still open.', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const named = path.join(scratch, 'Saved Show.lo2s');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, named);
  await menu('Save As…'); await page.getByText('Project saved', { exact: true }).waitFor();
  await page.getByLabel('Project name', { exact: true }).fill('Updated Show');
  await app.evaluate(({ app }) => app.quit());
  await dialog.getByRole('button', { name: 'Save', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Updated Show');
  await close();
  const closed = page.waitForEvent('close');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await closed;
  assert.equal(JSON.parse(await fs.readFile(named, 'utf8')).config.project, 'Updated Show');
} finally { await cleanup(app); }

// A saved named project keeps its destination and closes cleanly after restart.
app = await launch();
try {
  const page = await editor(app);
  await page.getByText('Latest changes autosaved', { exact: true }).waitFor();
  for(let i=0;i<100 && await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length>1);i++) await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Updated Show');
  const closed = page.waitForEvent('close');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await closed;
} finally { await cleanup(app); }

// Restored 3D scenes prepare before reveal; recovery is not a named save.
await fs.writeFile(path.join(projects, 'Startup Project.lo2s'), JSON.stringify({ ...initial, desktopSession: undefined, workspaceMode: 'simulation', rawXml: await fs.readFile(path.join(root, 'tests/fixtures/six-screen-regression.xml'), 'utf8') }));
app = await launch();
try {
  const page = await editor(app), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Scene hierarchy', exact: true }).waitFor();
  await page.waitForFunction(() => !!document.querySelector('.three-view canvas'));
  for (let i = 0; i < 100 && await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 1); i++) await page.waitForTimeout(100);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1, 'Prepared 3D scene closes the splash');
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  assert.equal(await page.locator('.hierarchy-row.child').count(), 6);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const opened = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Floating Preview', exact: true }).click();
  const preview = await opened;
  await preview.getByRole('region', { name: 'Floating Preview', exact: true }).waitFor();
  await app.evaluate(({ app }) => app.quit());
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(preview.isClosed(), false, 'Cancelling exit must keep Floating Preview open');
  await preview.getByRole('button', { name: 'Close Floating Preview', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.getByRole('dialog').getByRole('button', { name: 'Save As…', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(root, 'work/startup-exit-main.png') });
} finally { await cleanup(app); }
// Cancelling the launcher does not replace the existing recovery file.
const retained = await fs.readFile(path.join(projects, 'Startup Project.lo2s'), 'utf8');
app = await launch();
try {
  let splash;
  for(let i=0;i<100&&!splash;i++){splash=app.windows().find(page=>page.url().startsWith('data:'));if(!splash)await new Promise(resolve=>setTimeout(resolve,30));}
  const closed=splash.waitForEvent('close');
  await splash.getByRole('button',{name:'Cancel startup',exact:true}).click();await closed;
  assert.equal(await fs.readFile(path.join(projects, 'Startup Project.lo2s'),'utf8'),retained);
} finally {await cleanup(app);}

// A failed initial navigation keeps a usable loading window with Retry and Close.
const failedWrapper=path.join(scratch,'failed-main.cjs');
await fs.writeFile(failedWrapper,(await fs.readFile(wrapper,'utf8')).replace("http://localhost:3000/","http://localhost:1/"));
app=await _electron.launch({executablePath:path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[failedWrapper]});
try {
  let splash;
  for(let i=0;i<100&&!splash;i++){splash=app.windows().find(page=>page.url().startsWith('data:'));if(!splash)await new Promise(resolve=>setTimeout(resolve,30));}
  await splash.getByText('OpticMesh could not start. Please try again.',{exact:true}).waitFor();
  await splash.getByRole('button',{name:'Retry',exact:true}).click();
  await splash.getByText('OpticMesh could not start. Please try again.',{exact:true}).waitFor();
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>!w.webContents.getURL().startsWith('data:')).every(w=>!w.isVisible())),true);
  const closed=splash.waitForEvent('close');await splash.getByRole('button',{name:'Cancel startup',exact:true}).click();await closed;
} finally {await cleanup(app);}
console.log('Startup/exit: native loading window, prepared 3D reveal, unsaved-work prompt, cancel/Escape, failed/cancelled Save As, app.quit cancellation, named Save and recovery protection passed.');
