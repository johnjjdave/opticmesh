// GPU regression: a thin, uniformly white screen must not acquire black body
// stripes in the cloned output camera as it recedes. Run with Electron installed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'opticmesh-output-depth-'));
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const source = await fs.readFile(path.join(root, 'app/three-simulation.tsx'), 'utf8');
const geometry = compile(source.slice(source.indexOf('function clipPolygon('), source.indexOf('export default function ThreeSimulation')).replace('export function', 'function'));
const targetSource = await fs.readFile(path.join(root, 'app/simulation-output-target.ts'), 'utf8');
const targetFactory = compile(targetSource.replace('import * as THREE from "three";', '').replace('export function', 'function'));
await fs.writeFile(path.join(scratch, 'index.html'), '<!doctype html><title>Output depth regression</title>');
await fs.writeFile(path.join(scratch, 'main.cjs'), `
const {app, BrowserWindow} = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(scratch, 'profile'))});
app.whenReady().then(() => {
  const win = new BrowserWindow({show:false, webPreferences:{backgroundThrottling:false}});
  win.loadFile(${JSON.stringify(path.join(scratch, 'index.html'))});
});`);
const app = await _electron.launch({ executablePath: path.join(root, 'desktop/node_modules/electron/dist/electron.exe'), args: [path.join(scratch, 'main.cjs')] });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const report = await page.evaluate(async ({ url, geometry, targetFactory }) => {
    const THREE = await import(url);
    const makeGeometry = new Function('THREE', 'pivotOffset', geometry + '; return createSliceGeometry;')(THREE, () => [0, 0, 0]);
    const makeTarget = new Function('THREE', targetFactory + '; return createSimulationOutputTarget;')(THREE);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, reversedDepthBuffer: true });
    renderer.setSize(1920, 1080);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const gl = renderer.getContext(), rows = [];
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x444444);
    const slice = { id: 'test', input: { x: 0, y: 0, width: 2560, height: 1536, points: [] } };
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    canvas.getContext('2d').fillStyle = 'white'; canvas.getContext('2d').fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const body = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(makeGeometry(slice, .0039, .01, { horizontal: 0, vertical: 0 }, 2560, 1536, 'center'), [front, body]);
    mesh.rotation.y = .4; scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, .001, 5000);
    for (const source of ['solid', 'pattern', 'live']) {
      front.map = source === 'solid' ? null : texture; front.needsUpdate = true;
      texture.generateMipmaps = source === 'pattern';
      texture.minFilter = source === 'pattern' ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      texture.needsUpdate = true;
      for (const distance of [20, 80, 200, 500]) {
        camera.position.set(0, 0, distance);
        camera.near = Math.min(.25, Math.max(.001, distance / 10000));
        camera.far = Math.max(500, distance * 10); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
        for (const mode of ['viewport', 'old', 'fixed', 'fixed-no-msaa']) {
          const target = mode === 'viewport' ? null : mode === 'old'
            ? new THREE.WebGLRenderTarget(1920, 1080)
            : makeTarget(1920, 1080, mode === 'fixed-no-msaa' ? 0 : renderer.capabilities.maxSamples);
          if (target) target.texture.colorSpace = THREE.SRGBColorSpace;
          const outputCamera = target ? camera.clone() : camera;
          outputCamera.updateProjectionMatrix();
          renderer.setRenderTarget(target); renderer.render(scene, outputCamera);
          // Warm the viewport camera exactly as regular navigation does.
          if (!target) renderer.render(scene, outputCamera);
          const pixels = new Uint8Array(1920 * 1080 * 4);
          if (target) await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1920, 1080, pixels);
          else gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let black = 0, white = 0;
          for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] < 10) black++; if (pixels[i] > 245) white++; }
          rows.push({ source, distance, mode, black, white, error: gl.getError() });
          renderer.setRenderTarget(null); target?.dispose();
        }
      }
    }
    const reversedDepth = renderer.capabilities.reversedDepthBuffer;
    mesh.geometry.dispose(); front.dispose(); body.dispose(); texture.dispose(); renderer.dispose();
    return { reversedDepth, rows };
  }, { url: pathToFileURL(path.join(root, 'node_modules/three/build/three.module.js')).href, geometry, targetFactory });
  assert.deepEqual(errors, []);
  for (const row of report.rows) {
    assert.equal(row.error, 0, JSON.stringify(row));
    if (row.mode === 'old') continue;
    assert.equal(row.black, 0, `No dark body stripes: ${JSON.stringify(row)}`);
    assert(row.white > 300, `Screen remains visible: ${JSON.stringify(row)}`);
    if (row.mode === 'fixed') {
      const viewport = report.rows.find(v => v.mode === 'viewport' && v.source === row.source && v.distance === row.distance);
      assert(Math.abs(row.white - viewport.white) / viewport.white < .02, `Output matches viewport coverage: ${JSON.stringify(row)}`);
    }
  }
  const reproduced = report.rows.filter(row => row.mode === 'old' && row.black > 100).length;
  console.log(`PASS output depth: 3 source/filter modes × 4 camera distances, antialiased and non-MSAA captures. Old target reproduced stripes in ${reproduced}/12 cases; fixed target has none. Reversed depth: ${report.reversedDepth}.`);
} finally {
  const deadline = setTimeout(() => app.process().kill(), 10000);
  try { await app.close(); } finally { clearTimeout(deadline); }
}
