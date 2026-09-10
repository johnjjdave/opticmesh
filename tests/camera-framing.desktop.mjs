import { editorWindow, closeTestApp } from "./desktop-test-helpers.mjs";
// Verify camera commands against the bundled Windows renderer and fresh storage.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-camera-framing-'));
const documents = path.join(scratch, 'Documents');
await fs.mkdir(documents);
const startup = path.join(documents, 'OpticMesh/Projects/Startup Project.lo2s');
const wrapper = path.join(scratch, 'main.cjs');
await fs.writeFile(wrapper, `const {app,BrowserWindow}=require('electron');BrowserWindow.prototype.show=BrowserWindow.prototype.showInactive;app.setPath('userData',${JSON.stringify(path.join(scratch, 'profile'))});app.setPath('documents',${JSON.stringify(documents)});if(process.env.OPTICMESH_TEST_NO_DEVICE){const Module=require('module'),load=Module._load;Module._load=function(name,...args){if(name.endsWith('lo2s-spacemouse.node'))return {open:()=>false,focus:()=>{},close:()=>{}};return load.call(this,name,...args);};}delete process.env.OPTICMESH_DEV_URL;require(${JSON.stringify(path.join(root, 'desktop/electron-main.cjs'))});`);
const launch = () => _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [wrapper] });
const closeEnough = (a, b, label) => {
  if (typeof a === 'number') { assert(Math.abs(a - b) < 1e-5, `${label}: ${a} != ${b}`); return; }
  assert.deepEqual(Object.keys(a), Object.keys(b), label);
  for (const key of Object.keys(a)) closeEnough(a[key], b[key], `${label}.${key}`);
};
let app = await launch();
let saved;
try {
  const page = await editorWindow(app), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Guide').waitFor();
  assert(page.url().startsWith('file:'));
  const pose = async () => { await page.waitForTimeout(800); return JSON.parse(await fs.readFile(startup, 'utf8')).simulation.camera; };
  const assertFitted = async label => {
    const before = await pose();
    assert(before, `${label}: camera published`);
    assert(Math.hypot(...before.position.map((value, index) => value - before.target[index])) > 1, `${label}: camera must stand outside the model`);
    await button('Fit Scene').first().click();
    closeEnough(before, await pose(), label);
  };
  await button('3D').click();
  await page.locator('.three-view canvas').first().waitFor();
  await button('File').click(); await button('Open Demo').click();
  await button('Continue without saving').click();
  await assertFitted('Fresh demo');

  // A retained workspace has a zero-size host while Pixel Map is active.
  await button('Pixel Map').click();
  await page.locator('input[accept=".xml,text/xml"]').setInputFiles(path.join(root, 'tests/fixtures/six-screen-regression.xml'));
  await page.getByText('Loaded 2 screens and 6 slices', { exact: true }).waitFor();
  const hidden = await pose();
  assert(Math.hypot(...hidden.position) < 100, 'Hidden imports must not save a kilometre-distant camera');
  await button('3D').click();
  await assertFitted('XML imported while 3D is hidden');

  // Delay the first viewport layout, as can happen while a native window opens.
  const hide = await page.addStyleTag({ content: '.three-view { display: none !important; }' });
  await button('File').click(); await button('Open Demo').click();
  await button('Continue without saving').click();
  await page.waitForTimeout(250);
  await hide.evaluate(element => element.remove());
  await assertFitted('Demo before viewport layout');

  await button('File').click();
  await button('New Project').click();
  await button('Continue without saving').click();
  await button('3D').click();
  await button('Import Model…').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'offset-stage.obj', mimeType: 'text/plain', buffer: Buffer.from('o Stage\nv 100 0 0\nv 110 0 0\nv 100 5 0\nf 1 2 3') });
  await dialog.getByRole('button', { name: 'Read model', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Source units', exact: true }).selectOption('m');
  const hideModel = await page.addStyleTag({ content: '.three-view { display: none !important; }' });
  await dialog.getByRole('button', { name: 'Import into scene', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.waitForTimeout(250);
  await hideModel.evaluate(element => element.remove());
  await assertFitted('Model imported before viewport layout');
  assert(Math.abs((await pose()).target[0] - 105) < 0.01, 'Fit must target the actual offset model');

  // Ordinary mode changes and resizes must preserve an intentionally zoomed view.
  const pane = page.getByLabel('Perspective viewport', { exact: true });
  const box = await pane.boundingBox();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .4);
  await page.mouse.wheel(0, -240);
  const custom = await pose();
  await button('Pixel Map').click();
  await button('3D').click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 800));
  closeEnough(custom, await pose(), 'Navigation survives mode change and resize');
  saved = JSON.parse(await fs.readFile(startup, 'utf8'));
  assert.deepEqual(errors, []);
} finally { await closeTestApp(app); }

// Reopening restores a saved camera. A project without one frames its geometry.
for (const restore of [true, false]) {
  if (!restore) { delete saved.simulation.camera; await fs.writeFile(startup, JSON.stringify(saved)); }
  app = await launch();
  try {
    const page = await editorWindow(app);
    await page.getByRole('heading', { name: 'Scene hierarchy', exact: true }).waitFor();
    await page.waitForTimeout(1000);
    const before = JSON.parse(await fs.readFile(startup, 'utf8')).simulation.camera;
    if (restore) closeEnough(saved.simulation.camera, before, 'Saved startup camera');
    else {
      assert(Math.abs(before.target[0] - 105) < .01, 'First model view must fit populated geometry');
      await page.getByRole('button', { name: 'Fit Scene', exact: true }).first().click();
      await page.waitForTimeout(800);
      closeEnough(before, JSON.parse(await fs.readFile(startup, 'utf8')).simulation.camera, 'Startup without saved camera');
    }
  } finally { await closeTestApp(app); }
}
console.log('Desktop camera framing: fresh demo, hidden XML, delayed layout, model import, resize, mode switches and startup restoration passed.');
