// Run against a local app; PLAYWRIGHT_MODULE can point to an externally bundled Playwright.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadRegressionScene } from './browser-fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  const inspectorTab = name => page.locator('aside').last().locator(':scope > nav').getByRole('button', { name: new RegExp('^' + name + '$', 'i') });
  const dot = page.getByRole('spinbutton', { name: 'Dot size', exact: true });
  const checkDot = async sliderName => {
    const slider = page.getByRole('slider', { name: sliderName, exact: true });
    for (const control of [slider, dot]) {
      assert.equal(await control.getAttribute('min'), '50');
      assert.equal(await control.getAttribute('max'), '200');
      assert.equal(await control.inputValue(), '50');
    }
    await dot.fill('1'); assert.equal(await dot.inputValue(), '50');
    await dot.fill('999'); assert.equal(await dot.inputValue(), '200');
    assert.equal(await slider.inputValue(), '200');
    await slider.dblclick(); assert.equal(await dot.inputValue(), '50');
  };
  assert.equal(await button('Orientation').count(), 0);
  await button('Centre Mark').click();
  await inspectorTab('Overlays').click();
  await checkDot('Center Dot Size');
  assert.equal(await button('Cardinal labels').count(), 1);
  await button('Dome').click();
  await inspectorTab('Overlays').click();
  const domeToggle = button('Centre Mark');
  if (await domeToggle.getAttribute('aria-pressed') !== 'true') await domeToggle.click();
  await checkDot('Dome Center Dot Size');

  await loadRegressionScene(page);
  await inspectorTab('Style').click(); await button('Center dot').click();
  await checkDot('Center Dot Size');
  await inspectorTab('Info').click();
  const fields = ['Name', 'Coordinates', 'Resolution', 'Aspect ratio', 'Physical size'];
  const menu = name => page.getByRole('combobox', { name, exact: true });
  const global = Object.fromEntries(await Promise.all(fields.map(async name => [name, await menu(name).inputValue()])));
  const selectSlices = async names => {
    await inspectorTab('Source').click();
    const tree = page.locator('[class*="mapTree"]');
    for (let i = 0; i < names.length; i++) await tree.getByRole('button', { name: new RegExp('^' + names[i]) }).click({ modifiers: i ? ['Control'] : [] });
    await inspectorTab('Info').click();
  };
  await selectSlices(['Left Tower', 'Centre Wall']);
  for (const name of fields) { await menu(name).selectOption('top-left'); assert.equal(await menu(name).inputValue(), 'top-left'); }
  await menu('Orientation').selectOption('rotate-90'); assert.equal(await menu('Orientation').inputValue(), 'rotate-90');
  for (const slice of ['Left Tower', 'Centre Wall']) {
    await selectSlices([slice]);
    for (const name of fields) assert.equal(await menu(name).inputValue(), 'top-left');
  }
  await selectSlices(['Left Tower']); await menu('Name').selectOption('bottom-right');
  await selectSlices(['Left Tower', 'Centre Wall']);
  assert.equal(await menu('Name').inputValue(), 'mixed');
  assert.equal(await menu('Name').locator('option:checked').textContent(), '— Multiple values');
  await menu('Name').selectOption('center'); assert.equal(await menu('Name').inputValue(), 'center');
  await button('Reset selected to global').click();
  for (const name of fields) assert.equal(await menu(name).inputValue(), global[name]);

  // An inherited setting and an explicit equal setting must display one common value.
  await selectSlices(['Left Tower']); await menu('Name').selectOption(global.Name);
  await selectSlices(['Left Tower', 'Centre Wall']); assert.equal(await menu('Name').inputValue(), global.Name);
  await inspectorTab('Style').click(); await dot.fill('125');
  for (const slice of ['Left Tower', 'Centre Wall']) {
    await selectSlices([slice]); await inspectorTab('Style').click(); assert.equal(await dot.inputValue(), '125');
  }

  // Open an old project through the normal file input and check range migration at every scope.
  await button('File').click();
  const downloadEvent = page.waitForEvent('download'); await button('Save As…').click();
  const download = await downloadEvent;
  const project = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  project.config.centerDotSize = 10; project.config.domeCenterDotSize = 400;
  project.patternStyle.centerDotSize = 10;
  const ids = Object.keys(project.sliceOverrides);
  assert.equal(ids.length, 2);
  project.sliceOverrides[ids[0]].centerDotSize = 1;
  project.sliceOverrides[ids[1]].centerDotSize = 500;
  await button('File').click();
  const pickerEvent = page.waitForEvent('filechooser'); await button('Open Project…').click();
  const picker = await pickerEvent;
  await picker.setFiles({ name: 'dot-range-regression.lo2s', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByText('Project loaded: dot-range-regression.lo2s', { exact: true }).waitFor();
  await inspectorTab('Style').click(); assert.equal(await dot.inputValue(), '50');
  const migrated = [];
  for (const slice of ['Left Tower', 'Centre Wall']) { await selectSlices([slice]); await inspectorTab('Style').click(); migrated.push(await dot.inputValue()); }
  assert.deepEqual(migrated.sort(), ['200', '50']);
  await button('Patterns').click(); await button('Planar').click(); await inspectorTab('Overlays').click();
  assert.equal(await dot.inputValue(), '50');
  await button('Dome').click(); assert.equal(await dot.inputValue(), '200');
  assert.deepEqual(errors, []);
  console.log('PASS: Planar/Dome/Pixel Map dot bounds/default/reset; no Planar Orientation duplicate; all Info placements update for multiple/mixed/inherited selections; reset; selected-only sizes; old-project migration.');
} finally { await browser.close(); }
