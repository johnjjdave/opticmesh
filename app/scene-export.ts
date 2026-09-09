import { DEFAULT_BODY_MATERIAL, type BodyAppearance } from "./slice-material";
import { pivotOffset } from "./slice-pivot";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { createModelMaterial, nodeMaterial, modelGeometry, modelTriangleCount, inherited, type ImportedModel } from "./model-data";
import { createSliceGeometry, type SimulationSlice, type SliceCurvature, type SlicePivot, type SliceTransform } from "./three-simulation";
import { normalizeTransform, type TransformGroup } from "./group-transforms";
import packageMetadata from "../package.json";

export type SceneExportFormat = "glb" | "gltf" | "obj" | "mvr" | "stl" | "usdz";

export type SceneExportOptions = {
  bodyAppearanceBySlice?:Record<string,BodyAppearance>;
  models?: ImportedModel[];
  projectName: string;
  slices: SimulationSlice[];
  compositionWidth: number;
  compositionHeight: number;
  masterPitchMm: number;
  pitchBySlice: Record<string, number>;
  depthBySlice: Record<string, number>;
  curvatureBySlice: Record<string, SliceCurvature>;
  pivotBySlice: Record<string, SlicePivot>;
  transforms: Record<string, SliceTransform>;
  groups?: TransformGroup[];
  drawPatternTexture: (canvas: HTMLCanvasElement) => void;
};

export type SceneExportResult = {
  blob: Blob;
  filename: string;
  mimeType: string;
  sliceCount: number;
  triangleCount: number;
};

type BuiltScene = {
  scene: THREE.Scene;
  texture: THREE.CanvasTexture;
  textureCanvas: HTMLCanvasElement;
  meshesBySlice: Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>>;
  triangleCount: number;
};
type ZipEntry = { name: string; data: Uint8Array };

const encoder = new TextEncoder();

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "lo2s-scene"
  );
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function deterministicUuid(value: string) {
  const hashes = [2166136261, 2246822519, 3266489917, 668265263];
  for (let lane = 0; lane < hashes.length; lane += 1) {
    let hash = hashes[lane] >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index) + lane * 31;
      hash = Math.imul(hash, 16777619 + lane * 2) >>> 0;
    }
    hashes[lane] = hash;
  }
  const bytes = new Uint8Array(16);
  hashes.forEach((hash, lane) => new DataView(bytes.buffer).setUint32(lane * 4, hash, false));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildScene(options: SceneExportOptions): BuiltScene {
  const scene = new THREE.Scene();
  scene.name = options.projectName;
  const root = new THREE.Group();
  root.name = "LO2S LED Screens";
  scene.add(root);


  const textureCanvas = document.createElement("canvas");
  options.drawPatternTexture(textureCanvas);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.name = "LO2S - OpticMesh Pattern Map";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const front = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  front.name = "LED_Surface";
  const masterPitchM = options.masterPitchMm / 1000;
  const meshesBySlice = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>>();
  const groupObjects = new Map<string, THREE.Group>();
  const groupBySlice = new Map<string, TransformGroup>();
  (options.groups || []).forEach((group) => {
    const object = new THREE.Group(),
      transform = normalizeTransform(group.transform);
    object.name = group.name;
    object.position.fromArray(transform.position);
    object.rotation.fromArray([...transform.rotation, "XYZ"]);
    object.scale.fromArray(transform.scale || [1, 1, 1]);
    object.userData = {
      lo2sUuid: deterministicUuid(`lo2s:group:${group.id}`),
      groupId: group.id,
      groupName: group.name,
    };
    root.add(object);
    groupObjects.set(group.id, object);
    group.sliceIds.forEach((id) => groupBySlice.set(id, group));
  });
  (options.groups || []).forEach((group) => {
    if (!group.parentId) return;
    const object = groupObjects.get(group.id),
      parent = groupObjects.get(group.parentId);
    if (object && parent && object !== parent) parent.add(object);
  });
  scene.updateMatrixWorld(true);
  for (const model of options.models || []) {
    const objects = new Map<string, THREE.Object3D>();
    for (const node of model.nodes) {
      if (!inherited(model,node,"visible")) continue;
      const object = node.geometry ? new THREE.Mesh(modelGeometry(model.geometries[node.geometry]), createModelMaterial(nodeMaterial(model,node))) : new THREE.Group();
      object.name = node.name; object.visible = inherited(model,node,"visible"); object.matrixAutoUpdate=false; object.matrix.fromArray(node.matrix); objects.set(node.id,object);
    }
    for (const node of model.nodes) { const object=objects.get(node.id); if(!object)continue; const parent=node.parent ? objects.get(node.parent) : null; if(parent) { const parentNode=model.nodes.find(n=>n.id===node.parent)!; object.matrix.premultiply(new THREE.Matrix4().fromArray(parentNode.matrix).invert()); parent.add(object); } else { const owner=node.sceneGroupId?groupObjects.get(node.sceneGroupId):null;if(owner){object.matrix.premultiply(owner.matrixWorld.clone().invert());owner.add(object);}else scene.add(object); } }
  }
  let triangleCount = 0;

  options.slices.forEach((slice) => {
    const localPitchM = (options.pitchBySlice[slice.id] || options.masterPitchMm) / 1000;
    const pivot = options.pivotBySlice[slice.id] || "bottom-center";
    const geometry = createSliceGeometry(slice, localPitchM, options.depthBySlice[slice.id] || 0.01, options.curvatureBySlice[slice.id] || { horizontal: 0, vertical: 0 }, options.compositionWidth, options.compositionHeight, pivot, false);
    triangleCount += geometry.getAttribute("position").count / 3;
    const body=createModelMaterial(options.bodyAppearanceBySlice?.[slice.id]?.material || DEFAULT_BODY_MATERIAL);
    const mesh = new THREE.Mesh(geometry, [front, body]);
    mesh.name = `${slice.screenName} - ${slice.name}`;
    const offset = pivotOffset(pivot, slice.input.width * localPitchM, slice.input.height * localPitchM);
    const initialPosition: [number, number, number] = [(slice.input.x + slice.input.width / 2 - options.compositionWidth / 2) * masterPitchM + offset[0], (options.compositionHeight - slice.input.y - slice.input.height / 2) * masterPitchM + offset[1], offset[2]];
    const saved = options.transforms[slice.id];
    mesh.position.fromArray(saved?.position || initialPosition);
    if (saved) mesh.rotation.fromArray([...saved.rotation, "XYZ"]);
    mesh.scale.fromArray(saved?.scale || [1, 1, 1]);
    mesh.userData = {
      lo2sUuid: deterministicUuid(`lo2s:slice:${slice.id}`),
      sliceId: slice.id,
      sliceName: slice.name,
      screenName: slice.screenName,
      pivot,
      pitchMm: options.pitchBySlice[slice.id] || options.masterPitchMm,
      depthCm: (options.depthBySlice[slice.id] || 0.01) * 100,
      horizontalCurveDegrees: options.curvatureBySlice[slice.id]?.horizontal || 0,
      verticalCurveDegrees: options.curvatureBySlice[slice.id]?.vertical || 0,
      inputPixels: {
        x: slice.input.x,
        y: slice.input.y,
        width: slice.input.width,
        height: slice.input.height,
      },
    };
    const group = groupBySlice.get(slice.id);
    (group ? groupObjects.get(group.id) || root : root).add(mesh);
    meshesBySlice.set(slice.id, mesh);
  });
  scene.updateMatrixWorld(true);
  return { scene, texture, textureCanvas, meshesBySlice, triangleCount };
}

function disposeBuiltScene(built: BuiltScene) {
  built.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
  });
  const materials = new Set<THREE.Material>();
  built.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
  });
  materials.forEach((material) => material.dispose());
  built.texture.dispose();
}

function decodeDataUri(uri: string) {
  const comma = uri.indexOf(",");
  if (comma < 0) throw new Error("The glTF exporter returned an invalid embedded asset.");
  const metadata = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (metadata.includes(";base64")) {
    const binary = atob(payload);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return encoder.encode(decodeURIComponent(payload));
}

function imageExtension(uri: string) {
  if (uri.startsWith("data:image/jpeg")) return "jpg";
  if (uri.startsWith("data:image/webp")) return "webp";
  return "png";
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function createStoredZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  entries.forEach((entry) => {
    const name = encoder.encode(entry.name.replace(/\\/g, "/"));
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.data.length;
  });

  const central = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localParts, central, end]);
}

function binaryChunk(id: number, ...parts: Uint8Array[]) {
  const body = concatBytes(parts);
  const result = new Uint8Array(6 + body.length);
  const view = new DataView(result.buffer);
  view.setUint16(0, id, true);
  view.setUint32(2, result.length, true);
  result.set(body, 6);
  return result;
}

function nullString(value: string) {
  return concatBytes([encoder.encode(value.replace(/\0/g, "").slice(0, 63)), new Uint8Array([0])]);
}

function uint16(value: number) {
  const result = new Uint8Array(2);
  new DataView(result.buffer).setUint16(0, value, true);
  return result;
}

function colorChunk(red: number, green: number, blue: number) {
  return binaryChunk(0x0011, new Uint8Array([red, green, blue]));
}

function percentChunk(value: number) {
  return binaryChunk(0x0030, uint16(value));
}

function material3ds(name: string, color: [number, number, number], textureFilename?: string, emissive = false) {
  const parts = [binaryChunk(0xa000, nullString(name)), binaryChunk(0xa020, colorChunk(...color))];
  if (emissive) parts.push(binaryChunk(0xa084, percentChunk(100)));
  if (textureFilename) parts.push(binaryChunk(0xa200, binaryChunk(0xa300, nullString(textureFilename))));
  return binaryChunk(0xafff, ...parts);
}

function meshObject3ds(name: string, geometry: THREE.BufferGeometry, start: number, count: number, materialName: string, batchIndex: number) {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const uvs = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const triangleCount = Math.floor(count / 3);
  const vertices = new Uint8Array(2 + triangleCount * 3 * 12);
  const vertexView = new DataView(vertices.buffer);
  vertexView.setUint16(0, triangleCount * 3, true);
  const mapping = new Uint8Array(2 + triangleCount * 3 * 8);
  const mappingView = new DataView(mapping.buffer);
  mappingView.setUint16(0, triangleCount * 3, true);
  for (let local = 0; local < triangleCount * 3; local += 1) {
    const source = start + local;
    // Three/glTF Y-up metres -> MVR/3DS Z-up millimetres.
    vertexView.setFloat32(2 + local * 12, positions.getX(source) * 1000, true);
    vertexView.setFloat32(6 + local * 12, -positions.getZ(source) * 1000, true);
    vertexView.setFloat32(10 + local * 12, positions.getY(source) * 1000, true);
    mappingView.setFloat32(2 + local * 8, uvs ? uvs.getX(source) : 0, true);
    mappingView.setFloat32(6 + local * 8, uvs ? 1 - uvs.getY(source) : 0, true);
  }
  const faceData = new Uint8Array(2 + triangleCount * 8);
  const faceView = new DataView(faceData.buffer);
  faceView.setUint16(0, triangleCount, true);
  for (let face = 0; face < triangleCount; face += 1) {
    const offset = 2 + face * 8;
    faceView.setUint16(offset, face * 3, true);
    faceView.setUint16(offset + 2, face * 3 + 1, true);
    faceView.setUint16(offset + 4, face * 3 + 2, true);
    faceView.setUint16(offset + 6, 7, true);
  }
  const materialFaces = new Uint8Array(2 + triangleCount * 2);
  const materialView = new DataView(materialFaces.buffer);
  materialView.setUint16(0, triangleCount, true);
  for (let face = 0; face < triangleCount; face += 1) materialView.setUint16(2 + face * 2, face, true);
  const faceChunk = binaryChunk(0x4120, faceData, binaryChunk(0x4130, nullString(materialName), materialFaces));
  const localAxes = new Uint8Array(48);
  const axes = new DataView(localAxes.buffer);
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0].forEach((value, index) => axes.setFloat32(index * 4, value, true));
  return binaryChunk(0x4000, nullString(`${name}_${String(batchIndex).padStart(2, "0")}`), binaryChunk(0x4100, binaryChunk(0x4110, vertices), faceChunk, binaryChunk(0x4140, mapping), binaryChunk(0x4160, localAxes)));
}

function geometry3ds(geometry: THREE.BufferGeometry, name: string, textureFilename: string) {
  if (geometry.index) geometry = geometry.toNonIndexed();
  const groups = geometry.groups.length
    ? geometry.groups
    : [
        {
          start: 0,
          count: geometry.getAttribute("position").count,
          materialIndex: 0,
        },
      ];
  const objects: Uint8Array[] = [];
  let faceCount = 0;
  groups.forEach((group, groupIndex) => {
    const materialName = group.materialIndex === 0 ? "LED_Surface" : "Screen_Body";
    let remaining = Math.floor(group.count / 3) * 3;
    let start = group.start;
    let batch = 0;
    while (remaining > 0) {
      const count = Math.min(remaining, 21000 * 3);
      objects.push(meshObject3ds(`${name}_${groupIndex}`, geometry, start, count, materialName, batch++));
      faceCount += count / 3;
      start += count;
      remaining -= count;
    }
  });
  if (!faceCount) throw new Error(`MVR geometry ${name} contains no faces.`);
  const editor = binaryChunk(0x3d3d, material3ds("LED_Surface", [255, 255, 255], textureFilename, true), material3ds("Screen_Body", [37, 42, 45]), ...objects);
  return { data: binaryChunk(0x4d4d, editor), faceCount };
}

async function gltfJsonAndAssets(scene: THREE.Scene, basename: string) {
  const exported = await new GLTFExporter().parseAsync(scene, {
    binary: false,
    onlyVisible: true,
    trs: false,
    includeCustomExtensions: false,
  });
  if (exported instanceof ArrayBuffer) throw new Error("Expected a JSON glTF export.");
  const json = exported as Record<string, unknown> & {
    buffers?: Array<{ uri?: string }>;
    images?: Array<{ uri?: string }>;
  };
  const files: ZipEntry[] = [];
  json.buffers?.forEach((buffer, index) => {
    if (!buffer.uri?.startsWith("data:")) return;
    const filename = `${basename}-buffer-${index + 1}.bin`;
    files.push({ name: filename, data: decodeDataUri(buffer.uri) });
    buffer.uri = filename;
  });
  json.images?.forEach((image, index) => {
    if (!image.uri?.startsWith("data:")) return;
    const filename = `${basename}-texture-${index + 1}.${imageExtension(image.uri)}`;
    files.push({ name: filename, data: decodeDataUri(image.uri) });
    image.uri = filename;
  });
  files.unshift({
    name: `${basename}.gltf`,
    data: encoder.encode(JSON.stringify(json, null, 2)),
  });
  return files;
}

function matrixText(matrix: THREE.Matrix4) {
  const e = matrix.elements;
  return `{${e[0]},${e[1]},${e[2]}}{${e[4]},${e[5]},${e[6]}}{${e[8]},${e[9]},${e[10]}}{${e[12] * 1000},${e[13] * 1000},${e[14] * 1000}}`;
}

function mvrMatrixText(matrix: THREE.Matrix4) {
  const yUpToZUp = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const converted = yUpToZUp.clone().multiply(matrix).multiply(yUpToZUp.clone().invert());
  return matrixText(converted);
}

function createMvrXml(options: SceneExportOptions, geometryFilename: string) {
  const layerUuid = deterministicUuid(`lo2s:layer:${options.projectName}`);
  const sceneUuid = deterministicUuid(`lo2s:scene:${options.projectName}`);
  const contentName = options.models?.length ? "Stage and Screens" : "LED Screens";
  return `<?xml version="1.0" encoding="UTF-8"?>
<GeneralSceneDescription verMajor="1" verMinor="5" provider="LO2S - OpticMesh" providerVersion="${packageMetadata.version}">
  <UserData><Data provider="LO2S - OpticMesh" ver="${packageMetadata.version}"><SliceCount>${options.slices.length}</SliceCount></Data></UserData>
  <Scene>
    <AUXData/>
    <Layers>
      <Layer name="${contentName}" uuid="${layerUuid}">
        <ChildList>
          <SceneObject name="${xmlEscape(options.projectName)} - ${contentName}" uuid="${sceneUuid}">
            <Matrix>{1,0,0}{0,1,0}{0,0,1}{0,0,0}</Matrix>
            <Geometries><Geometry3D fileName="${xmlEscape(geometryFilename)}"/></Geometries>
            <Function>${options.models?.length ? "Stage Reference" : "LED Screen"}</Function>
            <CastShadow>false</CastShadow>
            <FixtureID>${xmlEscape(options.projectName)}</FixtureID>
            <FixtureIDNumeric>1</FixtureIDNumeric>
            <UnitNumber>1</UnitNumber>
            <CustomId>0</CustomId>
          </SceneObject>
        </ChildList>
      </Layer>
    </Layers>
  </Scene>
</GeneralSceneDescription>
`;
}

async function buildMvrFiles(built: BuiltScene, options: SceneExportOptions, basename: string) {
  // A single GLB resource is intentional. Some MVR importers silently drop
  // individual Geometry3D resources from a multi-file package. The same GLB
  // scene path is already interoperable across the target applications, keeps
  // each slice as a named node, and preserves all local axes and transforms.
  const exported = await new GLTFExporter().parseAsync(built.scene, {
    binary: true,
    onlyVisible: true,
    trs: false,
    includeCustomExtensions: false,
  });
  if (!(exported instanceof ArrayBuffer)) throw new Error("MVR validation failed: the embedded scene is not a binary GLB.");
  const sceneData = new Uint8Array(exported);
  if (sceneData.length < 20 || new DataView(sceneData.buffer, sceneData.byteOffset, sceneData.byteLength).getUint32(0, true) !== 0x46546c67) {
    throw new Error("MVR validation failed: the embedded GLB header is invalid.");
  }
  const geometryFilename = `${basename}-screens.glb`;
  return [
    {
      name: "GeneralSceneDescription.xml",
      data: encoder.encode(createMvrXml(options, geometryFilename)),
    },
    { name: geometryFilename, data: sceneData },
  ];
}

export async function exportSimulationScene(format: SceneExportFormat, options: SceneExportOptions): Promise<SceneExportResult> {
  if (!options.slices.length && !options.models?.length) throw new Error("Import screens or a 3D model before exporting the scene.");
  const basename = slugify(options.projectName);
  const built = buildScene(options);
  for (const model of options.models || []) for (const node of model.nodes) if(node.geometry && inherited(model,node,"visible")) { built.triangleCount += modelTriangleCount(model.geometries[node.geometry]); }
  try {
    if (format === "stl") {
      built.scene.updateMatrixWorld(true);
      const data = new STLExporter().parse(built.scene, { binary: true });
      return { blob: new Blob([new Uint8Array(data.buffer as ArrayBuffer)], { type: "model/stl" }), filename: `${basename}.stl`, mimeType: "model/stl", sliceCount: options.slices.length, triangleCount: built.triangleCount };
    }
    if (format === "usdz") {
      const data = await new USDZExporter().parseAsync(built.scene);
      return { blob: new Blob([data.slice().buffer as ArrayBuffer], { type: "model/vnd.usdz+zip" }), filename: `${basename}.usdz`, mimeType: "model/vnd.usdz+zip", sliceCount: options.slices.length, triangleCount: built.triangleCount };
    }
    if (format === "glb") {
      const result = await new GLTFExporter().parseAsync(built.scene, {
        binary: true,
        onlyVisible: true,
        trs: false,
        includeCustomExtensions: false,
      });
      if (!(result instanceof ArrayBuffer)) throw new Error("The GLB exporter did not return binary data.");
      return {
        blob: new Blob([result], { type: "model/gltf-binary" }),
        filename: `${basename}.glb`,
        mimeType: "model/gltf-binary",
        sliceCount: options.slices.length,
        triangleCount: built.triangleCount,
      };
    }

    if (format === "gltf") {
      const files = await gltfJsonAndAssets(built.scene, basename);
      return {
        blob: new Blob([createStoredZip(files)], { type: "application/zip" }),
        filename: `${basename}-gltf.zip`,
        mimeType: "application/zip",
        sliceCount: options.slices.length,
        triangleCount: built.triangleCount,
      };
    }

    if (format === "obj") {
      const obj = new OBJExporter().parse(built.scene);
      const textureBlob = await new Promise<Blob | null>((resolve) => built.textureCanvas.toBlob(resolve, "image/png"));
      if (!textureBlob) throw new Error("Unable to create the exported LED texture.");
      const stageMaterials = new Map<string, THREE.MeshPhysicalMaterial>();
      built.scene.traverse(object=>{if(object instanceof THREE.Mesh){for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshPhysicalMaterial && material.name.startsWith("Stage_"))stageMaterials.set(material.name,material);}});
      const stageMtl=[...stageMaterials.values()].map(m=>`newmtl ${m.name}\nKd ${m.color.toArray().join(" ")}\nKs ${[1,1,1].map(()=>m.specularIntensity*.04).join(" ")}\nNs ${Math.max(0,2/Math.max(.001,m.roughness*m.roughness)-2)}\nPr ${m.roughness}\nPm ${m.metalness}\nillum 2\n\n`).join("");
      const mtl = `${stageMtl}newmtl LED_Surface\nKa 1.000000 1.000000 1.000000\nKd 1.000000 1.000000 1.000000\nKe 1.000000 1.000000 1.000000\nmap_Kd ${basename}-texture.png\nmap_Ke ${basename}-texture.png\nillum 1\n\nnewmtl Screen_Body\nKa 0.145000 0.165000 0.176000\nKd 0.145000 0.165000 0.176000\nKs 0.080000 0.080000 0.080000\nillum 2\n`;
      const objWithMtl = `# LO2S - OpticMesh\n# Units: metres (1 OBJ unit = 1 metre). Import with scale 1 and source units metres.\n# Up axis: Y. Unit comments are informational; OBJ has no standard physical-unit field.\nmtllib ${basename}.mtl\n${obj}`;
      const files: ZipEntry[] = [
        { name: `${basename}.obj`, data: encoder.encode(objWithMtl) },
        { name: `${basename}.mtl`, data: encoder.encode(mtl) },
        {
          name: `${basename}-texture.png`,
          data: new Uint8Array(await textureBlob.arrayBuffer()),
        },
      ];
      files.push({
        name: "README.txt",
        data: encoder.encode(`LO2S OBJ export\n\nUnits: metres (1 OBJ unit = 1 metre). Up axis: Y.\nImport with scale 1 and source units metres in the receiving application. OBJ has no standard physical-unit field; the unit comments do not automatically configure an importer. Interpreting these coordinates as millimetres makes the scene 1,000 times too small; centimetres makes it 100 times too small.\n\n${basename}.obj contains the complete world-positioned scene with screen and imported-model transforms baked into its vertices.\n\nOBJ preserves geometry, UV mapping and world placement, but it has no standard field for editable local pivots or transform nodes. GLB/glTF should be used when the receiving software needs that hierarchy.\n`),
      });
      return {
        blob: new Blob([createStoredZip(files)], { type: "application/zip" }),
        filename: `${basename}-obj.zip`,
        mimeType: "application/zip",
        sliceCount: options.slices.length,
        triangleCount: built.triangleCount,
      };
    }

    const files = await buildMvrFiles(built, options, basename);
    return {
      blob: new Blob([createStoredZip(files)], { type: "application/x-mvr" }),
      filename: `${basename}.mvr`,
      mimeType: "application/x-mvr",
      sliceCount: options.slices.length,
      triangleCount: built.triangleCount,
    };
  } finally {
    disposeBuiltScene(built);
  }
}
