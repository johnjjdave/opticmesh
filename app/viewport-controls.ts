import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { zoomGeometryTree } from "./zoom-geometry.ts";

// Bounds only reject candidates: hollow/concave meshes must not create invisible
// zoom barriers. Imported meshes have shared search trees prepared on load.
// Keep uncached triangle scans bounded; selection/editing retain their raycasts.
const ZOOM_TRIANGLE_BUDGET = 20_000;
export function createZoomSurfaceQuery(raycaster: THREE.Raycaster) {
  const inverse = new THREE.Matrix4(), localRay = new THREE.Ray(), point = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  const candidates: { object: THREE.Mesh; lowerBound: number; triangles: number }[] = [];
  return (objects: THREE.Object3D[]) => {
    let remaining = ZOOM_TRIANGLE_BUDGET, nearest = Infinity;
    candidates.length = 0;
    for (const object of objects) {
      if (!(object instanceof THREE.Mesh) || !object.layers.test(raycaster.layers)) continue;
      let visible = true;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible) continue;
      const geometry = object.geometry, positions = geometry.getAttribute("position");
      if (!positions) continue;
      const triangles = (geometry.index?.count ?? positions.count) / 3;
      // Imported geometry already has cached bounds. Never scan an unprepared
      // dense attribute buffer in a wheel handler just to calculate its bounds.
      if (!geometry.boundingBox && triangles <= remaining) geometry.computeBoundingBox();
      if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) continue;
      object.updateWorldMatrix(true, false);
      if (object.matrixWorld.determinant() === 0) continue;
      inverse.copy(object.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(inverse);
      if (!localRay.intersectBox(geometry.boundingBox, point)) continue;
      point.applyMatrix4(object.matrixWorld);
      const boundDistance = point.distanceTo(raycaster.ray.origin);
      // When the origin is inside a bound, its exit is not a lower bound on
      // actual surfaces. Do not cull that object's precise intersection test.
      const inside = geometry.boundingBox.containsPoint(localRay.origin);
      candidates.push({ object, lowerBound: inside ? 0 : boundDistance, triangles });
    }
    candidates.sort((a, b) => a.lowerBound - b.lowerBound);
    for (const { object, lowerBound, triangles } of candidates) {
      if (lowerBound >= nearest) break;
      const tree = zoomGeometryTree(object.geometry);
      if (tree) {
        inverse.copy(object.matrixWorld).invert();
        localRay.copy(raycaster.ray).applyMatrix4(inverse);
        // Convert near/far distances along this ray, including nonuniform scale.
        const localScale = point.copy(raycaster.ray.origin).add(raycaster.ray.direction)
          .applyMatrix4(inverse).distanceTo(localRay.origin);
        const hit = tree.raycastFirst(localRay, object.material, raycaster.near * localScale, Math.min(raycaster.far, nearest) * localScale);
        if (hit) {
          const distance = point.copy(hit.point).applyMatrix4(object.matrixWorld).distanceTo(raycaster.ray.origin);
          if (Number.isFinite(distance)) nearest = Math.min(nearest, distance);
        }
      } else if (triangles <= remaining) {
        remaining -= triangles;
        hits.length = 0;
        object.raycast(raycaster, hits);
        for (const hit of hits) if (Number.isFinite(hit.distance)) nearest = Math.min(nearest, hit.distance);
      }
    }
    return Number.isFinite(nearest) ? nearest : undefined;
  };
}

// Both controllers must measure the same pane, never the shared rendering canvas.
export function createViewportControls(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, surface: HTMLElement, space: "local" | "world", zoomObjects?: () => THREE.Object3D[]) {
  const controls = new OrbitControls(camera);
  const zoomRay = new THREE.Raycaster(), direction = new THREE.Vector3(), pointer = new THREE.Vector2();
  const zoomSurfaceDistance = createZoomSurfaceQuery(zoomRay);
  const rebaseZoom = (event: WheelEvent) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !zoomObjects || !controls.enabled || !controls.enableZoom || ("state" in controls && controls.state !== -1) || !event.deltaY) return;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.updateMatrixWorld();
    zoomRay.setFromCamera(pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const surfaceDistance = zoomSurfaceDistance(zoomObjects());
    // The orbit target is a navigation aid, not a wall. Rebase its distance
    // without changing the view direction, then let OrbitControls dolly along
    // the cursor ray. A small floor keeps close-up/empty-space travel alive.
    const distance = surfaceDistance !== undefined ? Math.max(.25, surfaceDistance) : Math.max(1, camera.position.distanceTo(controls.target));
    camera.getWorldDirection(direction);
    controls.target.copy(camera.position).addScaledVector(direction, Math.min(controls.maxDistance, distance));
  };
  // Run before OrbitControls consumes the wheel, including on pane surfaces.
  surface.addEventListener("wheel", rebaseZoom, { capture: true, passive: true });
  controls.connect(surface);
  const dispose = controls.dispose.bind(controls);
  controls.dispose = () => { surface.removeEventListener("wheel", rebaseZoom, true); dispose(); };
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 5000;
  controls.minZoom = 0.001;
  controls.maxZoom = 10000;
  if (camera instanceof THREE.OrthographicCamera) {
    controls.enableRotate = false;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  }
  const transform = new TransformControls(camera, surface);
  transform.setSpace(space);
  transform.setSize(0.82);
  return { controls, transform };
}
