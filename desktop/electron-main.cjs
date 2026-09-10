const { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { fileURLToPath } = require("node:url");
const { promisify } = require("node:util");
const { writeCompiledProject } = require("./compile-project.cjs");
const { createStartupWindow } = require("./startup-window.cjs");
const editorWindows = new Map();
let quitRequested = false;

const { DesktopProjectEncoder } = require("./project-encoder.cjs");
const { createSystemPerformance } = require("./system-performance.cjs");
const readSystemPerformance = createSystemPerformance(() => app.getAppMetrics());

const appRoot = __dirname;
const { createRecentProjects } = require("./recent-projects.cjs");
const recentProjects = createRecentProjects(path.join(app.getPath("userData"), "recent-projects.json"));
const rememberRecentProject = projectPath => recentProjects.remember(projectPath).catch(error => console.warn("Unable to update recent projects:", error.message));
async function readNamedProject(projectPath) {
  try {
    const resolved = path.resolve(projectPath);
    if (path.extname(resolved).toLowerCase() !== ".lo2s") throw new Error("Choose an OpticMesh .lo2s project.");
    const stat = await fs.promises.stat(resolved);
    if (stat.size > MAX_PROJECT_BYTES) throw new Error("This project exceeds the supported project size.");
    const content = await fs.promises.readFile(resolved, "utf8");
    projectBuffer({ data: Buffer.from(content, "utf8") });
    writableProjectPaths.add(resolved);
    return { ok: true, path: resolved, name: path.basename(resolved), content };
  } catch (error) {
    return { ok: false, error: error.code === "ENOENT" ? "This project could not be found. It may have been moved or deleted." : error.message };
  }
}
const MAX_XML_BYTES = 32 * 1024 * 1024;
const projectLimits = require("./project-limits.json");
const MAX_PROJECT_BYTES = projectLimits.projectMiB * 1024 * 1024;
const SUPPORTED_PROJECT_SCHEMA = 4;
const WORKSPACE_DIRECTORY_NAME = "OpticMesh";
let linkedDirectory = null;
let linkedWatcher = null;
let linkedPoller = null;
let linkedDebounce = null;
let lastLinkedSignature = "";
let nativeSourceProcess = null;
let nativeSourceOwner = null;
let nativeFramePending = false;
let nativeOutputProcess = null;
let nativeOutputOwner = null;
let nativeOutputWriting = false;
let nativeOutputLatest = null;
let nativeOutputLastError = "";
let exportDirectories = null;
const writableProjectPaths = new Set();
const execFileAsync = promisify(execFile);
let nativeBridgePath = path.join(appRoot, "native", "lo2s-source-bridge.exe");

function workspacePaths() {
  const root = path.join(app.getPath("documents"), WORKSPACE_DIRECTORY_NAME);
  return {
    root,
    projects: path.join(root, "Projects"),
    exports: path.join(root, "Exports"),
    testPatterns: path.join(root, "Test Patterns"),
    startupProject: path.join(root, "Projects", "Startup Project.lo2s"),
    previousStartupProject: path.join(root, "Projects", "Startup Project.previous.lo2s"),
  };
}

async function ensureWorkspaceDirectories() {
  const locations = workspacePaths();
  await Promise.all([locations.projects, locations.exports, locations.testPatterns].map((directory) => fs.promises.mkdir(directory, { recursive: true })));
  return locations;
}

function projectBuffer(payload, projectTitle, inspect) {
  const data = Buffer.from(payload?.data || []);
  if (!data.length || data.length > MAX_PROJECT_BYTES) throw new Error(`The project data is empty or exceeds the ${projectLimits.projectMiB} MiB safety limit.`);
  const parsed = JSON.parse(data.toString("utf8"));
  if (parsed?.format !== "opticmesh-project") throw new Error("The project data is not a LO2S - OpticMesh project.");
  if (Number(parsed.version || 1) > SUPPORTED_PROJECT_SCHEMA) throw new Error(`This project uses schema ${parsed.version}, but this version supports up to schema ${SUPPORTED_PROJECT_SCHEMA}.`);
  inspect?.(parsed);
  if (projectTitle) {
    parsed.config = { ...parsed.config, project: projectTitle };
    const renamed = Buffer.from(JSON.stringify(parsed), "utf8");
    if (renamed.length > MAX_PROJECT_BYTES) throw new Error(`The project exceeds the ${projectLimits.projectMiB} MiB safety limit.`);
    return renamed;
  }
  return data;
}

function ensureWorkspaceDirectoriesSync() {
  const locations = workspacePaths();
  for (const directory of [locations.projects, locations.exports, locations.testPatterns]) fs.mkdirSync(directory, { recursive: true });
  return locations;
}

function atomicWriteProjectSync(targetPath, data, backupPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, data, { flag: "wx", flush: true });
    if (backupPath && fs.existsSync(targetPath)) fs.copyFileSync(targetPath, backupPath);
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

async function atomicWriteProject(targetPath, data, backupPath) {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await fs.promises.open(temporaryPath, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (backupPath && fs.existsSync(targetPath)) await fs.promises.copyFile(targetPath, backupPath);
    await fs.promises.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function numericVersion(value) {
  return String(value || "").replace(/^v/i, "").split("-")[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(candidate, current) {
  const left = numericVersion(candidate), right = numericVersion(current);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return false;
}

async function checkForUpdate() {
  try {
    const response = await net.fetch("https://api.github.com/repos/johnjjdave/opticmesh/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": `LO2S-OpticMesh/${app.getVersion()}` },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
    return { ok: true, available: isNewerVersion(latestVersion, app.getVersion()), currentVersion: app.getVersion(), latestVersion, name: release.name || release.tag_name, url: release.html_url };
  } catch (error) {
    return { ok: false, available: false, currentVersion: app.getVersion(), error: error.message || "Unable to check for updates." };
  }
}

async function loadExportDirectories() {
  if (exportDirectories) return exportDirectories;
  const locations = await ensureWorkspaceDirectories();
  const defaults = { project: locations.projects, scene3d: locations.exports, png: locations.testPatterns };
  try { exportDirectories = { ...defaults, ...JSON.parse(await fs.promises.readFile(path.join(app.getPath("userData"), "export-locations-v2.json"), "utf8")) }; }
  catch { exportDirectories = defaults; }
  return exportDirectories;
}

async function rememberExportDirectory(category, filePath) {
  const directories = await loadExportDirectories();
  directories[category] = path.dirname(filePath);
  await fs.promises.mkdir(app.getPath("userData"), { recursive: true });
  await fs.promises.writeFile(path.join(app.getPath("userData"), "export-locations-v2.json"), JSON.stringify(directories));
}

async function prepareNativeBridge() {
  if (!app.isPackaged) return;
  const bundledDirectory = path.join(process.resourcesPath, "app.asar.unpacked", "native");
  const installedDirectory = path.join(app.getPath("userData"), "native", app.getVersion());
  await fs.promises.mkdir(installedDirectory, { recursive: true });
  for (const filename of ["lo2s-source-bridge.exe", "SpoutLibrary.dll"]) {
    await fs.promises.copyFile(path.join(bundledDirectory, filename), path.join(installedDirectory, filename));
  }
  nativeBridgePath = path.join(installedDirectory, "lo2s-source-bridge.exe");
}

class NativeFrameParser {
  constructor(onFrame) {
    this.chunks = [];
    this.byteLength = 0;
    this.expectedPayload = null;
    this.header = null;
    this.onFrame = onFrame;
  }

  push(chunk) {
    this.chunks.push(chunk);
    this.byteLength += chunk.length;
    while (true) {
      if (!this.header) {
        if (this.byteLength < 32) return;
        const header = this.consume(32);
        if (header.readUInt32LE(0) !== 0x4632534c || header.readUInt32LE(4) !== 1) throw new Error("The native source bridge returned an invalid frame.");
        this.header = {
          width: header.readUInt32LE(8), height: header.readUInt32LE(12), stride: header.readUInt32LE(16),
          fpsN: header.readUInt32LE(20), fpsD: header.readUInt32LE(24),
        };
        this.expectedPayload = header.readUInt32LE(28);
        if (!this.expectedPayload || this.expectedPayload > 256 * 1024 * 1024) throw new Error("The native source frame is outside the supported size.");
      }
      if (this.byteLength < this.expectedPayload) return;
      const data = this.consume(this.expectedPayload);
      const frame = { ...this.header, data };
      this.header = null;
      this.expectedPayload = null;
      this.onFrame(frame);
    }
  }

  consume(size) {
    const result = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const chunk = this.chunks[0];
      const count = Math.min(chunk.length, size - offset);
      chunk.copy(result, offset, 0, count);
      offset += count;
      this.byteLength -= count;
      if (count === chunk.length) this.chunks.shift(); else this.chunks[0] = chunk.subarray(count);
    }
    return result;
  }
}

async function stopNativeSource() {
  const child = nativeSourceProcess;
  nativeSourceProcess = null;
  nativeSourceOwner = null;
  nativeFramePending = false;
  if (!child || child.killed) return;
  try { child.stdin?.write("q"); } catch {}
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(); }, 900);
    child.once("exit", finish);
  });
}

async function stopNativeOutput() {
  const child = nativeOutputProcess;
  nativeOutputProcess = null;
  nativeOutputOwner = null;
  nativeOutputWriting = false;
  nativeOutputLatest = null;
  nativeOutputLastError = "";
  if (!child || child.killed) return;
  try { child.stdin?.end(); } catch {}
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(); }, 1200);
    child.once("exit", finish);
  });
}

function reportNativeOutputError(child, error) {
  const message = error?.code === "EPIPE"
    ? (nativeOutputLastError || "The native output sender closed unexpectedly. Check the output status and try starting it again.")
    : (error?.message || "The native output sender stopped unexpectedly.");
  if (nativeOutputProcess !== child) return;
  nativeOutputLastError = message;
  const owner = nativeOutputOwner;
  nativeOutputProcess = null;
  nativeOutputOwner = null;
  nativeOutputWriting = false;
  nativeOutputLatest = null;
  if (owner && !owner.isDestroyed()) owner.send("output:status", { status: "error", name: message });
  try { child.stdin?.destroy(); } catch {}
  try { if (!child.killed) child.kill(); } catch {}
}

function flushNativeOutput() {
  const child = nativeOutputProcess;
  const frame = nativeOutputLatest;
  if (!child || child.killed || child.exitCode !== null || !child.stdin?.writable || child.stdin.destroyed || nativeOutputWriting || !frame) return;
  nativeOutputLatest = null;
  nativeOutputWriting = true;
  const header = Buffer.allocUnsafe(32);
  header.writeUInt32LE(0x4632534c, 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(frame.width, 8);
  header.writeUInt32LE(frame.height, 12);
  header.writeUInt32LE(frame.width * 4, 16);
  header.writeUInt32LE(frame.fpsN, 20);
  header.writeUInt32LE(frame.fpsD, 24);
  header.writeUInt32LE(frame.data.length, 28);
  try {
    child.stdin.write(header, (error) => { if (error) reportNativeOutputError(child, error); });
    child.stdin.write(frame.data, (error) => {
      if (error) { reportNativeOutputError(child, error); return; }
      if (nativeOutputProcess !== child) return;
      nativeOutputWriting = false;
      flushNativeOutput();
    });
  } catch (error) {
    reportNativeOutputError(child, error);
  }
}

async function listNativeSources(kind) {
  if (!fs.existsSync(nativeBridgePath)) return { ok: false, error: "The native source receiver is missing from this beta." };
  try {
    const { stdout } = await execFileAsync(nativeBridgePath, ["--list", kind], { windowsHide: true, timeout: 11000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } catch (error) {
    return { ok: false, error: error.message || "Unable to scan native sources." };
  }
}

function resolveFileRequest(requestUrl) {
  const parsed = new URL(requestUrl);
  let requestPath = fileURLToPath(parsed);

  if (requestPath.startsWith(`${path.sep}brand${path.sep}`) || requestPath.startsWith(`brand${path.sep}`)) {
    requestPath = requestPath.replace(new RegExp(`^${path.sep}?brand${path.sep}`), "");
    return path.join(appRoot, "dist", "brand", requestPath);
  }

  return requestPath;
}

async function readXmlFile(filePath, linked = false) {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile() || path.extname(filePath).toLowerCase() !== ".xml") throw new Error("Please choose a Resolume XML preset.");
  if (stats.size > MAX_XML_BYTES) throw new Error("The XML preset is larger than the 32 MB safety limit.");
  return {
    ok: true,
    linked,
    path: filePath,
    name: path.basename(filePath),
    mtimeMs: stats.mtimeMs,
    content: await fs.promises.readFile(filePath, "utf8"),
  };
}

async function listXmlFiles(directory) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listXmlFiles(entryPath));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".xml") files.push(entryPath);
  }
  return files;
}

async function newestResolumeXml(directory) {
  const files = await listXmlFiles(directory);
  const candidates = await Promise.all(files.map(async (filePath) => ({ filePath, stats: await fs.promises.stat(filePath) })));
  candidates.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  return candidates[0]?.filePath || null;
}

function stopResolumeLink() {
  if (linkedWatcher) linkedWatcher.close();
  if (linkedPoller) clearInterval(linkedPoller);
  if (linkedDebounce) clearTimeout(linkedDebounce);
  linkedWatcher = null;
  linkedPoller = null;
  linkedDebounce = null;
  linkedDirectory = null;
  lastLinkedSignature = "";
}

async function refreshResolumeLink(window, force = false) {
  if (!linkedDirectory || window.isDestroyed()) return null;
  const filePath = await newestResolumeXml(linkedDirectory);
  if (!filePath) throw new Error("No Resolume Advanced Output XML presets were found in this folder.");
  const result = await readXmlFile(filePath, true);
  const signature = `${result.path}:${result.mtimeMs}`;
  if (force || signature !== lastLinkedSignature) {
    lastLinkedSignature = signature;
    if (!force) window.webContents.send("resolume:xml-updated", result);
  }
  return result;
}

function scheduleResolumeRefresh(window) {
  if (linkedDebounce) clearTimeout(linkedDebounce);
  linkedDebounce = setTimeout(() => {
    refreshResolumeLink(window).catch((error) => {
      if (!window.isDestroyed()) window.webContents.send("resolume:link-error", { error: error.message });
    });
  }, 250);
}

async function startResolumeLink(window) {
  stopResolumeLink();
  linkedDirectory = path.join(app.getPath("documents"), "Resolume Arena", "Presets", "Advanced Output");
  await fs.promises.access(linkedDirectory, fs.constants.R_OK);
  const initial = await refreshResolumeLink(window, true);
  linkedWatcher = fs.watch(linkedDirectory, { recursive: true }, () => scheduleResolumeRefresh(window));
  linkedPoller = setInterval(() => scheduleResolumeRefresh(window), 1500);
  return initial;
}

const windowedOutputs = new Map();

ipcMain.handle("windowed-output:gesture", (event, command) => {
  // Only the owning editor renderer can move its own preview window.
  const entry = windowedOutputs.get(event.sender.id);
  if (!entry || entry.window.isDestroyed()) return;
  if (command?.action === "ready") entry.window.setAlwaysOnTop(true, "screen-saver");
  else if (command?.action === "begin-move" || command?.action === "begin-resize") {
    entry.gesture = { action: command.action, bounds: entry.window.getBounds() };
  } else if (command?.action === "end") entry.gesture = null;
  else if (command?.action === "update" && entry.gesture && Number.isFinite(command.x) && Number.isFinite(command.y)) {
    const dx = Math.round(Math.max(-20000, Math.min(20000, command.x)));
    const dy = Math.round(Math.max(-20000, Math.min(20000, command.y)));
    const bounds = entry.gesture.bounds;
    entry.window.setBounds(entry.gesture.action === "begin-move"
      ? { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
      : { ...bounds, width: Math.max(240, Math.min(7680, bounds.width + dx)), height: Math.max(160, Math.min(4320, bounds.height + dy)) });
  }
});

function createWindow() {
  const window = new BrowserWindow({
    title: "LO2S - OpticMesh",
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    center: true,
    show: false,
    backgroundColor: "#18191B",
    icon: path.join(appRoot, "icons", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  const state = { window, ready: false, allowClose: false, closePending: false, splash: null };
  editorWindows.set(window.webContents.id, state);
  state.splash = createStartupWindow(appRoot, () => window.destroy(), () => loadEditor());
  window.on("close", event => {
    if (state.allowClose || window.webContents.isDestroyed() || window.webContents.isCrashed()) return;
    if (!state.ready) return; // No editing has been possible during startup.
    event.preventDefault();
    state.closePending = true;
    window.webContents.send("app:close-requested");
  });
  window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) state.splash?.update("OpticMesh could not start. Please try again.", true);
  });
  window.webContents.on("render-process-gone", () => state.splash?.update("OpticMesh could not finish loading. Please try again.", true));
  window.once("closed", () => { state.splash?.close(); for (const [id, entry] of editorWindows) if (entry === state) editorWindows.delete(id); });
  window.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (url === "about:blank" && frameName === "opticmesh-windowed-output") {
      return { action: "allow", overrideBrowserWindowOptions: {
        title: "OpticMesh — Floating Preview", width: 640, height: 360, minWidth: 240, minHeight: 160,
        frame: false, thickFrame: false, roundedCorners: false, resizable: false, maximizable: false, fullscreenable: false,
        alwaysOnTop: true, autoHideMenuBar: true, backgroundColor: "#090b0c",
        webPreferences: { preload: path.join(appRoot, "windowed-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
      } };
    }
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("did-create-window", (preview, details) => {
    if (details.frameName !== "opticmesh-windowed-output") return;
    const ownerId = window.webContents.id;
    windowedOutputs.get(ownerId)?.window.close();
    const entry = { window: preview, gesture: null };
    windowedOutputs.set(ownerId, entry);
    // Reapply after initial navigation; about:blank portals also send "ready".
    // Use the topmost Windows level so the output remains above other apps.
    preview.webContents.once("did-finish-load", () => {
      setImmediate(() => { if (!preview.isDestroyed()) preview.setAlwaysOnTop(true, "screen-saver"); });
    });
    preview.setResizable(false);
    preview.setMaximizable(false);
    preview.setMenu(null);
    preview.webContents.on("will-navigate", (event) => event.preventDefault());
    preview.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const closePreview = () => { if (!preview.isDestroyed()) preview.close(); };
    preview.on("closed", () => {
      window.removeListener("closed", closePreview);
      if (windowedOutputs.get(ownerId) === entry) windowedOutputs.delete(ownerId);
    });
    window.once("closed", closePreview);
  });
  window.on("closed", () => { stopResolumeLink(); void stopNativeSource(); void stopNativeOutput(); });
  const localDevUrl = !app.isPackaged && process.env.OPTICMESH_DEV_URL;
  const loadEditor = () => {
    if (localDevUrl) {
      const parsed = new URL(localDevUrl);
      if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new Error("Development preview must use localhost.");
      void window.loadURL(parsed.href).catch(() => {}); // did-fail-load offers Retry.
    } else void window.loadFile(path.join(appRoot, "dist", "index.html")).catch(() => {});
  };
  loadEditor();
}

app.whenReady().then(async () => {
  ipcMain.on("app:startup-progress", (event, stage) => {
    const state = editorWindows.get(event.sender.id);
    if (!state || state.ready) return;
    if (stage === "project") state.splash?.update("Opening your project…");
    else if (stage === "scene") state.splash?.update("Preparing your 3D view…");
    else if (stage === "failed") state.splash?.update("OpticMesh could not finish loading. Please try again.", true);
    else if (stage === "ready") { state.ready = true; state.window.show(); state.splash?.close(); state.splash = null; }
  });
  ipcMain.handle("app:confirm-close", event => {
    const state = editorWindows.get(event.sender.id);
    if (!state?.closePending) return;
    state.allowClose = true;
    if (quitRequested) app.quit(); else state.window.close();
  });
  try { await ensureWorkspaceDirectories(); }
  catch (error) { console.error("Unable to prepare the OpticMesh workspace:", error); }
  try { await prepareNativeBridge(); }
  catch (error) { console.error("Unable to prepare native source bridge:", error); }
  protocol.interceptFileProtocol("file", (request, callback) => callback({ path: resolveFileRequest(request.url) }));

  ipcMain.handle("performance:snapshot", () => readSystemPerformance());
  ipcMain.handle("resolume:choose-xml", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose Resolume Advanced Output XML",
      defaultPath: path.join(app.getPath("documents"), "Resolume Arena", "Presets", "Advanced Output"),
      properties: ["openFile"],
      filters: [{ name: "Resolume Advanced Output XML", extensions: ["xml"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    stopResolumeLink();
    try { return await readXmlFile(result.filePaths[0]); }
    catch (error) { return { ok: false, error: error.message }; }
  });

  ipcMain.handle("resolume:link-latest", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { ok: false, error: "The application window is unavailable." };
    try { return await startResolumeLink(window); }
    catch (error) { stopResolumeLink(); return { ok: false, error: `Unable to link Resolume: ${error.message}` }; }
  });

  ipcMain.handle("resolume:unlink", async () => { stopResolumeLink(); return { ok: true }; });

  ipcMain.handle("source:list", async (_event, kind) => {
    if (kind !== "ndi" && kind !== "spout") return { ok: false, error: "Choose NDI or Spout before scanning." };
    return listNativeSources(kind);
  });

  ipcMain.handle("source:connect", async (event, payload) => {
    const kind = payload?.kind;
    if (kind !== "ndi" && kind !== "spout") return { ok: false, error: "Choose NDI or Spout before connecting." };
    if (!fs.existsSync(nativeBridgePath)) return { ok: false, error: "The native source receiver is missing from this beta." };
    await stopNativeSource();
    const args = ["--capture", kind, "--source", String(payload?.sourceId || ""), "--quality", payload?.quality === "quality" ? "quality" : "latency"];
    const child = spawn(nativeBridgePath, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    nativeSourceProcess = child;
    nativeSourceOwner = event.sender;
    const parser = new NativeFrameParser((frame) => {
      if (!nativeSourceOwner || nativeSourceOwner.isDestroyed() || nativeFramePending) return;
      nativeFramePending = true;
      nativeSourceOwner.send("source:frame", frame);
    });
    child.stdout.on("data", (chunk) => {
      try { parser.push(chunk); }
      catch (error) { if (nativeSourceOwner && !nativeSourceOwner.isDestroyed()) nativeSourceOwner.send("source:status", { status: "error", name: error.message }); void stopNativeSource(); }
    });
    let stderrBuffer = "";
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString("utf8");
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim() || !nativeSourceOwner || nativeSourceOwner.isDestroyed()) continue;
        try { nativeSourceOwner.send("source:status", JSON.parse(line)); }
        catch { nativeSourceOwner.send("source:status", { status: "message", name: line.trim() }); }
      }
    });
    child.once("error", (error) => {
      if (nativeSourceOwner && !nativeSourceOwner.isDestroyed()) nativeSourceOwner.send("source:status", { status: "error", name: error.message });
      void stopNativeSource();
    });
    child.once("exit", (code) => {
      if (nativeSourceProcess !== child) return;
      if (nativeSourceOwner && !nativeSourceOwner.isDestroyed()) nativeSourceOwner.send("source:status", { status: code === 0 ? "disconnected" : "error", name: code === 0 ? "Source disconnected" : `Native receiver stopped (${code})` });
      nativeSourceProcess = null;
      nativeSourceOwner = null;
      nativeFramePending = false;
    });
    return { ok: true };
  });

  ipcMain.handle("source:disconnect", async () => { await stopNativeSource(); return { ok: true }; });
  ipcMain.handle("output:start", async (event, payload) => {
    const kind = payload?.kind;
    if (kind !== "ndi" && kind !== "spout") return { ok: false, error: "Choose NDI or Spout output." };
    if (!fs.existsSync(nativeBridgePath)) return { ok: false, error: "The native output helper is missing." };
    await stopNativeOutput();
    const child = spawn(nativeBridgePath, ["--send", kind, "--name", String(payload?.name || "LO2S - OpticMesh")], { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
    nativeOutputProcess = child;
    nativeOutputOwner = event.sender;
    nativeOutputLastError = "";
    child.stdin.on("error", (error) => reportNativeOutputError(child, error));
    let stderrBuffer = "";
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString("utf8");
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim() || !nativeOutputOwner || nativeOutputOwner.isDestroyed()) continue;
        try {
          const status = JSON.parse(line);
          if (status.status === "error") nativeOutputLastError = status.name || "Native output failed.";
          nativeOutputOwner.send("output:status", status);
        }
        catch { nativeOutputOwner.send("output:status", { status: "message", name: line.trim() }); }
      }
    });
    child.once("error", (error) => {
      reportNativeOutputError(child, error);
    });
    child.once("exit", (code) => {
      if (nativeOutputProcess !== child) return;
      if (nativeOutputOwner && !nativeOutputOwner.isDestroyed()) nativeOutputOwner.send("output:status", { status: code === 0 ? "disconnected" : "error", name: code === 0 ? "Output stopped" : (nativeOutputLastError || `Native sender stopped (${code})`) });
      nativeOutputProcess = null;
      nativeOutputOwner = null;
      nativeOutputWriting = false;
      nativeOutputLatest = null;
      nativeOutputLastError = "";
    });
    event.sender.send("output:status", { status: "connecting", name: `Starting ${kind.toUpperCase()} output…` });
    return { ok: true };
  });
  ipcMain.handle("output:frame", async (event, payload) => {
    if (event.sender !== nativeOutputOwner || !nativeOutputProcess) return { ok: false, error: "Output is not running." };
    const width = Math.max(1, Math.floor(Number(payload?.width) || 0));
    const height = Math.max(1, Math.floor(Number(payload?.height) || 0));
    const data = Buffer.from(payload?.data || []);
    const expected = width * height * 4;
    if (expected !== data.length || expected > 512 * 1024 * 1024) return { ok: false, error: "The output frame dimensions are invalid." };
    const fpsN = Math.max(1, Math.min(30, Math.round(Number(payload?.fps) || 30)));
    nativeOutputLatest = { width, height, fpsN, fpsD: 1, data };
    flushNativeOutput();
    return { ok: true };
  });
  ipcMain.handle("output:stop", async () => { await stopNativeOutput(); return { ok: true }; });
  ipcMain.handle("spacemouse:settings", async (event) => {
    if (process.platform !== "win32" || !editorWindows.has(event.sender.id)) return { ok: false, error: "3Dconnexion settings are available in the Windows editor." };
    // Use the same command as 3Dconnexion Home, preserving the driver's profile controls.
    let directory = path.join(process.env.ProgramFiles || "C:\\Program Files", "3Dconnexion", "3DxWare", "3DxWinCore");
    try {
      const { stdout } = await promisify(execFile)("reg.exe", ["query", "HKLM\\SOFTWARE\\3Dconnexion\\3DxWare", "/v", "Home Directory"], { windowsHide: true });
      const match = stdout.match(/Home Directory\s+REG_SZ\s+(.+)/);
      if (match) directory = match[1].trim();
    } catch { /* Use the standard driver installation when no registry entry exists. */ }
    const executable = path.join(directory, "3DxService.exe");
    if (!fs.existsSync(executable)) return { ok: false, error: "Install 3Dconnexion 3DxWare to access SpaceMouse settings." };
    return new Promise(resolve => {
      const child = spawn(executable, ["-showGUI"], { windowsHide: true, stdio: "ignore" });
      child.once("error", error => resolve({ ok: false, error: error.message }));
      child.once("spawn", () => { child.unref(); resolve({ ok: true }); });
    });
  });
  ipcMain.handle("app:check-update", checkForUpdate);
  ipcMain.handle("app:open-external", async (_event, requestedUrl) => {
    const url = new URL(String(requestedUrl || ""));
    if (url.protocol !== "https:" || url.hostname !== "github.com") return { ok: false };
    await shell.openExternal(url.href);
    return { ok: true };
  });
  ipcMain.on("source:frame-ready", (event) => {
    if (event.sender !== nativeSourceOwner) return;
    nativeFramePending = false;
    try { nativeSourceProcess?.stdin?.write("a"); } catch {}
  });

  ipcMain.handle("export:save", async (_event, payload) => {
    const filename = path.basename(String(payload?.filename || "lo2s-scene.glb"));
    const category = payload?.category === "png" ? "png" : "scene3d";
    const extension = path.extname(filename).slice(1).toLowerCase();
    const labels = { png: "PNG image", glb: "glTF Binary", zip: "ZIP package", mvr: "MVR 1.5 scene meshes", obj: "Wavefront OBJ", gltf: "glTF scene" };
    const directories = await loadExportDirectories();
    const result = await dialog.showSaveDialog({
      title: category === "png" ? "Export LO2S - OpticMesh PNG" : "Export LO2S - OpticMesh 3D scene",
      defaultPath: path.join(directories[category] || app.getPath("documents"), filename),
      filters: [{ name: labels[extension] || "3D scene", extensions: [extension || "glb"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    try {
      await fs.promises.writeFile(result.filePath, Buffer.from(payload.data));
      await rememberExportDirectory(category, result.filePath);
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("project:save", async (_event, payload) => {
    let filename = path.basename(String(payload?.filename || "opticmesh-project.lo2s"));
    if (path.extname(filename).toLowerCase() !== ".lo2s") filename += ".lo2s";
    const directories = await loadExportDirectories();
    const result = await dialog.showSaveDialog({
      title: "Save LO2S - OpticMesh project",
      defaultPath: path.join(directories.project || app.getPath("documents"), filename),
      filters: [{ name: "LO2S - OpticMesh project", extensions: ["lo2s"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    try {
      const projectTitle = path.basename(result.filePath).toLowerCase() === filename.toLowerCase()
        ? undefined : path.basename(result.filePath, path.extname(result.filePath));
      await atomicWriteProject(result.filePath, projectBuffer(payload, projectTitle));
      await rememberExportDirectory("project", result.filePath);
      writableProjectPaths.add(path.resolve(result.filePath));
      await rememberRecentProject(result.filePath);
      return { ok: true, path: result.filePath, projectTitle };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("project:compile", async (_event, payload) => {
    try {
      const directories = await ensureWorkspaceDirectories();
      const suggested = path.basename(String(payload?.name || "OpticMesh Project")).replace(/[<>:"/\\|?*]/g, "-");
      const result = await dialog.showSaveDialog({
        title: "Compile Project — name the new folder", buttonLabel: "Compile",
        defaultPath: path.join(directories.projects, suggested),
        filters: [{ name: "Project folder (no extension)", extensions: ["*"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
      return await writeCompiledProject(result.filePath, payload);
    } catch (error) {
      return { ok: false, error: error.code === "EEXIST" ? "That folder already exists. Compile again with a new name." : error.message };
    }
  });

  ipcMain.handle("export:save-batch", async (_event, payload) => {
    try {
      const locations = await ensureWorkspaceDirectories();
      const files = Array.isArray(payload?.files) ? payload.files : [];
      if (!files.length || files.length > 1000) throw new Error("The export batch is empty or too large.");
      for (const file of files) {
        const filename = path.basename(String(file?.filename || "test-pattern.png"));
        if (path.extname(filename).toLowerCase() !== ".png") throw new Error("Batch test-pattern exports must use PNG files.");
        const data = Buffer.from(file?.data || []);
        if (!data.length || data.length > 512 * 1024 * 1024) throw new Error(`Invalid export data for ${filename}.`);
        await fs.promises.writeFile(path.join(locations.testPatterns, filename), data);
      }
      return { ok: true, count: files.length, path: locations.testPatterns };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("project:open", async () => {
    const locations = await ensureWorkspaceDirectories();
    const result = await dialog.showOpenDialog({
      title: "Open LO2S - OpticMesh project",
      defaultPath: locations.projects,
      properties: ["openFile"],
      filters: [{ name: "LO2S - OpticMesh project", extensions: ["lo2s"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    return readNamedProject(result.filePaths[0]);
  });

  ipcMain.handle("project:recent", () => recentProjects.list());
  ipcMain.handle("project:remember-recent", async (_event, requestedPath) => {
    const resolved = path.resolve(String(requestedPath || ""));
    if (!writableProjectPaths.has(resolved)) return { ok: false };
    await rememberRecentProject(resolved); return { ok: true };
  });
  ipcMain.handle("project:open-recent", async (_event, requestedPath) => {
    const match = (await recentProjects.list()).find(item => item.path.toLowerCase() === String(requestedPath).toLowerCase());
    if (!match) return { ok: false, error: "This project is no longer in Open Recent. Use Open Project to locate it." };
    return readNamedProject(match.path);
  });

  ipcMain.handle("project:overwrite", async (_event, payload) => {
    try {
      const targetPath = path.resolve(String(payload?.path || ""));
      if (path.extname(targetPath).toLowerCase() !== ".lo2s" || !writableProjectPaths.has(targetPath)) throw new Error("This project is not an active named project. Use Save As first.");
      await atomicWriteProject(targetPath, projectBuffer(payload));
      await rememberRecentProject(targetPath);
      return { ok: true, path: targetPath, savedAt: Date.now() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // One cached snapshot per editor renderer; reloads begin with a reset patch.
  const projectEncoders = new Map();
  ipcMain.handle("project:autosave-delta", async (event, patch) => {
    try {
      let encoder = projectEncoders.get(event.sender.id);
      if (!encoder) {
        encoder = new DesktopProjectEncoder();
        const id = event.sender.id;
        projectEncoders.set(id, encoder);
        event.sender.once("destroyed", () => { encoder.dispose(); projectEncoders.delete(id); });
      }
      const locations = await ensureWorkspaceDirectories();
      // JSON encoding/validation runs in a worker. Its full buffer is transferred
      // only to the main process, never copied through the renderer's bridge.
      const data = await encoder.encode(patch);
      if (event.sender.isDestroyed()) throw new Error("Project window closed.");
      await atomicWriteProject(locations.startupProject, data, locations.previousStartupProject);
      return { ok: true, path: locations.startupProject, savedAt: Date.now() };
    } catch (error) { return { ok: false, error: error.message }; }
  });

  ipcMain.handle("project:autosave", async (_event, payload) => {
    try {
      const locations = await ensureWorkspaceDirectories();
      const data = projectBuffer(payload);
      await atomicWriteProject(locations.startupProject, data, locations.previousStartupProject);
      return { ok: true, path: locations.startupProject, savedAt: Date.now() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.on("project:autosave-sync", (event, payload) => {
    try {
      const locations = ensureWorkspaceDirectoriesSync();
      atomicWriteProjectSync(locations.startupProject, projectBuffer(payload), locations.previousStartupProject);
      event.returnValue = { ok: true, path: locations.startupProject, savedAt: Date.now() };
    } catch (error) {
      event.returnValue = { ok: false, error: error.message };
    }
  });

  ipcMain.handle("project:load-startup", async () => {
    const locations = await ensureWorkspaceDirectories();
    for (const candidate of [locations.startupProject, locations.previousStartupProject]) {
      try {
        const content = await fs.promises.readFile(candidate, "utf8");
        let desktopSession;
        projectBuffer({ data: Buffer.from(content, "utf8") }, undefined, parsed => { desktopSession = parsed.desktopSession; });
        let activeProjectPath;
        if (typeof desktopSession?.projectPath === "string" && path.isAbsolute(desktopSession.projectPath) && path.extname(desktopSession.projectPath).toLowerCase() === ".lo2s") {
          const target = path.resolve(desktopSession.projectPath);
          if (target !== locations.startupProject && target !== locations.previousStartupProject) {
            try { if ((await fs.promises.stat(target)).isFile()) { activeProjectPath = target; writableProjectPaths.add(target); } } catch {}
          }
        }
        return { ok: true, restored: true, recoveryUsed: candidate === locations.previousStartupProject, path: candidate, content, activeProjectPath, unsavedChanges: desktopSession?.unsavedChanges !== false || Boolean(desktopSession?.projectPath && !activeProjectPath) };
      } catch (error) {
        if (error.code !== "ENOENT") console.error(`Unable to restore ${candidate}:`, error);
      }
    }
    return { ok: true, restored: false, path: locations.startupProject };
  });

  ipcMain.handle("workspace:paths", async () => ({ ok: true, ...(await ensureWorkspaceDirectories()) }));
  ipcMain.handle("workspace:reveal-projects", async () => { const locations = await ensureWorkspaceDirectories(); const error = await shell.openPath(locations.projects); return error ? { ok: false, error } : { ok: true, path: locations.projects }; });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === "media" || permission === "fullscreen");
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media" || permission === "fullscreen"));

  session.defaultSession.on("will-download", (_event, item) => {
    const extension = path.extname(item.getFilename()).slice(1).toLowerCase() || "png";
    item.setSaveDialogOptions({ title: "Save LO2S file", defaultPath: item.getFilename(), filters: [{ name: extension === "png" ? "PNG image" : "LO2S export", extensions: [extension] }] });
  });

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", event => {
  const pending = [...editorWindows.values()].find(state => state.ready && !state.allowClose && !state.window.webContents.isCrashed());
  if (pending) { event.preventDefault(); quitRequested = true; pending.window.close(); }
});
app.on("will-quit", () => { stopResolumeLink(); void stopNativeSource(); void stopNativeOutput(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
