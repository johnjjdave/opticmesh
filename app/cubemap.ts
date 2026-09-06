export type CubemapFaceKey = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";
export type CubemapLayout = "three-by-two" | "horizontal-cross" | "vertical-cross";
export type Vector3 = { x: number; y: number; z: number };
export type CubemapFacePlacement = {
  key: CubemapFaceKey;
  name: "RIGHT" | "LEFT" | "TOP" | "BOTTOM" | "BACK" | "FRONT";
  x: number;
  y: number;
};

export const CUBEMAP_FACE_ORDER: CubemapFaceKey[] = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];

const FACE_NAMES: Record<CubemapFaceKey, CubemapFacePlacement["name"]> = {
  "+X": "RIGHT",
  "-X": "LEFT",
  "+Y": "TOP",
  "-Y": "BOTTOM",
  "+Z": "FRONT",
  "-Z": "BACK",
};

export function cubemapLayoutSize(layout: CubemapLayout) {
  if (layout === "horizontal-cross") return { columns: 4, rows: 3 };
  if (layout === "vertical-cross") return { columns: 3, rows: 4 };
  return { columns: 3, rows: 2 };
}

export function cubemapAtlasDimensions(faceResolution: number, layout: CubemapLayout) {
  // Cross atlases above 4K per face exceed practical browser canvas limits
  // (Horizontal Cross would be 32768 × 24576 at 8K per face).
  const face = Math.min(4096, Math.max(1024, Math.round(faceResolution)));
  const { columns, rows } = cubemapLayoutSize(layout);
  return { width: face * columns, height: face * rows, face };
}

export function cubemapFacePlacements(layout: CubemapLayout): CubemapFacePlacement[] {
  const cells: Record<CubemapFaceKey, [number, number]> = layout === "horizontal-cross"
    ? { "+X": [2, 1], "-X": [0, 1], "+Y": [1, 0], "-Y": [1, 2], "+Z": [1, 1], "-Z": [3, 1] }
    : layout === "vertical-cross"
      ? { "+X": [2, 1], "-X": [0, 1], "+Y": [1, 0], "-Y": [1, 2], "+Z": [1, 1], "-Z": [1, 3] }
      : { "+X": [0, 0], "-X": [1, 0], "+Y": [2, 0], "-Y": [0, 1], "+Z": [1, 1], "-Z": [2, 1] };
  return CUBEMAP_FACE_ORDER.map((key) => ({ key, name: FACE_NAMES[key], x: cells[key][0], y: cells[key][1] }));
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/** OpenGL cubemap face coordinates. u and v are in [-1, 1], with v increasing down the image. */
export function cubemapFaceUvToDirection(face: CubemapFaceKey, u: number, v: number): Vector3 {
  if (face === "+X") return normalize({ x: 1, y: -v, z: -u });
  if (face === "-X") return normalize({ x: -1, y: -v, z: u });
  if (face === "+Y") return normalize({ x: u, y: 1, z: v });
  if (face === "-Y") return normalize({ x: u, y: -1, z: -v });
  if (face === "+Z") return normalize({ x: u, y: -v, z: 1 });
  return normalize({ x: -u, y: -v, z: -1 });
}

export function directionToCubemapFaceUv(direction: Vector3): { face: CubemapFaceKey; u: number; v: number } {
  const { x, y, z } = direction;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) {
    const major = ax || 1;
    return x >= 0 ? { face: "+X", u: -z / major, v: -y / major } : { face: "-X", u: z / major, v: -y / major };
  }
  if (ay >= ax && ay >= az) {
    const major = ay || 1;
    return y >= 0 ? { face: "+Y", u: x / major, v: z / major } : { face: "-Y", u: x / major, v: -z / major };
  }
  const major = az || 1;
  return z >= 0 ? { face: "+Z", u: x / major, v: -y / major } : { face: "-Z", u: -x / major, v: -y / major };
}

/** OpticMesh world convention: azimuth 0° is FRONT (+Z), 90° is RIGHT (+X), elevation is positive toward +Y. */
export function directionFromAzimuthElevation(azimuthDegrees: number, elevationDegrees: number): Vector3 {
  const azimuth = azimuthDegrees * Math.PI / 180;
  const elevation = elevationDegrees * Math.PI / 180;
  const horizontal = Math.cos(elevation);
  return normalize({
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation),
    z: Math.cos(azimuth) * horizontal,
  });
}

export function cubemapFaceCenterDirection(face: CubemapFaceKey) {
  return cubemapFaceUvToDirection(face, 0, 0);
}
