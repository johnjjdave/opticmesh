import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
try {
  await page.goto('http://localhost:3000/');
  const results = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { createSceneGround } = await import('/app/scene-ground.ts');
    const results = [];
    for (const reversedDepthBuffer of [false, true]) {
      const renderer = new T.WebGLRenderer({ preserveDrawingBuffer: true, reversedDepthBuffer });
      renderer.setSize(512, 384);
      const scene = new T.Scene(); scene.background = new T.Color(0);
      const { floor, grid } = createSceneGround(renderer.capabilities.reversedDepthBuffer);
      // Isolate visible grid pixels from lighting and floor brightness.
      floor.material.color.set(0);
      grid.geometry.attributes.color.array.fill(1);
      grid.geometry.attributes.color.needsUpdate = true;
      scene.add(floor, grid);
      const camera = new T.PerspectiveCamera(42, 512 / 384, .001, 1000);
      const read = (view) => {
        renderer.render(scene, view);
        const gl = renderer.getContext(), pixels = new Uint8Array(512 * 384 * 4);
        gl.readPixels(0, 0, 512, 384, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 50 && pixels[i + 1] > 50) count++;
        return { count, pixels };
      };
      const cases = [];
      // Off-origin close-up zoom, shallow/steep tilt and overhead views.
      for (const [height, depth, near] of [
        [1.6, 50, .001], [1.6, 50, .05], [1.6, 3, .001],
        [10, 1, .001], [100, 10, .01], [.1, 10, .001],
      ]) {
        camera.position.set(100, height, 100); camera.near = near;
        camera.lookAt(100, 0, 100 - depth); camera.updateProjectionMatrix();
        floor.visible = false; const withoutFloor = read(camera).count;
        floor.visible = true; const withFloor = read(camera).count;
        cases.push({ height, depth, near, withoutFloor, withFloor });
      }
      const top = new T.OrthographicCamera(-20, 20, 15, -15, .01, 1000);
      top.position.set(100, 100, 100); top.up.set(0, 0, -1); top.lookAt(100, 0, 100);
      floor.visible = false; const topWithout = read(top).count;
      floor.visible = true; const topWith = read(top).count;
      const box = new T.Mesh(new T.BoxGeometry(10, 2, 10), new T.MeshBasicMaterial({ color: 0xff0000 }));
      box.position.set(100, 1, 100); scene.add(box);
      const occluded = read(top);
      let leakedPixels = 0;
      for (let y = 160; y < 224; y++) for (let x = 220; x < 292; x++) {
        if (occluded.pixels[(y * 512 + x) * 4 + 1] > 50) leakedPixels++;
      }
      grid.visible = false; const hiddenGrid = read(top).count;
      results.push({ reversed: renderer.capabilities.reversedDepthBuffer, cases, topWithout, topWith, leakedPixels, hiddenGrid });
      floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); grid.material.dispose();
      box.geometry.dispose(); box.material.dispose(); renderer.dispose();
    }
    return results;
  });
  for (const result of results) {
    for (const pose of result.cases) {
      assert(pose.withoutFloor > 1000, JSON.stringify(pose));
      assert.equal(pose.withFloor, pose.withoutFloor, JSON.stringify({ reversed: result.reversed, ...pose }));
    }
    assert.equal(result.topWith, result.topWithout);
    assert.equal(result.leakedPixels, 0, 'Grid must remain behind model surfaces');
    assert.equal(result.hiddenGrid, 0, 'Grid toggle must hide all lines');
  }
  console.log('Floor/grid rendering:', JSON.stringify(results));
} finally { await browser.close(); }
