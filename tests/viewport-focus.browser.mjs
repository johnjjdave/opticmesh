import { confirmProjectReplacement } from "./browser-fixture.mjs";
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
  await button('3D').click(); await button('Load Demo Scene').click();await confirmProjectReplacement(page);
  const view = page.getByRole('region', { name: '3D viewport', exact: true });
  const ring = () => view.evaluate(el => getComputedStyle(el).outlineStyle);
  const focus = () => view.evaluate(el => el === document.activeElement);
  const selected = () => page.locator('.hierarchy-row.child.selected').count();
  const pointerFocus = async () => view.click({ position: { x: 8, y: 8 } });
  await pointerFocus(); assert(await focus()); assert.equal(await ring(), 'none');
  for (const key of ['e', 'r', 't', 'E', 'R', 'T', 's', 'f']) {
    await page.keyboard.press(key); assert.equal(await ring(), 'none', `No viewport ring after ${key}`);
  }
  const search = page.getByRole('textbox', { name: 'Search tools', exact: true });
  await search.fill('grid'); await search.fill('');
  await pointerFocus(); assert(await focus()); assert.equal(await ring(), 'none', 'No inherited input focus ring');
  await page.keyboard.press('Control+a'); assert.equal(await selected(), 7, 'Pointer-focused Ctrl+A still selects slices');
  assert.equal(await ring(), 'none');
  // Tab back from the next control: actual keyboard navigation remains visible.
  await page.keyboard.press('Tab'); assert(!(await focus()));
  await page.keyboard.press('Shift+Tab'); assert(await focus()); assert.equal(await ring(), 'solid');
  await page.keyboard.press('e'); assert.equal(await ring(), 'solid', 'Keyboard focus remains visible during shortcuts');
  await pointerFocus(); assert.equal(await ring(), 'none', 'Pointer use dismisses the keyboard ring');
  await page.getByRole('combobox', { name: 'Camera view', exact: true }).selectOption('four');
  await pointerFocus(); await page.keyboard.press('r'); assert.equal(await ring(), 'none');
  await page.keyboard.press('Control+a'); assert.equal(await selected(), 7);
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert(await focus()); assert.equal(await ring(), 'solid', 'All Views retains keyboard focus access');
  assert.deepEqual(errors, []);
  console.log('PASS: no spurious viewport ring after pointer focus, text editing or shortcuts; Tab/Shift+Tab indicator and scoped Ctrl+A retained in single/All Views.');
} finally { await browser.close(); }
