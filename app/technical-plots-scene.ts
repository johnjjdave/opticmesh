import * as THREE from 'three';
import { buildScene, disposeBuiltScene, type SceneExportOptions } from './scene-export';
import { VIEW_DIRECTIONS, type PlotFrame } from './technical-plots-data';
import { ModelLayer } from './model-data';

// Retained only while Technical Plots is active. Camera changes reuse GPU resources.
export function createPlotCaptureSession(options: SceneExportOptions) {
  let renderer: THREE.WebGLRenderer | undefined;
  let built: ReturnType<typeof buildScene> | undefined;
  const layer = new ModelLayer();
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const visibility = new Map<THREE.Mesh, boolean>();
  const meshes: THREE.Mesh[] = [];
  const styles: THREE.Material[] = [];
  let running = false, disposed = false, modelsLoaded = false;
  const boundsCache = new Map<boolean, THREE.Box3>();
  function cleanup() {
    for (const [mesh, material] of originals) mesh.material = material;
    built?.scene.remove(layer.root); layer.dispose();
    if (built) disposeBuiltScene(built);
    styles.forEach(m => m.dispose()); renderer?.dispose(); renderer?.forceContextLoss();
    built = undefined; renderer = undefined; originals.clear(); meshes.length = 0; visibility.clear(); boundsCache.clear();
  }
  return {
    dispose() { disposed = true; if (!running) cleanup(); },
    async capture(frames: PlotFrame[], signal: AbortSignal, ids: Record<string, number> = {}, fontFamily = 'Arial') {
      if (disposed || running) throw new Error('Plot capture is unavailable.');
      const images: Record<string, string> = {};
      if (!frames.length) return images;
      running = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 16)); signal.throwIfAborted();
        if (!built) {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
          renderer.setPixelRatio(1); renderer.setClearColor(0xffffff); renderer.outputColorSpace = THREE.SRGBColorSpace;
          built = buildScene({ ...options, models: [] });
          built.scene.add(layer.root); built.scene.background = new THREE.Color(0xffffff);
          styles.push(new THREE.MeshStandardMaterial({ color: 0xb7c1bd, roughness: 1, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0x56686d, wireframe: true }), new THREE.MeshBasicMaterial({ color: 0x506e75, side: THREE.DoubleSide }));
          built.scene.add(new THREE.HemisphereLight(0xffffff, 0x778080, 2));
          const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(20, 40, 30); built.scene.add(light);
        }
        if (!modelsLoaded && frames.some(f => f.stage)) { layer.sync(options.models || []); modelsLoaded = true; boundsCache.clear(); }
        meshes.length = 0;
        built.scene.traverseVisible(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
        // Include meshes hidden by a previous frame's stage toggle.
        const found = new Set(meshes);
        for (const mesh of originals.keys()) if (!found.has(mesh)) meshes.push(mesh);
        for (const mesh of meshes) if (!originals.has(mesh)) { originals.set(mesh, mesh.material); visibility.set(mesh, mesh.visible); }
        const [shaded, wire, led] = styles;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]; signal.throwIfAborted();
      for (const mesh of meshes) { const screen = !!mesh.userData.sliceId; mesh.visible = visibility.get(mesh)! && (screen || f.stage); mesh.material = f.style === 'wireframe' ? wire : screen ? led : shaded; }
      built.scene.updateMatrixWorld(true);
      let bounds = boundsCache.get(f.stage);
      if (!bounds) {
        bounds = new THREE.Box3();
        for (const mesh of meshes) if (mesh.visible) { if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)); }
        boundsCache.set(f.stage, bounds);
      }
      if (bounds.isEmpty()) throw new Error('No visible geometry is available for this view.');
      const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3()), radius = Math.max(.1, size.length());
      const direction = new THREE.Vector3(...VIEW_DIRECTIONS[f.view]).normalize();
      const aspect = (f.w - 4) / (f.h - 19);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, radius * .001, radius * 8);
      camera.position.copy(center).addScaledVector(direction, radius * 2);
      if (Math.abs(direction.y) > .99) camera.up.set(0, 0, direction.y > 0 ? -1 : 1);
      camera.lookAt(center); camera.updateMatrixWorld(true);
      const cameraBounds = new THREE.Box3();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) cameraBounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      const projected = cameraBounds.getSize(new THREE.Vector3());
      const halfH = Math.max(projected.y / 2, projected.x / (2 * aspect), .05) * 1.08;
      const halfView = halfH / f.viewZoom;
      const dx = f.panX / 100 * halfView * aspect * 2, dy = f.panY / 100 * halfView * 2;
      camera.left = -halfView * aspect + dx; camera.right = halfView * aspect + dx; camera.top = halfView + dy; camera.bottom = -halfView + dy; camera.updateProjectionMatrix();
      // 150 dpi at the frame's actual printed size; capped to avoid giant GPU targets.
      const width = Math.min(2800, Math.round((f.w - 4) / 25.4 * 150)), height = Math.min(2000, Math.round(width / aspect));
      renderer!.setSize(width, height, false); renderer!.render(built.scene, camera);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(renderer!.domElement, 0, 0);
      const fontSize = Math.max(14, width / (f.w - 4) * f.fontSize * 25.4 / 72); ctx.font = `600 ${fontSize}px ${fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const occupied: { x: number; y: number; w: number }[] = [];
      for (const [id, mesh] of built.meshesBySlice) if (mesh.visible) {
        const p = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
        if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1 || p.z < -1 || p.z > 1) continue;
        const x = (p.x + 1) / 2 * width, y = (1 - p.y) / 2 * height, label = String(ids[id] || options.slices.findIndex(s => s.id === id) + 1).padStart(2, '0');
        const labelWidth = ctx.measureText(label).width + fontSize * .8;
        let labelY = y;
        for (let attempt = 0; attempt < 24 && occupied.some(b => Math.abs(b.x - x) < (b.w + labelWidth) / 2 + 4 && Math.abs(b.y - labelY) < fontSize * 1.7); attempt++) labelY = Math.max(fontSize, Math.min(height - fontSize, y + (attempt % 2 ? -1 : 1) * (Math.floor(attempt / 2) + 1) * fontSize * 1.8));
        if (labelY !== y) { ctx.strokeStyle = '#596165'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, labelY); ctx.stroke(); }
        occupied.push({ x, y: labelY, w: labelWidth });
        ctx.fillStyle = '#263336'; ctx.fillRect(x - labelWidth / 2, labelY - fontSize * .7, labelWidth, fontSize * 1.4); ctx.fillStyle = '#ffffff'; ctx.fillText(label, x, labelY);
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Unable to capture view.')), 'image/png'));
      signal.throwIfAborted();
      images[f.id] = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      canvas.width = canvas.height = 1;
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    return images;
      } finally {
        running = false;
        if (disposed) cleanup();
      }
    },
  };
}
