import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Guide').click();
  const dialog = page.getByRole('dialog');
  const links = dialog.locator('a[href^="#manual-"]');
  assert((await links.count()) >= 17);
  for (const link of await links.all()) {
    const id = (await link.getAttribute('href')).slice(1);
    await link.click();
    assert.equal(await page.evaluate(() => document.activeElement.id), id);
    assert(await page.locator(`[id="${id}"]`).isVisible());
  }
  await button('Close manual').click();
  await button('3D').click(); await button('Load Demo Scene').click();
  await button('Select Center Wall').click();
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('front');
  const view = page.getByRole('region', { name: '3D viewport', exact: true });
  await view.focus(); await page.keyboard.press('s');
  await button('Snap').click();
  await button('Grid').first().click();
  assert.equal(await button('Grid').first().getAttribute('aria-pressed'), 'false');
  const positionX = page.locator('[class*="transformFields"] .transform-grid').first().locator('input').first();
  const dragMove = async () => {
    await page.waitForTimeout(200);
    const point = await view.locator('canvas').evaluate(canvas => {
      const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, copy.width, copy.height).data, pixels = [];
      for (let y = 0; y < copy.height; y++) for (let x = Math.floor(copy.width / 2); x < copy.width; x++) {
        const i = (y * copy.width + x) * 4;
        if (data[i] > 220 && data[i + 1] < 40 && data[i + 2] < 40) pixels.push([x, y]);
      }
      const right = Math.max(...pixels.map(p => p[0])), block = pixels.filter(p => p[0] > right - 12), rect = canvas.getBoundingClientRect();
      return { x: rect.x + (right - 6) * rect.width / copy.width, y: rect.y + block.reduce((s, p) => s + p[1], 0) / block.length * rect.height / copy.height };
    });
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 42, point.y, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(100);
  };
  await dragMove();
  let x = Number(await positionX.inputValue()); assert(x !== 0); assert.equal(x, Math.round(x));
  await page.keyboard.press('Control+z'); assert.equal(Number(await positionX.inputValue()), 0);
  await view.focus(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+g');
  await page.keyboard.press('s'); await dragMove(); x = Number(await positionX.inputValue()); assert.equal(x, Math.round(x));

  await page.evaluate(() => {
    window.lo2sDesktop = { compileProject: async payload => { window.compiledPayload = payload; return { ok: true, path: 'Test Show' }; } };
  });
  await button('File').click(); await button('Compile Project…').click();
  await page.getByText('Project compiled to Test Show', { exact: true }).waitFor();
  const bundle = await page.evaluate(async () => {
    const payload = window.compiledPayload;
    return { project: JSON.parse(payload.project), maps: await Promise.all(payload.files.map(async file => {
      const image = await createImageBitmap(new Blob([file.data], { type: 'image/png' }));
      const dimensions = { name: file.filename, width: image.width, height: image.height }; image.close(); return dimensions;
    })) };
  });
  assert.equal(bundle.project.simulation.snapEnabled, true);
  assert.equal(bundle.project.simulation.gridVisible, false);
  assert.equal(bundle.maps.length, 3);
  assert.deepEqual(bundle.maps.map(map => [map.width, map.height]), [[3940, 2710], [3840, 2160], [3840, 2160]]);
  assert(bundle.project.rawXml.includes('Header Ribbon'));
  // Browser folder access follows the same bundle layout and preserves the job.
  await page.evaluate(() => {
    window.lo2sDesktop = undefined;
    window.browserFiles = {};
    window.showDirectoryPicker = async () => ({
      getDirectoryHandle: async (_name, options) => {
        if (!options.create) throw new DOMException('Missing', 'NotFoundError');
        return { getFileHandle: async name => ({ createWritable: async () => ({ write: async blob => { window.browserFiles[name] = await blob.arrayBuffer(); }, close: async () => {} }) }) };
      },
    });
  });
  page.once('dialog', dialog => dialog.accept('Compiled Show'));
  await button('File').click(); await button('Compile Project…').click();
  await page.getByText('Compiled 5 files to Compiled Show', { exact: true }).waitFor();
  const files = await page.evaluate(() => ({ names: Object.keys(window.browserFiles), project: JSON.parse(new TextDecoder().decode(window.browserFiles['Compiled Show.lo2s'])), xml: new TextDecoder().decode(window.browserFiles['Compiled Show.xml']) }));
  assert.equal(files.names.length, 5); assert.equal(files.project.config.project, 'Compiled Show');
  assert.equal(files.xml, bundle.project.rawXml);
  page.once('dialog', dialog => dialog.dismiss());
  await button('File').click(); await button('Compile Project…').click();
  assert.equal(await page.evaluate(() => Object.keys(window.browserFiles).length), 5);
  assert.deepEqual(errors, []);
  console.log('PASS: Manual contents navigation; 1 m object/group snapping with hidden grid and undo; compiled snapshot and native-size input/all output PNGs.');
} finally { await browser.close(); }
