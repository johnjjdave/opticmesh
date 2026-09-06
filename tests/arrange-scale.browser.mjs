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
  await button('3D').click(); await button('Load Demo Scene').click();
  const view = page.getByRole('region', { name: '3D viewport', exact: true });
  const scaleFields = page.locator('[class*="transformFields"] .transform-grid').nth(2).locator('input');
  const scales = () => scaleFields.evaluateAll(inputs => inputs.map(input => Number(input.value)));
  const near = (actual, expected) => assert(Math.abs(actual - expected) < 0.015, `${actual} ≈ ${expected}`);
  const prepare = async () => {
    await button('Select Center Wall').click();
    await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('front');
    await view.focus(); await page.keyboard.press('t'); await page.keyboard.press('s');
    await page.waitForTimeout(300);
  };
  const handle = () => view.locator('canvas').evaluate(canvas => {
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(canvas, 0, 0);
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data, pixels = [];
    const rect = canvas.getBoundingClientRect(), pane = canvas.parentElement.querySelector('[aria-label="Front viewport"]').getBoundingClientRect();
    const left = (pane.left - rect.left) * copy.width / rect.width, top = (pane.top - rect.top) * copy.height / rect.height;
    const width = pane.width * copy.width / rect.width, height = pane.height * copy.height / rect.height;
    for (let y = Math.ceil(top); y < top + height; y++) for (let x = Math.floor(left + width / 2); x < left + width; x++) {
      const offset = (y * copy.width + x) * 4;
      if (data[offset] > 220 && data[offset + 1] < 40 && data[offset + 2] < 40) pixels.push([x, y]);
    }
    if (!pixels.length) throw new Error('Scale X handle not visible');
    const right = Math.max(...pixels.map(p => p[0])), block = pixels.filter(p => p[0] > right - 10);
    return { x: rect.x + (right - 5) * rect.width / copy.width, y: rect.y + block.reduce((sum, p) => sum + p[1], 0) / block.length * rect.height / copy.height };
  });
  const drag = async (shift = false) => {
    const point = await handle(); await page.mouse.move(point.x, point.y);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down(); await page.mouse.move(point.x + 36, point.y, { steps: 8 });
    await page.mouse.up(); if (shift) await page.keyboard.up('Shift');
    await page.waitForTimeout(120);
  };
  await prepare();
  await drag(); let result = await scales(); assert(result[0] > 1.1); near(result[1], 1); near(result[2], 1);
  await page.keyboard.press('Control+z');
  // Shift applies the same relative factor to an initially nonuniform object.
  for (const [axis, value] of [2, 3, 4].entries()) { await scaleFields.nth(axis).fill(String(value)); await scaleFields.nth(axis).press('Enter'); }
  await view.focus(); await page.keyboard.press('s'); await page.waitForTimeout(250);
  await drag(true); result = await scales();
  assert(result[0] > 2.1); near(result[0] / 2, result[1] / 3); near(result[1] / 3, result[2] / 4);
  await page.keyboard.press('Control+z'); result = await scales(); near(result[0], 2); near(result[1], 3); near(result[2], 4);
  const point = await handle(); await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 25, point.y, { steps: 5 });
  await page.keyboard.down('Shift'); await page.waitForTimeout(100);
  result = await scales(); near(result[0] / 2, result[1] / 3); near(result[1] / 3, result[2] / 4);
  await page.keyboard.up('Shift'); await page.mouse.move(point.x + 35, point.y, { steps: 3 });
  await page.mouse.up(); await page.waitForTimeout(100);
  result = await scales(); assert(result[0] > 2.1); near(result[1], 3); near(result[2], 4);

  await button('Load Demo Scene').click(); await view.focus(); await page.keyboard.press('Control+a');
  const groups = page.locator('.hierarchy-row.group');
  await page.getByRole('textbox', { name: 'Search tools', exact: true }).focus();
  await page.keyboard.press('Control+g'); assert.equal(await groups.count(), 0);
  await view.focus(); await page.keyboard.press('Control+g'); assert.equal(await groups.count(), 1);
  await page.keyboard.press('Control+g'); assert.equal(await groups.count(), 1, 'Repeated grouping does not nest unexpectedly');
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('front');
  await view.focus(); await page.keyboard.press('t'); await page.keyboard.press('s');
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('four');
  await page.waitForTimeout(300); await drag(true); result = await scales();
  assert(result[0] > 1.1); near(result[0], result[1]); near(result[1], result[2]);
  await page.keyboard.press('Control+z'); result = await scales(); result.forEach(value => near(value, 1));
  await page.keyboard.press('Control+z'); assert.equal(await groups.count(), 0);
  await view.focus(); await page.keyboard.press('Control+a');
  const inspector = page.locator('aside').last();
  await inspector.locator(':scope > nav').getByRole('button', { name: /^geometry$/i }).click();
  await button('Align').click();
  assert(await page.locator('#scene-align').evaluate(el => el.contains(document.activeElement)));
  assert(await page.locator('#scene-align').evaluate(el => { const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; }));
  await button('Align X').click();
  await button('Distribute').click();
  assert(await page.locator('#scene-distribute').evaluate(el => el.contains(document.activeElement)));
  await button('Space Y').click();
  assert.deepEqual(errors, []);
  console.log('PASS: axis scale, proportional Shift scale from nonuniform values, modifier changes mid-drag, undo, guarded Ctrl+G, and Align/Distribute navigation.');
} finally { await browser.close(); }
