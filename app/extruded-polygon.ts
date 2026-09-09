type Point3 = Readonly<{ x: number; y: number; z: number }>;
type Triangle = [number, number, number];

/** Recognize a non-planar face bounded by a curve and its translated reverse.
 * Triangulate each strip segment instead of flattening the entire curved face.
 * Return null for all other topology, leaving the format loader in control.
 */
export function triangulateExtrudedPolygon(vertices: readonly Point3[]): Triangle[] | null {
  const count = vertices.length;
  if (count < 6 || count % 2) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const normal = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const a = vertices[i], b = vertices[(i + 1) % count];
    for (const [axis, value] of [a.x, a.y, a.z].entries()) {
      if (!Number.isFinite(value)) return null;
      min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
    }
    normal[0] += (a.y - b.y) * (a.z + b.z);
    normal[1] += (a.z - b.z) * (a.x + b.x);
    normal[2] += (a.x - b.x) * (a.y + b.y);
  }
  const scale = Math.hypot(...max.map((v, i) => v - min[i]));
  const normalLength = Math.hypot(...normal);
  if (!scale || normalLength < scale * scale * 1e-12) return null;
  const origin = vertices[0];
  const nonplanar = vertices.some(v => Math.abs(
    (v.x - origin.x) * normal[0] + (v.y - origin.y) * normal[1] + (v.z - origin.z) * normal[2]
  ) / normalLength > scale * 1e-6);
  if (!nonplanar) return null;

  const half = count / 2, tolerance = scale * 1e-7;
  for (let start = 0; start < count; start++) {
    const index = (offset: number) => (start + offset) % count;
    const first = vertices[index(0)], opposite = vertices[index(count - 1)];
    const dx = opposite.x - first.x, dy = opposite.y - first.y, dz = opposite.z - first.z;
    if (Math.hypot(dx, dy, dz) <= tolerance) continue;
    let matched = true;
    for (let i = 1; i < half; i++) {
      const a = vertices[index(i)], b = vertices[index(count - 1 - i)], previous = vertices[index(i - 1)];
      const sx = a.x - previous.x, sy = a.y - previous.y, sz = a.z - previous.z;
      if (Math.hypot(b.x - a.x - dx, b.y - a.y - dy, b.z - a.z - dz) > tolerance ||
          Math.hypot(sy * dz - sz * dy, sz * dx - sx * dz, sx * dy - sy * dx) <= tolerance * scale) {
        matched = false; break;
      }
    }
    if (!matched) continue;
    const triangles: Triangle[] = [];
    for (let i = 0; i < half - 1; i++) {
      const a = index(i), b = index(i + 1), c = index(count - 2 - i), d = index(count - 1 - i);
      triangles.push([a, b, c], [a, c, d]);
    }
    return triangles;
  }
  return null;
}
