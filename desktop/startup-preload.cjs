const { ipcRenderer } = require("electron");
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("close").addEventListener("click", () => ipcRenderer.send("startup:action", "close"));
  document.getElementById("retry").addEventListener("click", () => ipcRenderer.send("startup:action", "retry"));
  ipcRenderer.on("startup:status", (_event, status) => {
    document.getElementById("status").textContent = status.message;
    document.getElementById("retry").hidden = !status.failed;
    document.body.classList.toggle("failed", status.failed);
  });
});
