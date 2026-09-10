import * as THREE from "three";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
const orientations = new WeakMap<Camera, { roll: THREE.Quaternion }>();
const worldUp = new THREE.Vector3(0, 1, 0);

// Roll belongs to the displayed camera, not OrbitControls' navigation up axis.
// Keep its normal world-Y orbit and screen-space pan/zoom calculations intact.
export function setNavigationOrientation(camera: Camera, orientation: THREE.Quaternion) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
  const level = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, camera.position.clone().add(forward), worldUp));
  const relative = level.invert().multiply(orientation);
  let state = orientations.get(camera);
  if (!state) {
    state = { roll: new THREE.Quaternion() };
    orientations.set(camera, state);
    const originalLookAt = camera.lookAt.bind(camera);
    camera.lookAt = (x: number | THREE.Vector3, y?: number, z?: number) => {
      if (x instanceof THREE.Vector3) originalLookAt(x);
      else originalLookAt(x, y!, z!);
      camera.quaternion.multiply(state!.roll);
    };
  }
  state.roll.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 2 * Math.atan2(relative.z, relative.w));
  camera.up.copy(worldUp);
  camera.quaternion.copy(orientation);
}

export function savedNavigationUp(camera: Camera): THREE.Vector3 {
  const state = orientations.get(camera);
  return state && Math.abs(state.roll.z) > 1e-8 ? new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion) : camera.up.clone();
}

export function restoreNavigationUp(camera: Camera, target: THREE.Vector3, up?: number[]) {
  if (!(camera instanceof THREE.PerspectiveCamera) || up?.length !== 3 || !up.every(Number.isFinite)) return;
  const direction = new THREE.Vector3(...up);
  if (direction.lengthSq() < .01) return;
  const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, target, direction.normalize()));
  setNavigationOrientation(camera, orientation);
}

export function resetNavigationHorizon(camera: Camera, target: THREE.Vector3) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  orientations.get(camera)?.roll.identity();
  camera.up.copy(worldUp);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
