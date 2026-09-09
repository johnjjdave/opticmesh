import { confirmProjectReplacement } from "./browser-fixture.mjs";
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.viewportDraws = 0;
    for (const name of ['drawElements', 'drawArrays']) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) { window.viewportDraws++; return original.apply(this, args); };
    }
  });
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  const panel = page.getByRole('region', { name: 'Render performance' });
  const value = label => panel.locator('dl > div').filter({ has: page.locator('dt').getByText(label, { exact: true }) }).locator('dd');
  await button('Performance').click();
  await page.waitForFunction(() => /ms/.test(document.querySelector('[aria-label="Render performance"]')?.textContent || ''));
  assert.match(await value('Last CPU draw').innerText(), /^\d+\.\d+ ms$/);
  assert.equal(await value('Last GPU draw').innerText(), 'Not available for 2D');
  assert.match(await value('Render size').innerText(), /2,560 × 1,536 px/);
  await page.waitForTimeout(1600);
  assert.equal(await value('Viewport redraws / s').innerText(), 'Idle');
  await button('Pixel Map').click(); await button('Load Demo Map').click();await confirmProjectReplacement(page); await button('Performance').click();
  await page.waitForTimeout(600);
  assert.match(await value('Render size').innerText(), /3,940 × 2,710 px/);
  await button('3D').click(); await button('Performance').click();
  await page.waitForTimeout(1200);
  assert(Number.parseInt(await value('Draw calls').innerText().then(t => t.replaceAll(',', ''))) > 0);
  assert(Number.parseInt(await value('Drawn triangles').innerText().then(t => t.replaceAll(',', ''))) > 0);
  const oneViewCalls = Number((await value('Draw calls').innerText()).replaceAll(',', ''));
  const viewport = page.getByRole('region', { name: '3D viewport', exact: true });
  const box = await viewport.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, i % 2 ? 30 : -30); await page.waitForTimeout(90); }
  assert(Number.parseFloat(await value('Viewport redraws / s').innerText()) > 0, 'FPS measures actual interaction redraws');
  assert.match(await value('CPU render · avg').innerText(), /^\d+\.\d+ ms$/);
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('four');
  await page.waitForTimeout(1600);
  const fourCalls = Number((await value('Draw calls').innerText()).replaceAll(',', ''));
  assert(fourCalls > oneViewCalls, `All Views sums panes: ${fourCalls} > ${oneViewCalls}`);
  const before = await page.evaluate(() => window.viewportDraws);
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(() => window.viewportDraws), before, 'monitor updates do not redraw the scene');
  assert.equal(await value('Viewport redraws / s').innerText(), 'Idle');
  const gpuText = await value('Last GPU draw').innerText();
  assert(/^(\d+\.\d+ ms|Not supported|Waiting for sample|Sample invalidated)$/.test(gpuText), gpuText);
  if (process.env.OPTICMESH_EVIDENCE_DIR) {
    await fs.mkdir(process.env.OPTICMESH_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.OPTICMESH_EVIDENCE_DIR, 'performance-1600.png') });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(700);
  assert(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'metrics fit narrow panels');
  if (process.env.OPTICMESH_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.OPTICMESH_EVIDENCE_DIR, 'performance-1280.png') });
  await button('Focused').click(); await page.waitForTimeout(600);
  assert(await panel.isVisible());
  await page.close();

  // A browser without the optional GPU timer must remain fully usable.
  const fallback = await browser.newPage(); fallback.on('pageerror', error => errors.push(error.message));
  await fallback.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name) { return name === 'EXT_disjoint_timer_query_webgl2' ? null : original.call(this, name); };
  });
  await fallback.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await fallback.getByText('Manual save only', { exact: true }).waitFor();
  await fallback.getByRole('button', { name: '3D', exact: true }).click();
  await fallback.getByRole('button', { name: 'Load Demo Scene', exact: true }).click();await confirmProjectReplacement(fallback);
  await fallback.getByRole('button', { name: 'Performance', exact: true }).click();
  await fallback.getByText('Not supported', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(`PASS: 2D/3D timings, measured redraw FPS, idle without extra draws, all-pane workload (${oneViewCalls} → ${fourCalls} calls), responsive layout, and GPU fallback. GPU on this browser: ${gpuText}.`);
} finally { await browser.close(); }
