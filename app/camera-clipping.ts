import { Box3, Camera, OrthographicCamera, PerspectiveCamera, Sphere, Vector3 } from "three";
import { WORLD_FLOOR_SIZE_METRES } from "./scene-ground.ts";

const origin = new Vector3();
const groundRadius = WORLD_FLOOR_SIZE_METRES / Math.SQRT2;

/** Zoom targets are navigation aids, never inputs to scene depth precision. */
export function updateSceneCameraClipping(camera: Camera, bounds: Box3) {
  if (!(camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera)) return;
  // Five centimetres preserves close inspection while retaining depth separation
  // for distant thin surfaces on the desktop's fixed-point canvas depth buffer.
  const near = camera instanceof PerspectiveCamera ? 0.05 : 0.01;
  const sphere = bounds.isEmpty() ? null : bounds.getBoundingSphere(new Sphere());
  // Include the world floor/grid even when hidden so toggles cannot move the
  // clipping horizon. Range follows the scene and camera, not the cursor target.
  const far = Math.max(500, camera.position.distanceTo(origin) + groundRadius + 50,
    sphere ? camera.position.distanceTo(sphere.center) + sphere.radius * 4 + 50 : 0);
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}
