import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Both controllers must measure the same pane, never the shared rendering canvas.
export function createViewportControls(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, surface: HTMLElement, space: "local" | "world") {
  const controls = new OrbitControls(camera, surface);
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
