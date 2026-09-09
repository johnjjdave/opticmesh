import * as THREE from "three";

const WORLD_FLOOR_SIZE_METRES = 2000;
export const WORLD_GRID_STEP_METRES = 1;

export function createSceneGround(reversedDepthBuffer: boolean) {
  // Fixed world geometry keeps the one-metre grid anchored when navigating.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_FLOOR_SIZE_METRES, WORLD_FLOOR_SIZE_METRES),
    new THREE.MeshStandardMaterial({
      color: 0x111518, roughness: 0.95, metalness: 0.05,
      polygonOffset: true, polygonOffsetFactor: 1,
      // Three reverses the slope factor, but leaves the constant units unchanged.
      // Bias away from the camera in both depth conventions, never over the grid.
      polygonOffsetUnits: reversedDepthBuffer ? -4 : 4,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  const grid = new THREE.GridHelper(
    WORLD_FLOOR_SIZE_METRES, WORLD_FLOOR_SIZE_METRES / WORLD_GRID_STEP_METRES,
    0x405158, 0x242c30,
  );
  grid.position.y = 0.01;
  return { floor, grid };
}
