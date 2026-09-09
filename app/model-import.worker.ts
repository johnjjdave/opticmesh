/// <reference lib="webworker" />
import * as THREE from "three";
import { DOMParser } from "@xmldom/xmldom";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { packModelGeometry, type ImportedModel, type ModelNode } from "./model-data";

// Workers deliberately decode static geometry only. Source image shaders and lights
// never become executable scene content or remote resource requests.
Object.assign(globalThis, { DOMParser });
THREE.TextureLoader.prototype.load = function (_url, onLoad) { const t = new THREE.Texture<HTMLImageElement>(); queueMicrotask(() => onLoad?.(t)); return t; };
THREE.ImageBitmapLoader.prototype.load = function (_url, onLoad) { queueMicrotask(() => onLoad?.(new OffscreenCanvas(1, 1).transferToImageBitmap())); };
const decoder = new TextDecoder();
const MAX_DECODED_BYTES = 512 * 1024 * 1024;
type Files = Map<string, Uint8Array>;
function xml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("External XML declarations are unsupported.");
  const document = new DOMParser({ onError: (level, message) => { if (level !== "warning") throw new Error(message); } }).parseFromString(text, "application/xml");
  // COLLADA only needs attribute lookup here; no browser DOM is required.
  const query = function (this: Element | Document, selector: string) { const match = /^\[(id|sid)="([^"]+)"\]$/.exec(selector); if (!match) return null; return Array.from(this.getElementsByTagName("*")).find(e => e.getAttribute(match[1]) === match[2]) || null; };
  const all = Array.from(document.getElementsByTagName("*"));
  for (const element of all) Object.assign(element, { querySelector: query });
  Object.assign(document, { querySelector: query }); return document;
}
// Give COLLADA the same parser with the narrow query helper.
Object.assign(globalThis, { DOMParser: class { parseFromString(text: string) { return xml(text); } } });
const children = (e: Element, name?: string) => Array.from(e.childNodes).filter(n => n.nodeType === 1 && (!name || (n as Element).tagName === name)) as Element[];
const child = (e: Element, name: string) => children(e, name)[0];
const content = (e: Element, name: string) => child(e, name)?.textContent?.trim() || "";
function archive(bytes: Uint8Array): Files {
  let total = 0;
  const data = unzipSync(bytes, { filter: entry => { total += entry.originalSize; if (total > MAX_DECODED_BYTES) throw new Error("Archive exceeds the available import working budget (512 MiB). Export a smaller asset bundle."); if (/^[/\\]|(^|[/\\])\.\.([/\\]|$)/.test(entry.name)) throw new Error("Unsafe archive asset path."); return true; } });
  return new Map(Object.entries(data));
}
function lookup(files: Files, name: string) {
  let path = decodeURIComponent(name).replace(/\\/g, "/").replace(/^\.\//, "");
  if (/^(https?:|file:|\/)/i.test(path)) throw new Error("Only assets in the selected local bundle can be imported.");
  const segments: string[] = []; for(const part of path.split("/")){if(part === "." || !part)continue;if(part === ".."){if(!segments.length)throw new Error("Asset reference leaves the selected bundle.");segments.pop();}else segments.push(part);}path=segments.join("/");
  const exact = files.get(path); if (exact) return exact;
  const matches = [...files].filter(([key]) => key.toLowerCase() === path.toLowerCase());
  if (matches.length === 1) return matches[0][1];
  throw new Error(`Missing companion asset: ${name}. Select it with the model or use a packaged format.`);
}
function matrix(text: string, gdtf = false) {
  if (!text) return new THREE.Matrix4();
  const v = (text.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) || []).map(Number);
  if (!v.every(Number.isFinite)) throw new Error("Invalid source transformation.");
  if (gdtf && v.length === 16) return new THREE.Matrix4().fromArray(v);
  if (v.length !== 12) throw new Error("Unsupported source transformation matrix.");
  return new THREE.Matrix4().fromArray([v[0],v[1],v[2],0,v[3],v[4],v[5],0,v[6],v[7],v[8],0,v[9],v[10],v[11],1]);
}
function setMatrix(object: THREE.Object3D, value: THREE.Matrix4) { object.matrix.copy(value); object.matrixAutoUpdate = false; }

async function meshFile(name: string, files: Files, warnings: Set<string>): Promise<THREE.Object3D> {
  const bytes = lookup(files, name), ext = name.split(".").pop()!.toLowerCase();
  const manager = new THREE.LoadingManager(), urls: string[] = [];
  manager.setURLModifier(url => {
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    const base = name.includes("/") ? name.slice(0, name.lastIndexOf("/") + 1) : "";
    const objectUrl = URL.createObjectURL(new Blob([lookup(files, base + url).slice().buffer])); urls.push(objectUrl); return objectUrl;
  });
  try {
    const buffer = bytes.slice().buffer;
    if (ext === "glb" || ext === "gltf") {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader(manager);
      loader.register(() => ({ name: "OPTICMESH_NEUTRAL", loadMaterial: () => Promise.resolve(new THREE.MeshStandardMaterial()) }));
      return (await loader.parseAsync(ext === "glb" ? buffer : decoder.decode(bytes), "")).scene;
    }
    if (ext === "obj") { const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js"); return new OBJLoader(manager).parse(decoder.decode(bytes)); }
    if (ext === "fbx") { const { FBXLoader } = await import("./vendor/FBXLoader.js"); return new FBXLoader(manager).parse(buffer, ""); }
    if (ext === "3ds") { const { TDSLoader } = await import("three/examples/jsm/loaders/TDSLoader.js"); warnings.add("3DS imports mesh names and placement; legacy keyframer hierarchy is not preserved."); return new TDSLoader(manager).parse(buffer, ""); }
    if (ext === "stl") { const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js"); return new THREE.Mesh(new STLLoader(manager).parse(buffer)); }
    if (ext === "dae") { const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js"); return new ColladaLoader(manager).parse(decoder.decode(bytes), "")!.scene; }
    if (["usd", "usda", "usdc", "usdz"].includes(ext)) {
      const { USDLoader } = await import("three/examples/jsm/loaders/USDLoader.js"); warnings.add("USD imports supported static meshes. Advanced composition, animation and shading may differ from the source.");
      return await new Promise((resolve, reject) => { new USDLoader(manager).parse(buffer, "", resolve, reject); });
    }
    throw new Error(`Unsupported mesh format: ${ext}`);
  } finally { for (const url of urls) URL.revokeObjectURL(url); }
}

async function gdtf(bytes: Uint8Array, warnings: Set<string>) {
  const files = archive(bytes), doc = xml(decoder.decode(lookup(files, "description.xml"))), fixture = doc.getElementsByTagName("FixtureType")[0];
  if (!["1.1", "1.2"].includes(doc.documentElement?.getAttribute("DataVersion") || "")) throw new Error("Supported GDTF geometry versions are 1.1 and 1.2.");
  if (!fixture) throw new Error("GDTF fixture description is missing.");
  const definitions = children(child(fixture as unknown as Element, "Models") || fixture as unknown as Element, "Model");
  const geometryRoot = child(fixture as unknown as Element, "Geometries"); if (!geometryRoot) throw new Error("GDTF contains no geometry hierarchy.");
  const definitionsByName = new Map(definitions.map(e => [e.getAttribute("Name"), e]));
  const geometryByName = new Map(Array.from(geometryRoot.getElementsByTagName("*")).map(e => [e.getAttribute("Name"), e]));
  const cache = new Map<string, THREE.Object3D>();
  async function part(element: Element, stack: Set<Element>): Promise<THREE.Object3D> {
    if (stack.has(element) || stack.size > 128) throw new Error("Cyclic or excessively nested GDTF geometry.");
    const next = new Set(stack).add(element), group = new THREE.Group(); group.name = element.getAttribute("Name") || element.tagName;
    setMatrix(group, matrix(element.getAttribute("Position") || "", true));
    const modelName = element.getAttribute("Model"), definition = definitionsByName.get(modelName);
    if (definition) {
      let object = cache.get(modelName!);
      if (!object) {
        const file = definition.getAttribute("File"), primitive = definition.getAttribute("PrimitiveType"), size = ["Length", "Width", "Height"].map(k => Number(definition.getAttribute(k)) || .1);
        if (file) {
          const path = [`models/gltf/${file}.glb`, `models/3ds/${file}.3ds`].find(p => files.has(p));
          if (!path) throw new Error(`Missing GDTF mesh: ${file}`);
          object = await meshFile(path, files, warnings);
          const adapter = new THREE.Group(); if (path.endsWith(".glb")) adapter.rotation.x = Math.PI / 2; else adapter.scale.setScalar(.001); adapter.add(object); object = adapter;
        } else {
          const geometry = primitive === "Sphere" ? new THREE.SphereGeometry(.5, 12, 8) : primitive === "Cylinder" ? new THREE.CylinderGeometry(.5, .5, 1, 12) : new THREE.BoxGeometry(1, 1, 1);
          if (!["Cube", "Sphere", "Cylinder"].includes(primitive || "")) warnings.add("Some GDTF predefined shapes use dimensioned box placeholders.");
          if(primitive === "Cylinder") geometry.rotateX(Math.PI/2);
          object = new THREE.Mesh(geometry); object.scale.set(size[0], size[1], size[2]);
        }
        cache.set(modelName!, object);
      }
      group.add(object.clone(true));
    }
    if (element.tagName === "GeometryReference") { const target = geometryByName.get(element.getAttribute("Geometry")); if (target) group.add(await part(target, next)); else warnings.add("A GDTF geometry reference could not be resolved."); }
    for (const elementChild of children(element)) if (elementChild.hasAttribute("Position") || elementChild.hasAttribute("Model") || elementChild.tagName.startsWith("Geometry")) group.add(await part(elementChild, next));
    return group;
  }
  const root = new THREE.Group(); root.name = fixture.getAttribute("Name") || "Fixture";
  for (const e of children(geometryRoot)) root.add(await part(e, new Set()));
  warnings.add("GDTF imports static fixture geometry at its authored pose; beams and DMX behaviour are excluded.");
  return root;
}

async function mvr(bytes: Uint8Array, warnings: Set<string>) {
  const files = archive(bytes), doc = xml(decoder.decode(lookup(files, "GeneralSceneDescription.xml"))), documentRoot = doc.documentElement!;
  const major = documentRoot.getAttribute("verMajor"), minor = documentRoot.getAttribute("verMinor");
  if (documentRoot.tagName !== "GeneralSceneDescription") throw new Error("MVR scene description root is invalid.");
  if (major !== "1" || !["4", "5", "6"].includes(minor || "")) throw new Error(`MVR version ${major || "?"}.${minor || "?"} is unsupported. Supported versions are 1.4, 1.5 and 1.6.`);
  const symdefs = new Map(Array.from(doc.getElementsByTagName("Symdef")).map(e => [e.getAttribute("uuid"), e as unknown as Element]));
  const meshCache = new Map<string, THREE.Object3D>();
  async function assemble(element: Element, stack: Set<Element>): Promise<THREE.Object3D> {
    if (stack.has(element) || stack.size > 128) throw new Error("Cyclic or excessively nested MVR hierarchy.");
    const next = new Set(stack).add(element), group = new THREE.Group(); group.name = element.getAttribute("name") || element.tagName;
    // Older symbol definitions can place resources directly in ChildList.
    // Resource matrices belong to their wrapper and must be applied only once.
    const isResource = element.tagName === "Geometry3D" || element.tagName === "Symbol";
    if (!isResource) setMatrix(group, matrix(content(element, "Matrix")));
    for (const item of isResource ? [element] : children(child(element, "Geometries") || element)) {
      if (item.tagName === "Geometry3D") {
        let file = item.getAttribute("fileName") || ""; if (!file.includes(".")) file += ".3ds";
        let mesh = meshCache.get(file); if (!mesh) { mesh = await meshFile(file, files, warnings); meshCache.set(file, mesh); }
        const wrapper = new THREE.Group(); setMatrix(wrapper, matrix(content(item, "Matrix")));
        const resource = new THREE.Group(); if (/\.gl(?:tf|b)$/i.test(file)) { resource.rotation.x = Math.PI / 2; resource.scale.setScalar(1000); }
        resource.add(mesh.clone(true)); wrapper.add(resource); group.add(wrapper);
      } else if (item.tagName === "Symbol") {
        const definition = symdefs.get(item.getAttribute("symdef")); if (!definition) throw new Error("Missing MVR symbol definition.");
        const wrapper = new THREE.Group(); setMatrix(wrapper, matrix(content(item, "Matrix"))); wrapper.add(await assemble(definition, next)); group.add(wrapper);
      }
    }
    if (element.tagName === "Fixture" && content(element, "GDTFSpec")) warnings.add("Lighting fixture definitions and metadata are excluded from MVR mesh import.");
    const list = child(element, "ChildList"); if (list) for (const e of children(list)) group.add(await assemble(e, next));
    return group;
  }
  const root = new THREE.Group();
  const layers = doc.getElementsByTagName("Layers")[0]; if (!layers) throw new Error("MVR scene layers are missing.");
  for (const layer of children(layers as unknown as Element)) root.add(await assemble(layer, new Set()));
  // Keep mesh-bearing branches only; focus points, addresses and empty fixture
  // records have no place in the stage-reference hierarchy.
  const keepMeshes = (object: THREE.Object3D): boolean => {
    for (const child of [...object.children]) if (!keepMeshes(child)) object.remove(child);
    return (object instanceof THREE.Mesh && !!object.geometry.getAttribute("position")?.count) || object.children.length > 0;
  };
  keepMeshes(root);
  return root;
}

async function run(files: Files, name: string): Promise<ImportedModel> {
  const ext = name.split(".").pop()!.toLowerCase(), warnings = new Set<string>();
  self.postMessage({ progress: `Reading ${ext.toUpperCase()} geometry…` });
  const root = ext === "mvr" ? await mvr(lookup(files, name), warnings) : ext === "gdtf" ? await gdtf(lookup(files, name), warnings) : await meshFile(name, files, warnings);
  root.updateMatrixWorld(true);
  const model: ImportedModel = { id: crypto.randomUUID(), name, format: ext, hierarchy: true, nodes: [], geometries: {}, warnings: [], triangles: 0 };
  const geometryIds = new Map<THREE.BufferGeometry, string>();
  const rootId = crypto.randomUUID();
  model.nodes.push({ id: rootId, parent: null, name: `3D Model — ${name}`, matrix: new THREE.Matrix4().toArray(), visible: true, locked: false, style: "shaded" });
  const add = (object: THREE.Object3D, parent: string) => {
    const id = crypto.randomUUID(), node: ModelNode = { id, parent, name: object.name || (object instanceof THREE.Mesh ? "Mesh" : "Group"), matrix: object.matrixWorld.toArray(), visible: object.visible, locked: false };
    if (!node.matrix.every(Number.isFinite)) throw new Error(`Object "${node.name}" has an invalid transform. Check its coordinates in the source application and export it again.`);
    if (object instanceof THREE.Mesh) {
      let geometry = object.geometry;
      if (object instanceof THREE.SkinnedMesh) { geometry = object.geometry.clone(); const p = geometry.getAttribute("position"), point = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { object.getVertexPosition(i, point); p.setXYZ(i, point.x, point.y, point.z); } geometry.computeVertexNormals(); warnings.add("Skinned geometry is imported as a static pose."); }
      let key = geometryIds.get(geometry);
      if (!key) {
        key = crypto.randomUUID(); geometryIds.set(geometry, key);
        model.geometries[key] = packModelGeometry(geometry, node.name, message => warnings.add(message));
      }
      node.geometry = key; model.triangles += (geometry.index?.count || geometry.getAttribute("position").count) / 3;
    } else if (object instanceof THREE.Line || object instanceof THREE.Points) warnings.add("Non-surface lines and points are omitted.");
    if (object instanceof THREE.Light || object instanceof THREE.Camera) return;
    model.nodes.push(node); for (const c of object.children) add(c, id);
  };
  add(root, rootId);
  if (!model.triangles) throw new Error("No supported triangle mesh geometry was found.");
  model.warnings = [...warnings]; return model;
}
self.onmessage = async event => {
  try {
    const { files, name } = event.data as { files: Array<{ name: string; bytes: ArrayBuffer }>; name: string };
    const total = files.reduce((sum, f) => sum + f.bytes.byteLength, 0); if (total > MAX_DECODED_BYTES) throw new Error("Selected assets exceed the 512 MiB import working budget.");
    const map = new Map(files.map(f => [f.name, new Uint8Array(f.bytes)]));
    self.postMessage({ model: await run(map, name) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Unable to read model." }); }
};
