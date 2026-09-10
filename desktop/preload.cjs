const { contextBridge, ipcRenderer } = require("electron");
const path = require("node:path");
window.addEventListener("error", () => ipcRenderer.send("app:startup-progress", "failed"));
window.addEventListener("unhandledrejection", () => ipcRenderer.send("app:startup-progress", "failed"));
window.addEventListener("webglcontextlost", () => ipcRenderer.send("app:startup-progress", "failed"), true);

let sharedFrames = null;
try { sharedFrames = require(path.join(__dirname, "native", "lo2s-shared-frame.node")); } catch {}
let sharedCanvas = null;
let sharedImage = null;
let sharedAnimation = 0;
let sharedMetricsAt = 0;
let sharedDisplayed = 0;
let sharedCopyMs = 0;
let sharedCanvasMs = 0;
let sharedLastCounters = { captured: 0, published: 0, overwritten: 0, displayed: 0 };
const sharedMetricListeners = new Set();

function ensureSharedCanvas(width, height) {
  sharedCanvas = document.getElementById("lo2s-native-shared-canvas");
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
    sharedCanvas.id = "lo2s-native-shared-canvas";
    sharedCanvas.hidden = true;
    document.documentElement.appendChild(sharedCanvas);
  }
  if (sharedCanvas.width !== width || sharedCanvas.height !== height) {
    sharedCanvas.width = width;
    sharedCanvas.height = height;
    sharedImage = new ImageData(width, height);
  }
  return sharedCanvas;
}

function stopSharedFrames() {
  if (sharedAnimation) cancelAnimationFrame(sharedAnimation);
  sharedAnimation = 0;
  sharedFrames?.close?.();
  sharedImage = null;
  sharedDisplayed = 0;
  sharedCopyMs = 0;
  sharedCanvasMs = 0;
  sharedMetricsAt = 0;
  sharedLastCounters = { captured: 0, published: 0, overwritten: 0, displayed: 0 };
}

function startSharedFrames(status) {
  stopSharedFrames();
  if (!sharedFrames || !status.mapping) return false;
  const opened = sharedFrames.open(status.mapping);
  if (!opened?.ok) return false;
  const canvas = ensureSharedCanvas(opened.width, opened.height);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context || !sharedImage) return false;
  sharedMetricsAt = performance.now();
  const renderLatest = (now) => {
    const frame = sharedFrames.readLatest(sharedImage.data);
    if (frame?.frame) {
      const canvasStarted = performance.now();
      context.putImageData(sharedImage, 0, 0);
      sharedCanvasMs += performance.now() - canvasStarted;
      sharedCopyMs += frame.copyMs || 0;
      sharedDisplayed += 1;
      canvas.dataset.frameVersion = String(frame.sequence || sharedDisplayed);
    }
    if (frame && now - sharedMetricsAt >= 1000) {
      const seconds = Math.max(0.001, (now - sharedMetricsAt) / 1000);
      const displayedDelta = sharedDisplayed - sharedLastCounters.displayed;
      const publishedDelta = (frame.published || 0) - sharedLastCounters.published;
      const metrics = {
        transport: "shared-memory",
        captureFps: ((frame.captured || 0) - sharedLastCounters.captured) / seconds,
        publishedFps: publishedDelta / seconds,
        displayedFps: displayedDelta / seconds,
        conversionMs: frame.published ? (frame.conversionMsTotal || 0) / frame.published : 0,
        copyMs: displayedDelta ? sharedCopyMs / displayedDelta : 0,
        canvasMs: displayedDelta ? sharedCanvasMs / displayedDelta : 0,
        overwritten: (frame.overwritten || 0) - sharedLastCounters.overwritten,
      };
      sharedMetricListeners.forEach((listener) => listener(metrics));
      sharedLastCounters = { captured: frame.captured || 0, published: frame.published || 0, overwritten: frame.overwritten || 0, displayed: sharedDisplayed };
      sharedCopyMs = 0;
      sharedCanvasMs = 0;
      sharedMetricsAt = now;
    }
    sharedAnimation = requestAnimationFrame(renderLatest);
  };
  sharedAnimation = requestAnimationFrame(renderLatest);
  return true;
}

// Only the editor preload exposes native camera navigation. The browser and
// windowed-output preload never acquire a connection to the device.
let spaceMouseNative = null;
const spaceMouse = process.platform === "win32" ? {
  open: (state) => {
    try {
      spaceMouseNative ||= require(path.join(__dirname, "native", "lo2s-spacemouse.node"));
      return spaceMouseNative.open(state);
    } catch { return false; }
  },
  sync: (state) => spaceMouseNative?.sync(state),
  poll: () => spaceMouseNative?.poll() ?? null,
  focus: (enabled) => spaceMouseNative?.focus(Boolean(enabled) && document.hasFocus() && !document.hidden),
  // Scene replacement releases input focus, not the renderer's driver connection.
  // Closing/reopening Navlib inside a React teardown can block its native UI
  // cleanup. Reuse it for the next viewport and close it when this window exits.
  close: () => spaceMouseNative?.focus(false),
} : undefined;
window.addEventListener("blur", () => spaceMouse?.focus(false));
document.addEventListener("visibilitychange", () => { if (document.hidden) spaceMouse?.focus(false); });
window.addEventListener("beforeunload", () => spaceMouseNative?.close());

contextBridge.exposeInMainWorld("lo2sDesktop", {
  spaceMouse,
  openSpaceMouseSettings: process.platform === "win32" ? () => ipcRenderer.invoke("spacemouse:settings") : undefined,
  startupProgress: (stage) => ipcRenderer.send("app:startup-progress", stage),
  confirmClose: () => ipcRenderer.invoke("app:confirm-close"),
  onCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:close-requested", listener);
    return () => ipcRenderer.removeListener("app:close-requested", listener);
  },
  getSystemPerformance: () => ipcRenderer.invoke("performance:snapshot"),
  windowedOutputGesture: (command) => ipcRenderer.invoke("windowed-output:gesture", command),
  chooseResolumeXml: () => ipcRenderer.invoke("resolume:choose-xml"),
  linkLatestResolumeMap: () => ipcRenderer.invoke("resolume:link-latest"),
  unlinkResolumeMap: () => ipcRenderer.invoke("resolume:unlink"),
  saveExport: (filename, mimeType, data, category) => ipcRenderer.invoke("export:save", { filename, mimeType, data, category }),
  saveExports: (files) => ipcRenderer.invoke("export:save-batch", { files }),
  saveProject: (filename, data) => ipcRenderer.invoke("project:save", { filename, data }),
  compileProject: (payload) => ipcRenderer.invoke("project:compile", payload),
  overwriteProject: (projectPath, data) => ipcRenderer.invoke("project:overwrite", { path: projectPath, data }),
  openProject: () => ipcRenderer.invoke("project:open"),
  recentProjects: () => ipcRenderer.invoke("project:recent"),
  openRecentProject: projectPath => ipcRenderer.invoke("project:open-recent", projectPath),
  rememberRecentProject: projectPath => ipcRenderer.invoke("project:remember-recent", projectPath),
  autosaveProjectDelta: (patch) => ipcRenderer.invoke("project:autosave-delta", patch),
  autosaveProject: (data) => ipcRenderer.invoke("project:autosave", { data }),
  autosaveProjectSync: (data) => ipcRenderer.sendSync("project:autosave-sync", { data }),
  loadStartupProject: () => ipcRenderer.invoke("project:load-startup"),
  getWorkspacePaths: () => ipcRenderer.invoke("workspace:paths"),
  revealProjectsFolder: () => ipcRenderer.invoke("workspace:reveal-projects"),
  startPatternOutput: (kind, name) => ipcRenderer.invoke("output:start", { kind, name }),
  sendPatternOutputFrame: (width, height, data, fps) => ipcRenderer.invoke("output:frame", { width, height, data, fps }),
  stopPatternOutput: () => ipcRenderer.invoke("output:stop"),
  listNativeSources: (kind) => ipcRenderer.invoke("source:list", kind),
  connectNativeSource: (kind, sourceId, quality) => { stopSharedFrames(); return ipcRenderer.invoke("source:connect", { kind, sourceId, quality }); },
  disconnectNativeSource: () => { stopSharedFrames(); return ipcRenderer.invoke("source:disconnect"); },
  checkForUpdates: () => ipcRenderer.invoke("app:check-update"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  nativeSourceFrameReady: () => ipcRenderer.send("source:frame-ready"),
  onNativeSourceFrame: (callback) => {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on("source:frame", listener);
    return () => ipcRenderer.removeListener("source:frame", listener);
  },
  onNativeSourceStatus: (callback) => {
    const listener = (_event, status) => {
      if (status?.transport === "shared-memory" && !startSharedFrames(status)) callback({ status: "error", name: "The NDI shared-memory transport could not open." });
      else callback(status);
    };
    ipcRenderer.on("source:status", listener);
    return () => ipcRenderer.removeListener("source:status", listener);
  },
  onNativeSourceMetrics: (callback) => { sharedMetricListeners.add(callback); return () => sharedMetricListeners.delete(callback); },
  onPatternOutputStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("output:status", listener);
    return () => ipcRenderer.removeListener("output:status", listener);
  },
  onResolumeXmlUpdated: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("resolume:xml-updated", listener);
    return () => ipcRenderer.removeListener("resolume:xml-updated", listener);
  },
  onResolumeLinkError: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("resolume:link-error", listener);
    return () => ipcRenderer.removeListener("resolume:link-error", listener);
  },
});
