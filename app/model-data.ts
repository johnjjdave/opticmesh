import * as THREE from "three";
import { continuousEuler } from "./group-transforms.ts";
import { gzipSync, gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { PIVOT_PRESETS, pivotOffset, type SlicePivot, type PivotPreset } from "./slice-pivot.ts";

type GeometryField = "position" | "normal" | "uv" | "index";
export type ModelGeometry = { position: string; normal?: string; uv?: string; index?: string; encoding?: "gzip"; byteLengths?: Partial<Record<GeometryField, number>> };
export type ModelMaterial = { color: string; diffuse: number; metallic: number; roughness: number; specular: number };
export const DEFAULT_MODEL_MATERIAL: Readonly<ModelMaterial> = { color: "#777d80", diffuse: 1, metallic: .05, roughness: .82, specular: 1 };
export type ModelNode = { sceneGroupId?: string; material?: ModelMaterial; id: string; parent: string | null; name: string; matrix: number[]; geometry?: string; visible: boolean; locked: boolean; style?: "shaded" | "wireframe"; pivot?: [number, number, number]; pivotMode?: PivotPreset | "custom"; initialMatrix?: number[]; rotation?: [number,number,number] };
// sceneAppearance is derived from shared groups for rendering/editing, never stored in project model data.
export type ImportedModel = { sceneAppearance?: {material?:ModelMaterial;style?:"shaded"|"wireframe"}; id: string; name: string; format: string; hierarchy: boolean; nodes: ModelNode[]; geometries: Record<string, ModelGeometry>; warnings: string[]; triangles: number };
export const MODEL_EXTENSIONS = ["mvr", "gdtf", "gltf", "glb", "fbx", "obj", "3ds", "dae", "stl", "usd", "usda", "usdc", "usdz"];
export function encodeArray(array: Float32Array | Uint32Array | Uint8Array) {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 16384) result += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(result);
}
/** Preserve vertex data; optional shading attributes may be repaired independently. */
export function packModelGeometry(geometry: THREE.BufferGeometry, name: string, warn: (message: string) => void): ModelGeometry {
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize !== 3 || !Number.isInteger(position.count) || !position.count) throw new Error(`Mesh "${name}" has no valid 3D vertex positions.`);
  const data: ModelGeometry = { position: "", encoding: "gzip", byteLengths: {} };
  const store = (field: GeometryField, array: Float32Array | Uint32Array) => {
    data.byteLengths![field] = array.byteLength;
    data[field] = encodeArray(gzipSync(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), { level: 3, mtime: 0 }));
  };
  for (const field of ["position", "normal", "uv"] as const) {
    const attribute = geometry.getAttribute(field); if (!attribute) continue;
    const size = field === "uv" ? 2 : 3;
    let invalid = attribute.itemSize !== size || attribute.count !== position.count;
    const array = new Float32Array(position.count * size);
    if (!invalid) outer: for (let i = 0; i < position.count; i++) for (let j = 0; j < size; j++) {
      array[i * size + j] = attribute.getComponent(i, j);
      if (!Number.isFinite(array[i * size + j])) {
        if (field === "position") throw new Error(`Mesh "${name}" has an invalid vertex position at vertex ${i + 1} (${["X", "Y", "Z"][j]}). Check this mesh in the source application and export it again.`);
        invalid = true; break outer;
      }
    }
    if (invalid) { warn(field === "normal" ? `Mesh "${name}": invalid normals were regenerated from its surfaces.` : `Mesh "${name}": invalid UV coordinates were omitted; stage shading does not require source textures.`); continue; }
    store(field, array);
  }
  if ((geometry.index?.count || position.count) % 3) throw new Error(`Mesh "${name}" contains incomplete triangle data.`);
  if (geometry.index) {
    if (geometry.index.array.some(i => !Number.isInteger(i) || i < 0 || i >= position.count)) throw new Error(`Mesh "${name}" has triangle indices referencing missing vertices.`);
    store("index", new Uint32Array(geometry.index.array));
  }
  return data;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function arrayByteLength(data: ModelGeometry, field: GeometryField) {
  const value = data[field]; if (typeof value !== "string") throw new Error("Missing model attribute data.");
  if (data.encoding !== undefined && data.encoding !== "gzip") throw new Error("Unsupported model geometry encoding.");
  const length = data.encoding === "gzip" ? data.byteLengths?.[field] : value.length * 3 / 4 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  // Bound allocations before inflating untrusted project data.
  if (!Number.isSafeInteger(length) || !length || length < 0 || length > 512 * 1024 * 1024 || length % 4) throw new Error("Invalid model attribute byte length.");
  return length;
}
export function modelTriangleCount(data: ModelGeometry) { return data.index ? arrayByteLength(data, "index") / 12 : arrayByteLength(data, "position") / 36; }
function decodeArray(data: ModelGeometry, field: GeometryField) {
  const length = arrayByteLength(data, field), raw = atob(data[field]!), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (!data.encoding) return bytes.buffer;
  if (bytes.length < 18) throw new Error("Invalid compressed model attribute.");
  const trailer = new DataView(bytes.buffer, bytes.length - 8);
  if (trailer.getUint32(4, true) !== length) throw new Error("Invalid compressed model attribute length.");
  const decoded = gunzipSync(bytes, { out: new Uint8Array(length) });
  if (crc32(decoded) !== trailer.getUint32(0, true)) throw new Error("Corrupt compressed model attribute.");
  return decoded.buffer as ArrayBuffer;
}
const geometryBoundsCache = new WeakMap<ModelGeometry, THREE.Box3>();
export function modelGeometry(data: ModelGeometry) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(decodeArray(data, "position")), 3));
  if (data.normal) geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(decodeArray(data, "normal")), 3));
  if (data.uv) geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(decodeArray(data, "uv")), 2));
  if (data.index) geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(decodeArray(data, "index")), 1));
  if (!data.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometryBoundsCache.set(data, geometry.boundingBox!.clone()); return geometry;
}

// Project geometry is immutable. Share its decoded CPU arrays between live views,
// while each view owns its attributes/geometry and can dispose its GPU buffers.
// Standalone modelGeometry callers (validation/export/editing) retain private data.
const liveGeometryCache = new WeakMap<ModelGeometry, { source: THREE.BufferGeometry; users: number }>();
function acquireViewGeometry(data: ModelGeometry) {
  let entry = liveGeometryCache.get(data);
  if (!entry) {
    entry = { source: modelGeometry(data), users: 0 };
    liveGeometryCache.set(data, entry);
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(entry.source.attributes)) {
    const source = attribute as THREE.BufferAttribute;
    geometry.setAttribute(name, new THREE.BufferAttribute(source.array, source.itemSize, source.normalized));
  }
  if (entry.source.index) {
    const source = entry.source.index;
    geometry.setIndex(new THREE.BufferAttribute(source.array, source.itemSize, source.normalized));
  }
  geometry.boundingBox = entry.source.boundingBox!.clone();
  geometry.boundingSphere = entry.source.boundingSphere!.clone();
  entry.users++;
  return geometry;
}
function releaseViewGeometry(data: ModelGeometry, geometry: THREE.BufferGeometry) {
  geometry.dispose();
  const entry = liveGeometryCache.get(data);
  if (entry && --entry.users === 0) {
    entry.source.dispose();
    liveGeometryCache.delete(data);
  }
}
function packedBounds(data: ModelGeometry) {
  if (!geometryBoundsCache.has(data)) modelGeometry(data).dispose();
  return geometryBoundsCache.get(data)!;
}
export function modelSelectionBounds(models: ImportedModel[], ids: string[], inverse = new THREE.Matrix4()) {
  const bounds=new THREE.Box3();
  for(const model of models){const included=descendants(model,ids);for(const node of model.nodes)if(included.has(node.id)&&node.geometry)bounds.union(packedBounds(model.geometries[node.geometry]).clone().applyMatrix4(inverse.clone().multiply(new THREE.Matrix4().fromArray(node.matrix))));}
  return bounds;
}
/** Pivot display frame uses the item's orientation but metre units, independent of source scale. */
export function modelPivotEntry(model: ImportedModel, node: ModelNode) {
  const matrix = new THREE.Matrix4().fromArray(node.matrix), position = new THREE.Vector3(), rotation = new THREE.Quaternion();
  matrix.decompose(position, rotation, new THREE.Vector3());
  const frame = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1,1,1)), inverse = frame.clone().invert();
  const included = descendants(model, [node.id]), bounds = new THREE.Box3();
  let hasVisibleGeometry = false;
  for (const child of model.nodes) if (included.has(child.id) && child.geometry) {
    hasVisibleGeometry ||= inherited(model,child,"visible");
    bounds.union(packedBounds(model.geometries[child.geometry]).clone().applyMatrix4(inverse.clone().multiply(new THREE.Matrix4().fromArray(child.matrix))));
  }
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const point = node.pivot ? new THREE.Vector3(...node.pivot).applyMatrix4(matrix).applyMatrix4(inverse) : center.clone();
  const offset = point.clone().sub(center).toArray() as [number,number,number];
  const preset = node.pivotMode && node.pivotMode !== "custom" && pivotOffset(node.pivotMode,size.x,size.y).every((v,i)=>Math.abs(v-offset[i])<1e-7) ? node.pivotMode : undefined;
  return { id: node.id, hasVisibleGeometry, width: size.x, height: size.y, pivot: (preset || (!node.pivot ? "center" : { custom: offset })) as SlicePivot, center, frame, matrix, worldPoint: point.applyMatrix4(frame), disabled: bounds.isEmpty() || Math.abs(matrix.determinant()) < 1e-12 || inherited(model,node,"locked") };
}
export function modelPivotEntries(models: ImportedModel[], ids: string[]) {
  return models.flatMap(model => model.nodes.filter(n=>ids.includes(n.id)).map(n=>modelPivotEntry(model,n)));
}
export function modelSelectionPivot(models: ImportedModel[], ids: string[]) {
  const points: THREE.Vector3[] = [];
  for (const model of models) for (const node of model.nodes) if (ids.includes(node.id) && inherited(model,node,"visible") && !inherited(model,node,"locked")) {
    let parent = node.parent, nested = false;
    while (parent) { if (ids.includes(parent)) { nested = true; break; } parent = model.nodes.find(n=>n.id===parent)?.parent || null; }
    if (!nested) { const entry=modelPivotEntry(model,node); if(!entry.disabled && entry.hasVisibleGeometry) points.push(entry.worldPoint); }
  }
  return points.length ? points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/points.length) : null;
}
export function setModelPivots(models: ImportedModel[], ids: string[], next: SlicePivot | ((previous: SlicePivot,width: number,height: number)=>SlicePivot)) {
  return models.map(model=>({...model,nodes:model.nodes.map(node=>{
    if(!ids.includes(node.id))return node;
    const entry=modelPivotEntry(model,node); if(entry.disabled)return node;
    const value=typeof next === "function" ? next(entry.pivot,entry.width,entry.height) : next;
    const point=entry.center.clone().add(new THREE.Vector3(...pivotOffset(value,entry.width,entry.height))).applyMatrix4(entry.frame).applyMatrix4(entry.matrix.clone().invert());
    return {...node,pivot:point.toArray() as [number,number,number],pivotMode:typeof value === "string" ? value : "custom" as const};
  })}));
}
export function descendants(model: ImportedModel, ids: string[]) {
  const included = new Set(ids), children = new Map<string, string[]>();
  for (const node of model.nodes) if (node.parent) { const list=children.get(node.parent)||[]; list.push(node.id); children.set(node.parent,list); }
  const queue=[...ids]; for(let i=0;i<queue.length;i++) for(const id of children.get(queue[i])||[]) if(!included.has(id)){ included.add(id);queue.push(id); }
  return included;
}
export function removeModelNodes(models: ImportedModel[], ids: string[]): ImportedModel[] {
  return models.flatMap(model => {
    // Walk each hierarchy once. Computing descendants inside filter is quadratic.
    const byId = new Map(model.nodes.map(n => [n.id, n]));
    const protectedIds = new Set<string>();
    for (const node of model.nodes) if (node.locked) {
      let current: ModelNode | undefined = node;
      while (current && !protectedIds.has(current.id)) { protectedIds.add(current.id); current = current.parent ? byId.get(current.parent) : undefined; }
    }
    const roots = ids.filter(id => byId.has(id) && !protectedIds.has(id) && !inherited(model, byId.get(id)!, "locked"));
    if (!roots.length) return [model];
    const removed = descendants(model, roots), nodes = model.nodes.filter(n => !removed.has(n.id));
    if (!nodes.length) return [];
    const used = new Set(nodes.flatMap(n => n.geometry ? [n.geometry] : []));
    const geometries = Object.fromEntries(Object.entries(model.geometries).filter(([id]) => used.has(id)));
    // Stored lengths give counts without inflating meshes during hierarchy edits.
    const triangles = nodes.reduce((sum, node) => { const g = node.geometry && geometries[node.geometry]; return sum + (g ? modelTriangleCount(g) : 0); }, 0);
    return [{ ...model, nodes, geometries, triangles }];
  });
}
const modelIndex = new WeakMap<ImportedModel, Map<string, ModelNode>>();
function index(model: ImportedModel) { let map=modelIndex.get(model); if(!map){map=new Map(model.nodes.map(n=>[n.id,n]));modelIndex.set(model,map);}return map; }
export function inherited(model: ImportedModel, node: ModelNode, key: "visible" | "locked") {
  const byId = index(model); let cursor: ModelNode | undefined = node;
  while (cursor) { if (key === "visible" && !cursor.visible) return false; if (key === "locked" && cursor.locked) return true; cursor = cursor.parent ? byId.get(cursor.parent) : undefined; }
  return key === "visible";
}
export function nodeMaterial(model: ImportedModel, node: ModelNode, byId = index(model)): ModelMaterial {
  let cursor: ModelNode | undefined = node;
  while(cursor){if(cursor.material)return cursor.material;cursor=cursor.parent?byId.get(cursor.parent):undefined;}
  return model.sceneAppearance?.material || DEFAULT_MODEL_MATERIAL;
}
export function applyModelMaterial(material: THREE.MeshPhysicalMaterial, value: ModelMaterial) {
  material.name=`Stage_${value.color.slice(1)}_${value.diffuse}_${value.metallic}_${value.roughness}_${value.specular}`;
  material.color.set(value.color).multiplyScalar(value.diffuse);material.metalness=value.metallic;material.roughness=value.roughness;material.specularIntensity=value.specular;
  return material;
}
/** LED body wireframes use unlit emission while retaining the existing material slot. */
export function applyBodyMaterial(material:THREE.MeshPhysicalMaterial,value:ModelMaterial,wireframe:boolean){
  applyModelMaterial(material,value);material.wireframe=wireframe;material.emissive.set(0);material.toneMapped=!wireframe;
  material.envMapIntensity=wireframe?0:.65;
  if(wireframe){material.emissive.copy(material.color);material.color.set(0);material.metalness=0;material.roughness=1;material.specularIntensity=0;}
  return material;
}
export function createModelMaterial(value: ModelMaterial) {
  return applyModelMaterial(new THREE.MeshPhysicalMaterial({side:THREE.DoubleSide}),value);
}
export function editModelMaterial(models: ImportedModel[], selected: string[], patch: Partial<ModelMaterial> | null) {
  const ids=new Set(selected);
  return models.map(model=>({...model,nodes:model.nodes.map(node=>ids.has(node.id)&&!inherited(model,node,"locked")?{...node,material:patch===null?undefined:{...nodeMaterial(model,node),...patch}}:node)}));
}
export function nodeStyle(model: ImportedModel, node: ModelNode): "shaded" | "wireframe" {
  const byId = index(model); let cursor: ModelNode | undefined = node;
  while (cursor) { if (cursor.style) return cursor.style; cursor = cursor.parent ? byId.get(cursor.parent) : undefined; } return model.sceneAppearance?.style || "shaded";
}
export function modelCoordinateItems(models: ImportedModel[], ids: string[]) {
  return models.flatMap(model=>model.nodes.filter(node=>{
    if(!ids.includes(node.id))return false;
    let parent=node.parent;while(parent){if(ids.includes(parent))return false;parent=index(model).get(parent)?.parent || null;}return true;
  }).map(node=>{
    const quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();new THREE.Matrix4().fromArray(node.matrix).decompose(new THREE.Vector3(),quaternion,scale);
    const euler=new THREE.Euler().setFromQuaternion(quaternion,"XYZ");
    return {model,node,position:modelPivotEntry(model,node).worldPoint.toArray() as [number,number,number],rotation:continuousEuler([euler.x,euler.y,euler.z],node.rotation),scale:scale.toArray() as [number,number,number],locked:inherited(model,node,"locked")};
  }));
}
export function transformModels(models: ImportedModel[], ids: string[], delta: number[], rotations?: Record<string,[number,number,number]>) {
  const change = new THREE.Matrix4().fromArray(delta), roots=new Set(modelCoordinateItems(models,ids).map(item=>item.node.id));
  return models.map(model => { const affected = descendants(model, ids); return { ...model, nodes: model.nodes.map(node => {
    if(!affected.has(node.id) || inherited(model,node,"locked"))return node;
    const matrix=change.clone().multiply(new THREE.Matrix4().fromArray(node.matrix)), q=new THREE.Quaternion();matrix.decompose(new THREE.Vector3(),q,new THREE.Vector3());
    const euler=new THREE.Euler().setFromQuaternion(q,"XYZ");
    return {...node,matrix:matrix.toArray(),rotation:continuousEuler([euler.x,euler.y,euler.z],rotations?.[node.id] || node.rotation),initialMatrix:roots.has(node.id) ? node.initialMatrix || node.matrix : change.clone().multiply(new THREE.Matrix4().fromArray(node.initialMatrix || node.matrix)).toArray()};
  }) }; });
}
export function editModelCoordinate(models: ImportedModel[], ids: string[], field: "position"|"rotation"|"scale", axis: 0|1|2, value: number) {
  if(!Number.isFinite(value))return models;
  let next=models;
  for(const item of modelCoordinateItems(models,ids).filter(item=>!item.locked)){
    const before=new THREE.Matrix4().compose(new THREE.Vector3(...item.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...item.rotation,"XYZ")),new THREE.Vector3(...item.scale));
    if(Math.abs(before.determinant())<1e-12)continue;
    const position=[...item.position] as [number,number,number],rotation=[...item.rotation] as [number,number,number],scale=[...item.scale] as [number,number,number];
    if(field==="position")position[axis]=value;else if(field==="rotation")rotation[axis]=THREE.MathUtils.degToRad(value);else scale[axis]=Math.max(.001,Math.min(1000,value));
    const after=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,"XYZ")),new THREE.Vector3(...scale));
    next=transformModels(next,[item.node.id],after.multiply(before.invert()).toArray(),{[item.node.id]:rotation});
  }
  return next;
}
export function resetModelCoordinates(models: ImportedModel[], ids: string[]) {
  let next=models;
  for(const item of modelCoordinateItems(models,ids).filter(item=>!item.locked && item.node.initialMatrix)){
    const current=new THREE.Matrix4().fromArray(item.node.matrix);if(Math.abs(current.determinant())<1e-12)continue;
    const initial=new THREE.Matrix4().fromArray(item.node.initialMatrix!),q=new THREE.Quaternion();initial.decompose(new THREE.Vector3(),q,new THREE.Vector3());const e=new THREE.Euler().setFromQuaternion(q,"XYZ");
    next=transformModels(next,[item.node.id],initial.multiply(current.invert()).toArray(),{[item.node.id]:[e.x,e.y,e.z]});
  }
  return next;
}
export function groupModelNodes(models: ImportedModel[], ids: string[], ungroup = false): ImportedModel[] {
  return models.map(model => {
    const selected = model.nodes.filter(n => ids.includes(n.id) && n.parent && !inherited(model, n, "locked"));
    const top = selected.filter(n => !selected.some(p => p.id !== n.id && descendants(model, [p.id]).has(n.id)));
    if (ungroup) {
      const groups = top.filter(n => !n.geometry), removed = new Set(groups.map(n => n.id));
      return { ...model, nodes: model.nodes.filter(n => !removed.has(n.id)).map(n => removed.has(n.parent || "") ? { ...n, parent: groups.find(p => p.id === n.parent)!.parent } : n) };
    }
    if (!top.length) return model;
    const id = crypto.randomUUID(), parent = top.every(n => n.parent === top[0].parent) ? top[0].parent : model.nodes[0].id;
    const chosen = new Set(top.map(n => n.id));
    return { ...model, nodes: [...model.nodes.map(n => chosen.has(n.id) ? { ...n, parent: id } : n), { id, parent, name: "Group", matrix: new THREE.Matrix4().toArray(), visible: true, locked: false }] };
  });
}
export function validateModels(input: unknown): ImportedModel[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error("Invalid model collection.");
  const ids = new Set<string>(), modelIds=new Set<string>();
  for (const model of input as ImportedModel[]) {
    if (!model || typeof model.id !== "string" || typeof model.name !== "string" || typeof model.hierarchy !== "boolean" || !Array.isArray(model.nodes) || !model.nodes.length || !model.geometries || typeof model.geometries !== "object") throw new Error("Invalid imported model.");
    if(modelIds.has(model.id))throw new Error("Duplicate imported model identity.");modelIds.add(model.id);
    const nodes = new Map(model.nodes.map(n => [n.id, n]));
    for (const node of model.nodes) {
      if (typeof node.id !== "string" || ids.has(node.id) || typeof node.name !== "string" || node.matrix?.length !== 16 || !node.matrix.every(Number.isFinite)) throw new Error("Invalid model hierarchy or transform.");
      if(node.initialMatrix !== undefined && (!Array.isArray(node.initialMatrix) || node.initialMatrix.length!==16 || !node.initialMatrix.every(Number.isFinite)))throw new Error("Invalid model reset transform.");
      if(node.rotation !== undefined && (!Array.isArray(node.rotation) || node.rotation.length!==3 || !node.rotation.every(Number.isFinite)))throw new Error("Invalid model rotation.");
      if (node.pivot !== undefined && (!Array.isArray(node.pivot) || node.pivot.length !== 3 || !node.pivot.every(Number.isFinite))) throw new Error("Invalid model pivot.");
      if (node.pivotMode !== undefined && node.pivotMode !== "custom" && !PIVOT_PRESETS.includes(node.pivotMode)) throw new Error("Invalid model pivot mode.");
      if(node.material !== undefined){const m=node.material;if(!m || typeof m!=="object" || typeof m.color!=="string" || !/^#[0-9a-f]{6}$/i.test(m.color) || ![m.diffuse,m.metallic,m.roughness,m.specular].every(v=>typeof v==="number" && Number.isFinite(v) && v>=0 && v<=1))throw new Error("Invalid model material.");}
      if(node.sceneGroupId !== undefined && (typeof node.sceneGroupId !== "string" || node.parent !== null))throw new Error("Invalid model scene group.");
      ids.add(node.id);
      const visited = new Set([node.id]); let parent = node.parent;
      while (parent) { if (visited.has(parent) || !nodes.has(parent)) throw new Error("Invalid model parent hierarchy."); visited.add(parent); parent = nodes.get(parent)!.parent; }
      if (node.geometry && !Object.hasOwn(model.geometries, node.geometry)) throw new Error("Missing model geometry.");
    }
    for (const data of Object.values(model.geometries)) {
      const geometry = modelGeometry(data), p = geometry.getAttribute("position"), normal = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
      if (!p.count || p.count % 1 || !p.array.every(Number.isFinite) || (normal && (normal.count !== p.count || !normal.array.every(Number.isFinite))) || (uv && (uv.count !== p.count || !uv.array.every(Number.isFinite))) || ((geometry.index?.count || p.count) % 3) || (geometry.index && geometry.index.array.some(i => i >= p.count))) { geometry.dispose(); throw new Error("Invalid model mesh data."); }
      geometry.dispose();
    }
  }
  return input as ImportedModel[];
}

/** World matrices preserve authored shears and grouping without lossy TRS decomposition. */
export class ModelLayer {
  root = new THREE.Group(); meshes = new Map<string, THREE.Mesh>(); models: ImportedModel[] = [];
  private geometries = new Map<ModelGeometry, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.MeshPhysicalMaterial>();
  private environment: THREE.Texture | null = null;
  setEnvironment(texture: THREE.Texture | null){this.environment=texture;for(const material of this.materials.values()){material.envMap=texture;material.envMapIntensity=.65;material.needsUpdate=true;}}
  private wireMaterials = new Map<string, THREE.MeshBasicMaterial>();
  sync(models: ImportedModel[], selected: string[] = []) {
    this.models = models; const alive = new Set<string>(), used = new Set<ModelGeometry>(), usedMaterials=new Set<string>();
    const requiredMaterials=new Set<string>(),requiredWires=new Set<string>(),usedWires=new Set<string>();
    for(const model of models)for(const node of model.nodes)if(node.geometry){const value=nodeMaterial(model,node);if(nodeStyle(model,node)==="wireframe")requiredWires.add(JSON.stringify([value.color,value.diffuse]));else requiredMaterials.add(JSON.stringify(value));}
    // Reuse no-longer-needed material instances during live slider edits. This
    // preserves the compiled shader while keeping distinct overrides isolated.
    const reusable=[...this.materials].filter(([key])=>!requiredMaterials.has(key));
    const reusableWires=[...this.wireMaterials].filter(([key])=>!requiredWires.has(key));
    for (const model of models) { const selection = descendants(model, selected), byId=new Map(model.nodes.map(n=>[n.id,n]));
      for (const node of model.nodes) if (node.geometry) {
        alive.add(node.id); const data = model.geometries[node.geometry]; used.add(data);
        let geometry = this.geometries.get(data); if (!geometry) { geometry = acquireViewGeometry(data); this.geometries.set(data, geometry); }
        let mesh = this.meshes.get(node.id); if (!mesh) { mesh = new THREE.Mesh(); mesh.matrixAutoUpdate = false; this.meshes.set(node.id, mesh); this.root.add(mesh); }
        mesh.geometry = geometry;
        const value=nodeMaterial(model,node,byId), key=JSON.stringify(value);
        if(nodeStyle(model,node)==="wireframe"){
          const wireKey=JSON.stringify([value.color,value.diffuse]);usedWires.add(wireKey);
          let material=this.wireMaterials.get(wireKey);
          if(!material){const previous=reusableWires.pop();if(previous){this.wireMaterials.delete(previous[0]);material=previous[1];}else material=new THREE.MeshBasicMaterial({wireframe:true,side:THREE.DoubleSide,toneMapped:false});material.name="Stage_Wireframe";material.color.set(value.color).multiplyScalar(value.diffuse);this.wireMaterials.set(wireKey,material);}
          mesh.material=material;
        }
        else {usedMaterials.add(key);let material=this.materials.get(key);if(!material){const prior=reusable.pop();if(prior){this.materials.delete(prior[0]);material=applyModelMaterial(prior[1],value);}else material=createModelMaterial(value);this.materials.set(key,material);}material.envMap=this.environment;material.envMapIntensity=.65;mesh.material=material;}
        mesh.name = node.name; mesh.userData = { modelNodeId: node.id, modelId: model.id, modelPickId: model.hierarchy ? node.id : model.nodes[0].id, selected: selection.has(node.id) };
        mesh.matrix.fromArray(node.matrix); mesh.visible = inherited(model, node, "visible"); mesh.matrixWorldNeedsUpdate = true;

      }
    }
    for (const [id, mesh] of this.meshes) if (!alive.has(id)) { mesh.removeFromParent(); this.meshes.delete(id); }
    for (const [data, geometry] of this.geometries) if (!used.has(data)) { releaseViewGeometry(data, geometry); this.geometries.delete(data); }
    for(const [key,material] of this.materials)if(!usedMaterials.has(key)){material.dispose();this.materials.delete(key);}
    for(const [key,material] of this.wireMaterials)if(!usedWires.has(key)){material.dispose();this.wireMaterials.delete(key);}
    this.root.updateMatrixWorld(true);
  }
  bounds(ids?: string[]) {
    const box = new THREE.Box3();
    for (const model of this.models) { const allowed = ids ? descendants(model, ids) : null; for (const node of model.nodes) { const mesh = this.meshes.get(node.id); if (mesh?.visible && (!allowed || allowed.has(node.id))) box.expandByObject(mesh); } }
    return box;
  }
  pick(raycaster: THREE.Raycaster) {
    const hit = raycaster.intersectObjects([...this.meshes.values()].filter(m => m.visible), false)[0]; if (!hit) return;
    const model = this.models.find(m => m.id === hit.object.userData.modelId)!;
    const node = model.nodes.find(n => n.id === hit.object.userData.modelNodeId)!;
    return { distance: hit.distance, id: model.hierarchy ? node.id : model.nodes[0].id };
  }
  dispose() { for (const [data, geometry] of this.geometries) releaseViewGeometry(data, geometry); this.geometries.clear(); for(const material of this.materials.values())material.dispose();this.materials.clear(); for(const material of this.wireMaterials.values())material.dispose();this.wireMaterials.clear(); this.meshes.clear(); this.root.clear(); this.models = []; this.root.removeFromParent(); }
}
