const { BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function registerTechnicalPlots(editorWindows, workspacePaths) {
  const active = new Set();
  ipcMain.handle('plots:printers', async event => {
    if (!editorWindows.has(event.sender.id)) return { error: 'Open an OpticMesh project first.' };
    try { return { printers: await event.sender.getPrintersAsync() }; } catch (error) { return { error: error.message || 'Unable to list printers.' }; }
  });
  ipcMain.handle('plots:print', async (event, payload) => {
    const editor = editorWindows.get(event.sender.id)?.window;
    if (!editor || active.has(event.sender.id)) return { error: 'A plot export is already open.' };
    if (!payload || !Array.isArray(payload.pages) || !payload.pages.length || payload.pages.length > 150 || payload.pages.some(p => typeof p !== 'string' || !p.startsWith('<svg') || p.length > 30000000) || payload.pages.reduce((n, p) => n + p.length, 0) > 120000000) return { error: 'The plot set is too large. Export fewer sheets.' };
    active.add(event.sender.id);
    let printWindow;
    try {
      let destination;
      if (payload.print) {
        const printers = await event.sender.getPrintersAsync();
        if (!printers.some(p => p.name === payload.deviceName)) return { error: 'The selected printer is no longer available.' };
      }
      if (!payload.print) {
        const name = String(payload.name || 'Technical plots').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120);
        const result = await dialog.showSaveDialog(editor, { title: 'Export technical plots', defaultPath: path.join(workspacePaths().exports, name + ' - Technical plots.pdf'), filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
        if (result.canceled || !result.filePath) return { canceled: true };
        destination = result.filePath;
      }
      printWindow = new BrowserWindow({ show: false, parent: editor, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false, partition: 'plots-print' } });
      printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      printWindow.webContents.on('will-navigate', e => e.preventDefault());
      const title = String(payload.name || 'Technical plots').slice(0, 160).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - Technical plots</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'"><style>@page{size:A3 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}article{width:420mm;height:297mm;break-after:page;overflow:hidden}article:last-child{break-after:auto}svg{width:420mm;height:297mm;display:block}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${payload.pages.map(p => `<article>${p}</article>`).join('')}</body></html>`;
      await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await printWindow.webContents.executeJavaScript(`Promise.all(Array.from(document.querySelectorAll('image'), element => new Promise((resolve, reject) => { const img = new Image(); img.onload = resolve; img.onerror = () => reject(new Error('A plot image could not be loaded.')); img.src = element.getAttribute('href'); }))).then(() => document.fonts.ready).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))).then(() => true)`);
      if (payload.print) {
        await new Promise((resolve, reject) => printWindow.webContents.print({ silent: true, deviceName: payload.deviceName, copies: Math.max(1, Math.min(99, Math.round(Number(payload.copies) || 1))), printBackground: true, landscape: true, pageSize: 'A3', margins: { marginType: 'none' } }, (success, reason) => success ? resolve() : reject(new Error(reason || 'Printing was cancelled.'))));
      } else {
        const pdf = await printWindow.webContents.printToPDF({ pageSize: 'A3', landscape: true, printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        await fs.writeFile(destination, pdf);
      }
      return { path: destination };
    } catch (error) { return { error: error.message || 'Unable to export the plot set.' }; }
    finally { if (printWindow && !printWindow.isDestroyed()) printWindow.destroy(); active.delete(event.sender.id); }
  });
}
module.exports = { registerTechnicalPlots };
