import { BufferGeometry } from "three";
import { CENTER, MeshBVH } from "three-mesh-bvh";

// Immutable imported geometry owns one CPU search tree, shared by its live views.
// Never build a tree in a wheel handler or change the rendered/exported topology.
const trees = new WeakMap<BufferGeometry, MeshBVH>();
function attach(geometry: BufferGeometry, tree: MeshBVH) {
  trees.set(geometry, tree);
  const release = () => { trees.delete(geometry); geometry.removeEventListener("dispose", release); };
  geometry.addEventListener("dispose", release);
}
export function prepareZoomGeometry(geometry: BufferGeometry) {
  if (trees.has(geometry)) return;
  const count = geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0;
  if (count < 3) return;
  attach(geometry, new MeshBVH(geometry, { strategy: CENTER, maxLeafSize: 32, indirect: true, setBoundingBox: false }));
}
export function shareZoomGeometry(source: BufferGeometry, view: BufferGeometry) {
  const tree = trees.get(source);
  if (tree) attach(view, tree);
}
export function zoomGeometryTree(geometry: BufferGeometry) { return trees.get(geometry); }
