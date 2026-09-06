import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const xml = await fs.readFile(new URL('../public/examples/LO2S - OpticMesh - Demo.xml', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.OPTICMESH_URL || 'http://localhost:3000/v070');
  await page.getByText('Manual save only', { exact: true }).waitFor();
  const button = name => page.getByRole('button', { name, exact: true });
  const inspector = page.locator('aside').last();
  const tab = name => inspector.locator(':scope > nav').getByRole('button', { name: new RegExp('^' + name + '$', 'i') });
  const pitch = page.getByRole('textbox', { name: /^Pixel pitch,/ });
  const save = async () => {
    await button('File').click(); const pending = page.waitForEvent('download'); await button('Save As…').click();
    return JSON.parse(await fs.readFile(await (await pending).path(), 'utf8'));
  };
  const checkSource = project => {
    assert.equal(project.rawXml, xml);
    assert.equal(project.xmlName, 'LO2S - OpticMesh - Demo.xml');
    assert.equal(project.config.project, 'LO2S - OpticMesh - Demo');
    assert.equal(project.config.pixelPitchMm, 3.9);
    assert.equal(project.config.resolutionWidth, 3940); assert.equal(project.config.resolutionHeight, 2710);
    assert.equal(project.config.wallWidth, 3940 / 256); assert.equal(project.config.wallHeight, 2710 / 256);
    assert.deepEqual(project.sliceOverrides, {}); assert.deepEqual(project.simulation.transforms, {});
    assert.deepEqual(project.simulation.groups, []); assert.deepEqual(project.simulation.locks, {});
  };
  await pitch.fill('10'); await pitch.press('Enter');
  await button('Pixel Map').click(); await button('Load Demo Map').click();
  assert((await inspector.innerText()).includes('3940 × 2710 px'));
  assert((await inspector.innerText()).includes('7 slices · 2 screens'));
  const names = ['Header Ribbon', 'Center Wall', 'Center Wing - Stage Right', 'Center Wing - Stage Left', 'Stage Elevation', 'Band - Stage Right', 'Band - Stage Left'];
  for (const name of names) assert.equal(await page.locator('[class*="mapTree"]').getByRole('button', { name: new RegExp('^' + name) }).count(), 1);
  const project = await save(); checkSource(project); assert.equal(project.workspaceMode, 'resolume');
  // Both actual nested virtual devices retain 3840×2160; no shrinking to occupied bounds.
  for (const name of ['Stage - Main', 'Slices']) {
    await page.locator('[class*="mapTree"]').getByRole('button', { name: new RegExp('^' + name + '\\s') }).click();
    assert((await inspector.innerText()).includes('3840 × 2160 px'));
  }
  await button('Input Map').last().click();
  await page.locator('[class*="mapTree"]').getByRole('button', { name: /^Center Wall/ }).click();
  await tab('Geometry').click(); assert.equal(await pitch.inputValue(), '3.9');
  await pitch.fill('2'); await pitch.press('Enter');
  await button('3D').click(); await button('Load Demo Scene').click();
  checkSource(await save());
  assert.equal(await page.locator('.hierarchy-row.child').count(), 7);
  await button('Select Center Wall').click(); await tab('Geometry').click();
  assert((await inspector.innerText()).includes('7.000 × 6.000 m'));
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('four');
  assert.equal(await page.locator('.three-view-surface').filter({ visible: true }).count(), 4);
  if (process.env.OPTICMESH_EVIDENCE_DIR) {
    await fs.mkdir(process.env.OPTICMESH_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.OPTICMESH_EVIDENCE_DIR, 'new-demo-all-views.png') });
    await button('Pixel Map').click(); await page.screenshot({ path: path.join(process.env.OPTICMESH_EVIDENCE_DIR, 'new-demo-pixel-map.png') });
  }
  await button('File').click(); await button('Open Demo').click();
  checkSource(await save()); assert.equal(await page.locator('.hierarchy-row.child').count(), 7);
  assert.deepEqual(errors, []);
  console.log('PASS: all three demo entry points; latest XML preserved; 3940×2710 input; two 3840×2160 outputs; 7 slices; 3.9 nominal pitch; clean demo state; 7×6 m center wall; All Views.');
} finally { await browser.close(); }
