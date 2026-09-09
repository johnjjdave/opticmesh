// Exercise real camera/rendering and window gestures against localhost. Desktop mode
// uses the actual main/preload in an isolated development session, never an installer.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRegressionScene } from './browser-fixture.mjs';
const { chromium, _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const native = process.env.OPTICMESH_TEST_DESKTOP === '1';
const url = process.env.OPTICMESH_URL || 'http://localhost:3000/';
let browser, app, page;
if (native) {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-windowed-'));
  await fs.mkdir(path.join(scratch, 'Documents'));
  const wrapper = path.join(scratch, 'main.cjs');
  await fs.writeFile(wrapper, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(path.join(scratch, 'profile'))});app.setPath('documents',${JSON.stringify(path.join(scratch, 'Documents'))});process.env.OPTICMESH_DEV_URL=${JSON.stringify(url)};require(${JSON.stringify(path.join(root, 'desktop/electron-main.cjs'))});`);
  app = await _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [wrapper] });
  app.process().stderr.on('data', chunk => { if (String(chunk).includes('Error')) console.log(String(chunk)); });
  page = await app.firstWindow();
} else {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(url);
}
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Guide').waitFor();
  if (!native) await page.getByText('Manual save only', { exact: true }).waitFor();
  await page.waitForTimeout(1200);
  await button('Output').click();
  assert(await button('Windowed').isDisabled(), '3D-only output');
  await page.keyboard.press('Escape');
  await loadRegressionScene(page, '3d');
  await button('Select Centre Wall').click();
  const editor = page.getByRole('region', { name: '3D viewport', exact: true });
  await page.waitForTimeout(700);
  await button('Output').click();
  const opened = native ? app.waitForEvent('window') : null;
  await button('Windowed').click();
  const previewPage = native ? await opened : page;
  if (native) previewPage.on('pageerror', error => errors.push(error.message));
  const panel = previewPage.getByRole('region', { name: 'Windowed output', exact: true });
  const preview = previewPage.getByRole('region', { name: 'Windowed 3D preview', exact: true });
  await preview.waitFor(); await previewPage.waitForTimeout(800);
  // Keep resize bounds away from the physical cursor, which can emit native hover events during CDP gestures.
  if (native) await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('Windowed output')).setPosition(20,20));
  if (native) assert.equal(await previewPage.evaluate(() => typeof window.lo2sDesktop), 'undefined', 'preview has no desktop editing/filesystem bridge');
  const pixels = view => view.locator('canvas').evaluate(canvas => canvas.toDataURL());
  const imageDifference = (a, b) => previewPage.evaluate(async ([left, right]) => {
    const decode = async data => {
      const image = await createImageBitmap(await (await fetch(data)).blob());
      const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0); image.close();
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const x = await decode(left), y = await decode(right);
    if (x.length !== y.length) return Infinity;
    let total = 0;
    for (let i=0;i<x.length;i++) total += Math.abs(x[i]-y[i]);
    return total/x.length;
  }, [a,b]);
  const fields = () => page.locator('[class*="transformFields"] input').evaluateAll(nodes => nodes.map(node => node.value));
  const originalFields = await fields();
  assert(originalFields.length >= 9);
  const originalEditor = await pixels(editor);
  const originalPreview = await pixels(preview);
  const drag = async (x, y, dx, dy, key, mouseButton = 'left') => {
    if (key) await previewPage.keyboard.down(key);
    await previewPage.mouse.move(x, y); await previewPage.mouse.down({ button: mouseButton });
    await previewPage.mouse.move(x + dx, y + dy, { steps: native && !key && mouseButton === 'left' ? 1 : 12 });
    await previewPage.mouse.up({ button: mouseButton });
    if (key) await previewPage.keyboard.up(key);
    await previewPage.waitForTimeout(650);
  };
  const box = await panel.boundingBox();
  // Keep LED fronts in view for the live-content assertions later in this test.
  await drag(box.x + box.width / 2, box.y + box.height / 2, 25, 8);
  assert.notEqual(await pixels(preview), originalPreview, 'preview camera orbits');
  assert.deepEqual(await panel.boundingBox(), box, 'camera drag does not move the window');
  assert.equal(await pixels(editor), originalEditor, 'editor camera is independent');
  assert.deepEqual(await fields(), originalFields, 'orbit leaves models unchanged');
  const orbitPreview = await pixels(preview);
  await drag(box.x + box.width / 2, box.y + box.height / 2, -10, 3, null, 'right');
  assert.notEqual(await pixels(preview), orbitPreview, 'right-drag pans');
  const panPreview = await pixels(preview);
  await previewPage.mouse.wheel(0, -180); await previewPage.waitForTimeout(700);
  assert.notEqual(await pixels(preview), panPreview, 'wheel zooms');
  await preview.focus();
  for (const key of ['e', 'r', 't', 'Control+a', 'Control+g', 'Delete', 'Control+z']) await previewPage.keyboard.press(key);
  assert.deepEqual(await fields(), originalFields, 'editing shortcuts cannot alter scene');
  assert.equal(await pixels(editor), originalEditor, 'preview gestures leave editor unchanged');
  const nativeBounds = () => app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(w => w.getTitle().includes('Windowed output'));
    return { ...win.getBounds(), top: win.isAlwaysOnTop(), resizable: win.isResizable(), maximizable: win.isMaximizable() };
  });
  const beforeMove = native ? await nativeBounds() : await panel.boundingBox();
  if (native) {
    assert(beforeMove.top); assert.equal(beforeMove.resizable, false); assert.equal(beforeMove.maximizable, false);
  }
  const handle = previewPage.getByRole('button', { name: 'Move windowed output', exact: true });
  const handleBox = await handle.boundingBox();
  assert.equal(handleBox.width, 24); assert.equal(handleBox.height, 24);
  for (const control of [handle, previewPage.getByRole('button', { name: 'Close windowed output', exact: true })]) {
    assert.equal(await control.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
  }
  // The padded button area owns movement, not just the SVG strokes.
  await drag(handleBox.x + 2, handleBox.y + 2, 50, 30);
  const afterMove = native ? await nativeBounds() : await panel.boundingBox();
  assert(afterMove.x > beforeMove.x + 20 && afterMove.y > beforeMove.y + 10, 'move handle drags window');
  assert.equal(afterMove.width, beforeMove.width);
  const resize = await previewPage.getByRole('button', { name: 'Resize windowed output' }).boundingBox();
  await drag(resize.x + 12, resize.y + 12, 100, 60);
  const afterResize = native ? await nativeBounds() : await panel.boundingBox();
  assert(afterResize.width > afterMove.width + 30 && afterResize.height > afterMove.height + 20, 'bottom-right grows');
  const shrink = await previewPage.getByRole('button', { name: 'Resize windowed output' }).boundingBox();
  await drag(shrink.x + 12, shrink.y + 12, -60, -30);
  const afterShrink = native ? await nativeBounds() : await panel.boundingBox();
  assert(afterShrink.width < afterResize.width && afterShrink.height < afterResize.height, 'bottom-right shrinks');
  const edgeBox = await panel.boundingBox();
  await drag(edgeBox.x + 2, edgeBox.y + 45, 8, 5);
  const afterEdge = native ? await nativeBounds() : await panel.boundingBox();
  assert.equal(afterEdge.width, afterShrink.width, 'left edge cannot resize');
  assert.equal(afterEdge.height, afterShrink.height, 'left edge cannot resize');
  const resizedPixels = await pixels(preview);
  const firstCoordinate = page.locator('[class*="transformFields"] input').first();
  await firstCoordinate.fill('5'); await firstCoordinate.press('Enter'); await page.waitForTimeout(900);
  assert.notEqual(await pixels(preview), resizedPixels, 'editor geometry updates reach preview');
  await fs.mkdir(path.join(root, 'work/v080-local'), { recursive: true });
  await panel.screenshot({ path: path.join(root, `work/v080-local/windowed-${native ? 'windows' : 'browser'}.png`) });
  if (native) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'LO2S - OpticMesh').minimize());
    await previewPage.waitForTimeout(250);
    assert(await previewPage.isVisible('.windowed-output'), 'preview remains visible with editor minimized');
    const minimizedPixels = await pixels(preview);
    const minimizedBox = await panel.boundingBox();
    await drag(minimizedBox.x + 90, minimizedBox.y + 90, 8, 3);
    assert.notEqual(await pixels(preview), minimizedPixels, 'camera stays live with editor minimized');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'LO2S - OpticMesh').restore());
  }
  // Workspace edits must keep the same preview/camera/window alive.
  const retainedBounds = native ? await nativeBounds() : await panel.boundingBox();
  await preview.locator('canvas').evaluate(canvas => { canvas.dataset.lifecycle = 'retained'; });
  const beforeSwitch = await pixels(preview);
  await button('Pixel Map').click(); await page.waitForTimeout(500);
  assert(await imageDifference(await pixels(preview), beforeSwitch) < 0.3, 'Pixel Map switch preserves camera and preview image');
  await button('Color Bars').click(); await page.waitForTimeout(600);
  const colorBars = await pixels(preview);
  assert.notEqual(colorBars, beforeSwitch, 'Pixel Map fill edits update undocked preview');
  await button('Patterns').click(); await page.waitForTimeout(400);
  assert(await imageDifference(await pixels(preview), colorBars) < 0.3, 'Patterns switch preserves 3D preview');
  await page.locator('[class*="inspector"] > nav').getByRole('button', {name:/^logo$/i}).click();
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/webp,image/svg+xml"]').setInputFiles({
    name:'preview-logo.svg', mimeType:'image/svg+xml',
    buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#ff00ff"/></svg>'),
  });
  await page.waitForTimeout(700);
  const logoDifference = await imageDifference(await pixels(preview), colorBars);
  console.log('Logo pixel difference', logoDifference);
  assert(logoDifference > 0.1, 'Logo edits in Patterns update undocked LED surfaces');
  await button('Pixel Map').click();
  await button('Run test sequence').click();
  await button('Patterns').click();
  const beforeSequence = await pixels(preview);
  await page.waitForTimeout(3400);
  assert.notEqual(await pixels(preview), beforeSequence, 'Map sequence keeps running in Patterns with preview open');
  await button('Pixel Map').click(); await button('Run test sequence').click();
  await button('3D').click(); await page.waitForTimeout(400);
  assert.equal(await preview.locator('canvas').getAttribute('data-lifecycle'), 'retained', 'workspace changes retain renderer');
  assert.deepEqual(native ? await nativeBounds() : await panel.boundingBox(), retainedBounds, 'window bounds stay intact');
  assert(!errors.length, errors.join('\n'));
  const closing = native ? previewPage.waitForEvent('close') : null;
  await previewPage.getByRole('button', { name: 'Close windowed output' }).click();
  if (native) await closing;
  else await panel.waitFor({ state: 'detached' });
  await button('Output').click();
  assert.equal(await button('Windowed').getAttribute('aria-pressed'), 'false');
  const nextWindow = native ? app.waitForEvent('window') : null;
  await button('Windowed').click();
  const nextPreview = native ? await nextWindow : page;
  await nextPreview.getByRole('region', {name:'Windowed output', exact:true}).waitFor();
  if (!native) {
    const nextBox = await panel.boundingBox();
    await drag(nextBox.x + 12, nextBox.y + 12, 680, 0); // Move handle uncovers the application menu.
  }
  await button('Patterns').click();
  await page.waitForTimeout(400);
  if (native) assert.equal((await app.windows()).length, 2, 'workspace switch retains native preview');
  else assert.equal(await page.locator('.windowed-output').count(), 1);
  await button('Output').click();
  assert(await button('Windowed').isEnabled(), 'active preview can be closed from Patterns');
  assert.equal(await button('Windowed').getAttribute('aria-pressed'), 'true');
  const toggledClosed = native ? nextPreview.waitForEvent('close') : null;
  await button('Windowed').click();
  if (native) await toggledClosed;
  else await panel.waitFor({state:'detached'});
  await button('3D').click();
  await button('Output').click();
  const reopened = native ? app.waitForEvent('window') : null;
  await button('Windowed').click();
  const escapePage = native ? await reopened : page;
  const escapePanel = escapePage.getByRole('region', { name: 'Windowed output', exact: true });
  await escapePanel.waitFor(); await escapePanel.focus();
  const escaped = native ? escapePage.waitForEvent('close') : null;
  await escapePage.keyboard.press('Escape');
  if (native) await escaped;
  else await escapePanel.waitFor({ state: 'detached' });
  assert(!errors.length, errors.join('\n'));
  console.log(`${native ? 'Windows' : 'Browser'} windowed output: camera-only, sync, move, resize, close and lifecycle checks passed.`);
} catch (error) {
  console.log('Renderer errors', errors);
  if (!page.isClosed()) console.log('Editor state', (await page.locator('body').innerText()).slice(0,650));
  throw error;
} finally { await app?.close(); await browser?.close(); }
