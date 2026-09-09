import { fileURLToPath } from 'node:url';

// Keep interaction regressions independent of changes to the product's example project.
export async function loadRegressionScene(page, mode = 'map') {
  await page.getByRole('button', { name: 'Pixel Map', exact: true }).click();
  await page.locator('input[accept=".xml,text/xml"]').setInputFiles(fileURLToPath(new URL('./fixtures/six-screen-regression.xml', import.meta.url)));
  await page.getByText('Loaded 2 screens and 6 slices', { exact: true }).waitFor();
  if (mode === '3d') await page.getByRole('button', { name: '3D', exact: true }).click();
}

export async function confirmProjectReplacement(page) {
  const dialog = page.locator(".project-replacement-dialog");
  await dialog.getByRole("button", { name: "Continue without saving", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
}
