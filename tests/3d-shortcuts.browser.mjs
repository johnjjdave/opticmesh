// Run against a running local app. Set PLAYWRIGHT_MODULE when Playwright is bundled externally.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRegressionScene } from './browser-fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
    await page.getByText('Manual save only', { exact: true }).waitFor();
    await loadRegressionScene(page, '3d');
    const viewport = page.getByRole('region', { name: '3D viewport', exact: true });
    const pivot = page.getByRole('combobox', { name: 'Pivot mode', exact: true });
    const pad = page.getByRole('group', { name: 'XY pivot pad', exact: true });
    const selected = page.locator('.hierarchy-row.child.selected');
    const search = page.getByRole('textbox', { name: 'Search tools', exact: true });
    const tool = name => page.locator('[class*="contextControls"]').getByRole('button', { name, exact: true });
    const clear = async () => { await viewport.click({ position: { x: 8, y: 8 } }); assert.equal(await selected.count(), 0); };
    const select = async name => page.getByRole('button', { name: 'Select ' + name, exact: true }).click();
    const capture = async () => { await page.waitForTimeout(400); return viewport.screenshot(); };
    // Reframing can change a few antialiased pixels through floating-point rounding.
    const sameImage = async (a, b) => page.evaluate(async ([first, second]) => {
      const pixels = async bytes => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0); bitmap.close();
        // Exclude the two-pixel viewport focus ring, which appears on keyboard use.
        return ctx.getImageData(2, 2, canvas.width - 4, canvas.height - 4).data;
      };
      const left = await pixels(first), right = await pixels(second);
      if (left.length !== right.length) return false;
      let difference = 0;
      for (let i = 0; i < left.length; i++) difference += Math.abs(left[i] - right[i]);
      return difference / left.length < 0.05;
    }, [[...a], [...b]]);

    assert(await pivot.isDisabled());
    assert.equal(await pad.getAttribute('aria-disabled'), 'true');
    assert.equal(await pad.getAttribute('tabindex'), '-1');
    const fields = page.locator('[class*="pivotCoordinates"] input');
    for (const field of await fields.all()) assert(await field.isDisabled());
    await pad.dispatchEvent('keydown', { key: 'Home' });
    await select('Left Tower');
    assert(await pivot.isEnabled());
    assert.equal(await pivot.inputValue(), 'bottom-center');
    await pivot.selectOption('center');
    await select('Centre Wall');
    assert.equal(await pivot.inputValue(), 'bottom-center', 'Pivot edit must not change unselected slices');
    await clear();
    await pivot.evaluate(el => { el.value = 'top-left'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await select('Centre Wall');
    assert.equal(await pivot.inputValue(), 'bottom-center', 'Empty selection must not change global/default pivot');
    await page.getByRole('button', { name: 'Select Left Tower', exact: true }).click({ modifiers: ['Control'] });
    assert.equal(await selected.count(), 2);
    await pivot.selectOption('top-right');
    for (const name of ['Left Tower', 'Centre Wall']) { await select(name); assert.equal(await pivot.inputValue(), 'top-right'); }
    await clear();

    await viewport.focus();
    for (const [key, name] of [['r','Rotate'], ['t','Scale'], ['e','Move'], ['R','Rotate'], ['T','Scale'], ['E','Move']]) {
      await page.keyboard.press(key);
      assert.equal(await tool(name).getAttribute('aria-pressed'), 'true', key);
    }
    await page.keyboard.press('Control+a');
    assert.equal(await selected.count(), 6);
    await clear();
    assert(await viewport.evaluate(el => el === document.activeElement));
    await search.fill('retest');
    await search.press('Control+a');
    assert.equal(await selected.count(), 0);
    assert.equal(await search.evaluate(el => el.selectionEnd - el.selectionStart), 6);
    await search.press('t');
    assert.equal(await tool('Move').getAttribute('aria-pressed'), 'true');
    await search.fill('');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.keyboard.press('r');
    assert.equal(await tool('Move').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    await page.keyboard.press('t');
    assert.equal(await tool('Move').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');

    console.log('Pivot, tools and guards passed');
    // S focuses selection; F always frames the scene; empty S must do nothing.
    await viewport.focus();
    await page.keyboard.press('f');
    const scene = await capture();
    await page.keyboard.press('s');
    assert(await sameImage(await capture(), scene), 'S without selection must leave the scene camera unchanged');
    await select('Left Tower');
    await viewport.focus();
    await page.keyboard.press('s');
    const focused = await capture();
    assert(!await sameImage(focused, scene), 'S must frame selected geometry');
    await page.getByRole('button', { name: 'Fit Scene', exact: true }).last().click();
    await viewport.focus();
    const fittedSelection = await capture();
    await page.keyboard.press('s');
    await page.keyboard.press('F');
    assert(await sameImage(await capture(), fittedSelection), 'F with selection must match Fit Scene');
    await clear();
    await page.keyboard.press('F');
    assert(await sameImage(await capture(), scene), 'F without selection must fit the whole scene');

    // All Views: only the active pane is reframed by a selection command.
    await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('four');
    await select('Left Tower');
    const top = page.locator('.three-view-surface[aria-label="Top viewport"]');
    const front = page.locator('.three-view-surface[aria-label="Front viewport"]');
    await top.hover(); await viewport.focus(); await page.waitForTimeout(400);
    const topBefore = await top.screenshot(), frontBefore = await front.screenshot();
    await page.keyboard.press('S'); await page.waitForTimeout(400);
    assert(!await sameImage(await top.screenshot(), topBefore));
    assert(await sameImage(await front.screenshot(), frontBefore));
    await page.keyboard.press('Control+a'); assert.equal(await selected.count(), 6);
    assert.equal(await page.locator('.three-view-surface').filter({ visible: true }).count(), 4);

    // F with no selection must include screens moved outside the original XML bounds.
    await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('perspective');
    await select('Left Tower');
    const positionX = page.locator('[class*="transformFields"] input').first();
    await positionX.fill('100'); await positionX.press('Enter');
    await clear(); await page.keyboard.press('f');
    const movedScene = await capture();
    const greenPixels = await page.evaluate(async bytes => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0); image.close();
      const pixels = ctx.getImageData(2, 2, canvas.width - 4, canvas.height - 4).data;
      let green = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > 100 && pixels[i + 1] > pixels[i] * 1.5 && pixels[i + 1] > pixels[i + 2] * 1.25) green++;
      return green;
    }, [...movedScene]);
    assert(greenPixels > 30, 'Fit Scene must keep the moved green Left Tower visible');

    // Other workspaces retain native select-all and do not switch the 3D tool.
    await page.getByRole('button', { name: 'Patterns', exact: true }).click();
    await page.keyboard.press('r');
    await page.getByRole('button', { name: '3D', exact: true }).click();
    assert.equal(await tool('Move').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    if (process.env.OPTICMESH_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.OPTICMESH_EVIDENCE_DIR, { recursive: true });
      await clear();
      await pivot.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.OPTICMESH_EVIDENCE_DIR, 'pivot-disabled.png') });
    }
    console.log('PASS: selection-only pivot; lower/uppercase tools; scoped Ctrl+A; editing/menu/dialog guards; S/F framing; All Views isolation; workspace isolation.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
