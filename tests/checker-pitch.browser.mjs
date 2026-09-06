import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { loadRegressionScene } from './browser-fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  const inspector = page.locator('aside').last();
  const tab = name => inspector.locator(':scope > nav').getByRole('button', { name: new RegExp('^' + name + '$', 'i') });
  const field = name => page.getByRole('textbox', { name: new RegExp('^' + name + ',') });
  const edit = async (name, value) => { await field(name).fill(String(value)); await field(name).press('Enter'); };
  const block = () => inspector.locator('[class*="readout"]').filter({ has: page.getByText('Checker block', { exact: true }) }).locator('strong').innerText();

  // Fixed physical wall: fewer raster pixels and fewer pixels/cabinet, same cabinet count.
  for (const [pitch, raster, expectedBlock] of [[2, 5000, '250 × 250 px'], [4, 2500, '125 × 125 px']]) {
    await edit('Pixel pitch', pitch);
    assert.equal(Number(await field('Width').inputValue()), 10);
    assert.equal(Number(await field('Raster W').inputValue()), raster);
    await tab('Overlays').click();
    if (await button('Cabinet checker').getAttribute('aria-pressed') !== 'true') await button('Cabinet checker').click();
    assert.equal(await block(), expectedBlock);
    assert.equal(raster / Number(expectedBlock.split(' ')[0]), 20);
    await tab('Setup').click();
  }

  await loadRegressionScene(page);
  const select = async names => {
    await tab('Source').click();
    for (let i = 0; i < names.length; i++) await page.locator('[class*="mapTree"]').getByRole('button', { name: new RegExp('^' + names[i]) }).click({ modifiers: i ? ['Control'] : [] });
    await tab('Geometry').click();
  };
  await select(['Left Tower']);
  for (const [pitch, expectedBlock, physical] of [[2, '250 × 250 px', '1.600 × 3.120 m'], [4, '125 × 125 px', '3.200 × 6.240 m']]) {
    await edit('Pixel pitch', pitch);
    assert.equal(await block(), expectedBlock);
    assert((await inspector.innerText()).includes('800 × 1560 px'));
    assert((await inspector.innerText()).includes(physical));
  }
  await select(['Left Tower', 'Centre Wall']); await edit('Pixel pitch', 2);
  assert.equal(await block(), '250 × 250 px');
  await tab('Style').click(); assert.equal(await block(), '250 × 250 px');
  await select(['Left Tower']); await edit('Pixel pitch', 4);
  await select(['Left Tower', 'Centre Wall']); assert.equal(await block(), '— Multiple values');
  await tab('Style').click(); assert.equal(await block(), '— Multiple values');
  // Different cabinet/pitch inputs can still produce the same actual checker raster.
  await select(['Left Tower']); await edit('Panel W', 1000); await edit('Panel H', 1000);
  await select(['Left Tower', 'Centre Wall']); assert.equal(await block(), '250 × 250 px');
  await tab('Style').click(); assert.equal(await block(), '250 × 250 px');
  assert.deepEqual(errors, []);
  console.log('PASS: fixed-wall cabinet count; fixed-raster physical growth; inverse cabinet pixel count; Geometry/Style common and mixed readouts; equal results from different inputs.');
} finally { await browser.close(); }
