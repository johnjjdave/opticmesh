// The startup window may load before the editor. Select the actual app page.
export async function editorWindow(app) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const page = app.windows().find(page => /^(https?:|file:)/.test(page.url()));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Desktop editor did not navigate');
}

// Test teardown must not wait on the user-facing save-on-close confirmation.
export async function closeTestApp(app) {
  try { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())); } catch {}
  await app.close();
}
