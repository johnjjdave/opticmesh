const { BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function createStartupWindow(appRoot, onCancel, onRetry) {
  const splash = new BrowserWindow({ title: "OpticMesh — Starting", width: 440, height: 280,
    frame: false, resizable: false, maximizable: false, minimizable: false, show: false,
    backgroundColor: "#111416", autoHideMenuBar: true,
    webPreferences: { preload: path.join(appRoot, "startup-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  let logo = "", font = "";
  for (const directory of [path.join(appRoot, "dist"), path.join(appRoot, "..", "public")]) {
    try { logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(directory, "brand/lo2s-logo-white.svg")).toString("base64")}`; font = fs.readFileSync(path.join(directory, "brand/Geist-Variable.ttf")).toString("base64"); break; } catch {}
  }
  let status = { message: "Starting OpticMesh…", failed: false };
  const send = () => { if (!splash.isDestroyed()) splash.webContents.send("startup:status", status); };
  const action = (event, value) => {
    if (splash.isDestroyed() || event.sender !== splash.webContents) return;
    if (value === "close") onCancel();
    else if (value === "retry" && status.failed) { status = { message: "Starting OpticMesh…", failed: false }; send(); onRetry(); }
  };
  ipcMain.on("startup:action", action);
  splash.on("closed", () => ipcMain.removeListener("startup:action", action));
  splash.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splash.webContents.on("will-navigate", event => event.preventDefault());
  splash.once("ready-to-show", () => { if (!splash.isDestroyed()) { splash.show(); send(); } });
  void splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><title>OpticMesh — Starting</title><style>
  @font-face{font-family:Geist;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:100 900;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#111416;color:#f4f7f8;font:13px/1.5 Geist,Arial,sans-serif;user-select:none}main{height:280px;padding:36px 32px 24px;display:flex;flex-direction:column;justify-content:center;-webkit-app-region:drag}header{display:flex;align-items:center;gap:18px}img{width:96px;height:auto}h1{font-size:27px;letter-spacing:-.8px;margin:0;font-weight:650}p{margin:30px 0 12px;color:#aab3b6;font-size:12px}button{font:inherit;color:#aab3b6;background:transparent;border:0;cursor:pointer;-webkit-app-region:no-drag}button:hover{color:#fff;background:#272c2e}button:focus-visible{outline:2px solid #d4dcd6;outline-offset:2px}.close{position:absolute;right:8px;top:8px;width:32px;height:32px;font-size:19px}.progress{height:2px;background:#343a3d;overflow:hidden}.progress:after{content:'';display:block;width:32%;height:100%;background:#d4dcd6;animation:loading 1.4s ease-in-out infinite}#retry{align-self:flex-end;border:1px solid #41484b;padding:6px 14px;margin-top:16px}body.failed .progress:after{animation:none;width:100%;background:#ffbd63}[hidden]{display:none!important}@keyframes loading{from{transform:translateX(-100%)}to{transform:translateX(415%)}}@media(prefers-reduced-motion:reduce){.progress:after{animation:none}}
  </style></head><body><button class="close" id="close" aria-label="Cancel startup">×</button><main><header>${logo ? `<img src="${logo}" alt="LO2S">` : ""}<h1>OpticMesh</h1></header><p id="status" role="status" aria-live="polite">Starting OpticMesh…</p><div class="progress" role="progressbar" aria-label="Loading OpticMesh"></div><button id="retry" hidden>Retry</button></main></body></html>`)}`);
  return {
    update(message, failed = false) { status = { message, failed }; send(); },
    close() { if (!splash.isDestroyed()) splash.destroy(); },
  };
}
module.exports = { createStartupWindow };
