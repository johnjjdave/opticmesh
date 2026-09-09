// Browser: running dev server. Desktop renderer: set OPTICMESH_ELECTRON to electron.exe after building desktop/dist.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegressionScene } from './browser-fixture.mjs';
const { chromium, _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
let runtime, scratch;
try {
  let page;
  if (process.env.OPTICMESH_ELECTRON) {
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-view-keys-'));
    const entry = path.join(scratch, 'main.cjs');
    const renderer = fileURLToPath(new URL('../desktop/dist/index.html', import.meta.url));
    // Isolated hidden shell: exercise the built executable renderer without native feeds or project autosave.
    await fs.writeFile(entry, `const {app,BrowserWindow}=require('electron');
      app.setPath('userData', ${JSON.stringify(path.join(scratch, 'profile'))});
      app.whenReady().then(()=>{const window=new BrowserWindow({show:false,width:1280,height:900,autoHideMenuBar:true,
        webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false}});
        window.loadFile(${JSON.stringify(renderer)});});
      app.on('window-all-closed',()=>app.quit());`);
    runtime = await _electron.launch({ executablePath: process.env.OPTICMESH_ELECTRON, args: [entry] });
    page = await runtime.firstWindow();
  } else {
    runtime = await chromium.launch({ channel: 'chrome', headless: true });
    page = await runtime.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByText('Manual save only', { exact: true }).waitFor();
  await loadRegressionScene(page, '3d');
  const view = page.getByRole('region', { name: '3D viewport', exact: true });
  const camera = page.getByRole('combobox', { name: 'Camera view', exact: true });
  const selected = page.locator('.hierarchy-row.child.selected');
  await page.getByRole('button', { name: 'Select Left Tower', exact: true }).click();
  const position = page.locator('[class*="transformFields"] input').first();
  await position.fill('12'); await position.press('Enter');
  const coordinates = await page.locator('[class*="transformFields"] input').evaluateAll(inputs => inputs.map(input => input.value));
  await page.evaluate(() => { window.viewShortcutSentinel = 'alive'; });
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await view.focus();
  for (const [key, value, label] of [
    ['F2', 'top', 'Top'], ['F3', 'right', 'Right'], ['F4', 'front', 'Front'],
    ['F5', 'four', null], ['F1', 'perspective', 'Perspective'],
  ]) {
    await page.keyboard.press(key);
    await page.waitForFunction(value => document.querySelector('[aria-label="Camera view"]').value === value, value);
    assert.equal(await camera.inputValue(), value);
    const panes = page.locator('.three-view-surface').filter({ visible: true });
    assert.equal(await panes.count(), value === 'four' ? 4 : 1);
    if (label) assert.equal(await panes.first().getAttribute('aria-label'), `${label} viewport`);
    assert.equal(await selected.count(), 1);
    assert.deepEqual(await page.locator('[class*="transformFields"] input').evaluateAll(inputs => inputs.map(input => input.value)), coordinates);
    assert.equal(await page.evaluate(() => window.viewShortcutSentinel), 'alive');
  }
  assert.equal(navigations, 0, 'View shortcuts must not reload or navigate');
  const guardedKeys = async () => {
    for (const key of ['F1', 'F2', 'F3', 'F4', 'F5']) {
      await page.evaluate(key => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })), key);
      assert.equal(await camera.inputValue(), 'perspective');
    }
  };
  await position.focus(); await guardedKeys();
  await camera.focus(); await guardedKeys();
  await page.getByRole('button', { name: 'Help', exact: true }).click(); await guardedKeys();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Guide', exact: true }).click(); await guardedKeys();
  await page.locator('.manual-sidebar a[href="#manual-12-keyboard-and-mouse-reference"]').click();
  await page.locator('.manual-sidebar a[href="#manual-121-current-keyboard-shortcuts"]').click();
  const guide = await page.getByRole('dialog').innerText();
  for (const key of ['F1', 'F2', 'F3', 'F4', 'F5']) assert(guide.includes(key));
  assert(!/Cinema|VIOSO/i.test(guide));
  await page.keyboard.press('Escape');
  await view.focus();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    await view.evaluate((element, modifier) => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', [modifier]: true, bubbles: true, cancelable: true })), modifier);
    assert.equal(await camera.inputValue(), 'perspective');
  }
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await page.keyboard.press('F2');
  await page.getByRole('button', { name: 'Pixel Map', exact: true }).click();
  await page.keyboard.press('F3');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  assert.equal(await camera.inputValue(), 'perspective');
  assert.deepEqual(errors, []);
  console.log(`PASS (${process.env.OPTICMESH_ELECTRON ? 'built Electron renderer' : 'browser'}): F1–F5 views, pane counts, preserved selection/coordinates, no reload, editing/select/menu/dialog/modifier/workspace guards, bundled Guide.`);
} finally {
  await runtime?.close();
  if (scratch && path.dirname(scratch) === os.tmpdir() && path.basename(scratch).startsWith('opticmesh-view-keys-')) await fs.rm(scratch, { recursive: true, force: true });
}
