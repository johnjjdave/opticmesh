const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// Local testing has its own recovery files and preferences.
const localDocuments = path.join(app.getPath("documents"), "OpticMesh Local");
fs.mkdirSync(localDocuments, { recursive: true });
app.setPath("documents", localDocuments);
app.setPath("userData", path.join(app.getPath("appData"), "OpticMesh Local"));
delete process.env.OPTICMESH_DEV_URL;
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows().find(window => !window.isDestroyed());
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  require("./electron-main.cjs");
}
