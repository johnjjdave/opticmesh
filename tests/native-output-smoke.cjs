const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const bridge = process.env.OPTICMESH_BRIDGE || path.resolve(__dirname, "..", "native", "build", "lo2s-source-bridge.exe");
const initialWidth = Math.max(1, Number.parseInt(process.env.OPTICMESH_SMOKE_WIDTH || "4", 10));
const initialHeight = Math.max(1, Number.parseInt(process.env.OPTICMESH_SMOKE_HEIGHT || "2", 10));
const resizedWidth = Math.max(1, Number.parseInt(process.env.OPTICMESH_SMOKE_RESIZED_WIDTH || String(initialWidth === 4 ? 5 : initialWidth), 10));
const resizedHeight = Math.max(1, Number.parseInt(process.env.OPTICMESH_SMOKE_RESIZED_HEIGHT || String(initialHeight === 2 ? 3 : initialHeight), 10));

function packet(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  // Exercise Windows text-mode hazards (CR/LF and Ctrl+Z) as well as arbitrary RGBA bytes.
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = index & 0xff;
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0x4632534c, 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(width, 8);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width * 4, 16);
  header.writeUInt32LE(30, 20);
  header.writeUInt32LE(1, 24);
  header.writeUInt32LE(pixels.length, 28);
  return { header, pixels };
}

function writePacket(child, width, height) {
  const { header, pixels } = packet(width, height);
  child.stdin.write(header);
  child.stdin.write(pixels);
}

function testSender(kind) {
  return new Promise((resolve, reject) => {
    const child = spawn(bridge, ["--send", kind, "--name", `LO2S - OpticMesh ${kind.toUpperCase()} Smoke Test`], { windowsHide: true });
    let stderr = "", settled = false, firstFrameSeen = false;
    const timer = setTimeout(() => finish(new Error(`${kind} sender timed out: ${stderr}`)), 8000);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.stdin.end(); } catch {}
      if (error) reject(error); else resolve();
    };
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      const lines = stderr.split(/\r?\n/);
      stderr = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const status = JSON.parse(line);
        if (status.status === "error") return finish(new Error(status.name));
        if (status.status === "connected") {
          if (!firstFrameSeen) {
            assert.equal(status.width, initialWidth);
            assert.equal(status.height, initialHeight);
            firstFrameSeen = true;
            writePacket(child, resizedWidth, resizedHeight);
          } else {
            assert.equal(status.width, resizedWidth);
            assert.equal(status.height, resizedHeight);
            return finish();
          }
        }
      }
    });
    child.stdin.on("error", finish);
    child.once("error", finish);
    child.once("exit", (code) => { if (!settled) finish(new Error(`${kind} sender exited with ${code}: ${stderr}`)); });
    writePacket(child, initialWidth, initialHeight);
  });
}

(async () => {
  await testSender("spout");
  await testSender("ndi");
  console.log("Native Spout and NDI output smoke tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
