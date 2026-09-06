import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { get } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_URL = "https://ndi.link/NDIRedistV6";
const RUNTIME_VERSION = "NDI 6 Runtime (official redistributable, retrieved 2026-08-31)";
const EXPECTED_SHA256 = "7EE73EEDB56402BCA5100868353DBAB4E944B6C37D2D9881580698A3B61346CD";
const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(desktopDirectory, "build", "ndi-runtime", "NDI 6 Runtime.exe");
const temporary = `${target}.download`;

async function sha256(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex").toUpperCase();
}

function download(url, destination, redirects = 0) {
  if (redirects > 5) throw new Error("Too many redirects while downloading the NDI Runtime.");
  return new Promise((resolveDownload, reject) => {
    const request = get(url, { headers: { "User-Agent": "LO2S-OpticMesh-Release-Builder" } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        const next = new URL(response.headers.location, url).href;
        download(next, destination, redirects + 1).then(resolveDownload, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`NDI Runtime download failed with HTTP ${response.statusCode || "unknown"}.`));
        return;
      }
      const output = createWriteStream(destination);
      response.pipe(output);
      output.on("finish", () => output.close(resolveDownload));
      output.on("error", reject);
    });
    request.on("error", reject);
  });
}

await mkdir(dirname(target), { recursive: true });
let currentHash = "";
try {
  await stat(target);
  currentHash = await sha256(target);
} catch {}

if (currentHash !== EXPECTED_SHA256) {
  await rm(temporary, { force: true });
  console.log(`Downloading ${RUNTIME_VERSION} from ${RUNTIME_URL}`);
  await download(RUNTIME_URL, temporary);
  const downloadedHash = await sha256(temporary);
  if (downloadedHash !== EXPECTED_SHA256) {
    await rm(temporary, { force: true });
    throw new Error(`The official NDI Runtime changed (expected ${EXPECTED_SHA256}, received ${downloadedHash}). Review the current NDI release and licensing terms before updating the pinned hash.`);
  }
  await rm(target, { force: true });
  await rename(temporary, target);
}

console.log(`NDI Runtime ready: ${target}`);
console.log(`SHA-256: ${EXPECTED_SHA256}`);
