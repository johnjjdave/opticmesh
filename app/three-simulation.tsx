"use client";

import { useEffect, useRef } from "react";
import { createStudioEnvironment, type StudioEnvironment, type ReflectionPreset } from "./studio-environment";
import { DEFAULT_BODY_MATERIAL, type BodyAppearance } from "./slice-material";
import { SelectionOutline } from "./selection-outline";
import { applyBodyMaterial, createModelMaterial, ModelLayer, descendants, inherited, modelSelectionPivot, type ImportedModel } from "./model-data";
import * as THREE from "three";
import { pivotOffset, pivotKey, type SlicePivot } from "./slice-pivot";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resetNavigationHorizon, restoreNavigationUp, savedNavigationUp } from "./camera-orientation";
import { createSpaceMouseControls, type SpaceMouseBridge } from "./spacemouse-controls";
import { createViewportControls } from "./viewport-controls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { createGpuTimer, RenderPerformance } from "./render-performance";
import { simulationOutputSize } from "./live-output";
import { createSimulationOutputTarget } from "./simulation-output-target";
import { createSceneGround, WORLD_GRID_STEP_METRES } from "./scene-ground";

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number; points: Point[] };
export type SimulationSlice = { id: string; name: string; screenName: string; input: Rect; output: Rect; warped: boolean; paletteIndex: number };
export type SliceTransform = { position: [number, number, number]; rotation: [number, number, number]; scale?: [number, number, number] };
type CameraPose = { up?: [number, number, number]; position: [number, number, number]; target: [number, number, number] };
export type CameraState = CameraPose & { orthographic?: Partial<Record<"top" | "right" | "front", CameraPose & { zoom: number; halfHeight: number }>> };
export type TransformMode = "translate" | "rotate" | "scale";
export type SimulationSource = "pattern" | "video" | "ndi" | "spout";
export type SimulationView = "perspective" | "top" | "right" | "front" | "four";
export type { SlicePivot } from "./slice-pivot";
export type SliceCurvature = { horizontal: number; vertical: number };
export type SimulationOutputFrame = { width: number; height: number; data: ArrayBuffer };
export type SimulationOutputCapture = () => Promise<SimulationOutputFrame>;

export type SimulationProps = {
  onSceneReady?: () => void;
  transferActive?:boolean;
  onTransferTarget?:(target:{kind:"slice"|"model";id:string})=>void;
  previewOnly?: boolean;
  renderPaused?: boolean;
  outputActive?: boolean;
  bodyAppearanceBySlice?: Record<string,BodyAppearance>;
  models?: ImportedModel[];
  modelSelection?: string[];
  onModelSelection?: (ids: string[], additive?:boolean) => void;
  onModelTransform?: (delta: number[], rotations?: Record<string,[number,number,number]>) => void;
  onModelTransformPreview?: (delta: number[] | null, rotations?: Record<string,[number,number,number]>) => void;
  snapEnabled?: boolean;
  performanceMetrics?: RenderPerformance;
  slices: SimulationSlice[];
  compositionWidth: number;
  compositionHeight: number;
  masterPitchMm: number;
  pitchBySlice: Record<string, number>;
  depthBySlice: Record<string, number>;
  curvatureBySlice: Record<string, SliceCurvature>;
  pivotBySlice: Record<string, SlicePivot>;
  selectedIds: string[];
  visibleIds: string[];
  lockedIds: string[];
  transforms: Record<string, SliceTransform>;
  selectionTransform?: SliceTransform;
  transformMode: TransformMode;
  transformSpace: "local" | "world";
  source: SimulationSource;
  sourceOverrides: Record<string, "inherit" | SimulationSource>;
  sourceMedia: Partial<Record<"video" | "ndi" | "spout", HTMLVideoElement | HTMLCanvasElement>>;
  sourceQuality: "latency" | "quality";
  cameraState?: CameraState;
  cameraMemory?: { current: CameraState | undefined };
  textureVersion: string;
  fitSignal: number;
  focusSignal: number;
  viewMode: SimulationView;
  gridVisible: boolean;
  floorVisible: boolean;
  backgroundLevel: number;
  reflectionPreset?: ReflectionPreset;
  interactiveGeometryPreview: boolean;
  drawPatternTexture: (canvas: HTMLCanvasElement, slice?: SimulationSlice) => void;
  onSelectionChange: (ids: string[], additive?:boolean) => void;
  onTransformPreview: (updates: Record<string, SliceTransform> | null) => void;
  onTransformsChange: (updates: Record<string, SliceTransform>) => void;
  onCameraChange: (camera: CameraState) => void;
  onOutputCaptureReady?: (capture: SimulationOutputCapture | null) => void;
};

type SliceObject = THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> & { userData: { sliceId: string; geometryKey?: string; modelPick?: boolean } };

function tuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function continuousRotation(quaternion: THREE.Quaternion, reference: [number, number, number]): [number, number, number] {
  const canonical = new THREE.Euler().setFromQuaternion(quaternion, "XYZ"),
    candidates: Array<[number, number, number]> = [
      [canonical.x, canonical.y, canonical.z],
      [canonical.x + Math.PI, Math.PI - canonical.y, canonical.z + Math.PI],
    ],
    unwrap = (value: number, target: number) => value + Math.round((target - value) / (Math.PI * 2)) * Math.PI * 2;
  return candidates
    .map((candidate) => candidate.map((value, axis) => unwrap(value, reference[axis])) as [number, number, number])
    .sort((a, b) => a.reduce((sum, value, axis) => sum + (value - reference[axis]) ** 2, 0) - b.reduce((sum, value, axis) => sum + (value - reference[axis]) ** 2, 0))[0];
}

function clipPolygon(points: THREE.Vector2[], axis: "x" | "y", boundary: number, keepGreater: boolean) {
  const output: THREE.Vector2[] = [];
  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const pointInside = keepGreater ? point[axis] >= boundary - 1e-8 : point[axis] <= boundary + 1e-8;
    const previousInside = keepGreater ? previous[axis] >= boundary - 1e-8 : previous[axis] <= boundary + 1e-8;
    if (pointInside !== previousInside) {
      const delta = point[axis] - previous[axis];
      const t = Math.abs(delta) < 1e-10 ? 0 : (boundary - previous[axis]) / delta;
      output.push(new THREE.Vector2(
        axis === "x" ? boundary : THREE.MathUtils.lerp(previous.x, point.x, t),
        axis === "y" ? boundary : THREE.MathUtils.lerp(previous.y, point.y, t),
      ));
    }
    if (pointInside) output.push(point.clone());
  });
  return output;
}

function clipPolygonToRect(points: THREE.Vector2[], minX: number, maxX: number, minY: number, maxY: number) {
  let clipped = clipPolygon(points, "x", minX, true);
  if (clipped.length) clipped = clipPolygon(clipped, "x", maxX, false);
  if (clipped.length) clipped = clipPolygon(clipped, "y", minY, true);
  if (clipped.length) clipped = clipPolygon(clipped, "y", maxY, false);
  return clipped;
}

export function createSliceGeometry(slice: SimulationSlice, pitchM: number, depthM: number, curvature: SliceCurvature, compositionWidth: number, compositionHeight: number, pivot: SlicePivot, fullSource = false, interactivePreview = false) {
  const sourcePoints = slice.input.points.length >= 4 ? slice.input.points : [
    { x: slice.input.x, y: slice.input.y },
    { x: slice.input.x + slice.input.width, y: slice.input.y },
    { x: slice.input.x + slice.input.width, y: slice.input.y + slice.input.height },
    { x: slice.input.x, y: slice.input.y + slice.input.height },
  ];
  const offset = pivotOffset(pivot, slice.input.width * pitchM, slice.input.height * pitchM);
  const pivotX = slice.input.x + slice.input.width / 2 + offset[0] / pitchM;
  const pivotY = slice.input.y + slice.input.height / 2 - offset[1] / pitchM;
  const local = sourcePoints.map((point) => new THREE.Vector2((point.x - pivotX) * pitchM, (pivotY - point.y) * pitchM));
  const widthM = Math.max(pitchM, slice.input.width * pitchM), heightM = Math.max(pitchM, slice.input.height * pitchM);
  const centerX = (slice.input.x + slice.input.width / 2 - pivotX) * pitchM, centerY = (pivotY - slice.input.y - slice.input.height / 2) * pitchM;
  const horizontalRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(curvature.horizontal || 0, -360, 360));
  const verticalRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(curvature.vertical || 0, -360, 360));
  const degreesPerSegment = interactivePreview ? 12 : 3;
  const horizontalSegments = Math.max(1, Math.min(128, Math.ceil(Math.abs(curvature.horizontal || 0) / degreesPerSegment)));
  const verticalSegments = Math.max(1, Math.min(128, Math.ceil(Math.abs(curvature.vertical || 0) / degreesPerSegment)));
  const xMin = -slice.input.width * pitchM / 2 + centerX, xMax = slice.input.width * pitchM / 2 + centerX;
  const yMin = (pivotY - slice.input.y - slice.input.height) * pitchM, yMax = (pivotY - slice.input.y) * pitchM;
  const frontPositions: number[] = [], frontUvs: number[] = [], frontNormals: number[] = [];
  const bodyPositions: number[] = [], bodyUvs: number[] = [], bodyNormals: number[] = [];
  const sourceUv = (point: THREE.Vector2): [number, number] => {
    const width = fullSource ? Math.max(1, slice.input.width) : Math.max(1, compositionWidth), height = fullSource ? Math.max(1, slice.input.height) : Math.max(1, compositionHeight);
    const sourceX = pivotX + point.x / pitchM, sourceY = pivotY - point.y / pitchM;
    const x = fullSource ? sourceX - slice.input.x : sourceX, y = fullSource ? sourceY - slice.input.y : sourceY;
    return [THREE.MathUtils.clamp(x / width, 0.5 / width, 1 - 0.5 / width), THREE.MathUtils.clamp(1 - y / height, 0.5 / height, 1 - 0.5 / height)];
  };
  const surfacePoint = (point: THREE.Vector2) => {
    const xFromCenter = point.x - centerX, yFromCenter = point.y - centerY;
    const phi = Math.abs(horizontalRad) < 1e-7 ? 0 : xFromCenter * horizontalRad / widthM;
    const psi = Math.abs(verticalRad) < 1e-7 ? 0 : yFromCenter * verticalRad / heightM;
    const x = Math.abs(horizontalRad) < 1e-7 ? point.x : centerX + widthM / horizontalRad * Math.sin(phi);
    const y = Math.abs(verticalRad) < 1e-7 ? point.y : centerY + heightM / verticalRad * Math.sin(psi);
    // Positive horizontal curvature is the outside of the LED cylinder. Its
    // emitting face bends away from the viewer and its body stays behind it.
    const zHorizontal = Math.abs(horizontalRad) < 1e-7 ? 0 : -widthM / horizontalRad * (1 - Math.cos(phi));
    const zVertical = Math.abs(verticalRad) < 1e-7 ? 0 : -heightM / verticalRad * (1 - Math.cos(psi));
    const normal = new THREE.Vector3(Math.sin(phi) * Math.cos(psi), Math.cos(phi) * Math.sin(psi), Math.cos(phi) * Math.cos(psi)).normalize();
    return { position: new THREE.Vector3(x, y, zHorizontal + zVertical - offset[2]), normal };
  };
  const pushVertex = (positions: number[], uvs: number[], normals: number[], position: THREE.Vector3, uv: [number, number], normal: THREE.Vector3) => {
    positions.push(position.x, position.y, position.z); uvs.push(uv[0], uv[1]); normals.push(normal.x, normal.y, normal.z);
  };
  const pushFrontTriangle = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) => {
    [a, b, c].forEach((point) => { const surface = surfacePoint(point); pushVertex(frontPositions, frontUvs, frontNormals, surface.position, sourceUv(point), surface.normal); });
    [c, b, a].forEach((point) => { const surface = surfacePoint(point), normal = surface.normal.clone().negate(); pushVertex(bodyPositions, bodyUvs, bodyNormals, surface.position.clone().addScaledVector(surface.normal, -depthM), [0, 0], normal); });
  };
  for (let yIndex = 0; yIndex < verticalSegments; yIndex += 1) {
    const cellMinY = THREE.MathUtils.lerp(yMin, yMax, yIndex / verticalSegments), cellMaxY = THREE.MathUtils.lerp(yMin, yMax, (yIndex + 1) / verticalSegments);
    for (let xIndex = 0; xIndex < horizontalSegments; xIndex += 1) {
      const cellMinX = THREE.MathUtils.lerp(xMin, xMax, xIndex / horizontalSegments), cellMaxX = THREE.MathUtils.lerp(xMin, xMax, (xIndex + 1) / horizontalSegments);
      const clipped = clipPolygonToRect(local, cellMinX, cellMaxX, cellMinY, cellMaxY);
      for (let index = 1; index + 1 < clipped.length; index += 1) pushFrontTriangle(clipped[0], clipped[index], clipped[index + 1]);
    }
  }
  const closedHorizontal = Math.abs(Math.abs(horizontalRad) - Math.PI * 2) < 1e-5;
  const closedVertical = Math.abs(Math.abs(verticalRad) - Math.PI * 2) < 1e-5;
  local.forEach((point, index) => {
    const nextPoint = local[(index + 1) % local.length], delta = nextPoint.clone().sub(point);
    const isClosedSeam = (closedHorizontal && Math.abs(delta.y) > 1e-7 && Math.abs(delta.x) < 1e-7
      && (Math.abs(point.x - xMin) < 1e-6 || Math.abs(point.x - xMax) < 1e-6))
      || (closedVertical && Math.abs(delta.x) > 1e-7 && Math.abs(delta.y) < 1e-7
      && (Math.abs(point.y - yMin) < 1e-6 || Math.abs(point.y - yMax) < 1e-6));
    if (isClosedSeam) return;
    const steps = Math.max(1, Math.min(64, Math.ceil(Math.max(Math.abs(delta.x) / widthM * horizontalSegments, Math.abs(delta.y) / heightM * verticalSegments))));
    for (let step = 0; step < steps; step += 1) {
      const a2 = point.clone().lerp(nextPoint, step / steps), b2 = point.clone().lerp(nextPoint, (step + 1) / steps);
      const a = surfacePoint(a2), b = surfacePoint(b2), backA = a.position.clone().addScaledVector(a.normal, -depthM), backB = b.position.clone().addScaledVector(b.normal, -depthM);
      const tangent = b.position.clone().sub(a.position).normalize();
      const normalA = tangent.clone().cross(a.normal.clone().negate()).normalize(), normalB = tangent.clone().cross(b.normal.clone().negate()).normalize();
      [[a.position, normalA], [b.position, normalB], [backB, normalB], [a.position, normalA], [backB, normalB], [backA, normalA]].forEach(([position, normal]) => pushVertex(bodyPositions, bodyUvs, bodyNormals, position as THREE.Vector3, [0, 0], normal as THREE.Vector3));
    }
  });
  const geometry = new THREE.BufferGeometry();
  const positions = [...frontPositions, ...bodyPositions], uvs = [...frontUvs, ...bodyUvs], normals = [...frontNormals, ...bodyNormals];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.addGroup(0, frontPositions.length / 3, 0);
  geometry.addGroup(frontPositions.length / 3, bodyPositions.length / 3, 1);
  return geometry;
}

export default function ThreeSimulation(props: SimulationProps) {
  const initialCamera = useRef(props.cameraMemory?.current || props.cameraState);
  // Signals are commands, not persistent view settings. Do not replay them on return.
  const lastFitSignal = useRef(props.cameraMemory?.current || props.cameraState ? props.fitSignal : 0);
  const lastFocusSignal = useRef(props.focusSignal);
  const mountRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<{
    fit: () => void;
    focusSelection: () => void;
    setView: (view: SimulationView) => void;
    render: () => void;
    refreshRendering: () => void;
    refreshMedia: () => void;
    updateClipping: () => void;
    updateTopology: () => void;
    updateNavigationSelection: () => void;
    controls: OrbitControls;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    transforms: TransformControls[];
    proxy: THREE.Object3D;
    meshes: Map<string, SliceObject>;
    patternTextures: Map<string, THREE.CanvasTexture>;
    scene: THREE.Scene;
    modelLayer: ModelLayer;
    studio: { target: StudioEnvironment };
    grid: THREE.GridHelper;
    floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
    externalTextures: Partial<Record<"video" | "ndi" | "spout", THREE.Texture>>;
  } | null>(null);
  const latestRef = useRef(props);
  useEffect(() => { latestRef.current = props; });

  // Browser :focus-visible heuristics also activate after tool shortcuts or a
  // programmatic focus transfer from an input. Only Tab navigation should draw
  // the viewport ring; pointer focus is still required for scoped Ctrl+A.
  useEffect(() => {
    const showKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key === "Tab" && mountRef.current) mountRef.current.dataset.keyboardFocus = "true";
    };
    document.addEventListener("keydown", showKeyboardFocus, true);
    return () => document.removeEventListener("keydown", showKeyboardFocus, true);
  }, []);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const document = host.ownerDocument;
    const window = document.defaultView!;
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);
    const cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const scene = new THREE.Scene();
    const modelLayer = new ModelLayer(); scene.add(modelLayer.root);
    const selectionOutline=new SelectionOutline();
    scene.background = new THREE.Color(0x090b0c);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true, reversedDepthBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.shadowMap.enabled = false;
    host.appendChild(renderer.domElement);
    const createReflections = () => createStudioEnvironment(renderer, texture => {
      modelLayer.setEnvironment(texture);
      runtimeRef.current?.meshes.forEach(mesh => { const body = mesh.material[1] as THREE.MeshPhysicalMaterial; body.envMap = texture; body.needsUpdate = true; });
      runtimeRef.current?.render();
    }, latestRef.current.reflectionPreset || 1);
    const studio={target:createReflections()};modelLayer.setEnvironment(studio.target.texture);
    const metrics = props.performanceMetrics ?? new RenderPerformance();
    metrics.reset();
    const gpuTimer = createGpuTimer(renderer.getContext() as WebGL2RenderingContext, metrics);
    const restoreGpuTimer = () => { metrics.reset(); gpuTimer.restore(); studio.target.dispose();studio.target=createReflections();modelLayer.setEnvironment(studio.target.texture);runtimeRef.current?.meshes.forEach(mesh=>{const body=mesh.material[1] as THREE.MeshPhysicalMaterial;body.envMap=studio.target.texture;body.needsUpdate=true;}); };
    renderer.domElement.addEventListener("webglcontextrestored", restoreGpuTimer);

    const createSurface = (name: string) => {
      const element = document.createElement("div");
      element.className = "three-view-surface";
      element.setAttribute("aria-label", name + " viewport");
      host.appendChild(element);
      return element;
    };
    const meshes = new Map<string, SliceObject>();
    const updateTopology = () => {
      let triangles = 0;
      for (const mesh of [...meshes.values(), ...modelLayer.meshes.values()]) triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0) / 3;
      metrics.setSceneTriangles(triangles);
    };
    updateTopology();
    // Only scene surfaces set zoom distance; floor, grid and gizmos do not.
    const zoomObjects = () => [...meshes.values(), ...modelLayer.meshes.values()];
    const perspectiveSurface = createSurface("Perspective");
    const { controls, transform } = createViewportControls(camera, perspectiveSurface, props.transformSpace, zoomObjects);

    scene.add(new THREE.HemisphereLight(0xdce9e5, 0x20262b, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);
    const { floor, grid } = createSceneGround(renderer.capabilities.reversedDepthBuffer);
    scene.add(floor, grid);
    scene.add(new THREE.AxesHelper(1));

    const patternTextures = new Map<string, THREE.CanvasTexture>();

    const proxy = new THREE.Object3D();
    scene.add(proxy);
    scene.add(transform.getHelper());

    type View = {
      name: Exclude<SimulationView, "four">;
      camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
      controls: OrbitControls;
      transform: TransformControls;
      surface: HTMLDivElement;
      initialized: boolean;
    };
    const views: View[] = [{ name: "perspective", camera, controls, transform, surface: perspectiveSurface, initialized: true }];
    for (const name of ["top", "front", "right"] as const) {
      const surface = createSurface(name[0].toUpperCase() + name.slice(1));
      const viewCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
      const { controls: orbit, transform: gizmo } = createViewportControls(viewCamera, surface, props.transformSpace, zoomObjects);
      scene.add(gizmo.getHelper());
      views.push({ name, camera: viewCamera, controls: orbit, transform: gizmo, surface, initialized: false });
    }
    let activeView = views[0];
    if (props.previewOnly) views.forEach(({ transform }) => { transform.enabled = false; });
    views.forEach((view) => view.surface.addEventListener("pointerenter", () => { if (!views.some((item) => item.transform.dragging)) activeView = view; }));
    let spaceMouse: ReturnType<typeof createSpaceMouseControls> | undefined;
    const navigationBounds = new THREE.Box3(), navigationSelection = new THREE.Box3();
    const updateNavigationSelection = () => {
      navigationSelection.makeEmpty();
      latestRef.current.selectedIds.forEach(id => { const mesh=meshes.get(id); if(mesh?.visible) navigationSelection.expandByObject(mesh); });
      if(latestRef.current.modelSelection?.length) navigationSelection.union(modelLayer.bounds(latestRef.current.modelSelection));
      spaceMouse?.sync();
    };
    const updateCameraClipping = () => {
      const bounds = new THREE.Box3();
      meshes.forEach((mesh) => bounds.expandByObject(mesh));
      bounds.union(modelLayer.bounds());
      navigationBounds.copy(bounds);
      const sphere = bounds.isEmpty() ? new THREE.Sphere(controls.target.clone(), 1) : bounds.getBoundingSphere(new THREE.Sphere());
      views.forEach(({ camera, controls }) => {
        const sceneDistance = camera.position.distanceTo(sphere.center);
        const targetDistance = Math.max(0.1, camera.position.distanceTo(controls.target));
        // Maintain a stable near/far ratio at every zoom level. Reversed depth
        // then keeps thin extrusions clean without pushing LED faces into bodies.
        camera.near = THREE.MathUtils.clamp(targetDistance / 10000, 0.001, 0.25);
        camera.far = Math.max(500, targetDistance * 10, sceneDistance + sphere.radius * 4 + 50);
        camera.updateProjectionMatrix();
        });
      spaceMouse?.sync();
    };
    let pendingFit = false;
    const pendingFrames = new Map<View, THREE.Box3 | undefined>();
    const hasLayout = () => host.clientWidth > 0 && host.clientHeight > 0;
    const fit = () => {
      resetNavigationHorizon(camera, controls.target);
      // Import commands can arrive while this retained workspace is hidden.
      // Wait for real dimensions instead of fitting against a zero-width pane.
      if (!hasLayout()) { pendingFit = true; pendingFrames.clear(); return; }
      pendingFit = false;
      pendingFrames.clear();
      layoutViews();
      // Once geometry exists, fit its current world bounds, including moved screens.
      if (meshes.size || modelLayer.meshes.size) {
        views.forEach((view) => frameView(view));
        return;
      }
      const current = latestRef.current;
      const pitch = current.masterPitchMm / 1000;
      const width = Math.max(1, current.compositionWidth * pitch), height = Math.max(1, current.compositionHeight * pitch);
      const span = Math.max(width, height);
      camera.up.set(0, 1, 0);
      controls.target.set(0, height / 2, 0);
      camera.position.set(span * 0.8, height * 0.85 + span * 0.15, span * 1.25);
      updateCameraClipping();
      controls.update();
    };
    const frameView = (view: View, bounds?: THREE.Box3) => {
      if (!hasLayout()) { pendingFrames.set(view, bounds?.clone()); return; }
      const box = bounds || new THREE.Box3();
      if (!bounds) { meshes.forEach((mesh) => { if (mesh.visible) box.expandByObject(mesh); }); box.union(modelLayer.bounds()); }
      const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1) : box.getBoundingSphere(new THREE.Sphere());
      const viewCamera = view.camera;
      const direction = view.name === "top" ? new THREE.Vector3(0, 1, 0) : view.name === "right" ? new THREE.Vector3(1, 0, 0) : view.name === "front" ? new THREE.Vector3(0, 0, 1) : viewCamera.position.clone().sub(view.controls.target).normalize();
      // A first mount with no layout may not yet have seeded a camera direction.
      if (direction.lengthSq() === 0) direction.set(0.8, 0.36, 1.25).normalize();
      const aspect = Math.max(0.01, (view.surface.clientWidth || host.clientWidth) / Math.max(1, view.surface.clientHeight || host.clientHeight));
      let distance = Math.max(1, sphere.radius * 3);
      if (viewCamera instanceof THREE.OrthographicCamera) {
        const halfHeight = Math.max(0.1, sphere.radius * 1.2 / Math.min(1, aspect));
        viewCamera.top = halfHeight; viewCamera.bottom = -halfHeight;
        viewCamera.left = -halfHeight * aspect; viewCamera.right = halfHeight * aspect;
        viewCamera.zoom = 1;
      } else {
        const fov = THREE.MathUtils.degToRad(viewCamera.fov);
        distance = Math.max(0.1, sphere.radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2) * 1.2);
      }
      view.controls.target.copy(sphere.center);
      viewCamera.position.copy(sphere.center).addScaledVector(direction, distance);
      viewCamera.up.set(0, view.name === "top" ? 0 : 1, view.name === "top" ? -1 : 0);
      viewCamera.lookAt(sphere.center);
      viewCamera.updateProjectionMatrix();
      view.controls.update();
      view.initialized = true;
      updateCameraClipping();
    };
    const layoutViews = () => {
      if (!hasLayout()) return;
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      const four = latestRef.current.viewMode === "four";
      views.forEach((view, index) => {
        const visible = four || view.name === latestRef.current.viewMode;
        const left = four && index % 2 ? Math.floor(width / 2) : 0;
        const top = four && index >= 2 ? Math.floor(height / 2) : 0;
        const w = four ? (index % 2 ? width - Math.floor(width / 2) : Math.floor(width / 2)) : width;
        const h = four ? (index >= 2 ? height - Math.floor(height / 2) : Math.floor(height / 2)) : height;
        Object.assign(view.surface.style, { display: visible ? "block" : "none", left: left + "px", top: top + "px", width: w + "px", height: h + "px" });
        view.controls.enabled = visible && !views.some((item) => item.transform.dragging);
        view.transform.enabled = visible;
        const aspect = Math.max(1, w) / Math.max(1, h);
        if (view.camera instanceof THREE.PerspectiveCamera) view.camera.aspect = aspect;
        else { view.camera.left = -view.camera.top * aspect; view.camera.right = view.camera.top * aspect; }
        view.camera.updateProjectionMatrix();
      });
    };
    const setView = (mode: SimulationView) => {
      layoutViews();
      views.forEach((view) => { if (!view.initialized && (mode === "four" || view.name === mode)) frameView(view); });
      if (mode !== "four") activeView = views.find((view) => view.name === mode)!;
    };
    const focusSelection = () => {
      const bounds = new THREE.Box3();
      latestRef.current.selectedIds.forEach((id) => { const mesh = meshes.get(id); if (mesh?.visible) bounds.expandByObject(mesh); });
      if (latestRef.current.modelSelection?.length) bounds.union(modelLayer.bounds(latestRef.current.modelSelection));
      if (!bounds.isEmpty()) frameView(activeView, bounds);
    };
    const renderViews = (width: number, height: number) => {
      renderer.setScissorTest(true);
      for (const view of views) {
        if (view.surface.style.display === "none") continue;
        // WebGLRenderer applies devicePixelRatio itself; viewport rectangles are CSS pixels.
        const x = view.surface.offsetLeft, y = height - view.surface.offsetTop - view.surface.clientHeight;
        views.forEach((other) => { other.transform.getHelper().visible = other === view && !!other.transform.object; });
        renderer.setViewport(x, y, view.surface.clientWidth, view.surface.clientHeight);
        renderer.setScissor(x, y, view.surface.clientWidth, view.surface.clientHeight);
        renderer.render(scene, view.camera);
        const modelMeshes=[...modelLayer.meshes.values()];
        const selectedModels=new Set(latestRef.current.previewOnly?[]:modelMeshes.filter(mesh=>mesh.visible&&mesh.userData.selected));
        selectionOutline.render(renderer,view.camera,[...modelMeshes,...meshes.values(),floor],selectedModels,view.surface.clientWidth,view.surface.clientHeight);
      }
      views.forEach((view) => { view.transform.getHelper().visible = !!view.transform.object; });
      renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
    };
    const renderScene = () => {
      if (latestRef.current.renderPaused || document.hidden || renderer.getContext().isContextLost()) return;
      const start = performance.now();
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      const autoReset = renderer.info.autoReset;
      renderer.info.autoReset = false;
      renderer.info.reset();
      gpuTimer.begin(start);
      try {
        renderer.setRenderTarget(null);
        renderViews(width, height);
      } finally {
        gpuTimer.end();
        renderer.info.autoReset = autoReset;
      }
      metrics.record(performance.now() - start, {
        width: renderer.domElement.width, height: renderer.domElement.height,
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      });
    };

    if (initialCamera.current) {
      camera.position.fromArray(initialCamera.current.position);
      controls.target.fromArray(initialCamera.current.target);
      restoreNavigationUp(camera, controls.target, initialCamera.current.up);
      for(const view of views){
        if(view.name!=="perspective" && view.camera instanceof THREE.OrthographicCamera){
          const saved=initialCamera.current.orthographic?.[view.name];
          if(saved && [...saved.position,...saved.target,saved.zoom,saved.halfHeight].every(Number.isFinite) && saved.zoom>0 && saved.halfHeight>0){
            view.camera.position.fromArray(saved.position);view.controls.target.fromArray(saved.target);
            view.camera.up.set(0,view.name==="top"?0:1,view.name==="top"?-1:0);
            view.camera.top=saved.halfHeight;view.camera.bottom=-saved.halfHeight;view.camera.zoom=saved.zoom;view.initialized=true;
          }
        }
        if(view.initialized)view.controls.update();
      }
    } else fit();
    layoutViews();
    const snapshotCamera=():CameraState=>({position:tuple(camera.position),target:tuple(controls.target),up:tuple(savedNavigationUp(camera)),orthographic:Object.fromEntries(views.filter(view=>view.name!=="perspective"&&view.initialized).map(view=>[view.name,{position:tuple(view.camera.position),target:tuple(view.controls.target),zoom:view.camera.zoom,halfHeight:(view.camera as THREE.OrthographicCamera).top}]))});
    const rememberCamera=()=>{const state=snapshotCamera();if(props.cameraMemory)props.cameraMemory.current=state;return state;};
    const publishCamera=()=>latestRef.current.onCameraChange(rememberCamera());
    let cameraSaveTimer:ReturnType<typeof setTimeout>|undefined;

    let frame = 0, dirty = true;
    const onVisibilityChange = () => {
      if (!document.hidden) { metrics.reset(); gpuTimer.restore(); dirty = true; }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const render = () => {
      if (latestRef.current.renderPaused) { spaceMouse?.deactivate(); return; }
      spaceMouse?.tick();
      frame = requestAnimationFrame(render);
      gpuTimer.poll();
      views.forEach((view) => { if (view.controls.enabled && view.controls.update()) dirty = true; });
      if (dirty) { renderScene(); dirty = false; }
    };
    const refreshRendering = () => { cancelAnimationFrame(frame); dirty = true; render(); };
    render();
    const resize = () => {
      // Hidden retained workspaces have no layout box. Keep their GPU targets
      // and camera aspect intact until the host becomes visible again.
      if (!host.clientWidth || !host.clientHeight) return;
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.setSize(width, height, false);
      layoutViews();
      const framingPending = pendingFit || pendingFrames.size > 0;
      const frames = [...pendingFrames];
      pendingFrames.clear();
      if (pendingFit) fit();
      frames.forEach(([view, bounds]) => frameView(view, bounds));
      if (framingPending) publishCamera();
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    document.addEventListener("fullscreenchange", resize);
    resize();

    const invalidate = () => {
      updateCameraClipping();dirty=true;rememberCamera();
      // Keep the last drawn pose immediately, but avoid React updates every frame.
      if(cameraSaveTimer)clearTimeout(cameraSaveTimer);
      cameraSaveTimer=setTimeout(publishCamera,150);
    };
    views.forEach((view) => { view.controls.addEventListener("change", invalidate); view.transform.addEventListener("change", () => { dirty = true; }); });
    // OrbitControls emits end after every wheel event. Debounce those events
    // together so scrolling cannot trigger a project update/save per wheel tick.
    const finishCameraGesture=()=>{if(cameraSaveTimer)clearTimeout(cameraSaveTimer);cameraSaveTimer=setTimeout(publishCamera,150);};
    views.forEach(view=>view.controls.addEventListener("end",finishCameraGesture));
    const deviceBridge = (window as Window & { lo2sDesktop?: { spaceMouse?: SpaceMouseBridge } }).lo2sDesktop?.spaceMouse;
    if (deviceBridge && !props.previewOnly) spaceMouse = createSpaceMouseControls(deviceBridge,host,()=>activeView,()=>navigationBounds,()=>!latestRef.current.previewOnly && !latestRef.current.renderPaused && !views.some(view=>view.transform.dragging),invalidate,()=>navigationSelection);

    type PickViewport = { camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; left: number; top: number; width: number; height: number };
    let pointerStart: { x: number; y: number } | null = null, marqueeStart: { x: number; y: number } | null = null, marqueeViewport: PickViewport | null = null, marqueeMoved = false;
    let transformDragging = false, lastTransformPreviewAt = 0;
    let transformPreviewTimer: ReturnType<typeof setTimeout> | null = null;
    let modelDrag: { proxy: THREE.Matrix4; matrices: Map<string, THREE.Matrix4>; slices: Map<string, THREE.Matrix4>; coordinateMatrices: Map<string,THREE.Matrix4>; rotations: Record<string,[number,number,number]> } | null = null;
    const modelDelta = () => { proxy.updateMatrix(); return proxy.matrix.clone().multiply(modelDrag!.proxy.clone().invert()); };
    let shiftPressed = false;
    const rawDragScale = new THREE.Vector3(1, 1, 1);
    let transformStart: {
      proxyPosition: THREE.Vector3;
      proxyQuaternion: THREE.Quaternion;
      proxyScale: THREE.Vector3;
      items: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; continuousRotation: [number, number, number] }>;
    } | null = null;
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const pickViewportAt = (clientX: number, clientY: number): PickViewport => {
      const rect = renderer.domElement.getBoundingClientRect();
      const view = views.find((view) => {
        const bounds = view.surface.getBoundingClientRect();
        return view.surface.style.display !== "none" && clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
      }) || activeView;
      const bounds = view.surface.getBoundingClientRect();
      return { camera: view.camera, left: bounds.left - rect.left, top: bounds.top - rect.top, width: bounds.width, height: bounds.height };
    };
    const hitAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect(), viewport = pickViewportAt(clientX, clientY), x = clientX - rect.left, y = clientY - rect.top;
      pointer.set((x - viewport.left) / viewport.width * 2 - 1, -((y - viewport.top) / viewport.height * 2 - 1));
      raycaster.setFromCamera(pointer, viewport.camera);
      const hit = raycaster.intersectObjects(Array.from(meshes.values()).filter((mesh) => mesh.visible), false)[0];
      const modelHit = modelLayer.pick(raycaster);
      if (modelHit && (!hit || modelHit.distance < hit.distance)) return { userData: { sliceId: modelHit.id, modelPick: true } } as unknown as SliceObject;
      return hit?.object as SliceObject | undefined;
    };
    const setMarquee = (left: number, top: number, width: number, height: number, visible: boolean) => { const element = marqueeRef.current; if (!element) return; Object.assign(element.style, { display: visible ? "block" : "none", left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }); };
    let transferGesture=false;
    const onPointerDown = (event: PointerEvent) => {
      if (latestRef.current.previewOnly) return;
      if(latestRef.current.transferActive&&event.button===0){transferGesture=true;pointerStart={x:event.clientX,y:event.clientY};host.setPointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();return;}
      shiftPressed = event.shiftKey;
      activeView = views.find((view) => view.surface.contains(event.target as Node)) || activeView;
      const bounds = activeView.surface.getBoundingClientRect();
      // Hit-test handles before selection and navigation receive pointerdown, including touch.
      activeView.transform.pointerHover(new PointerEvent("pointermove", { clientX: (event.clientX - bounds.left) / bounds.width * 2 - 1, clientY: -(event.clientY - bounds.top) / bounds.height * 2 + 1, button: event.button }));
      pointerStart = { x: event.clientX, y: event.clientY };
      if (activeView.transform.axis && event.button === 0) activeView.controls.enabled = false;
      if (event.button === 0 && event.ctrlKey && !transformDragging && !activeView.transform.axis) {
        const rect = renderer.domElement.getBoundingClientRect();
        marqueeViewport = pickViewportAt(event.clientX, event.clientY);
        marqueeStart = { x: event.clientX - rect.left, y: event.clientY - rect.top }; marqueeMoved = false; activeView.controls.enabled = false;
        setMarquee(marqueeStart.x, marqueeStart.y, 0, 0, true); activeView.surface.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
      }
      // Selection is resolved on click release. Starting an orbit/pan gesture
      // must not raycast every triangle or change the selection.
    };
    const onPointerMove = (event: PointerEvent) => {
      setShiftModifier(event.shiftKey);
      if (!marqueeStart) return;
      const rect = renderer.domElement.getBoundingClientRect(), bounds = marqueeViewport || { left: 0, top: 0, width: rect.width, height: rect.height }, x = THREE.MathUtils.clamp(event.clientX - rect.left, bounds.left, bounds.left + bounds.width), y = THREE.MathUtils.clamp(event.clientY - rect.top, bounds.top, bounds.top + bounds.height);
      marqueeMoved ||= Math.hypot(x - marqueeStart.x, y - marqueeStart.y) > 4;
      setMarquee(Math.min(x, marqueeStart.x), Math.min(y, marqueeStart.y), Math.abs(x - marqueeStart.x), Math.abs(y - marqueeStart.y), true); event.preventDefault(); event.stopPropagation();
    };
    const selectMarquee = (endX: number, endY: number) => {
      if (!marqueeStart || !marqueeViewport) return;
      const viewport = marqueeViewport, left = Math.min(marqueeStart.x, endX), right = Math.max(marqueeStart.x, endX), top = Math.min(marqueeStart.y, endY), bottom = Math.max(marqueeStart.y, endY);
      const objects = [...meshes.values(), ...modelLayer.meshes.values()].filter(mesh => mesh.visible), selected: string[] = [], selectedModels: string[] = [];
      // Both domains participate in occlusion, even when only one is being selected.
      const firstHitAt = (x: number, y: number) => { pointer.set((x - viewport.left) / viewport.width * 2 - 1, -((y - viewport.top) / viewport.height * 2 - 1)); raycaster.setFromCamera(pointer, viewport.camera); return raycaster.intersectObjects(objects, false)[0]?.object; };
      objects.forEach((mesh) => {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox; if (!box) return;
        const points = [new THREE.Vector3(box.min.x, box.min.y, box.min.z), new THREE.Vector3(box.max.x, box.min.y, box.min.z), new THREE.Vector3(box.min.x, box.max.y, box.min.z), new THREE.Vector3(box.max.x, box.max.y, box.min.z), new THREE.Vector3(box.min.x, box.min.y, box.max.z), new THREE.Vector3(box.max.x, box.min.y, box.max.z), new THREE.Vector3(box.min.x, box.max.y, box.max.z), new THREE.Vector3(box.max.x, box.max.y, box.max.z)].map((point) => point.applyMatrix4(mesh.matrixWorld).project(viewport.camera));
        const minX = Math.min(...points.map((point) => viewport.left + (point.x + 1) * viewport.width / 2)), maxX = Math.max(...points.map((point) => viewport.left + (point.x + 1) * viewport.width / 2)), minY = Math.min(...points.map((point) => viewport.top + (1 - point.y) * viewport.height / 2)), maxY = Math.max(...points.map((point) => viewport.top + (1 - point.y) * viewport.height / 2));
        const overlapLeft = Math.max(left, minX), overlapRight = Math.min(right, maxX), overlapTop = Math.max(top, minY), overlapBottom = Math.min(bottom, maxY); if (overlapRight < overlapLeft || overlapBottom < overlapTop) return;
        const samples: Array<[number, number]> = [[(overlapLeft + overlapRight) / 2, (overlapTop + overlapBottom) / 2], [overlapLeft + 1, overlapTop + 1], [overlapRight - 1, overlapTop + 1], [overlapLeft + 1, overlapBottom - 1], [overlapRight - 1, overlapBottom - 1]];
        if (samples.some(([x, y]) => firstHitAt(x, y) === mesh)) {
          if (mesh.userData.modelPickId) selectedModels.push(mesh.userData.modelPickId);
          else selected.push(mesh.userData.sliceId);
        }
      });
      // Keep screen and stage-model editing independent, as with the hierarchy.
      // Without an active selection, a box containing model geometry starts model selection.
      if (latestRef.current.modelSelection?.length || (!latestRef.current.selectedIds.length && selectedModels.length)) {
        if (selectedModels.length) latestRef.current.onModelSelection?.([...new Set([...(latestRef.current.modelSelection || []), ...selectedModels])]);
      } else if (selected.length) latestRef.current.onSelectionChange([...new Set([...latestRef.current.selectedIds, ...selected])]);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (latestRef.current.previewOnly) return;
      if(transferGesture&&event.button===0){
        transferGesture=false;const start=pointerStart;pointerStart=null;if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();
        if(latestRef.current.transferActive&&start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<5){const hit=hitAt(event.clientX,event.clientY);if(hit)latestRef.current.onTransferTarget?.({kind:hit.userData.modelPick?"model":"slice",id:hit.userData.sliceId});}
        return;
      }
      if (marqueeStart) {
        const rect = renderer.domElement.getBoundingClientRect(), bounds = marqueeViewport || { left: 0, top: 0, width: rect.width, height: rect.height }, endX = THREE.MathUtils.clamp(event.clientX - rect.left, bounds.left, bounds.left + bounds.width), endY = THREE.MathUtils.clamp(event.clientY - rect.top, bounds.top, bounds.top + bounds.height), didMove = marqueeMoved;
        if (didMove) selectMarquee(endX, endY); setMarquee(0, 0, 0, 0, false); marqueeStart = null; marqueeViewport = null; marqueeMoved = false; activeView.controls.enabled = !transformDragging; event.preventDefault(); event.stopPropagation(); if (didMove) { pointerStart = null; return; }
      }
      if (event.button !== 0 || !pointerStart || transformDragging || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) { pointerStart = null; return; }
      pointerStart = null;
      const hit = hitAt(event.clientX, event.clientY);
      const current = latestRef.current.selectedIds;
      if (!hit) { if (!event.ctrlKey && !event.shiftKey) latestRef.current.onSelectionChange([]); return; }
      const id = hit.userData.sliceId;
      if (hit.userData.modelPick) { const selected = latestRef.current.modelSelection || []; latestRef.current.onModelSelection?.(event.ctrlKey || event.shiftKey ? selected.includes(id) ? selected.filter(i=>i!==id) : [...selected,id] : [id],event.ctrlKey || event.metaKey || event.shiftKey); return; }
      if (event.ctrlKey || event.shiftKey) latestRef.current.onSelectionChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id],true);
      else latestRef.current.onSelectionChange([id]);
    };
    const onPointerCancel = () => {
      transferGesture=false;
      pointerStart = null; marqueeStart = null; marqueeViewport = null; marqueeMoved = false;
      setMarquee(0, 0, 0, 0, false);
      // TransformControls does not listen for pointercancel itself. Commit the visible edit once.
      if (activeView.transform.dragging) activeView.transform.pointerUp(new PointerEvent("pointerup", { button: 0 }));
      views.forEach((view) => { view.controls.enabled = view.surface.style.display !== "none"; });
    };
    host.addEventListener("pointercancel", onPointerCancel, true);
    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onPointerMove, true);
    host.addEventListener("pointerup", onPointerUp, true);

    const publishTransformPreview = () => {
      transformPreviewTimer=null;
      if(modelDrag)latestRef.current.onModelTransformPreview?.(Array.from(modelDelta().toArray()),{...modelDrag.rotations});
      else if(transformStart){
        const preview: Record<string,SliceTransform>={};
        transformStart.items.forEach((_,id)=>{const mesh=meshes.get(id);if(mesh)preview[id]={position:tuple(mesh.position),rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],scale:tuple(mesh.scale)};});
        latestRef.current.onTransformPreview(preview);
      }
      lastTransformPreviewAt=performance.now();
    };
    const scheduleTransformPreview = () => {
      const remaining=66-(performance.now()-lastTransformPreviewAt);
      if(remaining<=0){if(transformPreviewTimer)clearTimeout(transformPreviewTimer);publishTransformPreview();}
      else if(!transformPreviewTimer)transformPreviewTimer=setTimeout(publishTransformPreview,remaining);
    };
    const beginTransform = () => {
      if (latestRef.current.previewOnly) return;
      if (latestRef.current.modelSelection?.length) {
        const matrices = new Map<string, THREE.Matrix4>(),coordinateMatrices=new Map<string,THREE.Matrix4>(),rotations: Record<string,[number,number,number]>={};
        for(const model of modelLayer.models){const included=descendants(model,latestRef.current.modelSelection);for(const node of model.nodes)if(included.has(node.id)){const matrix=new THREE.Matrix4().fromArray(node.matrix),q=new THREE.Quaternion();matrix.decompose(new THREE.Vector3(),q,new THREE.Vector3());coordinateMatrices.set(node.id,matrix);rotations[node.id]=continuousRotation(q,node.rotation || [0,0,0]);}}
        for (const model of modelLayer.models) { const included = descendants(model, latestRef.current.modelSelection); for (const node of model.nodes) { const mesh = modelLayer.meshes.get(node.id); if (mesh?.visible && included.has(node.id) && !inherited(model,node,"locked")) matrices.set(node.id,mesh.matrix.clone()); } }
        const slices=new Map<string,THREE.Matrix4>();for(const id of latestRef.current.selectedIds){const mesh=meshes.get(id);if(mesh?.visible&&!latestRef.current.lockedIds.includes(id)){mesh.updateMatrix();slices.set(id,mesh.matrix.clone());}}
        proxy.updateMatrix(); modelDrag = { proxy: proxy.matrix.clone(), matrices,slices,coordinateMatrices,rotations }; return;
      }
      const items = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; continuousRotation: [number, number, number] }>();
      latestRef.current.selectedIds.forEach((id) => {
        const mesh = meshes.get(id);
        if (mesh && !latestRef.current.lockedIds.includes(id))
          items.set(id, {
            position: mesh.position.clone(),
            quaternion: mesh.quaternion.clone(),
            scale: mesh.scale.clone(),
            continuousRotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          });
      });
      transformStart = { proxyPosition: proxy.position.clone(), proxyQuaternion: proxy.quaternion.clone(), proxyScale: proxy.scale.clone(), items };
      rawDragScale.copy(proxy.scale);
    };
    const updateTransform = () => {
      if (modelDrag) {
        if (latestRef.current.transformMode === "translate" && latestRef.current.snapEnabled) { const start=new THREE.Vector3().setFromMatrixPosition(modelDrag.proxy);for(const axis of ["x","y","z"] as const)if(Math.abs(proxy.position[axis]-start[axis])>1e-7)proxy.position[axis]=Math.round(proxy.position[axis]); }
        rawDragScale.copy(proxy.scale);
        if (latestRef.current.transformMode === "scale" && shiftPressed) { const start=new THREE.Vector3().setFromMatrixScale(modelDrag.proxy),values = proxy.scale.clone().divide(start).toArray(); const value = values.reduce((a,b)=>Math.abs(a-1)>Math.abs(b-1)?a:b,1); proxy.scale.copy(start).multiplyScalar(value); }
        const delta = modelDelta(); for (const [id,start] of modelDrag.matrices) { const mesh=modelLayer.meshes.get(id)!; mesh.matrix.copy(delta).multiply(start); mesh.matrixWorldNeedsUpdate=true; }
        for(const [id,start] of modelDrag.slices){const mesh=meshes.get(id);if(mesh){delta.clone().multiply(start).decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.updateMatrixWorld(true);}}
        for(const [id,start] of modelDrag.coordinateMatrices){const q=new THREE.Quaternion();delta.clone().multiply(start).decompose(new THREE.Vector3(),q,new THREE.Vector3());modelDrag.rotations[id]=continuousRotation(q,modelDrag.rotations[id]);}
        scheduleTransformPreview();
        dirty=true; return;
      }
      if (!transformStart) return;
      if (latestRef.current.transformMode === "translate" && latestRef.current.snapEnabled) {
        for (const axis of ["x", "y", "z"] as const) {
          if (Math.abs(proxy.position[axis] - transformStart.proxyPosition[axis]) > 1e-7)
            proxy.position[axis] = Math.round(proxy.position[axis] / WORLD_GRID_STEP_METRES) * WORLD_GRID_STEP_METRES;
        }
      }
      const deltaQuaternion = proxy.quaternion.clone().multiply(transformStart.proxyQuaternion.clone().invert());
      const translation = proxy.position.clone().sub(transformStart.proxyPosition);
      const deltaScale = proxy.scale.clone().divide(transformStart.proxyScale);
      rawDragScale.copy(proxy.scale);
      if (latestRef.current.transformMode === "scale" && shiftPressed) {
        // Preserve each object's initial proportions, including nonuniform scales.
        // The most changed handle axis drives the same factor on every axis.
        const factors = [deltaScale.x, deltaScale.y, deltaScale.z];
        const factor = factors.reduce((chosen, value) => Math.abs(value - 1) > Math.abs(chosen - 1) ? value : chosen, 1);
        deltaScale.setScalar(factor);
        proxy.scale.copy(transformStart.proxyScale).multiply(deltaScale);
      }
      transformStart.items.forEach((start, id) => {
        const mesh = meshes.get(id); if (!mesh) return;
        mesh.position.copy(start.position.clone().sub(transformStart!.proxyPosition).multiply(deltaScale).applyQuaternion(deltaQuaternion).add(transformStart!.proxyPosition).add(translation));
        mesh.quaternion.copy(deltaQuaternion.clone().multiply(start.quaternion));
        start.continuousRotation = continuousRotation(mesh.quaternion, start.continuousRotation);
        mesh.rotation.set(...start.continuousRotation, "XYZ");
        mesh.scale.copy(start.scale).multiply(deltaScale);
      });
      scheduleTransformPreview();
      dirty = true;
    };
    const endTransform = () => {
      if(transformPreviewTimer){clearTimeout(transformPreviewTimer);transformPreviewTimer=null;}
      if (modelDrag) { const delta=modelDelta().toArray(),rotations=modelDrag.rotations; modelDrag=null; latestRef.current.onModelTransform?.(delta,rotations); latestRef.current.onModelTransformPreview?.(null); return; }
      if (!transformStart) return;
      const updates: Record<string, SliceTransform> = {};
      transformStart.items.forEach((_, id) => { const mesh = meshes.get(id); if (mesh) updates[id] = { position: tuple(mesh.position), rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z], scale: tuple(mesh.scale) }; });
      transformStart = null;
      latestRef.current.onTransformsChange(updates);
      latestRef.current.onTransformPreview(null);
    };
    views.forEach(({ transform }) => {
    transform.addEventListener("mouseDown", beginTransform);
    transform.addEventListener("objectChange", updateTransform);
    transform.addEventListener("mouseUp", endTransform);
    transform.addEventListener("dragging-changed", (event) => { transformDragging = Boolean((event as { value?: boolean }).value); host.dataset.transformDragging = String(transformDragging); views.forEach((view) => { view.controls.enabled = !transformDragging && view.surface.style.display !== "none"; }); dirty = true; });
    });
    const setShiftModifier = (pressed: boolean) => {
      if (shiftPressed === pressed) return;
      shiftPressed = pressed;
      if (modelDrag && latestRef.current.transformMode === "scale") { proxy.scale.copy(rawDragScale);lastTransformPreviewAt=0;updateTransform(); }
      if (transformStart && latestRef.current.transformMode === "scale") { proxy.scale.copy(rawDragScale); lastTransformPreviewAt = 0; updateTransform(); }
    };
    const updateRotationSnap = (event: KeyboardEvent) => {
      setShiftModifier(event.shiftKey);
      views.forEach(({ transform }) => transform.setRotationSnap(event.shiftKey ? THREE.MathUtils.degToRad(5) : null));
    };
    const clearRotationSnap = () => { setShiftModifier(false); views.forEach(({ transform }) => transform.setRotationSnap(null)); };
    window.addEventListener("keydown", updateRotationSnap);
    window.addEventListener("keyup", updateRotationSnap);
    window.addEventListener("blur", clearRotationSnap);

    let outputTarget: THREE.WebGLRenderTarget | null = null;
    let outputPixels = new Uint8Array(0);
    let capturePending = false, disposed = false;
    const disposeOutputRenderer = () => { outputTarget?.dispose(); renderer.dispose(); };
    const captureOutput: SimulationOutputCapture = async () => {
      if (disposed || renderer.getContext().isContextLost()) throw new Error("3D Output is unavailable while the viewport is closed or its graphics context is lost.");
      if (capturePending) throw new Error("A 3D Output frame is already being captured.");
      capturePending = true;
      try {
        const { width, height } = simulationOutputSize(renderer.capabilities.maxTextureSize);
        if (!outputTarget || outputTarget.width !== width || outputTarget.height !== height) {
          outputTarget?.dispose();
          outputTarget = createSimulationOutputTarget(width, height, renderer.capabilities.maxSamples);
          outputPixels = new Uint8Array(width * height * 4);
        }
        const previousTarget = renderer.getRenderTarget();
        const previousViewport = renderer.getViewport(new THREE.Vector4());
        const previousScissor = renderer.getScissor(new THREE.Vector4());
        const previousScissorTest = renderer.getScissorTest();
        const helperVisibility = views.map((view) => view.transform.getHelper().visible);
        const selectionOutlines=[...meshes.values(),...modelLayer.meshes.values()].flatMap(mesh=>mesh.children.filter(child=>child.userData.selectionOutline&&child.visible));
        const outputCamera = (latestRef.current.viewMode === "four" ? camera : views.find((view) => view.name === latestRef.current.viewMode)!.camera).clone();
        if (outputCamera instanceof THREE.PerspectiveCamera) outputCamera.aspect = width / height;
        else { outputCamera.left = -outputCamera.top * width / height; outputCamera.right = outputCamera.top * width / height; }
        outputCamera.updateProjectionMatrix();
        views.forEach((view) => { view.transform.getHelper().visible = false; });
        selectionOutlines.forEach(outline=>{outline.visible=false;});
        let readback: Promise<unknown>;
        try {
          renderer.setRenderTarget(outputTarget); renderer.setScissorTest(false); renderer.render(scene, outputCamera);
          readback = renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, width, height, outputPixels);
        } finally {
          // Restore immediately, before yielding to GPU readback, so navigation can render safely.
          renderer.setRenderTarget(previousTarget);
          renderer.setViewport(previousViewport);
          renderer.setScissor(previousScissor);
          renderer.setScissorTest(previousScissorTest);
          views.forEach((view, index) => { view.transform.getHelper().visible = helperVisibility[index]; });
          selectionOutlines.forEach(outline=>{outline.visible=true;});
        }
        await readback;
        if (disposed) throw new Error("3D Output stopped because the viewport was closed.");
        const flipped = new Uint8Array(outputPixels.length), stride = width * 4;
        for (let row = 0; row < height; row += 1) flipped.set(outputPixels.subarray((height - row - 1) * stride, (height - row) * stride), row * stride);
        return { width, height, data: flipped.buffer };
      } finally {
        capturePending = false;
        if (disposed) disposeOutputRenderer();
      }
    };
    props.onOutputCaptureReady?.(captureOutput);
    runtimeRef.current = { fit:()=>{fit();publishCamera();}, focusSelection:()=>{focusSelection();publishCamera();}, setView:mode=>{setView(mode);rememberCamera();}, render: renderScene, refreshRendering, refreshMedia: () => {}, updateClipping: updateCameraClipping, updateTopology, updateNavigationSelection, controls, camera, renderer, transforms: views.map((view) => view.transform), proxy, meshes, patternTextures, scene, modelLayer, studio, grid, floor, externalTextures: {} };
    return () => {
      if(cameraSaveTimer)clearTimeout(cameraSaveTimer);
      if(transformPreviewTimer)clearTimeout(transformPreviewTimer);
      disposed = true;
      spaceMouse?.dispose();
      cancelAnimationFrame(frame);
      gpuTimer.dispose();
      renderer.domElement.removeEventListener("webglcontextrestored", restoreGpuTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      document.removeEventListener("fullscreenchange", resize);
      views.forEach((view) => { view.controls.dispose(); view.transform.dispose(); view.surface.remove(); });
      window.removeEventListener("keydown", updateRotationSnap);
      window.removeEventListener("keyup", updateRotationSnap);
      window.removeEventListener("blur", clearRotationSnap);
      selectionOutline.dispose();
      modelLayer.dispose();
      studio.target.dispose();
      patternTextures.forEach((texture) => texture.dispose());
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.forEach((material) => material.dispose());
        mesh.children.forEach((child) => {
          if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
            else child.material.dispose();
          }
        });
      });
      host.removeEventListener("pointercancel", onPointerCancel, true);
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onPointerMove, true);
      host.removeEventListener("pointerup", onPointerUp, true);
      renderer.domElement.remove();
      if (!capturePending) disposeOutputRenderer();
      props.onOutputCaptureReady?.(null);
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (props.renderPaused && !props.outputActive) return;
    props.slices.forEach((slice) => {
      const texture = runtime.patternTextures.get(slice.id);
      if (!texture) return;
      props.drawPatternTexture(texture.image as HTMLCanvasElement, slice);
      texture.needsUpdate = true;
    });
    runtime.render();
  }, [props.textureVersion, props.drawPatternTexture, props.slices, props.renderPaused, props.outputActive]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    Object.values(runtime.externalTextures).forEach((texture) => texture?.dispose());
    runtime.externalTextures = {};
    let frame = 0;
    const canvasFrameVersions = new Map<HTMLCanvasElement, string>();
    const mediaEntries = Object.entries(props.sourceMedia) as Array<["video" | "ndi" | "spout", HTMLVideoElement | HTMLCanvasElement]>;
    mediaEntries.forEach(([kind, source]) => {
      let texture: THREE.Texture;
      if (props.sourceQuality === "quality" && source instanceof HTMLVideoElement) {
        texture = new THREE.VideoTexture(source);
      } else if (source instanceof HTMLCanvasElement) {
        texture = new THREE.CanvasTexture(source);
        canvasFrameVersions.set(source, source.dataset.frameVersion || "0");
      } else {
        const sourceWidth = Math.max(1, source.videoWidth || 1920);
        const sourceHeight = Math.max(1, source.videoHeight || 1080);
        const scale = props.sourceQuality === "quality" ? 1 : Math.min(1, 960 / sourceWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        texture = new THREE.CanvasTexture(canvas);
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      runtime.externalTextures[kind] = texture;
    });
    const update = () => {
      if (latestRef.current.renderPaused && !latestRef.current.outputActive) return;
      let changed = false;
      mediaEntries.forEach(([kind, source]) => {
        const active = runtime.externalTextures[kind];
        if (!(active instanceof THREE.CanvasTexture)) return;
        const canvas = active.image as HTMLCanvasElement;
        if (canvas === source) {
          const version = source.dataset.frameVersion || "0";
          if (canvasFrameVersions.get(source) === version) return;
          canvasFrameVersions.set(source, version);
        } else canvas.getContext("2d", { alpha: true })?.drawImage(source, 0, 0, canvas.width, canvas.height);
        active.needsUpdate = true;
        changed = true;
      });
      if (changed) runtime.render();
      frame = requestAnimationFrame(update);
    };
    const refreshMedia = () => { cancelAnimationFrame(frame); update(); };
    runtime.refreshMedia = refreshMedia;
    update();
    return () => {
      if (runtime.refreshMedia === refreshMedia) runtime.refreshMedia = () => {};
      cancelAnimationFrame(frame);
      Object.values(runtime.externalTextures).forEach((texture) => texture?.dispose());
      runtime.externalTextures = {};
    };
  }, [props.sourceQuality, props.sourceMedia.video, props.sourceMedia.ndi, props.sourceMedia.spout]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const activeIds = new Set(props.slices.map((slice) => slice.id));
    runtime.meshes.forEach((mesh, id) => {
      if (activeIds.has(id)) return;
      runtime.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.forEach((material) => material.dispose());
      mesh.children.forEach((child) => { if (child instanceof THREE.LineSegments) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); } });
      runtime.meshes.delete(id); runtime.patternTextures.get(id)?.dispose(); runtime.patternTextures.delete(id);
    });
    const masterPitchM = props.masterPitchMm / 1000;
    props.slices.forEach((slice) => {
      const localPitchM = (props.pitchBySlice[slice.id] || props.masterPitchMm) / 1000;
      const route = props.sourceOverrides[slice.id] || "inherit", resolvedSource = route === "inherit" ? props.source : route;
      const pivot = props.pivotBySlice[slice.id] || "bottom-center";
      const curvature = props.curvatureBySlice[slice.id] || { horizontal: 0, vertical: 0 }, depth = props.depthBySlice[slice.id] || 0.01, fullSource = resolvedSource === "pattern" || route !== "inherit";
      const geometryKey = [slice.input.x, slice.input.y, slice.input.width, slice.input.height, slice.input.points.map((point) => `${point.x},${point.y}`).join(";"), localPitchM, depth, curvature.horizontal, curvature.vertical, props.compositionWidth, props.compositionHeight, pivotKey(pivot), fullSource ? 1 : 0, props.interactiveGeometryPreview ? 1 : 0].join("|");
      let patternTexture = runtime.patternTextures.get(slice.id);
      if (!patternTexture) {
        const patternCanvas = document.createElement("canvas"); props.drawPatternTexture(patternCanvas, slice);
        patternTexture = new THREE.CanvasTexture(patternCanvas); patternTexture.colorSpace = THREE.SRGBColorSpace; patternTexture.minFilter = THREE.LinearMipmapLinearFilter; patternTexture.magFilter = THREE.LinearFilter; patternTexture.wrapS = patternTexture.wrapT = THREE.ClampToEdgeWrapping; patternTexture.generateMipmaps = true; patternTexture.anisotropy = runtime.renderer.capabilities.getMaxAnisotropy(); runtime.patternTextures.set(slice.id, patternTexture);
      }
      const sourceTexture = resolvedSource === "pattern" ? patternTexture : runtime.externalTextures[resolvedSource];
      let mesh = runtime.meshes.get(slice.id);
      if (!mesh) {
        const geometry = createSliceGeometry(slice, localPitchM, depth, curvature, props.compositionWidth, props.compositionHeight, pivot, fullSource, props.interactiveGeometryPreview);
        const front = new THREE.MeshBasicMaterial({ map: sourceTexture || null, color: sourceTexture ? 0xffffff : 0x000000, side: THREE.DoubleSide, toneMapped: false, fog: false, depthTest: true, depthWrite: true }), body = createModelMaterial(DEFAULT_BODY_MATERIAL);
        mesh = new THREE.Mesh(geometry, [front, body]) as unknown as SliceObject; mesh.userData.sliceId = slice.id; mesh.userData.geometryKey = geometryKey;
        const selected = props.selectedIds.includes(slice.id), edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: selected ? 1 : 0, depthWrite: false })); edges.visible = selected; edges.userData.nonInteractive = true; edges.userData.selectionOutline=true; mesh.add(edges); runtime.scene.add(mesh); runtime.meshes.set(slice.id, mesh);
      } else if (mesh.userData.geometryKey !== geometryKey) {
        const geometry = createSliceGeometry(slice, localPitchM, depth, curvature, props.compositionWidth, props.compositionHeight, pivot, fullSource, props.interactiveGeometryPreview), previousGeometry = mesh.geometry; mesh.geometry = geometry; previousGeometry.dispose(); mesh.userData.geometryKey = geometryKey;
        const edges = mesh.children[0] as THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | undefined; if (edges) { edges.geometry.dispose(); edges.geometry = new THREE.EdgesGeometry(geometry, 20); }
      }
      const front = mesh.material[0] as THREE.MeshBasicMaterial; if (front.map !== (sourceTexture || null)) { front.map = sourceTexture || null; front.needsUpdate = true; }
      // A selected live input without a texture is an opaque black LED face.
      front.color.set(sourceTexture ? 0xffffff : 0x000000);
      const body=mesh.material[1] as THREE.MeshPhysicalMaterial;applyBodyMaterial(body,props.bodyAppearanceBySlice?.[slice.id]?.material || DEFAULT_BODY_MATERIAL,props.bodyAppearanceBySlice?.[slice.id]?.style==="wireframe");body.envMap=runtime.studio.target.texture;
      const offset = pivotOffset(pivot, slice.input.width * localPitchM, slice.input.height * localPitchM);
      const saved = props.transforms[slice.id], initialPosition: [number, number, number] = [(slice.input.x + slice.input.width / 2 - props.compositionWidth / 2) * masterPitchM + offset[0], (props.compositionHeight - slice.input.y - slice.input.height / 2) * masterPitchM + offset[1], offset[2]];
      mesh.position.fromArray(saved?.position || initialPosition); mesh.rotation.fromArray([...(saved?.rotation || [0, 0, 0]), "XYZ"]); mesh.scale.fromArray(saved?.scale || [1, 1, 1]); mesh.visible = props.visibleIds.includes(slice.id);
    });
    runtime.updateClipping();
    runtime.updateTopology();
    runtime.render();
  }, [props.slices, props.compositionWidth, props.compositionHeight, props.masterPitchMm, props.pitchBySlice, props.depthBySlice, props.curvatureBySlice, props.pivotBySlice, props.source, props.sourceOverrides, props.sourceMedia.video, props.sourceMedia.ndi, props.sourceMedia.spout, props.sourceQuality, props.drawPatternTexture, props.interactiveGeometryPreview]);

  useEffect(()=>{const runtime=runtimeRef.current;if(!runtime)return;runtime.meshes.forEach((mesh,id)=>{const body=mesh.material[1] as THREE.MeshPhysicalMaterial;applyBodyMaterial(body,props.bodyAppearanceBySlice?.[id]?.material||DEFAULT_BODY_MATERIAL,props.bodyAppearanceBySlice?.[id]?.style==="wireframe");body.envMap=runtime.studio.target.texture;});runtime.render();},[props.bodyAppearanceBySlice]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return;
    const slicesById = new Map(props.slices.map((slice) => [slice.id, slice])), masterPitchM = props.masterPitchMm / 1000;
    runtime.meshes.forEach((mesh, id) => {
      const saved = props.transforms[id];
      if (saved) { mesh.position.fromArray(saved.position); mesh.rotation.fromArray([...saved.rotation, "XYZ"]); mesh.scale.fromArray(saved.scale || [1, 1, 1]); return; }
      const slice = slicesById.get(id); if (!slice) return;
      const pivot = props.pivotBySlice[id] || "bottom-center", pitch = (props.pitchBySlice[id] || props.masterPitchMm) / 1000;
      const offset = pivotOffset(pivot, slice.input.width * pitch, slice.input.height * pitch);
      mesh.position.set((slice.input.x + slice.input.width / 2 - props.compositionWidth / 2) * masterPitchM + offset[0], (props.compositionHeight - slice.input.y - slice.input.height / 2) * masterPitchM + offset[1], offset[2]); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    });
    runtime.render();
  }, [props.transforms, props.slices, props.masterPitchMm, props.pitchBySlice, props.compositionWidth, props.compositionHeight, props.pivotBySlice]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.meshes.forEach((mesh, id) => {
      const edges = mesh.children[0] as THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | undefined;
      if (edges) { const selected = !props.previewOnly && props.selectedIds.includes(id); edges.visible = selected; edges.material.opacity = selected ? 1 : 0; }
    });
    // Imported selection owns the shared gizmo until it clears. Re-run when that
    // selection changes so deleting its last item detaches immediately.
    if (!props.previewOnly && props.modelSelection?.length) return;
    const selected = (props.previewOnly ? [] : props.selectedIds).filter((id) => !props.lockedIds.includes(id) && props.visibleIds.includes(id)).map((id) => runtime.meshes.get(id)).filter(Boolean) as SliceObject[];
    if (!selected.length) { runtime.transforms.forEach((transform) => transform.detach()); runtime.render(); return; }
    if (props.selectionTransform) {
      runtime.proxy.position.fromArray(props.selectionTransform.position);
      runtime.proxy.quaternion.setFromEuler(new THREE.Euler(...props.selectionTransform.rotation, "XYZ"));
      runtime.proxy.scale.fromArray(props.selectionTransform.scale || [1, 1, 1]);
    } else {
      runtime.proxy.position.set(0, 0, 0);
      selected.forEach((mesh) => runtime.proxy.position.add(mesh.position));
      runtime.proxy.position.multiplyScalar(1 / selected.length);
      runtime.proxy.scale.set(1, 1, 1);
      if (props.transformSpace === "local") runtime.proxy.quaternion.copy(selected[selected.length - 1].quaternion); else runtime.proxy.rotation.set(0, 0, 0);
    }
    runtime.transforms.forEach((transform) => transform.attach(runtime.proxy));
    runtime.render();
  }, [props.selectedIds, props.lockedIds, props.visibleIds, props.transformSpace, props.transforms, props.pivotBySlice, props.selectionTransform, props.previewOnly, props.modelSelection]);

  useEffect(() => {
    const runtime=runtimeRef.current; if (!runtime) return;
    runtime.modelLayer.sync(props.models || [], props.previewOnly ? [] : props.modelSelection || []);
    runtime.updateTopology();
    if (!props.previewOnly && props.modelSelection?.length && !runtime.transforms.some(t=>t.dragging)) {
      const unlocked = (props.models || []).flatMap(model => model.nodes.filter(n=>props.modelSelection!.includes(n.id) && inherited(model,n,"visible") && !inherited(model,n,"locked")).map(n=>n.id));
      const point=modelSelectionPivot(props.models || [],unlocked);
      if (!point) runtime.transforms.forEach(t=>t.detach());
      else { runtime.proxy.position.copy(point); runtime.proxy.rotation.set(0,0,0); runtime.proxy.scale.set(1,1,1); if (props.transformSpace === "local" && unlocked.length === 1) { const node=(props.models || []).flatMap(m=>m.nodes).find(n=>n.id===unlocked[0]); if(node) new THREE.Matrix4().fromArray(node.matrix).decompose(new THREE.Vector3(),runtime.proxy.quaternion,new THREE.Vector3()); } if(props.selectionTransform){runtime.proxy.position.fromArray(props.selectionTransform.position);runtime.proxy.quaternion.setFromEuler(new THREE.Euler(...props.selectionTransform.rotation,"XYZ"));runtime.proxy.scale.fromArray(props.selectionTransform.scale||[1,1,1]);}runtime.transforms.forEach(t=>t.attach(runtime.proxy)); }
    }
    runtime.updateClipping(); runtime.render();
  }, [props.models, props.modelSelection, props.previewOnly, props.transformSpace,props.selectionTransform]);

  useEffect(() => { const runtime = runtimeRef.current; if (!runtime) return; runtime.meshes.forEach((mesh, id) => { mesh.visible = props.visibleIds.includes(id); }); runtime.render(); }, [props.visibleIds]);

  useEffect(() => { runtimeRef.current?.updateNavigationSelection(); }, [props.selectedIds, props.modelSelection, props.models, props.transforms, props.visibleIds]);

  useEffect(() => { const runtime = runtimeRef.current; if (!runtime) return; runtime.transforms.forEach((transform) => transform.setMode(props.transformMode)); runtime.render(); }, [props.transformMode]);
  useEffect(() => { const runtime = runtimeRef.current; if (!runtime) return; runtime.transforms.forEach((transform) => transform.setSpace(props.transformSpace)); const selected = props.selectedIds.filter((id) => !props.lockedIds.includes(id) && props.visibleIds.includes(id)).map((id) => runtime.meshes.get(id)).filter(Boolean) as SliceObject[]; if (props.modelSelection?.length) return; if (props.selectionTransform) runtime.proxy.quaternion.setFromEuler(new THREE.Euler(...props.selectionTransform.rotation, "XYZ")); else if (selected.length && props.transformSpace === "local") runtime.proxy.quaternion.copy(selected[selected.length - 1].quaternion); else runtime.proxy.rotation.set(0, 0, 0); runtime.render(); }, [props.transformSpace, props.selectedIds, props.lockedIds, props.visibleIds, props.transforms, props.pivotBySlice, props.selectionTransform]);
  useEffect(() => { const runtime = runtimeRef.current; if (!runtime) return; runtime.grid.visible = props.gridVisible; if (runtime.floor) runtime.floor.visible = props.floorVisible; const level = THREE.MathUtils.clamp(props.backgroundLevel / 100, 0, 2), base = new THREE.Color(0x090b0c), floorColor = new THREE.Color(0x111518); base.multiplyScalar(level); floorColor.multiplyScalar(level); runtime.scene.background = base; if (runtime.floor) runtime.floor.material.color.copy(floorColor); runtime.render(); }, [props.gridVisible, props.floorVisible, props.backgroundLevel]);
  useEffect(() => { void runtimeRef.current?.studio.target.select(props.reflectionPreset || 1); }, [props.reflectionPreset]);

  // On a first visit without a saved camera, frame the populated scene, after
  // both slice and imported-model effects have installed their geometry.
  useEffect(() => { if (!initialCamera.current) runtimeRef.current?.fit(); }, []);
  useEffect(() => { if (props.fitSignal!==lastFitSignal.current) { lastFitSignal.current=props.fitSignal;if(props.fitSignal)runtimeRef.current?.fit(); } }, [props.fitSignal]);
  useEffect(() => { if (props.focusSignal!==lastFocusSignal.current) { lastFocusSignal.current=props.focusSignal;if(props.focusSignal)runtimeRef.current?.focusSelection(); } }, [props.focusSignal]);
  useEffect(() => { const runtime = runtimeRef.current; if (!runtime) return; runtime.setView(props.viewMode); runtime.render(); }, [props.viewMode]);

  useEffect(() => {
    runtimeRef.current?.refreshRendering();
    runtimeRef.current?.refreshMedia();
  }, [props.renderPaused, props.outputActive]);

  useEffect(() => {
    if (!props.onSceneReady) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let cancelled = false, frame = 0;
    const prepare = () => {
      if (cancelled) return;
      if (runtime.renderer.getContext().isContextLost()) return;
      if (!mountRef.current?.clientWidth || !mountRef.current.clientHeight || latestRef.current.renderPaused) { frame = requestAnimationFrame(prepare); return; }
      runtime.render();
      // Let the first fully populated frame reach presentation before revealing.
      frame = requestAnimationFrame(() => { if (!cancelled) props.onSceneReady?.(); });
    };
    void runtime.studio.target.ready.then(() => { if (!cancelled) frame = requestAnimationFrame(prepare); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [props.onSceneReady]);

  useEffect(()=>{const runtime=runtimeRef.current;if(!runtime)return;runtime.transforms.forEach(transform=>{transform.enabled=!props.transferActive;transform.getHelper().visible=!props.transferActive;});runtime.render();},[props.transferActive]);

  return <div data-transfer-active={props.transferActive||undefined} inert={props.renderPaused || undefined} data-render-paused={props.renderPaused || undefined} className="three-view" ref={mountRef} tabIndex={0} role="region" aria-label={props.previewOnly ? "Floating Preview" : "3D viewport"} data-keyboard-focus="false"
    onBlur={(event) => { event.currentTarget.dataset.keyboardFocus = "false"; }}
    onPointerDownCapture={(event) => {
      event.currentTarget.dataset.keyboardFocus = "false";
      event.currentTarget.focus({ preventScroll: true });
      // Prevent Shift-click's native text-selection focus from returning to the
      // last edited field while the gizmo is receiving the pointer gesture.
      event.preventDefault();
    }}>
    {!props.slices.length && !props.models?.length && <div className="three-empty"><strong>Import a Resolume XML map</strong><span>Every slice will appear here as a physically sized 3D screen.</span></div>}
    {props.viewMode === "four" && <div className="three-view-labels" aria-hidden="true"><span>Perspective</span><span>Top</span><span>Front</span><span>Right</span></div>}
    <div ref={marqueeRef} className="three-marquee" aria-hidden="true" />
    {!props.previewOnly && <div className="three-help">{props.viewMode === "perspective" || props.viewMode === "four" ? "Perspective: left drag orbit · " : ""}Axis views: left drag pan · Right drag pan · Wheel zoom to cursor · Ctrl-drag marquee · Ctrl/Shift-click multi-select</div>}
  </div>;
}
