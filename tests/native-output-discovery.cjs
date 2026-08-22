const assert = require("node:assert/strict");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");

const execFileAsync = promisify(execFile);
const bridge = process.env.OPTICMESH_BRIDGE || path.resolve(__dirname, "..", "desktop", "native", "lo2s-source-bridge.exe");

function frame(width = 64, height = 32) {
  const pixels = Buffer.alloc(width * height * 4);
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

async function verifyDiscovery(kind) {
  const name = `OpticMesh ${kind.toUpperCase()} Discovery Test`;
  const child = spawn(bridge, ["--send", kind, "--name", name], { windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  child.stdin.on("error", () => {});
  const { header, pixels } = frame();
  child.stdin.write(header);
  child.stdin.write(pixels);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${kind} sender did not publish: ${stderr}`)), 5000);
      child.stderr.on("data", () => {
        if (!stderr.includes('"status":"connected"')) return;
        clearTimeout(timer);
        resolve();
      });
      child.once("exit", (code) => reject(new Error(`${kind} sender exited with ${code}: ${stderr}`)));
    });
    const { stdout } = await execFileAsync(bridge, ["--list", kind], { windowsHide: true, timeout: 12000 });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.ok, true, stdout);
    assert.ok(result.sources.some((source) => source.name.includes(name)), `${name} was not discoverable: ${stdout}`);
  } finally {
    try { child.stdin.end(); } catch {}
  }
}

(async () => {
  await verifyDiscovery("spout");
  await verifyDiscovery("ndi");
  console.log("Native Spout and NDI senders were discoverable by a second receiver process.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
