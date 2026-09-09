import { confirmProjectReplacement } from "./browser-fixture.mjs";
// Build desktop/dist first. Exercise the real Electron main/preload and native senders,
// with temporary Documents/userData and a unique sender name.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-output-'));
const wrapper = path.join(scratch, 'main.cjs');
const electronModule = path.join(root, 'desktop/node_modules/electron');
await fs.mkdir(path.join(scratch, 'Documents'), { recursive: true });
await fs.writeFile(wrapper, `
const {app, BrowserWindow, ipcMain} = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(scratch, 'profile'))});
app.setPath('documents', ${JSON.stringify(path.join(scratch, 'Documents'))});
BrowserWindow.prototype.show = function() {};
global.outputProbe = {frames: [], kind: '', name: 'OpticMesh output regression ' + process.pid};
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, callback) => handle(channel, async (event, payload) => {
  if (channel === 'output:start') { global.outputProbe.kind = payload.kind; payload = {...payload, name: global.outputProbe.name}; }
  const result = await callback(event, payload);
  if (channel === 'output:frame' && result.ok) global.outputProbe.frames.push({kind: global.outputProbe.kind, width:payload.width, height:payload.height, fps:payload.fps, bytes:payload.data.byteLength, at:Date.now()});
  return result;
});
require(${JSON.stringify(path.join(root, 'desktop/electron-main.cjs'))});
`);
const app = await _electron.launch({ executablePath: process.env.OPTICMESH_ELECTRON || path.join(electronModule, 'dist/electron.exe'), args: [wrapper] });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Guide', exact: true }).waitFor();
  console.log('Desktop interface loaded');
  const logo = page.getByRole('img', { name: 'LO2S', exact: true });
  assert(await logo.evaluate(image => image.complete && image.naturalWidth > 0), 'packaged file:// logo loads');
  await page.evaluate(() => {
    window.captureProbe = { asyncReads: 0, syncReads: 0, ticks: 0, maxGap: 0, previous: performance.now() };
    const original = WebGL2RenderingContext.prototype.readPixels;
    WebGL2RenderingContext.prototype.readPixels = function (...args) {
      window.captureProbe[typeof args[6] === 'number' ? 'asyncReads' : 'syncReads']++;
      return original.apply(this, args);
    };
    const tick = now => { const p = window.captureProbe; p.ticks++; p.maxGap = Math.max(p.maxGap, now - p.previous); p.previous = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Load Demo Scene', exact: true }).click();await confirmProjectReplacement(page);
  const menu = page.getByRole('navigation').first();
  const output = menu.getByRole('button', { name: 'Output', exact: true });
  const viewport = page.getByRole('region', { name: '3D viewport', exact: true });
  for (const kind of ['ndi', 'spout']) {
    console.log(`Starting ${kind}`);
    await output.click();
    await page.getByRole('button', { name: kind === 'ndi' ? 'NDI' : 'Spout', exact: true }).click();
    await page.getByRole('button', { name: `Output ${kind.toUpperCase()}`, exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('1920 × 1080') && document.body.innerText.includes('30 fps · RGBA'), null, { timeout: 20000 });
    console.log(`${kind} connected at configured dimensions`);
    await viewport.focus();
    await page.keyboard.press('F5');
    assert.equal(await page.getByRole('combobox', { name: 'Camera view', exact: true }).inputValue(), 'four');
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    const ticks = await page.evaluate(() => window.captureProbe.ticks);
    for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, i % 2 ? 40 : -40); await page.waitForTimeout(80); }
    await viewport.focus(); await page.keyboard.press('F1');
    assert.equal(await page.getByRole('combobox', { name: 'Camera view', exact: true }).inputValue(), 'perspective');
    assert(await page.evaluate(previous => window.captureProbe.ticks > previous + 10, ticks), 'viewport event loop advances while streaming');
    const frames = await app.evaluate(() => global.outputProbe.frames);
    const stream = frames.filter(frame => frame.kind === kind);
    assert(stream.length >= 3, `${kind} continues producing frames (${stream.length})`);
    for (const frame of stream) assert.deepEqual([frame.width, frame.height, frame.fps, frame.bytes], [1920, 1080, 30, 1920 * 1080 * 4]);
    console.log(`${kind} capture handoffs: ${((stream.length - 1) * 1000 / (stream.at(-1).at - stream[0].at)).toFixed(1)} fps over ${stream.length} frames`);
    await output.click(); await page.getByRole('button', { name: 'OFF', exact: true }).click();
  }
  // Stop/unmount during a queued capture must not leak a stale frame or a graphics error.
  await output.click(); await page.getByRole('button', { name: 'NDI', exact: true }).click();
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await output.click(); await page.getByRole('button', { name: 'OFF', exact: true }).click();
  await page.waitForTimeout(400);
  const probe = await page.evaluate(() => window.captureProbe);
  assert(probe.asyncReads >= 6);
  assert.equal(probe.syncReads, 0, '3D capture does not synchronously read GPU pixels');
  assert.deepEqual(errors, []);
  console.log(`PASS desktop logo, real NDI/Spout at 1920 × 1080 / 30 fps, live navigation and All Views, async readback, and workspace shutdown. ${JSON.stringify(probe)}`);
} catch (error) {
  console.error(error);
  const page = await app.firstWindow();
  console.error((await page.locator('body').innerText()).slice(0, 4000));
  throw error;
} finally {
  const deadline = setTimeout(() => app.process().kill(), 10000);
  try { await app.close(); } finally { clearTimeout(deadline); }
  // Isolated recovery files remain under the printed scratch path, never in the real Documents folder.
  console.log(`Isolated test workspace: ${scratch}`);
}
