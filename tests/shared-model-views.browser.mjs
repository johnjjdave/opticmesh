import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const mainArrays = new WeakSet(), atob = window.atob;
    window.viewStats = { decodedChars: 0, sharedBytes: 0, modelFirstDrawMs: null, start: 0 };
    window.atob = function (data) {
      if (window.viewStats.start && data.length > 100) window.viewStats.decodedChars += data.length;
      return atob.call(this, data);
    };
    const upload = WebGL2RenderingContext.prototype.bufferData;
    WebGL2RenderingContext.prototype.bufferData = function (...args) {
      const view = this.canvas.closest?.('.three-view'), data = args[1];
      if (view && ArrayBuffer.isView(data)) {
        if (view.getAttribute('aria-label') === '3D viewport') mainArrays.add(data.buffer);
        else if (mainArrays.has(data.buffer)) window.viewStats.sharedBytes += data.byteLength;
      }
      return upload.apply(this, args);
    };
    for (const name of ['drawArrays', 'drawElements']) {
      const draw = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        if (this.canvas.closest?.('[aria-label="Windowed 3D preview"]') && window.viewStats.sharedBytes && window.viewStats.modelFirstDrawMs === null)
          window.viewStats.modelFirstDrawMs = performance.now() - window.viewStats.start;
        return draw.apply(this, args);
      };
    }
  });
  await page.goto('http://localhost:3000/');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  await button('3D').click(); await button('Import Model…').click();
  const dialog = page.getByRole('dialog', { name: 'Import 3D model' });
  await dialog.locator('input[type=file]').first().setInputFiles(process.env.MODEL_PATH || {
    name: 'stage.obj', mimeType: 'text/plain', buffer: Buffer.from('o Stage\nv -2 0 0\nv 2 0 0\nv 2 2 0\nv -2 2 0\nf 1 2 3 4\n'),
  });
  await dialog.getByRole('button', { name: 'Read model', exact: true }).click();
  await dialog.locator('.model-preview canvas').waitFor({ timeout: 240000 });
  await dialog.getByLabel('Source units').selectOption(process.env.MODEL_PATH ? 'cm' : 'm');
  await dialog.getByRole('button', { name: 'Import into scene', exact: true }).click({ timeout: 240000 });
  await dialog.waitFor({ state: 'detached', timeout: 240000 });
  await page.waitForTimeout(1000);
  const editor = page.getByRole('region', { name: '3D viewport', exact: true });
  const original = await editor.locator('canvas').evaluate(canvas => canvas.toDataURL());
  const samples = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    await button('Output').click();
    await page.evaluate(() => { window.viewStats = { decodedChars: 0, sharedBytes: 0, modelFirstDrawMs: null, start: performance.now() }; });
    await button('Windowed').click();
    await page.waitForFunction(() => window.viewStats.modelFirstDrawMs !== null, {}, { timeout: 60000 });
    await page.waitForTimeout(500);
    const stats = await page.evaluate(() => { const stats = { ...window.viewStats }; window.viewStats.start = 0; return stats; });
    assert.equal(stats.decodedChars, 0, 'Opening another view does not decode the model again');
    assert(stats.sharedBytes > 0, 'Preview GPU uploads reuse the existing CPU model arrays');
    samples.push(stats);
    await button('Close windowed output').click();
    // Force a main-viewport redraw after disposing the preview GPU geometry.
    await button('Floor').first().click(); await button('Floor').first().click();
    await page.waitForTimeout(300);
    assert.equal(await editor.locator('canvas').evaluate(canvas => canvas.toDataURL()), original, 'Closing preview leaves the editor rendering intact');
  }
  assert.deepEqual(errors, []);
  console.log('Shared model views:', JSON.stringify(samples));
} finally { await browser.close(); }
