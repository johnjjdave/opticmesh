"use client";

import FieldStepper from "./field-stepper";
import UiIcon, { toolIcon } from "./ui-icon";
import ManualDialog from "./manual-dialog";
import PerformancePanel from "./performance-panel";
import { RenderPerformance } from "./render-performance";
import NumericInput from "./numeric-input";
import PivotPad from "./pivot-pad";
import { PIVOT_LABELS, PIVOT_PRESETS, pivotOffset, pivotKey, pivotLabel, reanchorTransform, type PivotPreset } from "./slice-pivot";

import ResetSlider from "./reset-slider";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ThreeSimulation, { type CameraState, type SimulationOutputCapture, type SimulationSource, type SimulationView, type SliceCurvature, type SlicePivot, type SliceTransform, type TransformMode } from "./three-simulation";
import { exportSimulationScene, type SceneExportFormat } from "./scene-export";
import { choosePhysicalLayoutAnchor, commonSelectionValue, resolvePhysicalLayout } from "./physical-layout";
import { canParentGroup, continuousEuler, groupAncestorIds, groupDescendantSliceIds, groupTransformFromMovedChild, groupTransformFromWorldBounds, groupWorldTransform, localToWorldTransform, migrateTransformGroup, normalizeTransform, placeTransformGroup, worldToLocalTransform, type TransformGroup } from "./group-transforms";
import { buildXmlValidations } from "./xml-validation";
import { cubemapAtlasDimensions, cubemapFacePlacements, cubemapFaceUvToDirection, cubemapLayoutSize, directionFromAzimuthElevation, directionToCubemapFaceUv, type CubemapFaceKey, type CubemapLayout, type Vector3 } from "./cubemap";
import packageMetadata from "../package.json";
import v070 from "./v070/v070.module.css";
import DEMO_RESOLUME_XML from "../public/examples/LO2S - OpticMesh - Demo.xml?raw";

const CENTER_DOT_SIZE = { min: 50, max: 200, default: 50 } as const;
const normalizeCenterDotSize = (value: unknown) => typeof value === "number" && Number.isFinite(value)
  ? Math.min(CENTER_DOT_SIZE.max, Math.max(CENTER_DOT_SIZE.min, value))
  : CENTER_DOT_SIZE.default;

type PatternType = "metric" | "cabinet" | "color" | "gray" | "pixel";
type ProjectionFormat = "planar" | "dome" | "cubemap" | "equirectangular" | "cylindrical";
type DomeBackground = "black" | "grayscale" | "spectrum" | "uv" | "transparent" | "custom";
type DomeRingWeight = "thin" | "medium" | "bold";
type WorkspaceMode = "patterns" | "resolume" | "simulation";
type MapView = "input" | "output";
type ControlTab = "setup" | "overlays" | "info" | "deco" | "logo" | "scene" | "sources";
type FullscreenMode = "fit" | "actual";
type CalculatorGroup = "physical" | "raster" | "pitch";
type BackgroundMode = "black" | "transparent";
type PatternOutput = "off" | "ndi" | "spout";
type PatternCalibration = "none" | "gamma" | "seam";
type MapFill = "checker" | PatternType;
type PatternScope = "slice" | "map";
type LogoPosition = "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";
type InfoPosition = LogoPosition | "hidden";
type InfoOrientation = "normal" | "rotate-90" | "rotate-180" | "rotate-270";
type Point = { x: number; y: number };
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  points: Point[];
};

type PatternConfig = {
  project: string;
  wallWidth: number;
  wallHeight: number;
  resolutionWidth: number;
  resolutionHeight: number;
  pixelPitchMm: number;
  cabinetWidth: number;
  cabinetHeight: number;
  pattern: PatternType;
  projectionFormat: ProjectionFormat;
  cubemapLayout: CubemapLayout;
  cubemapResolution: number;
  cubemapGridStep: number;
  cubemapShowGrid: boolean;
  cubemapShowFaceLabels: boolean;
  cubemapShowSeams: boolean;
  cubemapShowLogo: boolean;
  cubemapLogoAzimuth: number;
  cubemapLogoElevation: number;
  cubemapLogoAngularWidth: number;
  cubemapLogoOpacity: number;
  domePatternName: string;
  domeScale: number;
  domeResolution: number;
  domeBackground: DomeBackground;
  domeBackgroundColor: string;
  domeCompass: boolean;
  domeLineOpacity: number;
  domeDegreeStep: number;
  domeDegreeLabels: boolean;
  domeElevationAngles: boolean;
  domeBorder: boolean;
  domeRingCount: number;
  domeRingWeight: DomeRingWeight;
  domeShowGrid: boolean;
  domeShowRings: boolean;
  domeShowSafeArea: boolean;
  domeShowLabels: boolean;
  domeGridColor: string;
  domeAxisColor: string;
  domeRingColor: string;
  domeSafeAreaColor: string;
  domeLabelColor: string;
  domeShowCenterDot: boolean;
  domeCenterDotColor: string;
  domeCenterDotSize: number;
  domeShowLogo: boolean;
  domeLogoAzimuth: number;
  domeLogoElevation: number;
  domeLogoAngularWidth: number;
  domeLogoScale: number;
  domeLogoOpacity: number;
  showPatternCheckerboard: boolean;
  showMetricGrid: boolean;
  showPatternTitle: boolean;
  showPatternDimensions: boolean;
  showCardinalLabels: boolean;
  showCheckerboard: boolean;
  showPixelGrid: boolean;
  showLabels: boolean;
  showDiagonals: boolean;
  showCircles: boolean;
  showSafeArea: boolean;
  labelColor: string;
  diagonalColor: string;
  circleColor: string;
  safeAreaColor: string;
  metricGridColor: string;
  checkerColorA: string;
  checkerColorB: string;
  lineWidth: number;
  customLogoScale: number;
  customLogoOpacity: number;
  customLogoPosition: LogoPosition;
  showLogo: boolean;
  labelPosition: "top" | "center" | "bottom";
  labelNameScale: number;
  labelDataScale: number;
  infoOrientation: InfoOrientation;
  namePosition: InfoPosition;
  coordinatesPosition: InfoPosition;
  resolutionPosition: InfoPosition;
  aspectPosition: InfoPosition;
  physicalSizePosition: InfoPosition;
  showCenterDot: boolean;
  centerDotColor: string;
  centerDotSize: number;
  mapFill: MapFill;
  mapPatternScope: PatternScope;
  backgroundMode: BackgroundMode;
};

type PatternStyle = Pick<
  PatternConfig,
  | "showPatternCheckerboard"
  | "showMetricGrid"
  | "showPatternTitle"
  | "showPatternDimensions"
  | "showCardinalLabels"
  | "showLabels"
  | "showDiagonals"
  | "showCircles"
  | "showSafeArea"
  | "labelColor"
  | "diagonalColor"
  | "circleColor"
  | "safeAreaColor"
  | "metricGridColor"
  | "checkerColorA"
  | "checkerColorB"
  | "lineWidth"
  | "showCenterDot"
  | "centerDotColor"
  | "centerDotSize"
>;

type ResolumeSlice = {
  id: string;
  name: string;
  screenName: string;
  input: Rect;
  output: Rect;
  warped: boolean;
  paletteIndex: number;
};
type ResolumeScreen = {
  name: string;
  width: number;
  height: number;
  slices: ResolumeSlice[];
};
type ResolumeMap = {
  name: string;
  compositionWidth: number;
  compositionHeight: number;
  version: string;
  screens: ResolumeScreen[];
};
type SliceOverride = Partial<Pick<PatternConfig, "cabinetWidth" | "cabinetHeight" | "pixelPitchMm" | "checkerColorA" | "checkerColorB" | "metricGridColor" | "diagonalColor" | "circleColor" | "safeAreaColor" | "lineWidth" | "showCheckerboard" | "showPixelGrid" | "showLabels" | "showDiagonals" | "showCircles" | "showSafeArea" | "labelNameScale" | "labelDataScale" | "infoOrientation" | "namePosition" | "coordinatesPosition" | "resolutionPosition" | "aspectPosition" | "physicalSizePosition" | "showCenterDot" | "centerDotColor" | "centerDotSize">> & { logoScale?: number; logoVisible?: boolean; logoPosition?: LogoPosition };
type SceneGroup = TransformGroup;
type SimulationSnapshot = {
  transforms: Record<string, SliceTransform>;
  depthM: number;
  curvature: SliceCurvature;
  curvatureOverrides: Record<string, SliceCurvature>;
  source: SimulationSource;
  quality: "latency" | "quality";
  sourceOverrides: Record<string, "inherit" | SimulationSource>;
  transformSpace: "local" | "world";
  pivot: SlicePivot;
  pivotOverrides: Record<string, SlicePivot>;
  gridVisible: boolean;
  snapEnabled: boolean;
  floorVisible: boolean;
  backgroundLevel: number;
  visibility: Record<string, boolean>;
  locks: Record<string, boolean>;
  localNames: Record<string, string>;
  groups: SceneGroup[];
};
type HistoryEntry = { label: string; state: SimulationSnapshot };
type FileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
    abort?: () => Promise<void>;
  }>;
};
type DirectoryHandle = {
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileHandle>;
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<DirectoryHandle>;
  removeEntry: (name: string) => Promise<void>;
};
type DesktopXmlResult = {
  ok: boolean;
  cancelled?: boolean;
  linked?: boolean;
  path?: string;
  name?: string;
  mtimeMs?: number;
  content?: string;
  error?: string;
};
type NativeSourceInfo = { id: string; name: string };
type NativeSourceFrame = {
  width: number;
  height: number;
  stride: number;
  fpsN: number;
  fpsD: number;
  data: Uint8Array;
};
type NativeSourceStatus = {
  status: "connecting" | "connected" | "disconnected" | "error" | "message";
  name: string;
  width?: number;
  height?: number;
  fps?: number;
  transport?: "shared-memory";
  mapping?: string;
};
type NativeSourceMetrics = {
  transport: "shared-memory";
  captureFps: number;
  publishedFps: number;
  displayedFps: number;
  conversionMs: number;
  copyMs: number;
  canvasMs: number;
  overwritten: number;
};
type DesktopUpdate = {
  ok: boolean;
  available?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  name?: string;
  url?: string;
  error?: string;
};
type DesktopProjectResult = {
  ok: boolean;
  cancelled?: boolean;
  restored?: boolean;
  recoveryUsed?: boolean;
  path?: string;
  name?: string;
  content?: string;
  savedAt?: number;
  error?: string;
};
type DesktopBridge = {
  chooseResolumeXml: () => Promise<DesktopXmlResult>;
  linkLatestResolumeMap: () => Promise<DesktopXmlResult>;
  unlinkResolumeMap: () => Promise<{ ok: boolean }>;
  onResolumeXmlUpdated: (callback: (result: DesktopXmlResult) => void) => () => void;
  onResolumeLinkError: (callback: (result: { error?: string }) => void) => () => void;
  saveExport: (
    filename: string,
    mimeType: string,
    data: ArrayBuffer,
    category?: "png" | "scene3d",
  ) => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path?: string;
    error?: string;
  }>;
  saveExports: (files: Array<{ filename: string; data: ArrayBuffer }>) => Promise<{ ok: boolean; count?: number; path?: string; error?: string }>;
  compileProject?: (payload: { name: string; project: string; files: Array<{ filename: string; data: ArrayBuffer }> }) => Promise<{ ok: boolean; cancelled?: boolean; path?: string; error?: string }>;
  saveProject: (
    filename: string,
    data: ArrayBuffer,
  ) => Promise<{
    ok: boolean;
    cancelled?: boolean;
    path?: string;
    error?: string;
  }>;
  overwriteProject: (projectPath: string, data: ArrayBuffer) => Promise<DesktopProjectResult>;
  openProject: () => Promise<DesktopProjectResult>;
  autosaveProject: (data: ArrayBuffer) => Promise<DesktopProjectResult>;
  autosaveProjectSync: (data: ArrayBuffer) => DesktopProjectResult;
  loadStartupProject: () => Promise<DesktopProjectResult>;
  getWorkspacePaths: () => Promise<{
    ok: boolean;
    root?: string;
    projects?: string;
    exports?: string;
    testPatterns?: string;
  }>;
  revealProjectsFolder: () => Promise<{
    ok: boolean;
    path?: string;
    error?: string;
  }>;
  startPatternOutput: (kind: "ndi" | "spout", name: string) => Promise<{ ok: boolean; error?: string }>;
  sendPatternOutputFrame: (width: number, height: number, data: ArrayBuffer) => Promise<{ ok: boolean; error?: string }>;
  stopPatternOutput: () => Promise<{ ok: boolean }>;
  onPatternOutputStatus: (callback: (status: NativeSourceStatus) => void) => () => void;
  listNativeSources: (kind: "ndi" | "spout") => Promise<{ ok: boolean; sources?: NativeSourceInfo[]; error?: string }>;
  connectNativeSource: (kind: "ndi" | "spout", sourceId: string, quality: "latency" | "quality") => Promise<{ ok: boolean; error?: string }>;
  disconnectNativeSource: () => Promise<{ ok: boolean }>;
  checkForUpdates: () => Promise<DesktopUpdate>;
  openExternal: (url: string) => Promise<{ ok: boolean }>;
  nativeSourceFrameReady: () => void;
  onNativeSourceFrame: (callback: (frame: NativeSourceFrame) => void) => () => void;
  onNativeSourceStatus: (callback: (status: NativeSourceStatus) => void) => () => void;
  onNativeSourceMetrics: (callback: (metrics: NativeSourceMetrics) => void) => () => void;
};
type PickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileHandle>;
  showDirectoryPicker?: () => Promise<DirectoryHandle>;
  lo2sDesktop?: DesktopBridge;
};

const DEFAULT_CONFIG: PatternConfig = {
  project: "LO2S - OpticMesh — Main LED",
  wallWidth: 10,
  wallHeight: 6,
  resolutionWidth: 2560,
  resolutionHeight: 1536,
  pixelPitchMm: 3.9,
  cabinetWidth: 500,
  cabinetHeight: 500,
  pattern: "metric",
  projectionFormat: "planar",
  cubemapLayout: "horizontal-cross",
  cubemapResolution: 1024,
  cubemapGridStep: 15,
  cubemapShowGrid: true,
  cubemapShowFaceLabels: true,
  cubemapShowSeams: true,
  cubemapShowLogo: false,
  cubemapLogoAzimuth: 0,
  cubemapLogoElevation: 0,
  cubemapLogoAngularWidth: 30,
  cubemapLogoOpacity: 100,
  domePatternName: "Dome Test Pattern",
  domeScale: 100,
  domeResolution: 4096,
  domeBackground: "black",
  domeBackgroundColor: "#000000",
  domeCompass: true,
  domeLineOpacity: 100,
  domeDegreeStep: 5,
  domeDegreeLabels: true,
  domeElevationAngles: true,
  domeBorder: true,
  domeRingCount: 36,
  domeRingWeight: "thin",
  domeShowGrid: true,
  domeShowRings: true,
  domeShowSafeArea: false,
  domeShowLabels: true,
  domeGridColor: "#d4dcd6",
  domeAxisColor: "#ffffff",
  domeRingColor: "#d4dcd6",
  domeSafeAreaColor: "#ffdd2d",
  domeLabelColor: "#ff5a50",
  domeShowCenterDot: true,
  domeCenterDotColor: "#ff5a50",
  domeCenterDotSize: CENTER_DOT_SIZE.default,
  domeShowLogo: true,
  domeLogoAzimuth: 180,
  domeLogoElevation: 35,
  domeLogoAngularWidth: 36,
  domeLogoScale: 100,
  domeLogoOpacity: 100,
  showPatternCheckerboard: false,
  showMetricGrid: true,
  showPatternTitle: true,
  showPatternDimensions: true,
  showCardinalLabels: true,
  showCheckerboard: true,
  showPixelGrid: true,
  showLabels: true,
  showDiagonals: true,
  showCircles: true,
  showSafeArea: true,
  labelColor: "#ff5a50",
  diagonalColor: "#ffffff",
  circleColor: "#ffffff",
  safeAreaColor: "#ffdd2d",
  metricGridColor: "#ff3b30",
  checkerColorA: "#00e6a8",
  checkerColorB: "#006b55",
  lineWidth: 1,
  customLogoScale: 100,
  customLogoOpacity: 100,
  customLogoPosition: "center",
  showLogo: true,
  labelPosition: "bottom",
  labelNameScale: 100,
  labelDataScale: 100,
  infoOrientation: "normal",
  namePosition: "center",
  coordinatesPosition: "center",
  resolutionPosition: "center",
  aspectPosition: "hidden",
  physicalSizePosition: "hidden",
  showCenterDot: false,
  centerDotColor: "#ff3b30",
  centerDotSize: CENTER_DOT_SIZE.default,
  mapFill: "checker",
  mapPatternScope: "slice",
  backgroundMode: "transparent",
};

const DEFAULT_PATTERN_STYLE: PatternStyle = {
  showPatternCheckerboard: false,
  showMetricGrid: true,
  showPatternTitle: true,
  showPatternDimensions: true,
  showCardinalLabels: true,
  showLabels: true,
  showDiagonals: true,
  showCircles: true,
  showSafeArea: true,
  labelColor: "#ff5a50",
  diagonalColor: "#ffffff",
  circleColor: "#ffffff",
  safeAreaColor: "#ffdd2d",
  metricGridColor: "#ff3b30",
  checkerColorA: "#00e6a8",
  checkerColorB: "#006b55",
  lineWidth: 1,
  showCenterDot: false,
  centerDotColor: "#ff3b30",
  centerDotSize: CENTER_DOT_SIZE.default,
};

function patternStyleFromConfig(config: PatternConfig): PatternStyle {
  return {
    showPatternCheckerboard: config.showPatternCheckerboard,
    showMetricGrid: config.showMetricGrid,
    showPatternTitle: config.showPatternTitle,
    showPatternDimensions: config.showPatternDimensions,
    showCardinalLabels: config.showCardinalLabels,
    showLabels: config.showLabels,
    showDiagonals: config.showDiagonals,
    showCircles: config.showCircles,
    showSafeArea: config.showSafeArea,
    labelColor: config.labelColor,
    diagonalColor: config.diagonalColor,
    circleColor: config.circleColor,
    safeAreaColor: config.safeAreaColor,
    metricGridColor: config.metricGridColor,
    checkerColorA: config.checkerColorA,
    checkerColorB: config.checkerColorB,
    lineWidth: config.lineWidth,
    showCenterDot: config.showCenterDot,
    centerDotColor: config.centerDotColor,
    centerDotSize: config.centerDotSize,
  };
}

const DISPLAY_VERSION = packageMetadata.version.replace(/^v/i, "").replace(/-beta.*$/i, "");
const TransformSelectionScope = createContext("");

const PATTERNS: Array<{ id: PatternType; name: string; code: string }> = [
  { id: "metric", name: "Metric Grid", code: "M" },
  { id: "cabinet", name: "Cabinet IDs", code: "ID" },
  { id: "color", name: "Color Bars", code: "RGB" },
  { id: "gray", name: "Grayscale", code: "G" },
  { id: "pixel", name: "Pixel Check", code: "1" },
];

const PROJECTION_FORMATS: Array<{ id: ProjectionFormat; name: string }> = [
  { id: "planar", name: "Planar" },
  { id: "dome", name: "Dome" },
  { id: "cubemap", name: "Cubemap" },
];
const DOME_RESOLUTION_PRESETS = [1024, 2048, 4096, 6144, 8192];
const DOME_DEGREE_STEPS = [1.5, 2, 2.5, 5, 10, 15, 22.5, 30, 45, 90];
const DOME_BACKGROUND_OPTIONS: Array<{ id: DomeBackground; label: string }> = [
  { id: "black", label: "Black" },
  { id: "grayscale", label: "Black–white gradient" },
  { id: "spectrum", label: "Spectrum gradient" },
  { id: "uv", label: "UV map" },
  { id: "transparent", label: "Transparent" },
  { id: "custom", label: "Custom colour" },
];
const CUBEMAP_RESOLUTION_PRESETS = [1024, 2048, 4096];

function projectionDimensions(config: PatternConfig) {
  const width = Math.max(1, Math.round(config.resolutionWidth));
  if (config.projectionFormat === "dome") {
    const size = Math.max(256, Math.round(config.domeResolution));
    return { width: size, height: size };
  }
  if (config.projectionFormat === "cubemap") {
    const dimensions = cubemapAtlasDimensions(config.cubemapResolution, config.cubemapLayout);
    return { width: dimensions.width, height: dimensions.height };
  }
  if (config.projectionFormat === "equirectangular" || config.projectionFormat === "cylindrical") return { width, height: Math.max(1, Math.round(width / 2)) };
  return { width, height: Math.max(1, Math.round(config.resolutionHeight)) };
}

const MAP_FILLS: Array<{ id: MapFill; name: string; code: string }> = [
  { id: "checker", name: "Cabinet Checker", code: "CHK" },
  { id: "metric", name: "Metric Grid", code: "M" },
  { id: "cabinet", name: "Cabinet IDs", code: "ID" },
  { id: "color", name: "Color Bars", code: "RGB" },
  { id: "gray", name: "Grayscale", code: "G" },
  { id: "pixel", name: "Pixel Check", code: "1" },
];
const PIXEL_PITCH_PRESETS = [1.2, 1.5, 1.9, 2.5, 2.6, 2.9, 3.9, 4.8, 5.9, 10];

const INFO_POSITIONS: Array<{ id: InfoPosition; label: string }> = [
  { id: "top-left", label: "Top Left" },
  { id: "top-center", label: "Top" },
  { id: "top-right", label: "Top Right" },
  { id: "center-right", label: "Right" },
  { id: "bottom-right", label: "Bottom Right" },
  { id: "bottom-center", label: "Bottom" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "center-left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "hidden", label: "Don't Show" },
];

const CABINET_PALETTE = ["#ef3340", "#00c878", "#7957d5", "#f4d000", "#149fd3", "#e72c9f", "#86d92f", "#f47b20", "#2454d8", "#24c8ba", "#cf3ee8", "#f2505f"];
const DEMO_PROJECT_NAME = "LO2S - OpticMesh - Demo";
const DEMO_XML_NAME = `${DEMO_PROJECT_NAME}.xml`;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "opticmesh-project";
const safeFilenamePart = (value: string, fallback: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "") || fallback;
const patternProjectTitle = (value: string) =>
  safeFilenamePart(value, "Untitled Project")
    .replace(/^LO2S\s*-\s*OpticMesh\s*[—–-]\s*/i, "")
    .replace(/^OpticMesh\s*[—–-]\s*/i, "") || "Untitled Project";
const patternModeFilename = (format: ProjectionFormat) =>
  format === "equirectangular" ? "Equi" : format === "cylindrical" ? "Cyl" : format.charAt(0).toUpperCase() + format.slice(1);
function normalizeSimulationSource(value: unknown): SimulationSource {
  if (value === "shared") return "spout";
  return value === "video" || value === "ndi" || value === "spout" || value === "pattern" ? value : "pattern";
}
function normalizeSourceOverrides(value: unknown): Record<string, "inherit" | SimulationSource> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([id, source]) => [id, source === "inherit" ? "inherit" : normalizeSimulationSource(source)]));
}

function evaluateExpression(source: string, allowSigned = false): number | null {
  const text = source.replace(/[×x]/gi, "*").replace(/÷/g, "/").replace(/,/g, "").trim();
  if (!text || !/^[\d.+\-*/()\s]+$/.test(text)) return null;
  let index = 0;
  const skip = () => {
    while (/\s/.test(text[index] ?? "")) index += 1;
  };
  const expression = (): number => {
    let value = term();
    while (true) {
      skip();
      const op = text[index];
      if (op !== "+" && op !== "-") break;
      index += 1;
      const next = term();
      value = op === "+" ? value + next : value - next;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (true) {
      skip();
      const op = text[index];
      if (op !== "*" && op !== "/") break;
      index += 1;
      const next = factor();
      value = op === "*" ? value * next : value / next;
    }
    return value;
  };
  const factor = (): number => {
    skip();
    if (text[index] === "+" || text[index] === "-") {
      const sign = text[index++] === "-" ? -1 : 1;
      return sign * factor();
    }
    if (text[index] === "(") {
      index += 1;
      const value = expression();
      skip();
      if (text[index] !== ")") throw new Error("Missing parenthesis");
      index += 1;
      return value;
    }
    const match = text.slice(index).match(/^(?:\d+\.?\d*|\.\d+)/);
    if (!match) throw new Error("Expected number");
    index += match[0].length;
    return Number(match[0]);
  };
  try {
    const result = expression();
    skip();
    return index === text.length && Number.isFinite(result) && (allowSigned || result > 0) ? result : null;
  } catch {
    return null;
  }
}

function ExpressionField({ label, value, suffix, onCommit, scopeKey = "global", integer = false, min = integer ? 1 : 0.0001, max = Number.POSITIVE_INFINITY }: { label: string; value: number | null; suffix: string; onCommit: (value: number) => void; scopeKey?: string; integer?: boolean; min?: number; max?: number }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false),
    previousScope = useRef(scopeKey);
  useEffect(() => {
    const scopeChanged = previousScope.current !== scopeKey;
    previousScope.current = scopeKey;
    if (scopeChanged || !focused.current) {
      if (scopeChanged) focused.current = false;
      setDraft(value === null ? "" : String(value));
      setInvalid(false);
    }
  }, [scopeKey, value]);
  const commit = () => {
    focused.current = false;
    if (!draft.trim() && value === null) {
      setInvalid(false);
      return;
    }
    const result = evaluateExpression(draft, min <= 0);
    if (result === null) {
      setInvalid(true);
      setDraft(value === null ? "" : String(value));
      return;
    }
    const finalValue = clamp(integer ? Math.round(result) : round(result), min, max);
    setInvalid(false);
    setDraft(String(finalValue));
    onCommit(finalValue);
  };
  const adjust = (direction: 1 | -1, shifted = false) => {
    const parsed = evaluateExpression(draft, min <= 0) ?? value ?? min,
      increment = (integer ? 1 : 0.1) * (shifted ? 5 : 1),
      next = clamp(integer ? Math.round(parsed + direction * increment) : round(parsed + direction * increment, 4), min, max);
    setInvalid(false);
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <label className={`number-field ${invalid ? "invalid" : ""} ${value === null ? "mixed" : ""}`}>
      <span>{label}</span>
      <span className="number-control">
        <NumericInput
          aria-invalid={invalid}
          inputMode="decimal"
          value={draft}
          placeholder={value === null ? "Multiple values" : undefined}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onValueWheel={(event) => {
            event.preventDefault();
            adjust(event.deltaY < 0 ? 1 : -1, event.shiftKey);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          title={value === null ? "Multiple selected values · enter a value to apply it to every selected slice" : `${label} · arithmetic expressions supported`}
          aria-label={`${label}${value === null ? ", multiple values selected" : ", arithmetic expressions supported"}`}
        />
        <em>{suffix}</em>
        <FieldStepper label={label}>
          <button type="button" aria-label={`Increase ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(1)}><UiIcon name="up" /></button>
          <button type="button" aria-label={`Decrease ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(-1)}><UiIcon name="down" /></button>
        </FieldStepper>
      </span>
    </label>
  );
}

function PreciseNumberInput({ label, value, min, max, step = 1, disabled = false, onEditStart, onChange }: { label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; onEditStart?: () => void; onChange: (value: number) => void }) {
  const apply = (next: number) => onChange(clamp(round(next, 4), min, max));
  const adjust = (direction: 1 | -1, shifted = false) => {
    if (disabled) return;
    onEditStart?.();
    apply(value + direction * step * (shifted ? 5 : 1));
  };
  return (
    <span className="precise-stepper">
      <NumericInput
        disabled={disabled}
        aria-label={label}
        title={`${label}: ${value}`}
        className="precise-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={onEditStart}
        onChange={(event) => apply(Number(event.target.value))}
        onValueWheel={(event) => {
          if (disabled) return;
          event.preventDefault();
          adjust(event.deltaY < 0 ? 1 : -1, event.shiftKey);
        }}
      />
      <FieldStepper label={label}>
        <button type="button" disabled={disabled} aria-label={`Increase ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(1)}><UiIcon name="up" /></button>
        <button type="button" disabled={disabled} aria-label={`Decrease ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(-1)}><UiIcon name="down" /></button>
      </FieldStepper>
    </span>
  );
}

function SignedNumberField({ label, value, suffix, onCommit, disabled = false }: { label: string; value: number | null; suffix: string; onCommit: (value: number) => void; disabled?: boolean }) {
  const scopeKey = useContext(TransformSelectionScope);
  const [draft, setDraft] = useState(value === null ? "" : String(round(value, 3)));
  const focused = useRef(false);
  const focusScope = useRef(scopeKey);
  useEffect(() => {
    if (focusScope.current !== scopeKey) {
      focused.current = false;
      setDraft(value === null ? "" : String(round(value, 3)));
      return;
    }
    if (!focused.current) setDraft(value === null ? "" : String(round(value, 3)));
  }, [scopeKey, value]);
  useEffect(() => {
    const releaseDraft = () => {
      focused.current = false;
      setDraft(value === null ? "" : String(round(value, 3)));
    };
    window.addEventListener("lo2s-history-navigation", releaseDraft);
    return () => window.removeEventListener("lo2s-history-navigation", releaseDraft);
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (focusScope.current !== scopeKey) {
      setDraft(value === null ? "" : String(round(value, 3)));
      return;
    }
    const parsed = evaluateExpression(draft, true);
    if (parsed === null) {
      setDraft(value === null ? "" : String(round(value, 3)));
      return;
    }
    const next = round(parsed, 4);
    setDraft(String(next));
    onCommit(next);
  };
  const adjust = (direction: 1 | -1, shifted = false) => {
    if (disabled) return;
    const parsed = evaluateExpression(draft, true),
      base = parsed ?? value ?? 0,
      increment = shifted ? 0.5 : 0.1,
      next = round(base + direction * increment, 4);
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="number-control">
        <NumericInput
          disabled={disabled}
          inputMode="decimal"
          placeholder="—"
          title={`${label}: ${draft || "Multiple values"}`}
          value={draft}
          onFocus={() => {
            focused.current = true;
            focusScope.current = scopeKey;
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onValueWheel={(event) => {
            if (disabled) return;
            event.preventDefault();
            adjust(event.deltaY < 0 ? 1 : -1, event.shiftKey);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <FieldStepper label={label}>
          <button type="button" disabled={disabled} aria-label={`Increase ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => adjust(1, event.shiftKey)}><UiIcon name="up" /></button>
          <button type="button" disabled={disabled} aria-label={`Decrease ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => adjust(-1, event.shiftKey)}><UiIcon name="down" /></button>
        </FieldStepper>
        <em>{suffix}</em>
      </span>
    </label>
  );
}
function CurvatureNumberInput({ label, value, disabled, onEditStart, onCommit }: { label: string; value: number | null; disabled: boolean; onEditStart: () => void; onCommit: (value: number) => void }) {
  const scopeKey = useContext(TransformSelectionScope);
  const formatValue = useCallback((next: number | null) => (next === null ? "" : String(round(next, 1))), []);
  const [draft, setDraft] = useState(formatValue(value));
  const focused = useRef(false);
  const focusScope = useRef(scopeKey);
  useEffect(() => {
    if (focusScope.current !== scopeKey) {
      focused.current = false;
      setDraft(formatValue(value));
      return;
    }
    if (!focused.current) setDraft(formatValue(value));
  }, [formatValue, scopeKey, value]);
  useEffect(() => {
    const releaseDraft = () => {
      focused.current = false;
      setDraft(formatValue(value));
    };
    window.addEventListener("lo2s-history-navigation", releaseDraft);
    return () => window.removeEventListener("lo2s-history-navigation", releaseDraft);
  }, [formatValue, value]);
  const commit = () => {
    focused.current = false;
    if (focusScope.current !== scopeKey) {
      setDraft(formatValue(value));
      return;
    }
    const parsed = evaluateExpression(draft, true);
    if (parsed === null) {
      setDraft(formatValue(value));
      return;
    }
    const next = clamp(round(parsed, 1), -360, 360);
    setDraft(String(next));
    onCommit(next);
  };
  const adjust = (direction: 1 | -1) => {
    if (disabled) return;
    const parsed = evaluateExpression(draft, true),
      base = parsed ?? value ?? 0,
      next = clamp(round(base + direction, 1), -360, 360);
    onEditStart();
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <span className="precise-stepper">
      <NumericInput onValueWheel={(event) => adjust(event.deltaY < 0 ? 1 : -1)}
        disabled={disabled}
        aria-label={label}
        className="precise-input"
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="—"
        title="Signed values and arithmetic expressions supported"
        onFocus={() => {
          focused.current = true;
          focusScope.current = scopeKey;
          onEditStart();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            focused.current = false;
            setDraft(formatValue(value));
            event.currentTarget.blur();
          }
        }}
      />
      <FieldStepper label={label}>
        <button type="button" disabled={disabled} aria-label={`Increase ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(1)}><UiIcon name="up" /></button>
        <button type="button" disabled={disabled} aria-label={`Decrease ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => adjust(-1)}><UiIcon name="down" /></button>
      </FieldStepper>
    </span>
  );
}

function normalizeCurvature(value: Partial<SliceCurvature> | undefined): SliceCurvature {
  const horizontal = clamp(Number(value?.horizontal) || 0, -360, 360),
    vertical = clamp(Number(value?.vertical) || 0, -360, 360);
  return Math.abs(horizontal) > 0.001 ? { horizontal, vertical: 0 } : { horizontal: 0, vertical };
}

function NdiAttribution() {
  const openWebsite = () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (desktop?.openExternal) void desktop.openExternal("https://ndi.video/");
    else window.open("https://ndi.video/", "_blank", "noopener,noreferrer");
  };
  return (
    <button type="button" className="ndi-attribution" onClick={openWebsite}>
      NDI® technology by Vizrt · ndi.video
    </button>
  );
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function logoDimensions(logo: HTMLImageElement | null, width: number, height: number, scalePercent: number) {
  if (!logo?.complete || !logo.naturalWidth) return null;
  const scale = Math.min((width * 0.28) / logo.naturalWidth, (height * 0.16) / logo.naturalHeight) * (scalePercent / 100);
  return {
    width: logo.naturalWidth * scale,
    height: logo.naturalHeight * scale,
  };
}

function drawLogoAt(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, centerX: number, centerY: number, width: number, height: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity / 100;
  ctx.drawImage(logo, centerX - width / 2, centerY - height / 2, width, height);
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, width: number, height: number, scalePercent: number, opacity: number, position: LogoPosition = "center") {
  const dimensions = logoDimensions(logo, width, height, scalePercent);
  if (!logo || !dimensions) return;
  const anchor = positionAnchor({ x, y, width, height, points: [] }, position, dimensions.width, dimensions.height);
  drawLogoAt(ctx, logo, anchor.x, anchor.y, dimensions.width, dimensions.height, opacity);
}

function cabinetPixels(config: PatternConfig) {
  // Checker tiles represent whole cabinets in raster pixels, not individual LED sizes.
  // A fixed cabinet contains fewer pixels as its millimetres-per-pixel pitch increases.
  return {
    width: Math.max(1, Math.round(config.cabinetWidth / config.pixelPitchMm)),
    height: Math.max(1, Math.round(config.cabinetHeight / config.pixelPitchMm)),
  };
}

function exactPhysicalPitchMm(cabinetWidthMm: number, nominalPitchMm: number) {
  const cabinetPixelsWide = Math.max(1, Math.round(cabinetWidthMm / nominalPitchMm));
  return cabinetWidthMm / cabinetPixelsWide;
}

function drawChecker(ctx: CanvasRenderingContext2D, rect: Rect, config: PatternConfig, colorA: string, colorB: string) {
  const panel = cabinetPixels(config);
  for (let y = rect.y, row = 0; y < rect.y + rect.height; y += panel.height, row += 1)
    for (let x = rect.x, col = 0; x < rect.x + rect.width; x += panel.width, col += 1) {
      ctx.fillStyle = (row + col) % 2 ? colorA : colorB;
      ctx.fillRect(x, y, Math.min(panel.width, rect.x + rect.width - x), Math.min(panel.height, rect.y + rect.height - y));
    }
}

function drawMetric(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig, logo: HTMLImageElement | null) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (config.showPatternCheckerboard) drawChecker(ctx, { x: 0, y: 0, width, height, points: [] }, config, config.checkerColorA, config.checkerColorB);
  const sx = width / config.wallWidth,
    sy = height / config.wallHeight;
  const cols = Math.max(1, Math.round((config.wallWidth * 1000) / config.cabinetWidth)),
    rows = Math.max(1, Math.round((config.wallHeight * 1000) / config.cabinetHeight));
  const lineScale = clamp(config.lineWidth, 1, 12);
  const fine = Math.max(1, width / 2600) * lineScale,
    major = Math.max(2, width / 1500) * lineScale;
  if (config.showMetricGrid) {
    for (let col = 0; col <= cols; col += 1) line(ctx, (col * width) / cols, 0, (col * width) / cols, height, "#ffffff", fine, 0.24);
    for (let row = 0; row <= rows; row += 1) line(ctx, 0, (row * height) / rows, width, (row * height) / rows, "#ffffff", fine, 0.24);
    for (let metre = 0; metre <= config.wallWidth + 0.001; metre += 0.5) {
      const whole = Math.abs(metre - Math.round(metre)) < 0.01;
      line(ctx, metre * sx, 0, metre * sx, height, config.metricGridColor, whole ? major : fine, whole ? 0.95 : 0.42);
    }
    for (let metre = 0; metre <= config.wallHeight + 0.001; metre += 0.5) {
      const whole = Math.abs(metre - Math.round(metre)) < 0.01;
      line(ctx, 0, metre * sy, width, metre * sy, config.metricGridColor, whole ? major : fine, whole ? 0.95 : 0.42);
    }
  }
  if (config.showDiagonals) {
    line(ctx, 0, 0, width, height, config.diagonalColor, major);
    line(ctx, width, 0, 0, height, config.diagonalColor, major);
  }
  if (config.showCircles) {
    ctx.save();
    ctx.strokeStyle = config.circleColor;
    ctx.lineWidth = major;
    [0.12, 0.23, 0.34, 0.45].forEach((radius) => {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }
  if (config.showMetricGrid) {
    line(ctx, width / 2, 0, width / 2, height, config.metricGridColor, major * 1.5);
    line(ctx, 0, height / 2, width, height / 2, config.metricGridColor, major * 1.5);
  }
  if (config.showSafeArea) {
    ctx.save();
    ctx.strokeStyle = config.safeAreaColor;
    ctx.lineWidth = major;
    ctx.setLineDash([width / 80, width / 150]);
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
    ctx.restore();
  }
  if (config.showLabels) {
    const labelSize = clamp(Math.round(width / 85), 14, 54);
    ctx.font = `700 ${labelSize}px Geist, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = config.labelColor;
    for (let metre = 1; metre < config.wallWidth; metre += 1) ctx.fillText(`${metre}m`, metre * sx, labelSize * 0.45);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let metre = 1; metre < config.wallHeight; metre += 1) ctx.fillText(`${metre}m`, labelSize * 0.45, metre * sy);
    ctx.textAlign = "center";
    if (config.showPatternTitle) {
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${clamp(width / 42, 22, 92)}px Geist, sans-serif`;
      ctx.fillText(config.project.toUpperCase(), width / 2, height * 0.16);
    }
    if (config.showPatternDimensions) {
      ctx.fillStyle = config.labelColor;
      ctx.font = `700 ${Math.max(12, width / 105)}px Geist, sans-serif`;
      ctx.fillText(`${config.wallWidth} × ${config.wallHeight} M  /  ${config.resolutionWidth} × ${config.resolutionHeight} PX  /  ${config.pixelPitchMm.toFixed(4)} MM`, width / 2, height * 0.84);
    }
    if (config.showCardinalLabels) {
      ctx.fillStyle = config.labelColor;
      ctx.font = `800 ${Math.max(12, width / 120)}px Geist, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText("TOP", width / 2, labelSize * 1.4);
      ctx.fillText("BOTTOM", width / 2, height - labelSize * 1.4);
      ctx.save(); ctx.translate(labelSize * 1.4, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("LEFT", 0, 0); ctx.restore();
      ctx.save(); ctx.translate(width - labelSize * 1.4, height / 2); ctx.rotate(Math.PI / 2); ctx.fillText("RIGHT", 0, 0); ctx.restore();
    }
  }
  if (config.showLogo) drawLogo(ctx, logo, 0, 0, width, height, config.customLogoScale, config.customLogoOpacity, config.customLogoPosition);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, width / 1000) * lineScale;
  ctx.strokeRect(1, 1, width - 2, height - 2);
}

function drawPatternCenterDot(ctx: CanvasRenderingContext2D, width: number, height: number, style: PatternStyle) {
  if (!style.showCenterDot) return;
  ctx.save();
  ctx.fillStyle = style.centerDotColor;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, normalizeCenterDotSize(style.centerDotSize) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPatternCalibration(ctx: CanvasRenderingContext2D, width: number, height: number, mode: PatternCalibration) {
  if (mode === "none") return;
  ctx.save();
  if (mode === "gamma") {
    const steps = 11, swatchWidth = width * 0.72 / steps, swatchHeight = Math.max(40, height * 0.09), startX = (width - swatchWidth * steps) / 2, y = height * 0.68;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = `700 ${Math.max(11, width / 180)}px Geist, sans-serif`;
    for (let index = 0; index < steps; index += 1) {
      const level = Math.round(index * 255 / (steps - 1));
      ctx.fillStyle = `rgb(${level},${level},${level})`; ctx.fillRect(startX + index * swatchWidth, y, swatchWidth + 1, swatchHeight);
      ctx.strokeStyle = "#ffffff"; ctx.strokeRect(startX + index * swatchWidth, y, swatchWidth, swatchHeight);
      ctx.fillStyle = index < steps / 2 ? "#ffffff" : "#000000"; ctx.fillText(`${index * 10}%`, startX + (index + 0.5) * swatchWidth, y + swatchHeight * 0.72);
    }
  } else {
    const inset = Math.max(2, Math.round(Math.min(width, height) * 0.006)), lineWidth = Math.max(2, Math.round(Math.min(width, height) / 900));
    ctx.lineWidth = lineWidth;
    [["#ff3b30", inset], ["#42d36f", inset * 2], ["#4aa8ff", inset * 3]].forEach(([color, offset]) => { ctx.strokeStyle = String(color); const value = Number(offset); ctx.strokeRect(value, value, width - value * 2, height - value * 2); });
    ctx.setLineDash([Math.max(8, width / 120), Math.max(6, width / 180)]); ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
  }
  ctx.restore();
}

function readableText(hex: string) {
  const color = hex.replace("#", "");
  const r = parseInt(color.slice(0, 2), 16),
    g = parseInt(color.slice(2, 4), 16),
    b = parseInt(color.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.56 ? "#090909" : "#ffffff";
}

function rowLetters(index: number) {
  let value = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) value = String.fromCharCode(65 + ((n - 1) % 26)) + value;
  return value;
}

function drawCabinets(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig) {
  const cols = Math.max(1, Math.round((config.wallWidth * 1000) / config.cabinetWidth)),
    rows = Math.max(1, Math.round((config.wallHeight * 1000) / config.cabinetHeight));
  const cellW = width / cols,
    cellH = height / rows;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) {
      const x = col * cellW,
        y = row * cellH;
      const color = CABINET_PALETTE[(col * 5 + row * 7) % CABINET_PALETTE.length];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellW + 1, cellH + 1);
      ctx.strokeStyle = "rgba(0,0,0,.72)";
      ctx.lineWidth = Math.max(1, width / 1800);
      ctx.strokeRect(x, y, cellW, cellH);
      const fontSize = clamp(Math.min(cellW, cellH) * 0.32, 9, 72);
      ctx.fillStyle = readableText(color);
      ctx.font = `800 ${fontSize}px Geist, sans-serif`;
      ctx.fillText(`${rowLetters(row)}${col + 1}`, x + cellW / 2, y + cellH / 2);
    }
}

function drawBasicPattern(ctx: CanvasRenderingContext2D, width: number, height: number, type: PatternType) {
  if (type === "color") {
    const colors = ["#fff", "#ff0", "#0ff", "#0f0", "#f0f", "#f00", "#00f", "#000"];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect((i * width) / colors.length, 0, width / colors.length + 1, height);
    });
  } else if (type === "gray") {
    for (let i = 0; i < 16; i += 1) {
      const v = Math.round((i / 15) * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect((i * width) / 16, 0, width / 16 + 1, height * 0.62);
    }
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#000");
    gradient.addColorStop(1, "#fff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.62, width, height * 0.38);
  } else {
    const tile = document.createElement("canvas");
    tile.width = 2;
    tile.height = 2;
    const tileContext = tile.getContext("2d");
    if (!tileContext) return;
    tileContext.fillStyle = "#fff";
    tileContext.fillRect(0, 0, 2, 2);
    tileContext.fillStyle = "#000";
    tileContext.fillRect(1, 0, 1, 1);
    tileContext.fillRect(0, 1, 1, 1);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }
}

function drawProjectionBase(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig) {
  ctx.fillStyle = "#050708";
  ctx.fillRect(0, 0, width, height);
  if (config.showPatternCheckerboard) drawChecker(ctx, { x: 0, y: 0, width, height, points: [] }, config, config.checkerColorA, config.checkerColorB);
  if (config.pattern === "cabinet") drawCabinets(ctx, width, height, config);
  else if (config.pattern !== "metric") drawBasicPattern(ctx, width, height, config.pattern);
}

function projectionLineWidth(width: number, config: PatternConfig, major = false) {
  return Math.max(1, width / (major ? 900 : 1800)) * clamp(config.lineWidth, 1, 12);
}

function drawTextOnDomeArc(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, radius: number, azimuthDegrees: number, font: string, color: string) {
  if (!text || radius <= 1) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const glyphs = Array.from(text),
    widths = glyphs.map((glyph) => Math.max(1, ctx.measureText(glyph).width)),
    totalAngle = widths.reduce((sum, width) => sum + width, 0) / radius,
    centreAngle = ((azimuthDegrees - 90) * Math.PI) / 180;
  // Canvas angles increase clockwise. Traverse the arc in the opposite direction
  // so text reads left-to-right instead of appearing mirrored on the dome.
  let angle = centreAngle + totalAngle / 2;
  glyphs.forEach((glyph, index) => {
    const glyphAngle = widths[index] / radius;
    angle -= glyphAngle / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
    angle -= glyphAngle / 2;
  });
  ctx.restore();
}

function drawDomeRadialLabel(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, radius: number, azimuthDegrees: number, font: string, color: string, alpha = 1) {
  const angle = ((azimuthDegrees - 90) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  // Every label faces away from the dome centre.
  // Top text therefore points toward the top, side text toward its side, and
  // bottom text remains upright when viewed from the front of the pattern.
  ctx.rotate(angle - Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

type DomeLogoPatch = { canvas: HTMLCanvasElement; x: number; y: number; width: number; height: number };
const domeLogoPatchCache = new WeakMap<HTMLImageElement, Map<string, DomeLogoPatch>>();

function signedAngleDelta(angle: number, centre: number) {
  return Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));
}

function buildDomeLogoPatch(logo: HTMLImageElement, domeRadius: number, azimuthDegrees: number, elevationDegrees: number, angularWidthDegrees: number, scalePercent: number) {
  const effectiveAngularWidth = clamp(angularWidthDegrees * clamp(scalePercent, 25, 200) / 100, 9, 72),
    centreAngle = ((azimuthDegrees - 90) * Math.PI) / 180,
    angularWidth = (effectiveAngularWidth * Math.PI) / 180,
    patchRadius = Math.max(domeRadius * 0.12, domeRadius * (1 - clamp(elevationDegrees, 0, 90) / 90)),
    arcWidth = patchRadius * angularWidth,
    patchHeight = Math.min(domeRadius * 0.42, arcWidth * (logo.naturalHeight / logo.naturalWidth)),
    innerRadius = Math.max(0, patchRadius - patchHeight / 2),
    outerRadius = Math.min(domeRadius, patchRadius + patchHeight / 2),
    key = [Math.round(domeRadius * 10), azimuthDegrees.toFixed(3), elevationDegrees.toFixed(3), effectiveAngularWidth.toFixed(3), logo.naturalWidth, logo.naturalHeight].join(":");
  let cache = domeLogoPatchCache.get(logo);
  if (!cache) {
    cache = new Map();
    domeLogoPatchCache.set(logo, cache);
  }
  const cached = cache.get(key);
  if (cached) return cached;

  const points: Point[] = [];
  for (let step = 0; step <= 96; step += 1) {
    const angle = centreAngle - angularWidth / 2 + angularWidth * step / 96;
    points.push({ x: Math.cos(angle) * innerRadius, y: Math.sin(angle) * innerRadius });
    points.push({ x: Math.cos(angle) * outerRadius, y: Math.sin(angle) * outerRadius });
  }
  const left = Math.floor(Math.min(...points.map((point) => point.x))) - 2,
    top = Math.floor(Math.min(...points.map((point) => point.y))) - 2,
    right = Math.ceil(Math.max(...points.map((point) => point.x))) + 2,
    bottom = Math.ceil(Math.max(...points.map((point) => point.y))) + 2,
    patchCanvas = document.createElement("canvas"),
    // The polar logo texture is independently sampled and then composited onto
    // the native canvas. Bounding only this texture prevents large uploaded
    // logos from blocking the controls; grid and text overlays remain native.
    rasterScale = Math.min(1, 1024 / Math.max(right - left, bottom - top));
  patchCanvas.width = Math.max(1, Math.ceil((right - left) * rasterScale));
  patchCanvas.height = Math.max(1, Math.ceil((bottom - top) * rasterScale));
  const patchContext = patchCanvas.getContext("2d", { alpha: true, willReadFrequently: true }),
    sourceCanvas = document.createElement("canvas");
  if (!patchContext) return { canvas: patchCanvas, x: left, y: top, width: right - left, height: bottom - top };
  const sourceScale = Math.min(1, 2048 / Math.max(logo.naturalWidth, logo.naturalHeight));
  sourceCanvas.width = Math.max(1, Math.round(logo.naturalWidth * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(logo.naturalHeight * sourceScale));
  const sourceContext = sourceCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!sourceContext) return { canvas: patchCanvas, x: left, y: top, width: right - left, height: bottom - top };
  sourceContext.drawImage(logo, 0, 0);
  const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height),
    output = patchContext.createImageData(patchCanvas.width, patchCanvas.height),
    sourceData = source.data,
    outputData = output.data;
  for (let py = 0; py < patchCanvas.height; py += 1) {
    const logicalY = top + (py + 0.5) / rasterScale;
    for (let px = 0; px < patchCanvas.width; px += 1) {
      const logicalX = left + (px + 0.5) / rasterScale,
        radius = Math.hypot(logicalX, logicalY),
        delta = signedAngleDelta(Math.atan2(logicalY, logicalX), centreAngle),
        // At the lower hemisphere, positive angular deltas are screen-left.
        // Mapping them to the left side of the source keeps logos readable.
        u = 0.5 - delta / angularWidth,
        v = 0.5 + (radius - patchRadius) / patchHeight;
      if (u < 0 || u > 1 || v < 0 || v > 1 || radius > domeRadius) continue;
      const sourceX = u * (source.width - 1),
        sourceY = v * (source.height - 1),
        x0 = Math.floor(sourceX),
        y0 = Math.floor(sourceY),
        x1 = Math.min(source.width - 1, x0 + 1),
        y1 = Math.min(source.height - 1, y0 + 1),
        tx = sourceX - x0,
        ty = sourceY - y0,
        weight00 = (1 - tx) * (1 - ty),
        weight10 = tx * (1 - ty),
        weight01 = (1 - tx) * ty,
        weight11 = tx * ty,
        index00 = (y0 * source.width + x0) * 4,
        index10 = (y0 * source.width + x1) * 4,
        index01 = (y1 * source.width + x0) * 4,
        index11 = (y1 * source.width + x1) * 4,
        outputIndex = (py * patchCanvas.width + px) * 4;
      for (let channel = 0; channel < 4; channel += 1)
        outputData[outputIndex + channel] = Math.round(sourceData[index00 + channel] * weight00 + sourceData[index10 + channel] * weight10 + sourceData[index01 + channel] * weight01 + sourceData[index11 + channel] * weight11);
    }
  }
  patchContext.putImageData(output, 0, 0);
  const result = { canvas: patchCanvas, x: left, y: top, width: right - left, height: bottom - top };
  if (cache.size >= 4) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}

function drawLogoOnDome(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, cy: number, domeRadius: number, azimuthDegrees: number, elevationDegrees: number, angularWidthDegrees: number, scalePercent: number, opacity: number) {
  if (!logo?.complete || !logo.naturalWidth || !logo.naturalHeight || typeof document === "undefined") return;
  const patch = buildDomeLogoPatch(logo, domeRadius, azimuthDegrees, elevationDegrees, angularWidthDegrees, scalePercent);
  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 100) / 100;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(patch.canvas, cx + patch.x, cy + patch.y, patch.width, patch.height);
  ctx.restore();
}

function drawDomePattern(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig, logo: HTMLImageElement | null) {
  const cx = width / 2,
    cy = height / 2,
    fine = Math.max(1, width / 1800),
    major = Math.max(2, width / 900),
    radius = Math.max(1, Math.min(width, height) / 2 - major * 1.5),
    opacity = clamp(config.domeLineOpacity, 0, 100) / 100,
    ringCount = Math.round(clamp(config.domeRingCount, 4, 90)),
    ringWeight = config.domeRingWeight === "bold" ? 2.2 : config.domeRingWeight === "medium" ? 1.5 : 1,
    degreeStep = clamp(config.domeDegreeStep, 1.5, 90);
  ctx.clearRect(0, 0, width, height);
  if (config.domeBackground !== "transparent") {
    ctx.fillStyle = "#030405";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (config.domeBackground === "grayscale") {
    const background = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    background.addColorStop(0, "#ffffff");
    background.addColorStop(0.52, "#777777");
    background.addColorStop(1, "#000000");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else if (config.domeBackground === "spectrum" || config.domeBackground === "uv") {
    const background = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    [[0, "#ff304f"], [1 / 6, "#ffd43b"], [2 / 6, "#39e67a"], [3 / 6, "#33d7ff"], [4 / 6, "#4467ff"], [5 / 6, "#d84cff"], [1, "#ff304f"]].forEach(([stop, color]) => background.addColorStop(Number(stop), String(color)));
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else if (config.domeBackground === "custom") {
    ctx.fillStyle = config.domeBackgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  if (config.domeBackground === "uv") {
    const uvShade = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    uvShade.addColorStop(0, "rgba(255,255,255,.95)");
    uvShade.addColorStop(0.55, "rgba(255,255,255,.1)");
    uvShade.addColorStop(1, "rgba(0,0,0,.65)");
    ctx.fillStyle = uvShade;
    ctx.fillRect(0, 0, width, height);
  }
  if (config.domeShowRings)
    for (let ring = 1; ring <= ringCount; ring += 1) {
      const ringRadius = radius * (ring / ringCount),
        isMajor = ring % Math.max(1, Math.round(ringCount / 9)) === 0;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = config.domeRingColor;
      ctx.globalAlpha = opacity * (isMajor ? 0.95 : 0.48);
      ctx.lineWidth = (isMajor ? major : fine) * ringWeight;
      ctx.stroke();
    }
  ctx.globalAlpha = 1;
  if (config.domeShowGrid)
    for (let degrees = 0; degrees < 360 - degreeStep / 2; degrees += degreeStep) {
      const angle = ((degrees - 90) * Math.PI) / 180,
        isMajor = Math.abs(degrees % 45) < 0.001;
      line(ctx, cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, isMajor ? config.domeAxisColor : config.domeGridColor, isMajor ? major : fine, opacity * (isMajor ? 0.95 : 0.5));
    }
  line(ctx, cx - radius, cy, cx + radius, cy, config.domeAxisColor, major, opacity);
  line(ctx, cx, cy - radius, cx, cy + radius, config.domeAxisColor, major, opacity);
  if (config.domeShowSafeArea) {
    ctx.beginPath();
    ctx.setLineDash([width / 90, width / 170]);
    ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = config.domeSafeAreaColor;
    ctx.lineWidth = major;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  if (config.domeBorder) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = config.domeGridColor;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = major * 1.4 * ringWeight;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (config.domeShowLabels) {
    // Dome typography must scale with the native raster. Fixed upper caps made
    // labels proportionally smaller at 6K/8K even though the geometry grew.
    const cardinalSize = Math.max(20, width / 38),
      detailSize = Math.max(12, width / 95),
      elevationSize = Math.max(11, width / 72),
      degreeLabelSize = Math.max(13, width / 42);
    ctx.fillStyle = config.domeLabelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${cardinalSize}px Geist, sans-serif`;
    if (config.domeCompass)
      [["BACK", 0], ["RIGHT", 90], ["FRONT", 180], ["LEFT", 270]].forEach(([label, azimuth]) =>
        drawDomeRadialLabel(ctx, String(label), cx, cy, radius * 0.89, Number(azimuth), `800 ${cardinalSize}px Geist, sans-serif`, config.domeLabelColor),
      );
    ctx.font = `700 ${detailSize}px Geist, sans-serif`;
    if (config.domeElevationAngles) {
      const elevationFont = `700 ${elevationSize}px Geist, sans-serif`;
      for (let elevation = 10; elevation < 90; elevation += 10) {
        const elevationRadius = radius * (1 - elevation / 90);
        [0, 90, 180, 270].forEach((azimuth) =>
          drawDomeRadialLabel(ctx, `${elevation}°`, cx, cy, elevationRadius, azimuth, elevationFont, config.domeLabelColor, 0.78),
        );
      }
    }
    if (config.domeDegreeLabels) {
      const labelStep = Math.max(10, degreeStep);
      ctx.font = `700 ${degreeLabelSize}px Geist, sans-serif`;
      for (let degree = 0; degree < 360 - labelStep / 2; degree += labelStep) {
        const isCardinal = Math.abs(degree % 90) < 0.001;
        if (config.domeCompass && isCardinal) continue;
        drawTextOnDomeArc(ctx, `${round(degree, 1)}°`, cx, cy, radius * 0.95, degree, `700 ${degreeLabelSize}px Geist, sans-serif`, config.domeAxisColor);
      }
    }
    drawTextOnDomeArc(ctx, config.domePatternName || "Dome", cx, cy, radius * 0.5, 180, `800 ${Math.max(22, width / 34)}px Geist, sans-serif`, "#ffffff");
    drawTextOnDomeArc(ctx, `${width} × ${height} PX`, cx, cy, radius * 0.61, 180, `700 ${detailSize}px Geist, sans-serif`, config.domeGridColor);
  }
  if (config.domeShowCenterDot) {
    ctx.fillStyle = config.domeCenterDotColor;
    ctx.beginPath();
    ctx.arc(cx, cy, normalizeCenterDotSize(config.domeCenterDotSize) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (config.domeShowLogo) drawLogoOnDome(ctx, logo, cx, cy, radius, config.domeLogoAzimuth, config.domeLogoElevation, DEFAULT_CONFIG.domeLogoAngularWidth, config.domeLogoScale, config.domeLogoOpacity);
}

type CubemapAtlasPoint = { face: CubemapFaceKey; x: number; y: number };

function projectCubemapDirection(direction: Vector3, faceSize: number, placements: Map<CubemapFaceKey, { x: number; y: number }>): CubemapAtlasPoint {
  const projected = directionToCubemapFaceUv(direction), placement = placements.get(projected.face)!;
  return {
    face: projected.face,
    x: placement.x * faceSize + (projected.u + 1) * faceSize / 2,
    y: placement.y * faceSize + (projected.v + 1) * faceSize / 2,
  };
}

function drawCubemapDirectionalPath(ctx: CanvasRenderingContext2D, directions: Vector3[], faceSize: number, placements: Map<CubemapFaceKey, { x: number; y: number }>, color: string, width: number, alpha: number) {
  let previous: CubemapAtlasPoint | null = null;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "square";
  ctx.lineJoin = "round";
  directions.forEach((direction) => {
    const point = projectCubemapDirection(direction, faceSize, placements);
    if (!previous || previous.face !== point.face) {
      if (previous) ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else ctx.lineTo(point.x, point.y);
    previous = point;
  });
  if (previous) ctx.stroke();
  ctx.restore();
}

function drawCubemapFaceBackground(ctx: CanvasRenderingContext2D, face: CubemapFaceKey, x: number, y: number, size: number, pattern: PatternType) {
  const sampleSize = Math.min(512, Math.max(256, Math.round(size / 4))), sample = document.createElement("canvas");
  sample.width = sampleSize;
  sample.height = sampleSize;
  const sampleContext = sample.getContext("2d");
  if (!sampleContext) return;
  const pixels = sampleContext.createImageData(sampleSize, sampleSize);
  for (let py = 0; py < sampleSize; py += 1) for (let px = 0; px < sampleSize; px += 1) {
    const direction = cubemapFaceUvToDirection(face, (px + .5) / sampleSize * 2 - 1, (py + .5) / sampleSize * 2 - 1),
      offset = (py * sampleSize + px) * 4;
    if (pattern === "color") {
      const color = face.endsWith("X") ? [255, 36, 42] : face.endsWith("Y") ? [22, 222, 62] : [35, 74, 255];
      pixels.data[offset] = color[0];
      pixels.data[offset + 1] = color[1];
      pixels.data[offset + 2] = color[2];
    } else if (pattern === "gray") {
      const value = Math.round((direction.y + 1) * 127.5);
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
    } else if (pattern === "pixel") {
      const value = ((Math.floor(px / 4) + Math.floor(py / 4)) & 1) === 0 ? 255 : 0;
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
    } else {
      const aboveHorizon = direction.y >= 0,
        amount = Math.pow(Math.abs(direction.y), .55),
        horizon = aboveHorizon ? [91, 139, 181] : [73, 76, 72],
        extreme = aboveHorizon ? [12, 34, 65] : [13, 16, 18],
        haze = Math.exp(-Math.abs(direction.y) * 18) * 24;
      pixels.data[offset] = Math.round(horizon[0] * (1 - amount) + extreme[0] * amount + haze);
      pixels.data[offset + 1] = Math.round(horizon[1] * (1 - amount) + extreme[1] * amount + haze);
      pixels.data[offset + 2] = Math.round(horizon[2] * (1 - amount) + extreme[2] * amount + haze);
    }
    pixels.data[offset + 3] = 255;
  }
  sampleContext.putImageData(pixels, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = pattern !== "pixel";
  ctx.drawImage(sample, x, y, size, size);
  ctx.restore();
}

function cubemapDirectionFromPoint(x: number, y: number, z: number): Vector3 {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function drawCubemapPerspectiveGrid(ctx: CanvasRenderingContext2D, faceSize: number, placements: Map<CubemapFaceKey, { x: number; y: number }>, color: string, width: number, density: number) {
  const halfExtent = 12,
    spacing = density <= 5 ? 1 : density <= 15 ? 2 : 3,
    samples = 480;
  for (let position = -halfExtent; position <= halfExtent; position += spacing) {
    const alongX: Vector3[] = [], alongZ: Vector3[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const value = -halfExtent + index / samples * halfExtent * 2;
      alongX.push(cubemapDirectionFromPoint(value, -1, position));
      alongZ.push(cubemapDirectionFromPoint(position, -1, value));
    }
    drawCubemapDirectionalPath(ctx, alongX, faceSize, placements, color, position === 0 ? width * 1.8 : width, position === 0 ? .9 : .54);
    drawCubemapDirectionalPath(ctx, alongZ, faceSize, placements, color, position === 0 ? width * 1.8 : width, position === 0 ? .9 : .54);
  }
}

function drawImageTriangle(ctx: CanvasRenderingContext2D, image: CanvasImageSource, source: [Point, Point, Point], destination: [Point, Point, Point]) {
  const [s0, s1, s2] = source, [d0, d1, d2] = destination,
    denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 1e-8) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator,
    b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator,
    c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator,
    d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator,
    e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator,
    f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawCubemapDirectionalLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, faceSize: number, placements: Map<CubemapFaceKey, { x: number; y: number }>, config: PatternConfig) {
  if (!config.cubemapShowLogo || !logo?.complete || !logo.naturalWidth || !logo.naturalHeight) return;
  const azimuth = config.cubemapLogoAzimuth * Math.PI / 180,
    elevation = config.cubemapLogoElevation * Math.PI / 180,
    centre = directionFromAzimuthElevation(config.cubemapLogoAzimuth, config.cubemapLogoElevation),
    right = { x: Math.cos(azimuth), y: 0, z: Math.sin(azimuth) },
    up = { x: -Math.sin(azimuth) * Math.sin(elevation), y: Math.cos(elevation), z: Math.cos(azimuth) * Math.sin(elevation) },
    halfWidth = Math.tan(clamp(config.cubemapLogoAngularWidth, 5, 120) * Math.PI / 360),
    halfHeight = halfWidth * logo.naturalHeight / logo.naturalWidth,
    columns = 48,
    rows = Math.max(8, Math.round(columns * logo.naturalHeight / logo.naturalWidth)),
    vertex = (column: number, row: number) => {
      const u = column / columns, v = row / rows,
        sx = (u * 2 - 1) * halfWidth,
        sy = (1 - v * 2) * halfHeight,
        x = centre.x + right.x * sx + up.x * sy,
        y = centre.y + right.y * sx + up.y * sy,
        z = centre.z + right.z * sx + up.z * sy,
        length = Math.hypot(x, y, z) || 1;
      return { source: { x: u * logo.naturalWidth, y: v * logo.naturalHeight }, target: projectCubemapDirection({ x: x / length, y: y / length, z: z / length }, faceSize, placements) };
    };
  ctx.save();
  ctx.globalAlpha = clamp(config.cubemapLogoOpacity, 0, 100) / 100;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = vertex(column, row), b = vertex(column + 1, row), c = vertex(column, row + 1), d = vertex(column + 1, row + 1);
    if (a.target.face === b.target.face && b.target.face === c.target.face) drawImageTriangle(ctx, logo, [a.source, b.source, c.source], [a.target, b.target, c.target]);
    if (b.target.face === d.target.face && d.target.face === c.target.face) drawImageTriangle(ctx, logo, [b.source, d.source, c.source], [b.target, d.target, c.target]);
  }
  ctx.restore();
}

function drawCubemapPattern(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig, logo: HTMLImageElement | null) {
  const { face: faceSize } = cubemapAtlasDimensions(config.cubemapResolution, config.cubemapLayout),
    faces = cubemapFacePlacements(config.cubemapLayout),
    placements = new Map(faces.map((face) => [face.key, { x: face.x, y: face.y }])),
    fine = Math.max(1, config.lineWidth * faceSize / 2048),
    major = fine * 2;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  faces.forEach((face) => drawCubemapFaceBackground(ctx, face.key, face.x * faceSize, face.y * faceSize, faceSize, config.pattern));
  const occupiedCells = new Set(faces.map((face) => `${face.x}:${face.y}`)),
    layoutSize = cubemapLayoutSize(config.cubemapLayout);
  ctx.fillStyle = "#000";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  for (let row = 0; row < layoutSize.rows; row += 1) for (let column = 0; column < layoutSize.columns; column += 1)
    if (!occupiedCells.has(`${column}:${row}`)) ctx.fillRect(column * faceSize, row * faceSize, faceSize, faceSize);

  if (config.cubemapShowGrid && config.pattern !== "color") {
    drawCubemapPerspectiveGrid(ctx, faceSize, placements, config.metricGridColor, fine, config.cubemapGridStep);
  }

  if (config.cubemapShowSeams) faces.forEach((face) => {
    ctx.strokeStyle = config.safeAreaColor;
    ctx.lineWidth = major;
    ctx.strokeRect(face.x * faceSize, face.y * faceSize, faceSize, faceSize);
  });

  if (config.cubemapShowFaceLabels) faces.forEach((face) => {
    const x = (face.x + .5) * faceSize, y = (face.y + .5) * faceSize;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (config.pattern !== "color") {
      ctx.fillStyle = "rgba(0,0,0,.58)";
      ctx.fillRect(x - faceSize * .17, y - faceSize * .075, faceSize * .34, faceSize * .15);
    }
    ctx.fillStyle = config.pattern === "color" ? (face.key.endsWith("Z") ? "#fff" : "#050505") : config.labelColor;
    ctx.font = `800 ${config.pattern === "color" ? clamp(faceSize / 7, 32, 300) : clamp(faceSize / 16, 18, 86)}px Geist, sans-serif`;
    ctx.fillText(face.key.replace("-", "−"), x, y - faceSize * .018);
    ctx.fillStyle = config.pattern === "color" ? (face.key.endsWith("Z") ? "#fff" : "#050505") : "#fff";
    ctx.font = `700 ${config.pattern === "color" ? clamp(faceSize / 28, 13, 72) : clamp(faceSize / 42, 11, 38)}px Geist, sans-serif`;
    ctx.fillText(face.name, x, y + faceSize * .045);
    ctx.restore();
  });

  drawCubemapDirectionalLogo(ctx, logo, faceSize, placements, config);
}

function drawPanoramicPattern(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig, logo: HTMLImageElement | null, cylindrical: boolean) {
  const fine = projectionLineWidth(width, config),
    major = projectionLineWidth(width, config, true),
    title = cylindrical ? "CYLINDRICAL 360°" : "EQUIRECTANGULAR 360° × 180°";
  drawProjectionBase(ctx, width, height, config);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(0, 0, width, height);
  for (let longitude = 0; longitude <= 360; longitude += 15) {
    const x = (longitude / 360) * width,
      isMajor = longitude % 90 === 0;
    line(ctx, x, 0, x, height, isMajor ? config.diagonalColor : config.metricGridColor, isMajor ? major : fine, isMajor ? 0.95 : 0.55);
  }
  for (let latitude = -90; latitude <= 90; latitude += 15) {
    const y = ((90 - latitude) / 180) * height,
      isMajor = latitude === 0 || latitude % 45 === 0;
    line(ctx, 0, y, width, y, isMajor ? config.diagonalColor : config.metricGridColor, isMajor ? major : fine, isMajor ? 0.95 : 0.55);
  }
  if (config.showDiagonals) {
    line(ctx, 0, 0, width, height, config.diagonalColor, fine, 0.55);
    line(ctx, width, 0, 0, height, config.diagonalColor, fine, 0.55);
  }
  if (config.showCircles)
    [0.25, 0.5, 0.75].forEach((fraction) => {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * fraction * 0.48, 0, Math.PI * 2);
      ctx.strokeStyle = config.circleColor;
      ctx.lineWidth = fine;
      ctx.stroke();
    });
  if (config.showSafeArea) {
    ctx.save();
    ctx.setLineDash([width / 90, width / 170]);
    ctx.strokeStyle = config.safeAreaColor;
    ctx.lineWidth = major;
    ctx.strokeRect(width * 0.025, height * 0.05, width * 0.95, height * 0.9);
    ctx.restore();
  }
  if (config.showLabels) {
    const headingSize = clamp(width / 52, 18, 72),
      detailSize = clamp(width / 115, 11, 36);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${headingSize}px Geist, sans-serif`;
    ctx.fillStyle = config.labelColor;
    [["N · 0°", 0], ["E · 90°", 90], ["S · 180°", 180], ["W · 270°", 270], ["N · 360°", 360]].forEach(([label, degree]) => ctx.fillText(String(label), (Number(degree) / 360) * width, height * 0.51));
    ctx.font = `700 ${detailSize}px Geist, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(title, width / 2, detailSize * 1.6);
    ctx.fillText(cylindrical ? "TOP" : "NORTH POLE · +90°", width / 2, detailSize * 3.1);
    ctx.fillText(cylindrical ? "BOTTOM" : "SOUTH POLE · −90°", width / 2, height - detailSize * 1.5);
    ctx.fillStyle = config.safeAreaColor;
    ctx.fillText("SEAM", detailSize * 1.8, height * 0.12);
    ctx.fillText("SEAM", width - detailSize * 1.8, height * 0.12);
  }
  ctx.strokeStyle = config.metricGridColor;
  ctx.lineWidth = major;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  if (config.showLogo) drawLogo(ctx, logo, 0, 0, width, height, config.customLogoScale, config.customLogoOpacity, config.customLogoPosition);
}

function drawProjectionPattern(ctx: CanvasRenderingContext2D, width: number, height: number, config: PatternConfig, logo: HTMLImageElement | null) {
  if (config.projectionFormat === "dome") drawDomePattern(ctx, width, height, config, logo);
  else if (config.projectionFormat === "cubemap") drawCubemapPattern(ctx, width, height, config, logo);
  else if (config.projectionFormat === "equirectangular") drawPanoramicPattern(ctx, width, height, config, logo, false);
  else if (config.projectionFormat === "cylindrical") drawPanoramicPattern(ctx, width, height, config, logo, true);
}

function bounds(points: Point[]): Rect {
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
    points,
  };
}
function parsePoints(node: Element | null): Point[] {
  if (!node) return [];
  return Array.from(node.children)
    .filter((child) => child.tagName === "v")
    .map((child) => ({
      x: Number(child.getAttribute("x")),
      y: Number(child.getAttribute("y")),
    }));
}

function parseResolumeXml(xml: string): ResolumeMap {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This file is not valid Resolume XML.");
  const setup = doc.querySelector("ScreenSetup"),
    composition = setup?.querySelector("CurrentCompositionTextureSize");
  if (!setup || !composition) throw new Error("No Advanced Output setup was found in this XML file.");
  const screenContainer = Array.from(setup.children).find((child) => child.tagName === "screens"),
    screenNodes = screenContainer ? Array.from(screenContainer.children).filter((child) => child.tagName === "Screen") : [];
  const screens = screenNodes.map((screenNode, screenIndex): ResolumeScreen => {
    const params = Array.from(screenNode.querySelectorAll("Param")).find((param) => param.getAttribute("name") === "Name"),
      screenName = params?.getAttribute("value") || screenNode.getAttribute("name") || `Screen ${screenIndex + 1}`;
    const device = screenNode.querySelector("OutputDeviceVirtual") || screenNode.querySelector("OutputDevice"),
      layers = Array.from(screenNode.children).find((child) => child.tagName === "layers"),
      sliceNodes = layers ? Array.from(layers.children).filter((child) => child.tagName === "Slice") : [];
    const slices = sliceNodes.map((sliceNode, sliceIndex): ResolumeSlice => {
      const nameParam = Array.from(sliceNode.querySelectorAll("Param")).find((param) => param.getAttribute("name") === "Name"),
        inputPoints = parsePoints(sliceNode.querySelector("InputRect")),
        outputPoints = parsePoints(sliceNode.querySelector("OutputRect"));
      if (inputPoints.length < 4 || outputPoints.length < 4) throw new Error(`Slice ${sliceIndex + 1} has incomplete geometry.`);
      const bezier = Array.from(sliceNode.querySelectorAll("BezierWarper > vertices > v")).map((point) => ({
          x: Number(point.getAttribute("x")),
          y: Number(point.getAttribute("y")),
        })),
        corners = bezier.length === 16 ? [bezier[0], bezier[3], bezier[15], bezier[12]] : [],
        warped = corners.length === 4 && corners.some((point, i) => Math.abs(point.x - outputPoints[i].x) > 0.01 || Math.abs(point.y - outputPoints[i].y) > 0.01);
      return {
        id: sliceNode.getAttribute("uniqueId") || `${screenIndex}-${sliceIndex}`,
        name: nameParam?.getAttribute("value") || `Slice ${sliceIndex + 1}`,
        screenName,
        input: bounds(inputPoints),
        output: bounds(outputPoints),
        warped,
        paletteIndex: screenIndex * 17 + sliceIndex,
      };
    });
    return {
      name: screenName,
      width: Number(device?.getAttribute("width")) || Math.ceil(Math.max(1, ...slices.map((slice) => slice.output.x + slice.output.width))),
      height: Number(device?.getAttribute("height")) || Math.ceil(Math.max(1, ...slices.map((slice) => slice.output.y + slice.output.height))),
      slices,
    };
  });
  const version = doc.querySelector("versionInfo");
  return {
    name: doc.documentElement.getAttribute("name") || "Resolume Map",
    compositionWidth: Number(composition.getAttribute("width")),
    compositionHeight: Number(composition.getAttribute("height")),
    version: version ? `${version.getAttribute("majorVersion")}.${version.getAttribute("minorVersion")}.${version.getAttribute("microVersion")}` : "Unknown",
    screens,
  };
}

function hexHue(hex: string) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16) / 255,
    green = parseInt(value.slice(2, 4), 16) / 255,
    blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue),
    min = Math.min(red, green, blue),
    delta = max - min;
  if (!delta) return 0;
  const raw = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (raw * 60 + 360) % 360;
}

function automaticSliceColors(slice: ResolumeSlice, config: PatternConfig) {
  const hue = (hexHue(config.checkerColorA) + slice.paletteIndex * 47) % 360;
  const toHex = (saturation: number, lightness: number) => {
    const s = saturation / 100,
      l = lightness / 100,
      chroma = (1 - Math.abs(2 * l - 1)) * s,
      part = chroma * (1 - Math.abs(((hue / 60) % 2) - 1)),
      match = l - chroma / 2;
    const [red, green, blue] = hue < 60 ? [chroma, part, 0] : hue < 120 ? [part, chroma, 0] : hue < 180 ? [0, chroma, part] : hue < 240 ? [0, part, chroma] : hue < 300 ? [part, 0, chroma] : [chroma, 0, part];
    return `#${[red, green, blue]
      .map((value) =>
        Math.round((value + match) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  };
  return { colorA: toHex(92, 52), colorB: toHex(88, 25) };
}

function drawCabinetIdsRect(ctx: CanvasRenderingContext2D, rect: Rect, config: PatternConfig, originX: number, originY: number) {
  const panel = cabinetPixels(config),
    startCol = Math.floor((rect.x - originX) / panel.width),
    startRow = Math.floor((rect.y - originY) / panel.height);
  for (let row = startRow; originY + row * panel.height < rect.y + rect.height; row += 1)
    for (let col = startCol; originX + col * panel.width < rect.x + rect.width; col += 1) {
      const x = originX + col * panel.width,
        y = originY + row * panel.height,
        color = CABINET_PALETTE[(col * 5 + row * 7 + 1200) % CABINET_PALETTE.length];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, panel.width, panel.height);
      ctx.strokeStyle = "rgba(0,0,0,.75)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, panel.width, panel.height);
      const fontSize = clamp(Math.min(panel.width, panel.height) * 0.26, 8, 48);
      ctx.fillStyle = readableText(color);
      ctx.font = `800 ${fontSize}px Geist, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rowLetters(Math.max(0, row))}${Math.max(0, col) + 1}`, x + panel.width / 2, y + panel.height / 2);
    }
}

function drawMapFill(ctx: CanvasRenderingContext2D, rect: Rect, width: number, height: number, config: PatternConfig, settings: PatternConfig & SliceOverride) {
  const local = config.mapPatternScope === "slice",
    fillConfig = local ? settings : config,
    originX = local ? rect.x : 0,
    originY = local ? rect.y : 0,
    patternWidth = local ? rect.width : width,
    patternHeight = local ? rect.height : height;
  if (config.mapFill === "checker") {
    if (settings.showCheckerboard) drawChecker(ctx, rect, fillConfig, settings.checkerColorA, settings.checkerColorB);
  } else if (config.mapFill === "cabinet") drawCabinetIdsRect(ctx, rect, fillConfig, originX, originY);
  else if (config.mapFill === "color") {
    ["#fff", "#ff0", "#0ff", "#0f0", "#f0f", "#f00", "#00f", "#000"].forEach((color, index, colors) => {
      ctx.fillStyle = color;
      ctx.fillRect(originX + (index * patternWidth) / colors.length, originY, patternWidth / colors.length + 1, patternHeight);
    });
  } else if (config.mapFill === "gray") {
    for (let index = 0; index < 16; index += 1) {
      const value = Math.round((index / 15) * 255);
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(originX + (index * patternWidth) / 16, originY, patternWidth / 16 + 1, patternHeight);
    }
  } else if (config.mapFill === "pixel") {
    const tile = document.createElement("canvas");
    tile.width = 2;
    tile.height = 2;
    const tileContext = tile.getContext("2d");
    if (tileContext) {
      tileContext.fillStyle = "#fff";
      tileContext.fillRect(0, 0, 2, 2);
      tileContext.fillStyle = "#000";
      tileContext.fillRect(1, 0, 1, 1);
      tileContext.fillRect(0, 1, 1, 1);
      const pattern = ctx.createPattern(tile, "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
  } else {
    ctx.fillStyle = "#050505";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    const panel = cabinetPixels(fillConfig);
    for (let x = originX; x <= originX + patternWidth; x += panel.width) line(ctx, x, originY, x, originY + patternHeight, settings.metricGridColor, Math.max(1, settings.lineWidth), 0.9);
    for (let y = originY; y <= originY + patternHeight; y += panel.height) line(ctx, originX, y, originX + patternWidth, y, settings.metricGridColor, Math.max(1, settings.lineWidth), 0.9);
    line(ctx, originX, originY + patternHeight / 2, originX + patternWidth, originY + patternHeight / 2, settings.metricGridColor, Math.max(2, settings.lineWidth * 2));
    line(ctx, originX + patternWidth / 2, originY, originX + patternWidth / 2, originY + patternHeight, settings.metricGridColor, Math.max(2, settings.lineWidth * 2));
  }
}

function greatestCommonDivisor(a: number, b: number) {
  let x = Math.max(1, Math.round(a)),
    y = Math.max(1, Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

function positionAnchor(rect: Rect, position: Exclude<InfoPosition, "hidden">, boxWidth: number, boxHeight: number) {
  const pad = Math.max(5, Math.min(rect.width, rect.height) * 0.035),
    left = rect.x + pad,
    right = rect.x + rect.width - pad,
    top = rect.y + pad,
    bottom = rect.y + rect.height - pad;
  const horizontal = position.endsWith("left") ? "left" : position.endsWith("right") ? "right" : "center";
  const vertical = position.startsWith("top") ? "top" : position.startsWith("bottom") ? "bottom" : "center";
  return {
    x: horizontal === "left" ? left + boxWidth / 2 : horizontal === "right" ? right - boxWidth / 2 : rect.x + rect.width / 2,
    y: vertical === "top" ? top + boxHeight / 2 : vertical === "bottom" ? bottom - boxHeight / 2 : rect.y + rect.height / 2,
    horizontal,
  };
}

function drawSliceInformation(ctx: CanvasRenderingContext2D, slice: ResolumeSlice, rect: Rect, settings: PatternConfig & SliceOverride, logoLayout?: { width: number; height: number; position: LogoPosition }): Point | null {
  const divisor = greatestCommonDivisor(rect.width, rect.height),
    physicalW = (rect.width * settings.pixelPitchMm) / 1000,
    physicalH = (rect.height * settings.pixelPitchMm) / 1000;
  const allItems: Array<{
    kind: "name" | "data";
    text: string;
    position: InfoPosition;
    order: number;
  }> = [
    {
      kind: "name",
      text: slice.name,
      position: settings.namePosition,
      order: 0,
    },
    {
      kind: "data",
      text: `${Math.round(rect.x)}, ${Math.round(rect.y)}`,
      position: settings.coordinatesPosition,
      order: 1,
    },
    {
      kind: "data",
      text: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
      position: settings.resolutionPosition,
      order: 2,
    },
    {
      kind: "data",
      text: `${Math.round(rect.width / divisor)}:${Math.round(rect.height / divisor)}`,
      position: settings.aspectPosition,
      order: 3,
    },
    {
      kind: "data",
      text: `${physicalW.toFixed(1)}m × ${physicalH.toFixed(1)}m`,
      position: settings.physicalSizePosition,
      order: 4,
    },
  ];
  const rawItems = settings.showLabels ? allItems.filter((item) => item.position !== "hidden") : [];
  const positions = Array.from(new Set([...rawItems.map((item) => item.position), ...(logoLayout ? [logoLayout.position] : [])])) as Array<Exclude<InfoPosition, "hidden">>;
  let logoCenter: Point | null = null;
  positions.forEach((position) => {
    const source = rawItems.filter((item) => item.position === position).sort((a, b) => a.order - b.order),
      items: Array<{ kind: "name" | "data"; text: string }> = [];
    source.forEach((item) => {
      const last = items.at(-1);
      if (item.order === 2 && last?.kind === "data" && settings.coordinatesPosition === settings.resolutionPosition) last.text += `  //  ${item.text}`;
      else items.push({ kind: item.kind, text: item.text });
    });
    const base = clamp(Math.min(rect.width / 10, rect.height / 4), 12, 52),
      measured = items.map((item) => {
        const fontSize = item.kind === "name" ? (base * settings.labelNameScale) / 100 : Math.max(9, (base * 0.52 * settings.labelDataScale) / 100),
          family = item.kind === "name" ? "Geist, sans-serif" : "Geist, sans-serif",
          weight = item.kind === "name" ? 800 : 700;
        ctx.font = `${weight} ${fontSize}px ${family}`;
        return {
          ...item,
          fontSize,
          family,
          weight,
          width: ctx.measureText(item.text).width + fontSize * 0.9,
          height: fontSize * 1.45,
        };
      });
    const groupWidth = measured.length ? Math.max(...measured.map((item) => item.width)) : 0,
      groupHeight = measured.reduce((sum, item) => sum + item.height, 0),
      angle = settings.infoOrientation === "rotate-90" ? Math.PI / 2 : settings.infoOrientation === "rotate-180" ? Math.PI : settings.infoOrientation === "rotate-270" ? -Math.PI / 2 : 0,
      quarterTurn = Math.abs(angle) === Math.PI / 2,
      infoWidth = quarterTurn ? groupHeight : groupWidth,
      infoHeight = quarterTurn ? groupWidth : groupHeight;
    const includesLogo = logoLayout?.position === position,
      logoWidth = includesLogo ? logoLayout.width : 0,
      logoHeight = includesLogo ? logoLayout.height : 0,
      gap = includesLogo && measured.length ? clamp(Math.min(rect.width, rect.height) * 0.025, 4, 18) : 0;
    const combinedWidth = Math.max(infoWidth, logoWidth),
      combinedHeight = infoHeight + gap + logoHeight,
      anchor = positionAnchor(rect, position, combinedWidth, combinedHeight),
      horizontal = anchor.horizontal;
    const alignedX = (childWidth: number) => (horizontal === "left" ? anchor.x - combinedWidth / 2 + childWidth / 2 : horizontal === "right" ? anchor.x + combinedWidth / 2 - childWidth / 2 : anchor.x);
    const top = anchor.y - combinedHeight / 2;
    if (includesLogo) logoCenter = { x: alignedX(logoWidth), y: top + logoHeight / 2 };
    if (measured.length) {
      const infoCenterX = alignedX(infoWidth),
        infoCenterY = top + logoHeight + gap + infoHeight / 2;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(infoCenterX, infoCenterY);
      ctx.rotate(angle);
      let cursorY = -groupHeight / 2;
      measured.forEach((item, index) => {
        const left = horizontal === "left" ? -groupWidth / 2 : horizontal === "right" ? groupWidth / 2 - item.width : -item.width / 2,
          dark = index % 2 === 0;
        ctx.fillStyle = dark ? "#050505" : "#ffffff";
        ctx.fillRect(left, cursorY, item.width, item.height);
        ctx.fillStyle = dark ? "#ffffff" : "#050505";
        ctx.font = `${item.weight} ${item.fontSize}px ${item.family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.text, left + item.width / 2, cursorY + item.height / 2);
        cursorY += item.height;
      });
      ctx.restore();
    }
  });
  return logoCenter;
}

function drawPixelMap(ctx: CanvasRenderingContext2D, width: number, height: number, slices: ResolumeSlice[], view: MapView, config: PatternConfig, logo: HTMLImageElement | null, overrides: Record<string, SliceOverride>, selectedIds: string[] = [], showSelection = false) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  if (config.backgroundMode === "black") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
  } else ctx.clearRect(0, 0, width, height);
  ctx.restore();
  slices.forEach((slice) => {
    const rect = view === "input" ? slice.input : slice.output,
      override = overrides[slice.id] || {},
      automatic = automaticSliceColors(slice, config);
    const settings = {
      ...config,
      ...override,
      checkerColorA: override.checkerColorA ?? automatic.colorA,
      checkerColorB: override.checkerColorB ?? automatic.colorB,
    };
    ctx.save();
    ctx.beginPath();
    rect.points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
    ctx.clip();
    drawMapFill(ctx, rect, width, height, config, settings);
    const stroke = Math.max(1, settings.lineWidth * Math.max(width / 5760, 0.75));
    if (settings.showDiagonals) {
      line(ctx, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height, settings.diagonalColor, stroke);
      line(ctx, rect.x + rect.width, rect.y, rect.x, rect.y + rect.height, settings.diagonalColor, stroke);
    }
    if (settings.showCircles) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = settings.circleColor;
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.min(rect.width * 0.34, rect.height * 0.44), Math.min(rect.width * 0.34, rect.height * 0.44), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (settings.showSafeArea) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = settings.safeAreaColor;
      ctx.lineWidth = stroke;
      ctx.setLineDash([stroke * 8, stroke * 6]);
      ctx.strokeRect(rect.x + rect.width * 0.05, rect.y + rect.height * 0.05, rect.width * 0.9, rect.height * 0.9);
      ctx.restore();
    }
    if (settings.showCenterDot) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = settings.centerDotColor;
      ctx.beginPath();
      ctx.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, normalizeCenterDotSize(settings.centerDotSize) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (settings.showPixelGrid) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = settings.metricGridColor;
      ctx.lineWidth = Math.max(1, (settings.lineWidth * width) / 5760);
      ctx.beginPath();
      rect.points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    const logoVisible = Boolean(override.logoVisible ?? config.showLogo),
      logoScale = override.logoScale ?? config.customLogoScale,
      logoPosition = override.logoPosition ?? config.customLogoPosition,
      dimensions = logoVisible ? logoDimensions(logo, rect.width, rect.height, logoScale) : null;
    const logoCenter = drawSliceInformation(ctx, slice, rect, settings, dimensions ? { ...dimensions, position: logoPosition } : undefined);
    if (logo && dimensions && logoCenter) drawLogoAt(ctx, logo, logoCenter.x, logoCenter.y, dimensions.width, dimensions.height, config.customLogoOpacity);
    ctx.restore();
    if (showSelection && selectedIds.includes(slice.id)) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(3, width / 1800);
      ctx.setLineDash([Math.max(8, width / 350), Math.max(6, width / 500)]);
      ctx.strokeRect(rect.x + 2, rect.y + 2, Math.max(0, rect.width - 4), Math.max(0, rect.height - 4));
      ctx.restore();
    }
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

function ToolList({ title, items, styles, query = "" }: { title: string; items: Array<[string, boolean, () => void, boolean?]>; styles: Record<string, string>; query?: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = !normalizedQuery || title.toLocaleLowerCase().includes(normalizedQuery)
    ? items
    : items.filter(([label]) => label.toLocaleLowerCase().includes(normalizedQuery));
  if (!visibleItems.length) return null;
  return <section className={styles.toolList}><h2>{title}</h2>{visibleItems.map(([label, active, action, disabled]) => <button aria-pressed={["Arrange", "Selection", "View"].includes(title) && label !== "All Views" ? undefined : active} className={active ? styles.active : ""} disabled={disabled} onClick={action} key={label}><UiIcon name={toolIcon(label)} /><span>{label}</span></button>)}</section>;
}

function VSection({ title, styles, children, query = "", keywords = [], id }: { title: string; styles: Record<string, string>; children: React.ReactNode; query?: string; keywords?: string[]; id?: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery && ![title, ...keywords].some((label) => label.toLocaleLowerCase().includes(normalizedQuery))) return null;
  return <section id={id} className={styles.vSection}><h2>{title}</h2>{children}</section>;
}

function ToggleRow({ label, value, onClick, styles, disabled = false }: { label: string; value: boolean; onClick: () => void; styles: Record<string, string>; disabled?: boolean }) {
  return <button aria-pressed={value} className={`${styles.toggleRow} ${value ? styles.active : ""}`} onClick={onClick} disabled={disabled}><span>{label}</span><i /></button>;
}

function PatternsModeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4v16M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" /></svg>;
}

function PixelMapModeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" /><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" /></svg>;
}

function ThreeDModeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>;
}

export default function Home({ uiVersion = "v070" }: { uiVersion?: "legacy" | "v070" } = {}) {
  const [config, setConfig] = useState(DEFAULT_CONFIG),
    [patternStyle, setPatternStyle] = useState(DEFAULT_PATTERN_STYLE),
    [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("patterns"),
    [controlTab, setControlTab] = useState<ControlTab>("setup"),
    [mapView, setMapView] = useState<MapView>("input");
  const [resolumeMap, setResolumeMap] = useState<ResolumeMap | null>(null),
    [rawXml, setRawXml] = useState(""),
    [xmlName, setXmlName] = useState(""),
    [xmlError, setXmlError] = useState(""),
    [selectedScreen, setSelectedScreen] = useState(0),
    [xmlLinkState, setXmlLinkState] = useState<"unlinked" | "linking" | "linked">("unlinked"),
    [xmlPath, setXmlPath] = useState(""),
    [xmlUpdatedAt, setXmlUpdatedAt] = useState<number | null>(null),
    [pendingXmlUpdate, setPendingXmlUpdate] = useState<{ xml: string; name: string; path?: string; mtimeMs?: number; map: ResolumeMap } | null>(null);
  const [selectedSliceIds, setSelectedSliceIds] = useState<string[]>([]),
    [logoData, setLogoData] = useState(""),
    [logoName, setLogoName] = useState(""),
    [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null),
    [sliceOverrides, setSliceOverrides] = useState<Record<string, SliceOverride>>({});
  const [simulationTransforms, setSimulationTransforms] = useState<Record<string, SliceTransform>>({}),
    [simulationDepthM, setSimulationDepthM] = useState(0.1),
    [simulationCurvature, setSimulationCurvature] = useState<SliceCurvature>({
      horizontal: 0,
      vertical: 0,
    }),
    [simulationCurvatureOverrides, setSimulationCurvatureOverrides] = useState<Record<string, SliceCurvature>>({}),
    [simulationTool, setSimulationTool] = useState<TransformMode>("translate"),
    [simulationSource, setSimulationSource] = useState<SimulationSource>("pattern"),
    [simulationQuality, setSimulationQuality] = useState<"latency" | "quality">("latency"),
    [simulationSourceOverrides, setSimulationSourceOverrides] = useState<Record<string, "inherit" | SimulationSource>>({}),
    [simulationCamera, setSimulationCamera] = useState<CameraState | undefined>(),
    [simulationFitSignal, setSimulationFitSignal] = useState(0),
    [simulationFocusSignal, setSimulationFocusSignal] = useState(0),
    [simulationViewMode, setSimulationViewMode] = useState<SimulationView>("perspective"),
    [simulationTransformSpace, setSimulationTransformSpace] = useState<"local" | "world">("local"),
    [simulationPivot, setSimulationPivot] = useState<SlicePivot>("bottom-center"),
    [simulationPivotOverrides, setSimulationPivotOverrides] = useState<Record<string, SlicePivot>>({}),
    [simulationGridVisible, setSimulationGridVisible] = useState(true),
    [simulationSnapEnabled, setSimulationSnapEnabled] = useState(false),
    [simulationFloorVisible, setSimulationFloorVisible] = useState(true),
    [simulationBackgroundLevel, setSimulationBackgroundLevel] = useState(100);
  const [simulationVisibility, setSimulationVisibility] = useState<Record<string, boolean>>({}),
    [simulationLocks, setSimulationLocks] = useState<Record<string, boolean>>({}),
    [simulationLocalNames, setSimulationLocalNames] = useState<Record<string, string>>({}),
    [simulationGroups, setSimulationGroups] = useState<SceneGroup[]>([]),
    [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]),
    [hierarchyQuery, setHierarchyQuery] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null),
    [hierarchyDrag, setHierarchyDrag] = useState<{
      kind: "group" | "slice";
      id: string;
    } | null>(null),
    [hierarchyDrop, setHierarchyDrop] = useState<{
      targetKind: "group" | "slice";
      targetId: string;
      placement: "before" | "inside" | "after";
    } | null>(null);
  const [simulationTransformPreview, setSimulationTransformPreview] = useState<Record<string, SliceTransform> | null>(null);
  const [simulationInputDevices, setSimulationInputDevices] = useState<MediaDeviceInfo[]>([]),
    [simulationInputDeviceId, setSimulationInputDeviceId] = useState(""),
    [simulationSourceVideo, setSimulationSourceVideo] = useState<HTMLVideoElement | null>(null),
    [simulationNativeCanvas, setSimulationNativeCanvas] = useState<HTMLCanvasElement | null>(null),
    [simulationSourceStatus, setSimulationSourceStatus] = useState("Not connected");
  const [simulationNativeSources, setSimulationNativeSources] = useState<NativeSourceInfo[]>([]),
    [simulationNdiSourceId, setSimulationNdiSourceId] = useState(""),
    [simulationSpoutSourceId, setSimulationSpoutSourceId] = useState(""),
    [simulationNativeConnected, setSimulationNativeConnected] = useState(false),
    [simulationNativeScanning, setSimulationNativeScanning] = useState(false),
    [simulationNativeKind, setSimulationNativeKind] = useState<"ndi" | "spout" | null>(null);
  const [simulationExportFormat, setSimulationExportFormat] = useState<SceneExportFormat>("glb"),
    [simulationExporting, setSimulationExporting] = useState(false),
    [simulationGeometryPreview, setSimulationGeometryPreview] = useState(false);
  const [patternOutput, setPatternOutput] = useState<PatternOutput>("off"),
    [patternOutputStatus, setPatternOutputStatus] = useState("Output disabled"),
    [patternCalibration, setPatternCalibration] = useState<PatternCalibration>("none");
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>("fit"),
    [sequenceActive, setSequenceActive] = useState(false),
    [notice, setNotice] = useState(""),
    [availableUpdate, setAvailableUpdate] = useState<DesktopUpdate | null>(null),
    [calculatorSources, setCalculatorSources] = useState<[CalculatorGroup, CalculatorGroup]>(["physical", "pitch"]);
  const [startupRestoreReady, setStartupRestoreReady] = useState(false),
    [startupProjectStatus, setStartupProjectStatus] = useState("Preparing autosave…");
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
  const [helpTopic, setHelpTopic] = useState<"manual" | "shortcuts" | null>(null);
  const [compilingProject, setCompilingProject] = useState(false);
  const compileInFlight = useRef(false);
  const [renderMetrics] = useState(() => ({ patterns: new RenderPerformance(), resolume: new RenderPerformance(), simulation: new RenderPerformance() }));
  const [arrangeNavigation, setArrangeNavigation] = useState<{ section: "align" | "distribute" } | null>(null);
  const handledArrangeNavigation = useRef<typeof arrangeNavigation>(null);
  const [v070InspectorTab, setV070InspectorTab] = useState<"setup" | "overlays" | "logo" | "scene" | "source" | "geometry" | "information" | "appearance" | "export">("setup"),
    [v070Menu, setV070Menu] = useState<string | null>(null),
    [v070ToolQuery, setV070ToolQuery] = useState(""),
    [v070DiagnosticTab, setV070DiagnosticTab] = useState<"validation" | "changes" | "output" | "performance">("validation"),
    [v070Focused, setV070Focused] = useState(false),
    [v070DiagnosticsOpen, setV070DiagnosticsOpen] = useState(true);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [spaceDown, setSpaceDown] = useState(false),
    [stageBounds, setStageBounds] = useState({ width: 1, height: 1 }),
    [selectionMarquee, setSelectionMarquee] = useState<{
      left: number;
      top: number;
      width: number;
      height: number;
    } | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    canvasStageRef = useRef<HTMLDivElement>(null),
    fullscreenHostRef = useRef<HTMLDivElement>(null),
    xmlInputRef = useRef<HTMLInputElement>(null),
    logoInputRef = useRef<HTMLInputElement>(null),
    v070PixelLogoInputRef = useRef<HTMLInputElement>(null),
    projectInputRef = useRef<HTMLInputElement>(null),
    previewFrameRef = useRef<number | null>(null),
    previewQualityTimerRef = useRef<number | null>(null),
    patternOutputTimerRef = useRef<number | null>(null),
    simulationOutputCaptureRef = useRef<SimulationOutputCapture | null>(null),
    patternOutputBusyRef = useRef(false),
    zoomRef = useRef(1),
    panRef = useRef({ x: 0, y: 0 }),
    selectionDragRef = useRef<{
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      moved: boolean;
      additive: boolean;
      initialIds: string[];
    } | null>(null),
    simulationInputStreamRef = useRef<MediaStream | null>(null),
    simulationNativeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationNativeStatusRef = useRef<NativeSourceStatus | null>(null),
    patternOutputPushRef = useRef<() => Promise<void>>(async () => {}),
    patternOutputReadyRef = useRef(false),
    hierarchySelectionAnchorRef = useRef<string | null>(null),
    hierarchyGroupSelectionAnchorRef = useRef<string | null>(null);
  const undoHistoryRef = useRef<HistoryEntry[]>([]),
    redoHistoryRef = useRef<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState<{
    undo?: string;
    redo?: string;
  }>({});

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 10_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const allSlices = useMemo(() => resolumeMap?.screens.flatMap((screen) => screen.slices) || [], [resolumeMap]),
    activeScreen = resolumeMap?.screens[selectedScreen] || null,
    activeSlices = workspaceMode === "simulation" || mapView === "input" ? allSlices : activeScreen?.slices || [];
  const groupedSliceIds = useMemo(() => new Set(simulationGroups.flatMap((group) => group.sliceIds)), [simulationGroups]);
  const hierarchyOrderedSliceIds = useMemo(() => {
    const query = hierarchyQuery.trim().toLowerCase(),
      matches = (id: string) => {
        const slice = allSlices.find((item) => item.id === id);
        return Boolean(slice && (!query || slice.screenName.toLowerCase().includes(query) || (simulationLocalNames[id] || slice.name).toLowerCase().includes(query)));
      };
    const grouped = simulationGroups.filter((group) => !query || group.name.toLowerCase().includes(query) || group.sliceIds.some(matches)).flatMap((group) => group.sliceIds);
    const ungrouped = allSlices.filter((slice) => !groupedSliceIds.has(slice.id) && matches(slice.id)).map((slice) => slice.id);
    return [...grouped, ...ungrouped];
  }, [allSlices, groupedSliceIds, hierarchyQuery, simulationGroups, simulationLocalNames]);
  const hierarchyOrderedGroupIds = useMemo(() => {
    const ordered: string[] = [],
      visit = (parentId: string | null) =>
        simulationGroups
          .filter((group) => (group.parentId && simulationGroups.some((parent) => parent.id === group.parentId) ? group.parentId : null) === parentId)
          .forEach((group) => {
            ordered.push(group.id);
            visit(group.id);
          });
    visit(null);
    return ordered;
  }, [simulationGroups]);
  const simulationVisibleIds = useMemo(
    () =>
      allSlices
        .filter((slice) => {
          const owner = simulationGroups.find((group) => group.sliceIds.includes(slice.id)),
            lineage = owner ? [owner.id, ...groupAncestorIds(owner.id, simulationGroups)] : [];
          return simulationVisibility[slice.id] !== false && lineage.every((id) => simulationGroups.find((group) => group.id === id)?.visible !== false);
        })
        .map((slice) => slice.id),
    [allSlices, simulationGroups, simulationVisibility],
  );
  const simulationLockedIds = useMemo(
    () =>
      allSlices
        .filter((slice) => {
          const owner = simulationGroups.find((group) => group.sliceIds.includes(slice.id)),
            lineage = owner ? [owner.id, ...groupAncestorIds(owner.id, simulationGroups)] : [];
          return simulationLocks[slice.id] === true || lineage.some((id) => simulationGroups.find((group) => group.id === id)?.locked);
        })
        .map((slice) => slice.id),
    [allSlices, simulationGroups, simulationLocks],
  );
  const patternRenderConfig = useMemo<PatternConfig>(() => ({ ...config, ...patternStyle }), [config, patternStyle]);
  const patternDimensions = useMemo(() => projectionDimensions(config), [config]);
  const outputWidth = (workspaceMode === "resolume" || workspaceMode === "simulation") && resolumeMap ? (workspaceMode === "simulation" || mapView === "input" ? resolumeMap.compositionWidth : activeScreen?.width || 1) : workspaceMode === "patterns" ? patternDimensions.width : config.resolutionWidth,
    outputHeight = (workspaceMode === "resolume" || workspaceMode === "simulation") && resolumeMap ? (workspaceMode === "simulation" || mapView === "input" ? resolumeMap.compositionHeight : activeScreen?.height || 1) : workspaceMode === "patterns" ? patternDimensions.height : config.resolutionHeight;
  const fitScale = Math.max(0.001, Math.min(Math.max(1, stageBounds.width - 28) / outputWidth, Math.max(1, stageBounds.height - 28) / outputHeight)),
    baseScale = fullscreenMode === "actual" ? 1 : fitScale,
    displayScale = baseScale * zoom;
  const selectedSlices = activeSlices.filter((slice) => selectedSliceIds.includes(slice.id)),
    selectedOverride = selectedSlices.length === 1 ? sliceOverrides[selectedSlices[0].id] || {} : {};
  const selectionScopeKey = selectedSliceIds.join("|") || "global";
  const selectedNumericValues = useMemo(() => {
    const commonNumber = (key: keyof SliceOverride, fallback: number) => (selectedSlices.length ? commonSelectionValue(selectedSlices.map((slice) => Number(sliceOverrides[slice.id]?.[key] ?? fallback))) : fallback);
    return {
      cabinetWidth: commonNumber("cabinetWidth", config.cabinetWidth),
      cabinetHeight: commonNumber("cabinetHeight", config.cabinetHeight),
      pixelPitchMm: commonNumber("pixelPitchMm", config.pixelPitchMm),
      labelNameScale: commonNumber("labelNameScale", config.labelNameScale),
      labelDataScale: commonNumber("labelDataScale", config.labelDataScale),
      lineWidth: commonNumber("lineWidth", config.lineWidth),
      centerDotSize: commonNumber("centerDotSize", config.centerDotSize),
      logoScale: commonNumber("logoScale", config.customLogoScale),
    };
  }, [config.cabinetHeight, config.cabinetWidth, config.labelDataScale, config.labelNameScale, config.pixelPitchMm, config.lineWidth, config.centerDotSize, config.customLogoScale, selectedSlices, sliceOverrides]);
  const selectedPanelSizes = selectedSlices.length
    ? selectedSlices.map((slice) => cabinetPixels({ ...config, ...sliceOverrides[slice.id] }))
    : [cabinetPixels(config)];
  const selectedPanelPixels = selectedPanelSizes.every((panel) => panel.width === selectedPanelSizes[0].width && panel.height === selectedPanelSizes[0].height)
    ? selectedPanelSizes[0] : null;
  const selectedInfoOrientation = useMemo<InfoOrientation | "mixed">(() => {
    if (!selectedSlices.length) return config.infoOrientation;
    const values = selectedSlices.map((slice) => sliceOverrides[slice.id]?.infoOrientation ?? config.infoOrientation);
    return commonSelectionValue(values) ?? "mixed";
  }, [config.infoOrientation, selectedSlices, sliceOverrides]);
  const selectedSourceOverride = useMemo<"inherit" | "mixed" | SimulationSource>(() => {
    if (!selectedSliceIds.length) return "inherit";
    const values = selectedSliceIds.map((id) => simulationSourceOverrides[id] || "inherit");
    return values.every((value) => value === values[0]) ? values[0] : "mixed";
  }, [selectedSliceIds, simulationSourceOverrides]);
  const sourcePanelType = selectedSourceOverride !== "inherit" && selectedSourceOverride !== "mixed" ? selectedSourceOverride : simulationSource;
  const simulationSourceMedia = useMemo<Partial<Record<"video" | "ndi" | "spout", HTMLVideoElement | HTMLCanvasElement>>>(() => {
    const media: Partial<Record<"video" | "ndi" | "spout", HTMLVideoElement | HTMLCanvasElement>> = {};
    if (simulationSourceVideo) media.video = simulationSourceVideo;
    if (simulationNativeCanvas && simulationNativeKind) media[simulationNativeKind] = simulationNativeCanvas;
    return media;
  }, [simulationNativeCanvas, simulationNativeKind, simulationSourceVideo]);
  const selectedAutomaticColors = selectedSlices.length === 1 ? automaticSliceColors(selectedSlices[0], config) : { colorA: config.checkerColorA, colorB: config.checkerColorB };
  // XML pivot positions and physical slice geometry must use the same scale.
  // Deriving the exact pitch from the panel's integer raster also avoids
  // rounded values such as 3.9 mm displacing an otherwise exact 500/128 panel.
  const simulationMasterPitchMm = exactPhysicalPitchMm(config.cabinetWidth, config.pixelPitchMm);
  const simulationPitchBySlice = useMemo(
    () =>
      Object.fromEntries(
        allSlices.map((slice) => {
          const override = sliceOverrides[slice.id];
          const cabinetWidthMm = override?.cabinetWidth || config.cabinetWidth;
          const nominalPitchMm = override?.pixelPitchMm || config.pixelPitchMm;
          return [slice.id, exactPhysicalPitchMm(cabinetWidthMm, nominalPitchMm)];
        }),
      ),
    [allSlices, config.cabinetWidth, config.pixelPitchMm, sliceOverrides],
  );
  const simulationPitchCount = useMemo(() => new Set(Object.values(simulationPitchBySlice).map((pitch) => round(pitch, 6))).size, [simulationPitchBySlice]);
  const automaticLayoutAnchorId = useMemo(
    () =>
      choosePhysicalLayoutAnchor(
        allSlices.map((slice) => ({
          id: slice.id,
          x: slice.input.x,
          y: slice.input.y,
          width: slice.input.width,
          height: slice.input.height,
        })),
        resolumeMap?.compositionWidth || config.resolutionWidth,
        resolumeMap?.compositionHeight || config.resolutionHeight,
      ) || "",
    [allSlices, config.resolutionHeight, config.resolutionWidth, resolumeMap?.compositionHeight, resolumeMap?.compositionWidth],
  );
  const effectiveLayoutAnchorId = automaticLayoutAnchorId;
  const effectiveLayoutAnchorSlice = allSlices.find((slice) => slice.id === effectiveLayoutAnchorId);
  const simulationPivotBySlice = useMemo<Record<string, SlicePivot>>(() => Object.fromEntries(allSlices.map((slice) => [slice.id, simulationPivotOverrides[slice.id] || simulationPivot])), [allSlices, simulationPivot, simulationPivotOverrides]);
  const simulationBottomLeftPositions = useMemo(
    () =>
      resolvePhysicalLayout(
        allSlices.map((slice) => ({
          id: slice.id,
          x: slice.input.x,
          y: slice.input.y,
          width: slice.input.width,
          height: slice.input.height,
        })),
        resolumeMap?.compositionWidth || config.resolutionWidth,
        resolumeMap?.compositionHeight || config.resolutionHeight,
        simulationPitchBySlice,
        Object.fromEntries(allSlices.map((slice) => [slice.id, "bottom-left" as const])),
        simulationMasterPitchMm,
        effectiveLayoutAnchorId,
      ),
    [allSlices, config.resolutionHeight, config.resolutionWidth, effectiveLayoutAnchorId, resolumeMap?.compositionHeight, resolumeMap?.compositionWidth, simulationMasterPitchMm, simulationPitchBySlice],
  );
  const simulationCurvatureBySlice = useMemo<Record<string, SliceCurvature>>(() => Object.fromEntries(allSlices.map((slice) => [slice.id, normalizeCurvature(simulationCurvatureOverrides[slice.id] || simulationCurvature)])), [allSlices, simulationCurvature, simulationCurvatureOverrides]);
  const simulationDepthBySlice = useMemo<Record<string, number>>(() => Object.fromEntries(allSlices.map((slice) => [slice.id, simulationDepthM])), [allSlices, simulationDepthM]);
  const simulationTextureVersion = useMemo(
    () =>
      JSON.stringify({
        map: resolumeMap?.name,
        xml: xmlUpdatedAt,
        fill: config.mapFill,
        scope: config.mapPatternScope,
        config,
        sliceOverrides,
        logoData,
        quality: simulationQuality,
      }),
    [config, logoData, resolumeMap?.name, simulationQuality, sliceOverrides, xmlUpdatedAt],
  );
  const selectedBoolean = useCallback((key: keyof SliceOverride, globalValue: boolean) => (selectedSlices.length ? selectedSlices.every((slice) => Boolean(sliceOverrides[slice.id]?.[key] ?? globalValue)) : globalValue), [selectedSlices, sliceOverrides]);
  const initialSimulationTransformForPivot = useCallback(
    (slice: ResolumeSlice, pivot: SlicePivot): SliceTransform => {
      const bottomLeft = simulationBottomLeftPositions[slice.id] || [0, 0, 0],
        widthM = (slice.input.width * (simulationPitchBySlice[slice.id] || simulationMasterPitchMm)) / 1000,
        heightM = (slice.input.height * (simulationPitchBySlice[slice.id] || simulationMasterPitchMm)) / 1000,
        offset = pivotOffset(pivot, widthM, heightM);
      return {
        position: [bottomLeft[0] + widthM / 2 + offset[0], bottomLeft[1] + heightM / 2 + offset[1], bottomLeft[2] + offset[2]],
        rotation: [0, 0, 0],
      };
    },
    [simulationBottomLeftPositions, simulationMasterPitchMm, simulationPitchBySlice],
  );
  const initialSimulationTransform = useCallback((slice: ResolumeSlice): SliceTransform => initialSimulationTransformForPivot(slice, simulationPivotBySlice[slice.id] || simulationPivot), [initialSimulationTransformForPivot, simulationPivot, simulationPivotBySlice]);
  const groupBySliceId = useMemo(() => {
    const result = new Map<string, SceneGroup>();
    simulationGroups.forEach((group) => group.sliceIds.forEach((id) => result.set(id, group)));
    return result;
  }, [simulationGroups]);
  const groupWorldById = useMemo(() => new Map(simulationGroups.map((group) => [group.id, groupWorldTransform(group.id, simulationGroups)])), [simulationGroups]);
  const selectedGroups = useMemo(() => simulationGroups.filter((group) => selectedGroupIds.includes(group.id)), [selectedGroupIds, simulationGroups]);
  const selectedTransformGroups = useMemo(
    () => selectedGroups.filter((group) => !groupAncestorIds(group.id, simulationGroups).some((id) => selectedGroupIds.includes(id))),
    [selectedGroupIds, selectedGroups, simulationGroups],
  );
  const selectedGroup = selectedGroups.length === 1 ? selectedGroups[0] : null;
  const selectedGroupSliceIds = useMemo(
    () => [...new Set(selectedTransformGroups.flatMap((group) => groupDescendantSliceIds(group.id, simulationGroups)))],
    [selectedTransformGroups, simulationGroups],
  );
  const hasGroupSelection = selectedGroupIds.length > 0;
  const renderedSimulationTransforms = useMemo<Record<string, SliceTransform>>(
    () =>
      Object.fromEntries(
        allSlices.map((slice) => {
          const local = simulationTransforms[slice.id] || initialSimulationTransform(slice),
            group = groupBySliceId.get(slice.id);
          return [slice.id, group ? localToWorldTransform(groupWorldById.get(group.id) || group.transform, local) : normalizeTransform(local)];
        }),
      ),
    [allSlices, groupBySliceId, groupWorldById, initialSimulationTransform, simulationTransforms],
  );
  const simulationExportTransforms = useMemo<Record<string, SliceTransform>>(() => Object.fromEntries(allSlices.map((slice) => [slice.id, groupBySliceId.has(slice.id) ? simulationTransforms[slice.id] || initialSimulationTransform(slice) : renderedSimulationTransforms[slice.id]])), [allSlices, groupBySliceId, initialSimulationTransform, renderedSimulationTransforms, simulationTransforms]);
  const groupTransformForSliceIds = useCallback(
    (ids: string[]) =>
      groupTransformFromWorldBounds(
        ids
          .map((id) => {
            const slice = allSlices.find((item) => item.id === id),
              transform = renderedSimulationTransforms[id];
            if (!slice || !transform) return null;
            const pitchM = (simulationPitchBySlice[id] || simulationMasterPitchMm) / 1000,
              width = slice.input.width * pitchM,
              height = slice.input.height * pitchM,
              pivot = simulationPivotBySlice[id] || simulationPivot,
              offset = pivotOffset(pivot, width, height),
              minX = -width / 2 - offset[0], minY = -height / 2 - offset[1];
            return {
              transform,
              min: [minX, minY, -(simulationDepthBySlice[id] || simulationDepthM) - offset[2]] as [number, number, number],
              max: [minX + width, minY + height, -offset[2]] as [number, number, number],
            };
          })
          .filter(Boolean) as Array<{
          transform: SliceTransform;
          min: [number, number, number];
          max: [number, number, number];
        }>,
      ),
    [allSlices, renderedSimulationTransforms, simulationDepthBySlice, simulationDepthM, simulationMasterPitchMm, simulationPitchBySlice, simulationPivot, simulationPivotBySlice],
  );
  useEffect(() => {
    const legacyGroups = simulationGroups.filter((group) => group.legacySelectionGroup);
    if (!legacyGroups.length || !allSlices.length) return;
    const migrations = new Map(legacyGroups.map((group) => [group.id, groupTransformForSliceIds(group.sliceIds)]));
    const migrationTimer = window.setTimeout(() => {
      setSimulationTransforms((current) => {
        const next = { ...current };
        legacyGroups.forEach((group) => {
          const transform = migrations.get(group.id)!;
          group.sliceIds.forEach((id) => {
            const world = renderedSimulationTransforms[id];
            if (world) next[id] = worldToLocalTransform(transform, world);
          });
        });
        return next;
      });
      setSimulationGroups((current) =>
        current.map((group) => {
          const transform = migrations.get(group.id);
          return transform
            ? {
                ...group,
                transform,
                initialTransform: normalizeTransform(transform),
                legacySelectionGroup: false,
              }
            : group;
        }),
      );
    }, 0);
    return () => window.clearTimeout(migrationTimer);
  }, [allSlices.length, groupTransformForSliceIds, renderedSimulationTransforms, simulationGroups]);
  const effectiveSimulationTransform = useCallback((slice: ResolumeSlice) => simulationTransformPreview?.[slice.id] || renderedSimulationTransforms[slice.id] || initialSimulationTransform(slice), [initialSimulationTransform, renderedSimulationTransforms, simulationTransformPreview]);
  const selectedGroupDisplayTransforms = useMemo(
    () =>
      selectedTransformGroups.map((group) => {
        const selectedWorld = groupWorldById.get(group.id) || group.transform;
        if (!simulationTransformPreview) return group.transform;
        const referenceId = groupDescendantSliceIds(group.id, simulationGroups).find((id) => simulationTransformPreview[id] && renderedSimulationTransforms[id]);
        if (!referenceId) return group.transform;
        const rotationDelta = simulationTransformPreview[referenceId].rotation.map((value, axis) => value - renderedSimulationTransforms[referenceId].rotation[axis]) as [number, number, number],
          expectedWorldRotation = selectedWorld.rotation.map((value, axis) => value + rotationDelta[axis]) as [number, number, number],
          expectedLocalRotation = group.transform.rotation.map((value, axis) => value + rotationDelta[axis]) as [number, number, number],
          local = worldToLocalTransform(selectedWorld, renderedSimulationTransforms[referenceId]);
        const previewWorld = groupTransformFromMovedChild(local, simulationTransformPreview[referenceId], expectedWorldRotation);
        const parentWorld = group.parentId ? groupWorldById.get(group.parentId) : null;
        return parentWorld ? worldToLocalTransform(parentWorld, previewWorld, expectedLocalRotation) : { ...previewWorld, rotation: continuousEuler(previewWorld.rotation, expectedLocalRotation) };
      }),
    [groupWorldById, renderedSimulationTransforms, selectedTransformGroups, simulationGroups, simulationTransformPreview],
  );
  const selectedGroupSelectionWorldTransform = useMemo(
    () => (selectedTransformGroups.length === 1 ? groupWorldById.get(selectedTransformGroups[0].id) || selectedTransformGroups[0].transform : selectedTransformGroups.length > 1 ? groupTransformForSliceIds(selectedGroupSliceIds) : undefined),
    [groupTransformForSliceIds, groupWorldById, selectedGroupSliceIds, selectedTransformGroups],
  );
  const selectedTransformPosition = useMemo<[number | null, number | null, number | null] | null>(() => {
    if (selectedGroupDisplayTransforms.length) {
      return [0, 1, 2].map((axis) => {
        const first = selectedGroupDisplayTransforms[0].position[axis];
        return selectedGroupDisplayTransforms.every((transform) => Math.abs(transform.position[axis] - first) < 0.00001) ? first : null;
      }) as [number | null, number | null, number | null];
    }
    if (!selectedSlices.length) return null;
    const transforms = selectedSlices.map(effectiveSimulationTransform);
    return [0, 1, 2].map((axis) => {
      const first = transforms[0].position[axis];
      return transforms.every((transform) => Math.abs(transform.position[axis] - first) < 0.00001) ? first : null;
    }) as [number | null, number | null, number | null];
  }, [effectiveSimulationTransform, selectedGroupDisplayTransforms, selectedSlices]);
  const selectedTransformRotation = useMemo<[number | null, number | null, number | null] | null>(() => {
    if (selectedGroupDisplayTransforms.length) {
      return [0, 1, 2].map((axis) => {
        const first = (selectedGroupDisplayTransforms[0].rotation[axis] * 180) / Math.PI;
        return selectedGroupDisplayTransforms.every((transform) => Math.abs((transform.rotation[axis] * 180) / Math.PI - first) < 0.001) ? first : null;
      }) as [number | null, number | null, number | null];
    }
    if (!selectedSlices.length) return null;
    const transforms = selectedSlices.map(effectiveSimulationTransform);
    return [0, 1, 2].map((axis) => {
      const first = (transforms[0].rotation[axis] * 180) / Math.PI;
      return transforms.every((transform) => Math.abs((transform.rotation[axis] * 180) / Math.PI - first) < 0.001) ? first : null;
    }) as [number | null, number | null, number | null];
  }, [effectiveSimulationTransform, selectedGroupDisplayTransforms, selectedSlices]);
  const selectedTransformScale = useMemo<[number | null, number | null, number | null] | null>(() => {
    const transforms = selectedGroupDisplayTransforms.length ? selectedGroupDisplayTransforms : selectedSlices.map(effectiveSimulationTransform);
    if (!transforms.length) return null;
    return [0, 1, 2].map((axis) => {
      const first = normalizeTransform(transforms[0]).scale![axis];
      return transforms.every((transform) => Math.abs(normalizeTransform(transform).scale![axis] - first) < 0.00001) ? first : null;
    }) as [number | null, number | null, number | null];
  }, [effectiveSimulationTransform, selectedGroupDisplayTransforms, selectedSlices]);
  const selectedSimulationPivot = useMemo<SlicePivot | "mixed">(() => {
    if (!selectedSlices.length) return simulationPivot;
    const pivots = selectedSlices.map((slice) => simulationPivotBySlice[slice.id] || simulationPivot);
    return pivots.every((pivot) => pivotKey(pivot) === pivotKey(pivots[0])) ? pivots[0] : "mixed";
  }, [selectedSlices, simulationPivot, simulationPivotBySlice]);
  const selectedCurvature = useMemo<{
    horizontal: number | null;
    vertical: number | null;
  }>(() => {
    if (!selectedSlices.length) return normalizeCurvature(simulationCurvature);
    const curves = selectedSlices.map((slice) => simulationCurvatureBySlice[slice.id] || normalizeCurvature(simulationCurvature));
    const common = (axis: keyof SliceCurvature) => (curves.every((curve) => Math.abs(curve[axis] - curves[0][axis]) < 0.001) ? curves[0][axis] : null);
    return { horizontal: common("horizontal"), vertical: common("vertical") };
  }, [selectedSlices, simulationCurvature, simulationCurvatureBySlice]);
  const horizontalCurveActive = selectedCurvature.horizontal !== null && Math.abs(selectedCurvature.horizontal) > 0.001;
  const verticalCurveActive = selectedCurvature.vertical !== null && Math.abs(selectedCurvature.vertical) > 0.001;
  const selectedCurvatureRadius = useMemo(() => {
    if (selectedSlices.length !== 1) return { horizontal: null, vertical: null };
    const slice = selectedSlices[0],
      pitchM = (simulationPitchBySlice[slice.id] || config.pixelPitchMm) / 1000;
    const radius = (lengthM: number, degrees: number | null) => (!degrees ? null : Math.abs(lengthM / ((degrees * Math.PI) / 180)));
    return {
      horizontal: radius(slice.input.width * pitchM, selectedCurvature.horizontal),
      vertical: radius(slice.input.height * pitchM, selectedCurvature.vertical),
    };
  }, [config.pixelPitchMm, selectedCurvature, selectedSlices, simulationPitchBySlice]);
  const invalidCurvedDepthSlices = useMemo(
    () =>
      allSlices.filter((slice) => {
        const curvature = simulationCurvatureBySlice[slice.id] || simulationCurvature;
        const axis = Math.abs(curvature.horizontal) > 0.001 ? "horizontal" : "vertical",
          degrees = Math.abs(curvature[axis]);
        if (degrees <= 0) return false;
        const pitchM = (simulationPitchBySlice[slice.id] || config.pixelPitchMm) / 1000;
        const radius = ((axis === "horizontal" ? slice.input.width : slice.input.height) * pitchM) / ((degrees * Math.PI) / 180);
        return simulationDepthM >= radius - 1e-6;
      }),
    [allSlices, config.pixelPitchMm, simulationCurvature, simulationCurvatureBySlice, simulationDepthM, simulationPitchBySlice],
  );

  const captureSimulationSnapshot = useCallback(
    (): SimulationSnapshot => ({
      transforms: structuredClone(simulationTransforms),
      depthM: simulationDepthM,
      curvature: { ...simulationCurvature },
      curvatureOverrides: structuredClone(simulationCurvatureOverrides),
      source: simulationSource,
      quality: simulationQuality,
      sourceOverrides: structuredClone(simulationSourceOverrides),
      transformSpace: simulationTransformSpace,
      pivot: simulationPivot,
      pivotOverrides: structuredClone(simulationPivotOverrides),
      gridVisible: simulationGridVisible,
      snapEnabled: simulationSnapEnabled,
      floorVisible: simulationFloorVisible,
      backgroundLevel: simulationBackgroundLevel,
      visibility: structuredClone(simulationVisibility),
      locks: structuredClone(simulationLocks),
      localNames: structuredClone(simulationLocalNames),
      groups: structuredClone(simulationGroups),
    }),
    [simulationBackgroundLevel, simulationCurvature, simulationCurvatureOverrides, simulationDepthM, simulationFloorVisible, simulationGridVisible, simulationSnapEnabled, simulationGroups, simulationLocalNames, simulationLocks, simulationPivot, simulationPivotOverrides, simulationQuality, simulationSource, simulationSourceOverrides, simulationTransformSpace, simulationTransforms, simulationVisibility],
  );
  const restoreSimulationSnapshot = useCallback((snapshot: SimulationSnapshot) => {
    setSimulationTransformPreview(null);
    setSimulationTransforms(structuredClone(snapshot.transforms));
    setSimulationDepthM(clamp(snapshot.depthM, 0.01, 0.5));
    setSimulationCurvature(normalizeCurvature(snapshot.curvature));
    setSimulationCurvatureOverrides(Object.fromEntries(Object.entries(snapshot.curvatureOverrides || {}).map(([id, curvature]) => [id, normalizeCurvature(curvature)])));
    setSimulationSource(normalizeSimulationSource(snapshot.source));
    setSimulationQuality(snapshot.quality);
    setSimulationSourceOverrides(normalizeSourceOverrides(snapshot.sourceOverrides));
    setSimulationTransformSpace(snapshot.transformSpace);
    setSimulationPivot(snapshot.pivot || "bottom-center");
    setSimulationPivotOverrides(structuredClone(snapshot.pivotOverrides || {}));
    setSimulationGridVisible(snapshot.gridVisible);
    setSimulationSnapEnabled(snapshot.snapEnabled ?? false);
    setSimulationFloorVisible(snapshot.floorVisible ?? true);
    setSimulationBackgroundLevel(snapshot.backgroundLevel);
    setSimulationVisibility(structuredClone(snapshot.visibility || {}));
    setSimulationLocks(structuredClone(snapshot.locks || {}));
    setSimulationLocalNames(structuredClone(snapshot.localNames || {}));
    setSimulationGroups((snapshot.groups || []).map(migrateTransformGroup));
  }, []);
  const refreshHistoryState = useCallback(
    () =>
      setHistoryState({
        undo: undoHistoryRef.current.at(-1)?.label,
        redo: redoHistoryRef.current.at(-1)?.label,
      }),
    [],
  );
  const recordSimulationHistory = useCallback(
    (label: string) => {
      undoHistoryRef.current.push({
        label,
        state: captureSimulationSnapshot(),
      });
      if (undoHistoryRef.current.length > 100) undoHistoryRef.current.shift();
      redoHistoryRef.current = [];
      refreshHistoryState();
    },
    [captureSimulationSnapshot, refreshHistoryState],
  );
  const undoSimulation = useCallback(() => {
    const entry = undoHistoryRef.current.pop();
    if (!entry) return;
    redoHistoryRef.current.push({
      label: entry.label,
      state: captureSimulationSnapshot(),
    });
    restoreSimulationSnapshot(entry.state);
    refreshHistoryState();
    setNotice(`Undid ${entry.label}`);
  }, [captureSimulationSnapshot, refreshHistoryState, restoreSimulationSnapshot]);
  const redoSimulation = useCallback(() => {
    const entry = redoHistoryRef.current.pop();
    if (!entry) return;
    undoHistoryRef.current.push({
      label: entry.label,
      state: captureSimulationSnapshot(),
    });
    restoreSimulationSnapshot(entry.state);
    refreshHistoryState();
    setNotice(`Redid ${entry.label}`);
  }, [captureSimulationSnapshot, refreshHistoryState, restoreSimulationSnapshot]);
  const pivotEditorValues = useMemo(() => {
    const entries = selectedSlices.length ? selectedSlices.map((slice) => {
      const pitch = (simulationPitchBySlice[slice.id] || simulationMasterPitchMm) / 1000;
      return { pivot: simulationPivotBySlice[slice.id] || simulationPivot, width: slice.input.width * pitch, height: slice.input.height * pitch };
    }) : [{ pivot: simulationPivot, width: config.resolutionWidth * simulationMasterPitchMm / 1000, height: config.resolutionHeight * simulationMasterPitchMm / 1000 }];
    const offsets = entries.map(({ pivot, width, height }) => pivotOffset(pivot, width, height));
    const values = [0, 1, 2].map((axis) => offsets.every((v) => Math.abs(v[axis] - offsets[0][axis]) < 1e-8) ? offsets[0][axis] : null);
    const points = offsets.map((v, i) => [0.5 + v[0] / Math.max(0.0001, entries[i].width), 0.5 - v[1] / Math.max(0.0001, entries[i].height)]);
    const point = points.every((v) => v.every((n, axis) => Math.abs(n - points[0][axis]) < 1e-8)) ? points[0] as [number, number] : null;
    const modes = entries.map(({ pivot }) => typeof pivot === "string" ? pivot : "custom");
    return { values, point, mode: modes.every((mode) => mode === modes[0]) ? modes[0] : "mixed" };
  }, [selectedSlices, simulationPivot, simulationPivotBySlice, simulationPitchBySlice, simulationMasterPitchMm, config.resolutionWidth, config.resolutionHeight]);
  const pivotEditingDisabled = !selectedSlices.length || hasGroupSelection || selectedSlices.every((slice) => simulationLockedIds.includes(slice.id));
  const changeSimulationPivot = useCallback(
    (nextValue: SlicePivot | ((previous: SlicePivot, width: number, height: number) => SlicePivot)) => {
      if (pivotEditingDisabled) return;
      const nextFor = (previous: SlicePivot, width: number, height: number) => typeof nextValue === "function" ? nextValue(previous, width, height) : nextValue;
      const targets = selectedSlices.filter((slice) => !simulationLockedIds.includes(slice.id));
      const updates = targets.map((slice) => {
        const previous = simulationPivotBySlice[slice.id] || simulationPivot, pitch = (simulationPitchBySlice[slice.id] || simulationMasterPitchMm) / 1000;
        const width = slice.input.width * pitch, height = slice.input.height * pitch;
        return { slice, previous, next: nextFor(previous, width, height), width, height };
      });
      if (!updates.some(({ previous, next }) => pivotKey(previous) !== pivotKey(next))) return;
      recordSimulationHistory("Change selected pivots");
      setSimulationTransforms((current) => {
        const next = { ...current };
        updates.forEach(({ slice, previous, next: pivot, width, height }) => {
          const base = current[slice.id] || initialSimulationTransformForPivot(slice, previous);
          next[slice.id] = reanchorTransform(base, pivotOffset(previous, width, height), pivotOffset(pivot, width, height));
        });
        return next;
      });
      setSimulationPivotOverrides((current) => {
        const next = { ...current };
        updates.forEach(({ slice, next: pivot }) => { next[slice.id] = pivot; });
        return next;
      });
    },
    [pivotEditingDisabled, initialSimulationTransformForPivot, recordSimulationHistory, selectedSlices, simulationMasterPitchMm, simulationPitchBySlice, simulationPivot, simulationPivotBySlice, simulationLockedIds],
  );
  const applySimulationCurvature = useCallback(
    (axis: keyof SliceCurvature, value: number) => {
      const nextValue = clamp(value, -360, 360),
        otherAxis: keyof SliceCurvature = axis === "horizontal" ? "vertical" : "horizontal";
      if (!selectedSlices.length) {
        setSimulationCurvature((current) => ({
          ...current,
          [axis]: nextValue,
          ...(Math.abs(nextValue) > 0.001 ? { [otherAxis]: 0 } : {}),
        }));
        return;
      }
      setSimulationCurvatureOverrides((current) => {
        const next = { ...current };
        selectedSlices.forEach((slice) => {
          const resolved = simulationCurvatureBySlice[slice.id] || simulationCurvature,
            updated = {
              ...resolved,
              [axis]: nextValue,
              ...(Math.abs(nextValue) > 0.001 ? { [otherAxis]: 0 } : {}),
            };
          if (Math.abs(updated.horizontal - simulationCurvature.horizontal) < 0.001 && Math.abs(updated.vertical - simulationCurvature.vertical) < 0.001) delete next[slice.id];
          else next[slice.id] = updated;
        });
        return next;
      });
    },
    [selectedSlices, simulationCurvature, simulationCurvatureBySlice],
  );
  const updateManualPosition = useCallback(
    (axis: 0 | 1 | 2, value: number) => {
      if (selectedTransformGroups.length) {
        const ids = new Set(selectedTransformGroups.map((group) => group.id));
        recordSimulationHistory(`Set position for ${ids.size} group${ids.size === 1 ? "" : "s"}`);
        setSimulationGroups((current) =>
          current.map((group) => {
            if (!ids.has(group.id)) return group;
            const transform = normalizeTransform(group.transform);
            transform.position[axis] = value;
            return { ...group, transform };
          }),
        );
        return;
      }
      if (!selectedSlices.length) return;
      recordSimulationHistory(`Set position for ${selectedSlices.length} slice${selectedSlices.length > 1 ? "s" : ""}`);
      setSimulationTransformPreview(null);
      setSimulationTransforms((current) => {
        const next = { ...current };
        selectedSlices.forEach((slice) => {
          const world = normalizeTransform(renderedSimulationTransforms[slice.id] || initialSimulationTransform(slice));
          world.position[axis] = value;
          const group = groupBySliceId.get(slice.id);
          next[slice.id] = group ? worldToLocalTransform(groupWorldById.get(group.id) || group.transform, world) : world;
        });
        return next;
      });
    },
    [groupBySliceId, groupWorldById, initialSimulationTransform, recordSimulationHistory, renderedSimulationTransforms, selectedSlices, selectedTransformGroups],
  );
  const updateManualRotation = useCallback(
    (axis: 0 | 1 | 2, degrees: number) => {
      if (selectedTransformGroups.length) {
        const ids = new Set(selectedTransformGroups.map((group) => group.id));
        recordSimulationHistory(`Set rotation for ${ids.size} group${ids.size === 1 ? "" : "s"}`);
        setSimulationGroups((current) =>
          current.map((group) => {
            if (!ids.has(group.id)) return group;
            const transform = normalizeTransform(group.transform);
            transform.rotation[axis] = (degrees * Math.PI) / 180;
            return { ...group, transform };
          }),
        );
        return;
      }
      if (!selectedSlices.length) return;
      recordSimulationHistory(`Set rotation for ${selectedSlices.length} slice${selectedSlices.length > 1 ? "s" : ""}`);
      setSimulationTransformPreview(null);
      setSimulationTransforms((current) => {
        const next = { ...current };
        selectedSlices.forEach((slice) => {
          const world = normalizeTransform(renderedSimulationTransforms[slice.id] || initialSimulationTransform(slice));
          world.rotation[axis] = (degrees * Math.PI) / 180;
          const group = groupBySliceId.get(slice.id);
          next[slice.id] = group ? worldToLocalTransform(groupWorldById.get(group.id) || group.transform, world) : world;
        });
        return next;
      });
    },
    [groupBySliceId, groupWorldById, initialSimulationTransform, recordSimulationHistory, renderedSimulationTransforms, selectedSlices, selectedTransformGroups],
  );
  const updateManualScale = useCallback(
    (axis: 0 | 1 | 2, value: number) => {
      const safeValue = clamp(value, 0.001, 1000);
      if (selectedTransformGroups.length) {
        const ids = new Set(selectedTransformGroups.map((group) => group.id));
        recordSimulationHistory(`Set scale for ${ids.size} group${ids.size === 1 ? "" : "s"}`);
        setSimulationGroups((current) => current.map((group) => {
          if (!ids.has(group.id)) return group;
          const transform = normalizeTransform(group.transform);
          transform.scale![axis] = safeValue;
          return { ...group, transform };
        }));
        return;
      }
      if (!selectedSlices.length) return;
      recordSimulationHistory(`Set scale for ${selectedSlices.length} slice${selectedSlices.length > 1 ? "s" : ""}`);
      setSimulationTransformPreview(null);
      setSimulationTransforms((current) => {
        const next = { ...current };
        selectedSlices.forEach((slice) => {
          const world = normalizeTransform(renderedSimulationTransforms[slice.id] || initialSimulationTransform(slice));
          world.scale![axis] = safeValue;
          const group = groupBySliceId.get(slice.id);
          next[slice.id] = group ? worldToLocalTransform(groupWorldById.get(group.id) || group.transform, world) : world;
        });
        return next;
      });
    },
    [groupBySliceId, groupWorldById, initialSimulationTransform, recordSimulationHistory, renderedSimulationTransforms, selectedSlices, selectedTransformGroups],
  );
  const resetSelectedTransforms = useCallback(() => {
    if (selectedTransformGroups.length) {
      const ids = new Set(selectedTransformGroups.map((group) => group.id));
      recordSimulationHistory(`Reset ${ids.size} group${ids.size === 1 ? "" : "s"}`);
      setSimulationTransformPreview(null);
      setSimulationGroups((current) =>
        current.map((group) =>
          ids.has(group.id)
            ? {
                ...group,
                transform: normalizeTransform(group.initialTransform),
              }
            : group,
        ),
      );
      return;
    }
    if (!selectedSliceIds.length) return;
    recordSimulationHistory(`Reset ${selectedSliceIds.length} slice${selectedSliceIds.length > 1 ? "s" : ""}`);
    setSimulationTransformPreview(null);
    setSimulationTransforms((current) => {
      const next = { ...current };
      selectedSlices.forEach((slice) => {
        const group = groupBySliceId.get(slice.id);
        if (group) next[slice.id] = worldToLocalTransform(groupWorldById.get(group.id) || group.transform, initialSimulationTransform(slice));
        else delete next[slice.id];
      });
      return next;
    });
  }, [groupBySliceId, groupWorldById, initialSimulationTransform, recordSimulationHistory, selectedSliceIds.length, selectedSlices, selectedTransformGroups]);
  const arrangeSimulationSelection = useCallback(
    (axis: 0 | 1 | 2, operation: "align" | "distribute") => {
      const groupTargets = selectedTransformGroups.map((group) => ({ kind: "group" as const, id: group.id, transform: normalizeTransform(groupWorldById.get(group.id) || group.transform) }));
      const sliceTargets = groupTargets.length ? [] : selectedSlices.map((slice) => ({ kind: "slice" as const, id: slice.id, transform: normalizeTransform(renderedSimulationTransforms[slice.id] || initialSimulationTransform(slice)) }));
      const targets = [...groupTargets, ...sliceTargets];
      const minimum = operation === "distribute" ? 3 : 2;
      if (targets.length < minimum) {
        setNotice(operation === "align" ? "Select at least two slices or groups to align" : "Select at least three slices or groups to distribute");
        return;
      }
      const ordered = [...targets].sort((a, b) => a.transform.position[axis] - b.transform.position[axis]);
      const first = ordered[0].transform.position[axis], last = ordered[ordered.length - 1].transform.position[axis];
      const targetPositions = new Map<string, number>();
      if (operation === "align") {
        const centre = ordered.reduce((sum, item) => sum + item.transform.position[axis], 0) / ordered.length;
        ordered.forEach((item) => targetPositions.set(item.id, centre));
      } else ordered.forEach((item, index) => targetPositions.set(item.id, first + (last - first) * index / (ordered.length - 1)));
      recordSimulationHistory(`${operation === "align" ? "Align" : "Distribute"} ${targets.length} item${targets.length === 1 ? "" : "s"} on ${["X", "Y", "Z"][axis]}`);
      setSimulationTransformPreview(null);
      if (groupTargets.length) setSimulationGroups((current) => current.map((group) => {
        const position = targetPositions.get(group.id);
        if (position === undefined) return group;
        const world = normalizeTransform(groupWorldById.get(group.id) || group.transform);
        world.position[axis] = position;
        const parentWorld = group.parentId ? groupWorldById.get(group.parentId) : null;
        return { ...group, transform: parentWorld ? worldToLocalTransform(parentWorld, world, group.transform.rotation) : world };
      }));
      else setSimulationTransforms((current) => {
        const next = { ...current };
        sliceTargets.forEach((target) => {
          const world = normalizeTransform(target.transform);
          world.position[axis] = targetPositions.get(target.id) ?? world.position[axis];
          const group = groupBySliceId.get(target.id);
          next[target.id] = group ? worldToLocalTransform(groupWorldById.get(group.id) || group.transform, world) : world;
        });
        return next;
      });
    },
    [groupBySliceId, groupWorldById, initialSimulationTransform, recordSimulationHistory, renderedSimulationTransforms, selectedSlices, selectedTransformGroups],
  );
  const selectHierarchySlice = useCallback(
    (id: string, modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
      const additive = modifiers.ctrlKey || modifiers.metaKey;
      setSelectedGroupIds([]);
      setSelectedSliceIds((current) => {
        if (modifiers.shiftKey && hierarchySelectionAnchorRef.current) {
          const orderedIds = hierarchyOrderedSliceIds,
            anchorIndex = orderedIds.indexOf(hierarchySelectionAnchorRef.current),
            targetIndex = orderedIds.indexOf(id);
          if (anchorIndex >= 0 && targetIndex >= 0) {
            const range = orderedIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
            return additive ? [...new Set([...current, ...range])] : range;
          }
        }
        hierarchySelectionAnchorRef.current = id;
        if (additive) return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        return [id];
      });
    },
    [hierarchyOrderedSliceIds],
  );
  const selectHierarchyGroup = useCallback(
    (group: SceneGroup, modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
      const additive = modifiers.ctrlKey || modifiers.metaKey;
      let next: string[];
      if (modifiers.shiftKey && hierarchyGroupSelectionAnchorRef.current) {
        const anchorIndex = hierarchyOrderedGroupIds.indexOf(hierarchyGroupSelectionAnchorRef.current),
          targetIndex = hierarchyOrderedGroupIds.indexOf(group.id);
        const range = anchorIndex >= 0 && targetIndex >= 0 ? hierarchyOrderedGroupIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1) : [group.id];
        next = additive ? [...new Set([...selectedGroupIds, ...range])] : range;
      } else {
        hierarchyGroupSelectionAnchorRef.current = group.id;
        next = additive ? (selectedGroupIds.includes(group.id) ? selectedGroupIds.filter((id) => id !== group.id) : [...selectedGroupIds, group.id]) : [group.id];
      }
      setSelectedGroupIds(next);
      setSelectedSliceIds([...new Set(next.flatMap((id) => groupDescendantSliceIds(id, simulationGroups)))]);
    },
    [hierarchyOrderedGroupIds, selectedGroupIds, simulationGroups],
  );
  const toggleSliceVisibility = useCallback(
    (id: string) => {
      const targets = selectedSliceIds.includes(id) && selectedSliceIds.length > 1 ? selectedSliceIds : [id],
        nextVisible = simulationVisibility[id] === false;
      recordSimulationHistory(`${nextVisible ? "Show" : "Hide"} ${targets.length} slice${targets.length > 1 ? "s" : ""}`);
      setSimulationVisibility((current) => {
        const next = { ...current };
        targets.forEach((target) => {
          next[target] = nextVisible;
        });
        return next;
      });
    },
    [recordSimulationHistory, selectedSliceIds, simulationVisibility],
  );
  const toggleSliceLock = useCallback(
    (id: string) => {
      const targets = selectedSliceIds.includes(id) && selectedSliceIds.length > 1 ? selectedSliceIds : [id],
        nextLocked = !simulationLocks[id];
      recordSimulationHistory(`${nextLocked ? "Lock" : "Unlock"} ${targets.length} slice${targets.length > 1 ? "s" : ""}`);
      setSimulationLocks((current) => {
        const next = { ...current };
        targets.forEach((target) => {
          next[target] = nextLocked;
        });
        return next;
      });
    },
    [recordSimulationHistory, selectedSliceIds, simulationLocks],
  );
  const groupSelectedSlices = useCallback(() => {
    const ids = selectedSliceIds.filter((id) => !groupedSliceIds.has(id));
    if (!ids.length) {
      setNotice("Select one or more ungrouped slices first");
      return;
    }
    recordSimulationHistory(`Group ${ids.length} slice${ids.length > 1 ? "s" : ""}`);
    const id = `group-${Date.now()}`,
      transform = groupTransformForSliceIds(ids);
    setSimulationTransforms((current) => {
      const next = { ...current };
      ids.forEach((sliceId) => {
        const world = renderedSimulationTransforms[sliceId];
        if (world) next[sliceId] = worldToLocalTransform(transform, world);
      });
      return next;
    });
    setSimulationGroups((current) => [
      ...current,
      {
        id,
        name: `Group ${current.length + 1}`,
        sliceIds: ids,
        parentId: null,
        visible: true,
        locked: false,
        expanded: true,
        transform,
        initialTransform: normalizeTransform(transform),
      },
    ]);
    setSelectedGroupIds([id]);
  }, [groupTransformForSliceIds, groupedSliceIds, recordSimulationHistory, renderedSimulationTransforms, selectedSliceIds]);
  const ungroupSelectedSlices = useCallback(() => {
    const groups = simulationGroups.filter((group) => selectedGroupIds.includes(group.id) || (!selectedGroupIds.length && group.sliceIds.some((id) => selectedSliceIds.includes(id))));
    if (!groups.length) return;
    recordSimulationHistory(`Ungroup ${groups.length} group${groups.length > 1 ? "s" : ""}`);
    const ids = new Set(groups.map((group) => group.id));
    setSimulationTransforms((current) => {
      const next = { ...current };
      groups.forEach((group) =>
        group.sliceIds.forEach((id) => {
          const world = renderedSimulationTransforms[id];
          if (!world) return;
          const parentWorld = group.parentId ? groupWorldById.get(group.parentId) : null;
          next[id] = parentWorld ? worldToLocalTransform(parentWorld, world) : normalizeTransform(world);
        }),
      );
      return next;
    });
    setSimulationGroups((current) => {
      let nextGroups = current
        .filter((group) => !ids.has(group.id))
        .map((group) => {
          if (!group.parentId || !ids.has(group.parentId)) return group;
          const removedParent = simulationGroups.find((item) => item.id === group.parentId),
            nextParentId = removedParent?.parentId || null,
            world = groupWorldById.get(group.id) || group.transform,
            parentWorld = nextParentId ? groupWorldById.get(nextParentId) : null;
          return {
            ...group,
            parentId: nextParentId,
            transform: parentWorld ? worldToLocalTransform(parentWorld, world) : normalizeTransform(world),
          };
        });
      groups.forEach((removed) => {
        if (!removed.parentId || ids.has(removed.parentId)) return;
        nextGroups = nextGroups.map((group) =>
          group.id === removed.parentId
            ? {
                ...group,
                sliceIds: [...group.sliceIds, ...removed.sliceIds.filter((sliceId) => !group.sliceIds.includes(sliceId))],
              }
            : group,
        );
      });
      return nextGroups;
    });
    setSelectedGroupIds([]);
  }, [groupWorldById, recordSimulationHistory, renderedSimulationTransforms, selectedGroupIds, selectedSliceIds, simulationGroups]);
  const commitSimulationTransforms = useCallback(
    (updates: Record<string, SliceTransform>) => {
      const count = Object.keys(updates).length;
      if (!count) return;
      const action = simulationTool === "translate" ? "Move" : simulationTool === "rotate" ? "Rotate" : "Scale";
      recordSimulationHistory(`${action} ${selectedTransformGroups.length ? `${selectedTransformGroups.length} group${selectedTransformGroups.length === 1 ? "" : "s"}` : `${count} slice${count > 1 ? "s" : ""}`}`);
      if (selectedTransformGroups.length) {
        const transforms = new Map<string, SliceTransform>();
        selectedTransformGroups.forEach((selected) => {
          const referenceId = groupDescendantSliceIds(selected.id, simulationGroups).find((id) => updates[id] && renderedSimulationTransforms[id]);
          if (!referenceId) return;
          const selectedWorld = groupWorldById.get(selected.id) || selected.transform,
            rotationDelta = updates[referenceId].rotation.map((value, axis) => value - renderedSimulationTransforms[referenceId].rotation[axis]) as [number, number, number],
            expectedWorldRotation = selectedWorld.rotation.map((value, axis) => value + rotationDelta[axis]) as [number, number, number],
            expectedLocalRotation = selected.transform.rotation.map((value, axis) => value + rotationDelta[axis]) as [number, number, number],
            relativeToGroup = worldToLocalTransform(selectedWorld, renderedSimulationTransforms[referenceId]),
            nextWorld = groupTransformFromMovedChild(relativeToGroup, updates[referenceId], expectedWorldRotation),
            parentWorld = selected.parentId ? groupWorldById.get(selected.parentId) : null,
            transform = parentWorld ? worldToLocalTransform(parentWorld, nextWorld, expectedLocalRotation) : { ...nextWorld, rotation: continuousEuler(nextWorld.rotation, expectedLocalRotation) };
          transforms.set(selected.id, transform);
        });
        setSimulationGroups((current) => current.map((group) => (transforms.has(group.id) ? { ...group, transform: transforms.get(group.id)! } : group)));
        return;
      }
      setSimulationTransforms((current) => {
        const next = { ...current };
        Object.entries(updates).forEach(([id, world]) => {
          const group = groupBySliceId.get(id);
          next[id] = group ? worldToLocalTransform(groupWorldById.get(group.id) || group.transform, world) : normalizeTransform(world);
        });
        return next;
      });
    },
    [groupBySliceId, groupWorldById, recordSimulationHistory, renderedSimulationTransforms, selectedTransformGroups, simulationGroups, simulationTool],
  );

  const hierarchyPlacement = useCallback((event: React.DragEvent<HTMLElement>, allowInside: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (allowInside && ratio >= 0.25 && ratio <= 0.75) return "inside" as const;
    return ratio < 0.5 ? ("before" as const) : ("after" as const);
  }, []);
  const dropHierarchyItem = useCallback(
    (targetKind: "group" | "slice", targetId: string, placement: "before" | "inside" | "after") => {
      const dragged = hierarchyDrag;
      if (!dragged || (dragged.kind === targetKind && dragged.id === targetId)) return;
      if (dragged.kind === "group") {
        if (targetKind !== "group") return;
        const source = simulationGroups.find((group) => group.id === dragged.id),
          target = simulationGroups.find((group) => group.id === targetId);
        if (!source || !target) return;
        const parentId = placement === "inside" ? target.id : target.parentId;
        if (!canParentGroup(source.id, parentId, simulationGroups)) {
          setNotice("A group cannot be placed inside itself or one of its children");
          return;
        }
        recordSimulationHistory(`Move ${source.name} in hierarchy`);
        const sourceWorld = groupWorldById.get(source.id) || source.transform;
        setSimulationGroups((current) => {
          let next = placeTransformGroup(current, source.id, target.id, placement);
          const parentWorld = parentId ? groupWorldTransform(parentId, next) : null;
          const nextLocal = parentWorld ? worldToLocalTransform(parentWorld, sourceWorld) : normalizeTransform(sourceWorld);
          next = next.map((group) =>
            group.id === source.id
              ? {
                  ...group,
                  transform: nextLocal,
                  initialTransform: normalizeTransform(nextLocal),
                }
              : group.id === target.id && placement === "inside"
                ? { ...group, expanded: true }
                : group,
          );
          return next;
        });
      } else {
        const sourceWorld = renderedSimulationTransforms[dragged.id];
        if (!sourceWorld) return;
        const targetOwner = targetKind === "slice" ? groupBySliceId.get(targetId) : simulationGroups.find((group) => group.id === targetId);
        const nextOwnerId = targetKind === "group" ? (placement === "inside" ? targetId : targetOwner?.parentId || null) : targetOwner?.id || null;
        recordSimulationHistory(`Move slice in hierarchy`);
        setSimulationGroups((current) =>
          current.map((group) => {
            const withoutSource = group.sliceIds.filter((id) => id !== dragged.id);
            if (group.id !== nextOwnerId) return withoutSource.length === group.sliceIds.length ? group : { ...group, sliceIds: withoutSource };
            const insertAt = targetKind === "slice" ? Math.max(0, withoutSource.indexOf(targetId) + (placement === "after" ? 1 : 0)) : withoutSource.length;
            const sliceIds = [...withoutSource];
            sliceIds.splice(insertAt, 0, dragged.id);
            return { ...group, sliceIds, expanded: true };
          }),
        );
        const parentWorld = nextOwnerId ? groupWorldById.get(nextOwnerId) : null;
        setSimulationTransforms((current) => ({
          ...current,
          [dragged.id]: parentWorld ? worldToLocalTransform(parentWorld, sourceWorld) : normalizeTransform(sourceWorld),
        }));
      }
      setHierarchyDrag(null);
      setHierarchyDrop(null);
    },
    [groupBySliceId, groupWorldById, hierarchyDrag, recordSimulationHistory, renderedSimulationTransforms, simulationGroups],
  );
  const dropHierarchyAtRoot = useCallback(() => {
    const dragged = hierarchyDrag;
    if (!dragged) return;
    if (dragged.kind === "group") {
      const group = simulationGroups.find((item) => item.id === dragged.id);
      if (!group || !group.parentId) return;
      recordSimulationHistory(`Move ${group.name} to scene root`);
      const world = groupWorldById.get(group.id) || group.transform;
        setSimulationGroups((current) => [...current.filter((item) => item.id !== group.id), { ...group, parentId: null, transform: normalizeTransform(world), initialTransform: normalizeTransform(world) }]);
    } else {
      const owner = groupBySliceId.get(dragged.id),
        world = renderedSimulationTransforms[dragged.id];
      if (!owner || !world) return;
      recordSimulationHistory("Move slice to scene root");
      setSimulationGroups((current) =>
        current.map((group) =>
          group.id === owner.id
            ? {
                ...group,
                sliceIds: group.sliceIds.filter((id) => id !== dragged.id),
              }
            : group,
        ),
      );
      setSimulationTransforms((current) => ({
        ...current,
        [dragged.id]: normalizeTransform(world),
      }));
    }
    setHierarchyDrag(null);
    setHierarchyDrop(null);
  }, [groupBySliceId, groupWorldById, hierarchyDrag, recordSimulationHistory, renderedSimulationTransforms, simulationGroups]);

  const stats = useMemo(() => {
    const pitchX = (config.wallWidth * 1000) / config.resolutionWidth,
      pitchY = (config.wallHeight * 1000) / config.resolutionHeight,
      cols = (config.wallWidth * 1000) / config.cabinetWidth,
      rows = (config.wallHeight * 1000) / config.cabinetHeight;
    return {
      pitchX,
      pitchY,
      cols,
      rows,
      area: config.wallWidth * config.wallHeight,
      mismatch: Math.abs(pitchX - pitchY) > 0.001,
      cabinetRemainder: Math.abs(cols - Math.round(cols)) > 0.01 || Math.abs(rows - Math.round(rows)) > 0.01,
    };
  }, [config]);
  const validations = useMemo(() => (resolumeMap ? buildXmlValidations(allSlices, resolumeMap.screens) : []), [allSlices, resolumeMap]);
  const pendingMapChanges = useMemo(() => {
    if (!pendingXmlUpdate) return { added: 0, removed: 0, changed: 0, screens: 0 };
    const current = new Map(allSlices.map((slice) => [slice.id, JSON.stringify([slice.name, slice.screenName, slice.input, slice.output, slice.warped])])),
      incomingSlices = pendingXmlUpdate.map.screens.flatMap((screen) => screen.slices),
      incoming = new Map(incomingSlices.map((slice) => [slice.id, JSON.stringify([slice.name, slice.screenName, slice.input, slice.output, slice.warped])]));
    return {
      added: incomingSlices.filter((slice) => !current.has(slice.id)).length,
      removed: allSlices.filter((slice) => !incoming.has(slice.id)).length,
      changed: incomingSlices.filter((slice) => current.has(slice.id) && current.get(slice.id) !== incoming.get(slice.id)).length,
      screens: Math.abs((resolumeMap?.screens.length || 0) - pendingXmlUpdate.map.screens.length),
    };
  }, [allSlices, pendingXmlUpdate, resolumeMap?.screens.length]);

  const renderToCanvas = useCallback(
    (canvas: HTMLCanvasElement, mode = workspaceMode, view = mapView, screen = activeScreen, slices?: ResolumeSlice[], selection = true, interactivePreview = false) => {
      const started = performance.now();
      const dimensions = mode === "patterns" ? projectionDimensions(config) : { width: config.resolutionWidth, height: config.resolutionHeight },
        width = mode === "resolume" && resolumeMap ? (view === "input" ? resolumeMap.compositionWidth : screen?.width || 1) : dimensions.width,
        height = mode === "resolume" && resolumeMap ? (view === "input" ? resolumeMap.compositionHeight : screen?.height || 1) : dimensions.height,
        previewScale = interactivePreview && mode === "patterns" && (config.projectionFormat === "dome" || config.projectionFormat === "cubemap")
          ? Math.min(1, Math.max(2400 / Math.max(width, height), displayScale * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)))
          : 1;
      canvas.width = Math.max(1, Math.round(width * previewScale));
      canvas.height = Math.max(1, Math.round(height * previewScale));
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;
      ctx.setTransform(previewScale, 0, 0, previewScale, 0, 0);
      if (mode === "resolume" && resolumeMap) drawPixelMap(ctx, width, height, slices || (view === "input" ? allSlices : screen?.slices || []), view, config, logoImage, sliceOverrides, selectedSliceIds, selection);
      else {
        if (config.projectionFormat !== "planar") drawProjectionPattern(ctx, width, height, patternRenderConfig, logoImage);
        else if (config.pattern === "metric") drawMetric(ctx, width, height, patternRenderConfig, logoImage);
        else if (config.pattern === "cabinet") drawCabinets(ctx, width, height, patternRenderConfig);
        else drawBasicPattern(ctx, width, height, config.pattern);
        if (config.projectionFormat === "planar") drawPatternCalibration(ctx, width, height, patternCalibration);
        if (config.projectionFormat !== "dome" && config.projectionFormat !== "cubemap") drawPatternCenterDot(ctx, width, height, patternStyle);
      }
      if (canvas === canvasRef.current && !document.hidden) renderMetrics[mode].record(performance.now() - started, { width: canvas.width, height: canvas.height });
    },
    [activeScreen, allSlices, config, displayScale, logoImage, mapView, patternCalibration, patternRenderConfig, patternStyle, renderMetrics, resolumeMap, selectedSliceIds, sliceOverrides, workspaceMode],
  );
  const drawSimulationTexture = useCallback(
    (canvas: HTMLCanvasElement, slice?: ResolumeSlice) => {
      if (!resolumeMap) {
        canvas.width = 2;
        canvas.height = 2;
        return;
      }
      if (slice) {
        const shifted = {
          ...slice,
          input: {
            ...slice.input,
            x: 0,
            y: 0,
            points: slice.input.points.map((point) => ({
              x: point.x - slice.input.x,
              y: point.y - slice.input.y,
            })),
          },
          output: {
            ...slice.output,
            x: 0,
            y: 0,
            points: slice.output.points.map((point) => ({
              x: point.x - slice.output.x,
              y: point.y - slice.output.y,
            })),
          },
        };
        canvas.width = Math.max(1, Math.round(slice.input.width));
        canvas.height = Math.max(1, Math.round(slice.input.height));
        const context = canvas.getContext("2d", { alpha: true });
        if (context) drawPixelMap(context, canvas.width, canvas.height, [shifted], "input", config, logoImage, sliceOverrides, [], false);
        return;
      }
      const drawFull = (target: HTMLCanvasElement) => {
        target.width = Math.max(1, Math.round(resolumeMap.compositionWidth));
        target.height = Math.max(1, Math.round(resolumeMap.compositionHeight));
        const context = target.getContext("2d", { alpha: true });
        if (context) drawPixelMap(context, target.width, target.height, allSlices, "input", config, logoImage, sliceOverrides, [], false);
      };
      if (simulationSource === "pattern" || simulationQuality === "quality") {
        drawFull(canvas);
        return;
      }
      const full = document.createElement("canvas");
      drawFull(full);
      const scale = Math.min(1, 2048 / Math.max(full.width, full.height));
      canvas.width = Math.max(1, Math.round(full.width * scale));
      canvas.height = Math.max(1, Math.round(full.height * scale));
      canvas.getContext("2d")?.drawImage(full, 0, 0, canvas.width, canvas.height);
    },
    [allSlices, config, logoImage, resolumeMap, simulationQuality, simulationSource, sliceOverrides],
  );
  const pushPatternOutputFrame = useCallback(async () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.sendPatternOutputFrame || patternOutput === "off" || !patternOutputReadyRef.current || patternOutputBusyRef.current) return;
    patternOutputBusyRef.current = true;
    try {
      if (workspaceMode === "simulation") {
        if (!resolumeMap || !allSlices.length) {
          setPatternOutputStatus("Import a scene before starting 3D Output");
          return;
        }
        const capture = simulationOutputCaptureRef.current;
        if (!capture) return;
        const frame = await capture(resolumeMap.compositionWidth, resolumeMap.compositionHeight);
        const result = await desktop.sendPatternOutputFrame(frame.width, frame.height, frame.data);
        if (!result.ok && result.error !== "Output is not running.") setPatternOutputStatus(result.error || "Unable to update 3D Output");
        return;
      }
    if (workspaceMode === "resolume" && !resolumeMap) {
      setPatternOutputStatus("Import a Pixel Map before starting Output");
      return;
    }
    const canvas = document.createElement("canvas");
    renderToCanvas(canvas, workspaceMode, mapView, activeScreen, undefined, false);
    const context = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
    });
    if (!context) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = await desktop.sendPatternOutputFrame(canvas.width, canvas.height, image.data.buffer as ArrayBuffer);
    if (!result.ok && result.error !== "Output is not running.") setPatternOutputStatus(result.error || "Unable to update the live output");
    } catch (error) {
      setPatternOutputStatus(error instanceof Error ? error.message : "Unable to render Output");
    } finally {
      patternOutputBusyRef.current = false;
    }
  }, [activeScreen, allSlices.length, mapView, patternOutput, renderToCanvas, resolumeMap, workspaceMode]);
  useEffect(() => {
    patternOutputPushRef.current = pushPatternOutputFrame;
  }, [pushPatternOutputFrame]);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.startPatternOutput || !desktop.stopPatternOutput) {
      if (patternOutput !== "off") {
        const statusTimer = window.setTimeout(() => setPatternOutputStatus("NDI/Spout output is available in the Windows app"), 0);
        return () => window.clearTimeout(statusTimer);
      }
      return;
    }
    let cancelled = false;
    patternOutputReadyRef.current = false;
    if (patternOutput === "off") {
      const statusTimer = window.setTimeout(() => setPatternOutputStatus("Output disabled"), 0);
      void desktop.stopPatternOutput();
      return () => {
        cancelled = true;
        window.clearTimeout(statusTimer);
      };
    }
    const statusTimer = window.setTimeout(() => setPatternOutputStatus(`Starting ${patternOutput.toUpperCase()}…`), 0);
    void desktop.startPatternOutput(patternOutput, "LO2S - OpticMesh Output").then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPatternOutputStatus(result.error || `Unable to start ${patternOutput.toUpperCase()}`);
        return;
      }
      patternOutputReadyRef.current = true;
      await patternOutputPushRef.current();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(statusTimer);
    };
  }, [patternOutput]);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (patternOutput === "off" || !desktop?.sendPatternOutputFrame || workspaceMode === "simulation") return;
    if (patternOutputTimerRef.current !== null) window.clearTimeout(patternOutputTimerRef.current);
    patternOutputTimerRef.current = window.setTimeout(() => {
      patternOutputTimerRef.current = null;
      void patternOutputPushRef.current();
    }, 120);
    return () => {
      if (patternOutputTimerRef.current !== null) window.clearTimeout(patternOutputTimerRef.current);
    };
  }, [mapView, patternOutput, resolumeMap, simulationTextureVersion, workspaceMode]);
  useEffect(() => {
    if (patternOutput === "off" || workspaceMode !== "simulation") return;
    let cancelled = false, timer = 0;
    const pump = async () => {
      await patternOutputPushRef.current();
      if (!cancelled) timer = window.setTimeout(pump, 1000 / 15);
    };
    timer = window.setTimeout(pump, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [patternOutput, resolumeMap?.compositionHeight, resolumeMap?.compositionWidth, workspaceMode]);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.onPatternOutputStatus) return;
    return desktop.onPatternOutputStatus((status) => {
      if (status.status === "connected") {
        patternOutputReadyRef.current = true;
        setPatternOutputStatus(`${status.name} · ${status.width || 0} × ${status.height || 0} · ${status.fps?.toFixed(0) || 30} fps · RGBA`);
      } else {
        if (status.status === "error" || status.status === "disconnected") patternOutputReadyRef.current = false;
        setPatternOutputStatus(status.name || status.status);
      }
    });
  }, []);
  useEffect(
    () => () => {
      const desktop = (window as PickerWindow).lo2sDesktop;
      void desktop?.stopPatternOutput?.();
    },
    [],
  );
  useEffect(() => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    if (previewQualityTimerRef.current !== null) window.clearTimeout(previewQualityTimerRef.current);
    const useWorkingRaster = workspaceMode === "patterns" && (config.projectionFormat === "dome" || config.projectionFormat === "cubemap") && fullscreenMode !== "actual";
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      if (canvasRef.current) renderToCanvas(canvasRef.current, workspaceMode, mapView, activeScreen, undefined, true, useWorkingRaster);
    });
    if (useWorkingRaster && config.projectionFormat === "dome")
      previewQualityTimerRef.current = window.setTimeout(() => {
        previewQualityTimerRef.current = null;
        if (canvasRef.current) renderToCanvas(canvasRef.current, workspaceMode, mapView, activeScreen, undefined, true, false);
      }, 180);
    return () => {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
      if (previewQualityTimerRef.current !== null) window.clearTimeout(previewQualityTimerRef.current);
    };
  }, [activeScreen, config.projectionFormat, fullscreenMode, mapView, renderToCanvas, workspaceMode]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    if (workspaceMode === "simulation") return;
    const stage = canvasStageRef.current;
    if (!stage) return;
    const updateBounds = () => {
      const width = stage.clientWidth,
        height = stage.clientHeight;
      if (width > 1 && height > 1) setStageBounds({ width, height });
    };
    updateBounds();
    const frame = requestAnimationFrame(updateBounds),
      observer = new ResizeObserver(updateBounds);
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [workspaceMode, outputWidth, outputHeight]);
  useEffect(() => {
    if (!sequenceActive || workspaceMode !== "patterns") return;
    const timer = window.setInterval(
      () =>
        setConfig((current) => ({
          ...current,
          pattern: PATTERNS[(PATTERNS.findIndex((item) => item.id === current.pattern) + 1) % PATTERNS.length].id,
        })),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [sequenceActive, workspaceMode]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  useEffect(() => {
    const handleHistory = (event: KeyboardEvent) => {
      if (workspaceMode !== "simulation" || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      window.dispatchEvent(new Event("lo2s-history-navigation"));
      if (key === "z") {
        if (event.shiftKey) redoSimulation();
        else undoSimulation();
      } else redoSimulation();
    };
    window.addEventListener("keydown", handleHistory);
    return () => window.removeEventListener("keydown", handleHistory);
  }, [redoSimulation, undoSimulation, workspaceMode]);

  useEffect(() => {
    const handleViewportShortcut = (event: KeyboardEvent) => {
      if (workspaceMode !== "simulation" || event.defaultPrevented || event.isComposing || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      // Editing, native selects and open menus/dialogs retain their keyboard behavior.
      if (target?.isContentEditable || target?.closest('input, textarea, select, [role="textbox"], [role="combobox"], [role="menu"]') || document.querySelector('dialog[open], [role="menu"], section[id^="toolbar-menu-"]')) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === "g" && !event.shiftKey) {
          event.preventDefault();
          if (!event.repeat && selectedSliceIds.length && !hasGroupSelection) groupSelectedSlices();
          return;
        }
        if (key !== "a" || event.shiftKey || !document.activeElement?.closest('.three-view') || !fullscreenHostRef.current?.contains(document.activeElement)) return;
        event.preventDefault();
        setSimulationTransformPreview(null);
        setSelectedGroupIds([]);
        setSelectedSliceIds(allSlices.map((slice) => slice.id));
        return;
      }
      const viewShortcuts: Partial<Record<string, SimulationView>> = {
        f1: "perspective", f2: "top", f3: "right", f4: "front", f5: "four",
      };
      const nextView = viewShortcuts[key];
      if (nextView && !event.shiftKey) {
        // Consume F5 before Chromium can reload the project renderer.
        event.preventDefault();
        if (!event.repeat) setSimulationViewMode(nextView);
        return;
      }
      if (!["s", "f", "e", "r", "t"].includes(key)) return;
      event.preventDefault();
      if (event.repeat) return;
      if (key === "e") setSimulationTool("translate");
      else if (key === "r") setSimulationTool("rotate");
      else if (key === "t") setSimulationTool("scale");
      else if (key === "f") setSimulationFitSignal((value) => value + 1);
      else if (selectedSliceIds.length) setSimulationFocusSignal((value) => value + 1);
    };
    window.addEventListener("keydown", handleViewportShortcut);
    return () => window.removeEventListener("keydown", handleViewportShortcut);
  }, [allSlices, groupSelectedSlices, hasGroupSelection, selectedSliceIds.length, workspaceMode]);

  const openArrangeControls = (section: "align" | "distribute") => {
    setV070InspectorTab("scene");
    setArrangeNavigation({ section });
  };
  useEffect(() => {
    if (!arrangeNavigation || handledArrangeNavigation.current === arrangeNavigation || workspaceMode !== "simulation" || v070InspectorTab !== "scene") return;
    const section = document.getElementById(`scene-${arrangeNavigation.section}`);
    section?.scrollIntoView({ block: "nearest" });
    section?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    if (section) handledArrangeNavigation.current = arrangeNavigation;
  }, [arrangeNavigation, v070InspectorTab, workspaceMode]);

  const update = useCallback(<K extends keyof PatternConfig>(key: K, value: PatternConfig[K]) => setConfig((current) => ({ ...current, [key]: value })), []);
  const updatePatternStyle = useCallback(<K extends keyof PatternStyle>(key: K, value: PatternStyle[K]) => setPatternStyle((current) => ({ ...current, [key]: value })), []);
  const updateGlobal = useCallback(<K extends keyof PatternConfig>(key: K, value: PatternConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    const mapped = key === "customLogoScale" ? "logoScale" : key === "customLogoPosition" ? "logoPosition" : key === "showLogo" ? "logoVisible" : key;
    setSliceOverrides((current) => {
      const next: Record<string, SliceOverride> = {};
      Object.entries(current).forEach(([id, override]) => {
        const cleaned = { ...override };
        delete cleaned[mapped as keyof SliceOverride];
        if (Object.keys(cleaned).length) next[id] = cleaned;
      });
      return next;
    });
  }, []);
  const snapPhysical = useCallback((value: number, cabinetMm: number) => round(Math.round(value / (cabinetMm / 1000)) * (cabinetMm / 1000), 3), []);
  const editCalculator = useCallback(
    (group: CalculatorGroup, key: keyof PatternConfig, value: number) => {
      const other = calculatorSources.find((source) => source !== group),
        nextSources: [CalculatorGroup, CalculatorGroup] = calculatorSources.includes(group) ? [other || calculatorSources[0], group] : [calculatorSources[1], group];
      setCalculatorSources(nextSources);
      setConfig((current) => {
        const next = { ...current, [key]: value } as PatternConfig,
          hasPhysical = nextSources.includes("physical"),
          hasRaster = nextSources.includes("raster"),
          hasPitch = nextSources.includes("pitch");
        if (hasPhysical && hasRaster) next.pixelPitchMm = round((next.wallWidth * 1000) / next.resolutionWidth);
        else if (hasPhysical && hasPitch) {
          next.resolutionWidth = Math.max(1, Math.round((next.wallWidth * 1000) / next.pixelPitchMm));
          next.resolutionHeight = Math.max(1, Math.round((next.wallHeight * 1000) / next.pixelPitchMm));
        } else if (hasRaster && hasPitch) {
          next.wallWidth = snapPhysical((next.resolutionWidth * next.pixelPitchMm) / 1000, next.cabinetWidth);
          next.wallHeight = snapPhysical((next.resolutionHeight * next.pixelPitchMm) / 1000, next.cabinetHeight);
        }
        return next;
      });
    },
    [calculatorSources, snapPhysical],
  );
  const updateSelected = useCallback(
    (patch: SliceOverride) => {
      if (!selectedSliceIds.length) return;
      setSliceOverrides((current) => {
        const next = { ...current };
        selectedSliceIds.forEach((id) => {
          next[id] = { ...(next[id] || {}), ...patch };
        });
        return next;
      });
    },
    [selectedSliceIds],
  );

  const loadLogo = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setLogoData(reader.result);
      setLogoName(file.name);
      const image = new Image();
      image.onload = () => setLogoImage(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, []);
  const applyXmlText = useCallback(
    (
      xml: string,
      name: string,
      options: {
        linked?: boolean;
        path?: string;
        mtimeMs?: number;
        resetView?: boolean;
      } = {},
    ) => {
      try {
        const map = parseResolumeXml(xml),
          validIds = new Set(map.screens.flatMap((screen) => screen.slices.map((slice) => slice.id)));
        setResolumeMap(map);
        setRawXml(xml);
        setXmlName(name);
        setXmlPath(options.path || "");
        setXmlUpdatedAt(options.mtimeMs || Date.now());
        setXmlError("");
        setPendingXmlUpdate(null);
        setSimulationFitSignal((value) => value + 1);
        setSelectedScreen((current) => Math.min(current, Math.max(0, map.screens.length - 1)));
        setSelectedSliceIds((current) => current.filter((id) => validIds.has(id)));
        setWorkspaceMode((current) => (current === "simulation" ? "simulation" : "resolume"));
        if (options.resetView) {
          setSelectedScreen(0);
          setSelectedSliceIds([]);
          zoomRef.current = 1;
          panRef.current = { x: 0, y: 0 };
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
        setXmlLinkState(options.linked ? "linked" : "unlinked");
        setNotice(options.linked ? `Resolume link updated: ${name}` : `Loaded ${map.screens.length} screens and ${map.screens.flatMap((screen) => screen.slices).length} slices`);
        return true;
      } catch (error) {
        setXmlError(error instanceof Error ? error.message : "Unable to read this XML file.");
        return false;
      }
    },
    [],
  );
  const loadXml = useCallback(
    (file?: File) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (applyXmlText(String(reader.result), file.name, { resetView: true })) {
          setXmlLinkState("unlinked");
          setXmlPath("");
        }
      };
      reader.readAsText(file);
    },
    [applyXmlText],
  );
  const chooseXml = useCallback(async () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop) {
      xmlInputRef.current?.click();
      return;
    }
    const result = await desktop.chooseResolumeXml();
    if (result.cancelled) return;
    if (!result.ok || !result.content || !result.name) {
      setXmlError(result.error || "Unable to open this XML preset.");
      return;
    }
    applyXmlText(result.content, result.name, {
      path: result.path,
      mtimeMs: result.mtimeMs,
      resetView: true,
    });
  }, [applyXmlText]);
  const linkResolume = useCallback(async () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop) {
      setNotice("Live Resolume linking is available in the Windows app");
      return;
    }
    setXmlLinkState("linking");
    setXmlError("");
    const result = await desktop.linkLatestResolumeMap();
    if (!result.ok || !result.content || !result.name) {
      setXmlLinkState("unlinked");
      setXmlError(result.error || "Unable to link the Resolume Advanced Output folder.");
      return;
    }
    applyXmlText(result.content, result.name, {
      linked: true,
      path: result.path,
      mtimeMs: result.mtimeMs,
      resetView: true,
    });
  }, [applyXmlText]);
  const unlinkResolume = useCallback(async () => {
    await (window as PickerWindow).lo2sDesktop?.unlinkResolumeMap();
    setXmlLinkState("unlinked");
    setNotice("Resolume map unlinked");
  }, []);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop) return;
    const removeUpdate = desktop.onResolumeXmlUpdated((result) => {
      if (result.ok && result.content && result.name) {
        try {
          const map = parseResolumeXml(result.content);
          setPendingXmlUpdate({ xml: result.content, name: result.name, path: result.path, mtimeMs: result.mtimeMs, map });
          setV070DiagnosticTab("changes");
          setV070DiagnosticsOpen(true);
          setNotice(`Linked map changed: review ${result.name} before applying`);
        } catch (error) {
          setXmlError(error instanceof Error ? error.message : "The linked Resolume map update could not be parsed.");
        }
      }
    });
    const removeError = desktop.onResolumeLinkError((result) => {
      setXmlError(result.error || "The linked Resolume map could not be refreshed.");
    });
    return () => {
      removeUpdate();
      removeError();
    };
  }, [applyXmlText]);
  const stopSimulationInput = useCallback(() => {
    simulationInputStreamRef.current?.getTracks().forEach((track) => track.stop());
    simulationInputStreamRef.current = null;
    setSimulationSourceVideo(null);
    setSimulationSourceStatus("Not connected");
  }, []);
  const scanNativeSources = useCallback(async (kind: "ndi" | "spout") => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.listNativeSources) {
      setSimulationNativeSources([]);
      setSimulationSourceStatus("Use the Windows beta for native sources");
      return;
    }
    setSimulationNativeScanning(true);
    setSimulationSourceStatus(kind === "ndi" ? "Scanning the NDI network…" : "Scanning for Spout senders…");
    try {
      const result = await desktop.listNativeSources(kind);
      if (!result.ok) throw new Error(result.error || "Source scan failed.");
      const sources = result.sources || [];
      setSimulationNativeSources(sources);
      if (kind === "ndi") setSimulationNdiSourceId((current) => (sources.some((source) => source.id === current) ? current : sources[0]?.id || ""));
      else setSimulationSpoutSourceId((current) => (sources.some((source) => source.id === current) ? current : sources[0]?.id || ""));
      setSimulationSourceStatus(sources.length ? `${sources.length} ${kind === "ndi" ? "NDI source" : "Spout sender"}${sources.length === 1 ? "" : "s"} found` : `No ${kind === "ndi" ? "NDI sources" : "Spout senders"} found`);
    } catch (error) {
      setSimulationNativeSources([]);
      setSimulationSourceStatus(error instanceof Error ? error.message : "Unable to scan native sources.");
    } finally {
      setSimulationNativeScanning(false);
    }
  }, []);
  const disconnectNativeInput = useCallback(async () => {
    await (window as PickerWindow).lo2sDesktop?.disconnectNativeSource?.();
    setSimulationNativeConnected(false);
    setSimulationNativeKind(null);
    simulationNativeCanvasRef.current = null;
    setSimulationNativeCanvas(null);
    setSimulationSourceStatus("Not connected");
  }, []);
  const connectNativeInput = useCallback(
    async (qualityOverride?: "latency" | "quality", kindOverride?: "ndi" | "spout", sourceOverride?: string) => {
      const kind = kindOverride || (sourcePanelType === "ndi" || sourcePanelType === "spout" ? sourcePanelType : null);
      if (!kind) return;
      const desktop = (window as PickerWindow).lo2sDesktop;
      if (!desktop?.connectNativeSource) {
        setSimulationSourceStatus("Native sources require the Windows beta");
        return;
      }
      const sourceId = sourceOverride || (kind === "ndi" ? simulationNdiSourceId : simulationSpoutSourceId);
      if (!sourceId) {
        setSimulationSourceStatus(`Choose a ${kind === "ndi" ? "NDI source" : "Spout sender"} first`);
        return;
      }
      await desktop.disconnectNativeSource();
      simulationNativeCanvasRef.current = null;
      setSimulationNativeCanvas(null);
      setSimulationNativeConnected(false);
      setSimulationNativeKind(kind);
      setSimulationSourceStatus("Connecting…");
      const result = await desktop.connectNativeSource(kind, sourceId, qualityOverride || simulationQuality);
      if (!result.ok) setSimulationSourceStatus(result.error || "The native source could not connect.");
    },
    [simulationNdiSourceId, simulationQuality, simulationSpoutSourceId, sourcePanelType],
  );
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.onNativeSourceFrame || !desktop.onNativeSourceStatus) return;
    const removeFrame = desktop.onNativeSourceFrame((frame) => {
      try {
        let canvas = simulationNativeCanvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          simulationNativeCanvasRef.current = canvas;
          setSimulationNativeCanvas(canvas);
        }
        if (canvas.width !== frame.width || canvas.height !== frame.height) {
          canvas.width = frame.width;
          canvas.height = frame.height;
        }
        const bytes = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data);
        const expectedLength = frame.width * frame.height * 4;
        const rgba = bytes.byteLength >= expectedLength ? new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, expectedLength) : new Uint8ClampedArray(expectedLength);
        if (bytes.byteLength < expectedLength) rgba.set(bytes);
        canvas.getContext("2d", { alpha: true })?.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, frame.width, frame.height), 0, 0);
        canvas.dataset.frameVersion = String(Number(canvas.dataset.frameVersion || "0") + 1);
      } finally {
        desktop.nativeSourceFrameReady();
      }
    });
    const removeStatus = desktop.onNativeSourceStatus((status) => {
      simulationNativeStatusRef.current = status;
      setSimulationNativeConnected(status.status === "connected");
      if (status.status === "connected") {
        if (status.transport === "shared-memory") {
          const canvas = document.getElementById("lo2s-native-shared-canvas") as HTMLCanvasElement | null;
          if (canvas) {
            simulationNativeCanvasRef.current = canvas;
            setSimulationNativeCanvas(canvas);
          }
        }
        setSimulationSourceStatus(`${status.name} · ${status.width || 0} × ${status.height || 0}${status.fps ? ` · ${status.fps.toFixed(2)} fps` : ""}${status.transport === "shared-memory" ? " · Shared memory" : ""}`);
      } else setSimulationSourceStatus(status.name || (status.status === "connecting" ? "Connecting…" : "Not connected"));
    });
    const removeMetrics = desktop.onNativeSourceMetrics?.((metrics) => {
      const source = simulationNativeStatusRef.current;
      if (!source || source.status !== "connected" || source.transport !== "shared-memory") return;
      setSimulationSourceStatus(`${source.name} · ${source.width || 0} × ${source.height || 0} · Display ${metrics.displayedFps.toFixed(1)} fps · Convert ${metrics.conversionMs.toFixed(2)} ms · Copy ${metrics.copyMs.toFixed(2)} ms · Canvas ${metrics.canvasMs.toFixed(2)} ms · Missed ${metrics.overwritten}`);
    });
    return () => {
      removeFrame();
      removeStatus();
      removeMetrics?.();
      void desktop.disconnectNativeSource();
    };
  }, []);
  useEffect(() => {
    if (sourcePanelType !== "ndi" && sourcePanelType !== "spout") return;
    const timer = window.setTimeout(() => void scanNativeSources(sourcePanelType), 0);
    return () => window.clearTimeout(timer);
  }, [scanNativeSources, sourcePanelType]);
  const connectSimulationInput = useCallback(
    async (qualityOverride?: "latency" | "quality", deviceOverride?: string) => {
      if (sourcePanelType !== "video") {
        setSimulationSourceStatus("Choose a native source below");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setSimulationSourceStatus("Use the Windows beta for live video inputs");
        return;
      }
      setSimulationSourceStatus("Connecting…");
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        if (!devices.some((device) => device.kind === "videoinput" && device.label)) {
          const permissionStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          permissionStream.getTracks().forEach((track) => track.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        }
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        setSimulationInputDevices(videoDevices);
        const selected = videoDevices.find((device) => device.deviceId === (deviceOverride || simulationInputDeviceId)) || videoDevices[0];
        if (!selected) throw new Error("No video device was found.");
        setSimulationInputDeviceId(selected.deviceId);
        simulationInputStreamRef.current?.getTracks().forEach((track) => track.stop());
        const quality = qualityOverride || simulationQuality;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: selected.deviceId },
            width: { ideal: quality === "quality" ? 3840 : 1280 },
            height: { ideal: quality === "quality" ? 2160 : 720 },
            frameRate: { ideal: quality === "quality" ? 60 : 30, max: 60 },
          },
        });
        const video = document.createElement("video");
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        simulationInputStreamRef.current = stream;
        setSimulationSourceVideo(video);
        const settings = stream.getVideoTracks()[0]?.getSettings();
        setSimulationSourceStatus((selected.label || "Video input") + " · " + (settings?.width || video.videoWidth) + " × " + (settings?.height || video.videoHeight));
      } catch (error) {
        stopSimulationInput();
        setSimulationSourceStatus(error instanceof Error ? error.message : "Unable to connect this video source.");
      }
    },
    [simulationInputDeviceId, simulationQuality, sourcePanelType, stopSimulationInput],
  );
  useEffect(
    () => () => {
      simulationInputStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  const saveBlob = useCallback(async (blob: Blob, filename: string) => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (desktop?.saveExport) {
      const result = await desktop.saveExport(filename, "image/png", await blob.arrayBuffer(), "png");
      if (!result.ok && !result.cancelled) throw new Error(result.error || "Unable to save the PNG.");
      return;
    }
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (picker)
      try {
        const handle = await picker.call(window, {
          suggestedName: filename,
          types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);
  const saveExportBlob = useCallback(async (blob: Blob, filename: string, mimeType: string) => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (desktop?.saveExport) {
      const result = await desktop.saveExport(filename, mimeType, await blob.arrayBuffer(), "scene3d");
      if (result.cancelled) return false;
      if (!result.ok) throw new Error(result.error || "Unable to save the exported scene.");
      return true;
    }
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }, []);
  const export3DScene = useCallback(async (formatOverride?: SceneExportFormat) => {
    if (!resolumeMap || !allSlices.length || simulationExporting) {
      setNotice("Import a Resolume XML map before exporting the 3D scene");
      return;
    }
    if (invalidCurvedDepthSlices.length) {
      setNotice(`Export blocked: reduce extrusion depth for ${invalidCurvedDepthSlices.length} curved screen${invalidCurvedDepthSlices.length > 1 ? "s" : ""}`);
      return;
    }
    const format = formatOverride || simulationExportFormat;
    setSimulationExportFormat(format);
    setSimulationExporting(true);
    setNotice("Building " + format.toUpperCase() + " scene…");
    try {
      const result = await exportSimulationScene(format, {
        projectName: resolumeMap.name || config.project,
        slices: allSlices,
        compositionWidth: resolumeMap.compositionWidth,
        compositionHeight: resolumeMap.compositionHeight,
        masterPitchMm: simulationMasterPitchMm,
        pitchBySlice: simulationPitchBySlice,
        depthBySlice: simulationDepthBySlice,
        curvatureBySlice: simulationCurvatureBySlice,
        pivotBySlice: simulationPivotBySlice,
        transforms: simulationExportTransforms,
        groups: simulationGroups,
        drawPatternTexture: drawSimulationTexture,
      });
      if (await saveExportBlob(result.blob, result.filename, result.mimeType)) setNotice("Exported " + result.filename + " · " + result.sliceCount + " screens · " + Math.round(result.triangleCount).toLocaleString() + " triangles");
    } catch (error) {
      setNotice(error instanceof Error ? "Export failed: " + error.message : "The 3D scene could not be exported.");
    } finally {
      setSimulationExporting(false);
    }
  }, [allSlices, config.project, drawSimulationTexture, invalidCurvedDepthSlices.length, resolumeMap, saveExportBlob, simulationCurvatureBySlice, simulationDepthBySlice, simulationExportFormat, simulationExportTransforms, simulationExporting, simulationGroups, simulationMasterPitchMm, simulationPitchBySlice, simulationPivotBySlice]);
  const exportCurrent = useCallback(async () => {
    const canvas = document.createElement("canvas");
    renderToCanvas(canvas, workspaceMode, mapView, activeScreen, undefined, false);
    const blob = await canvasBlob(canvas);
    if (!blob) return;
    const name = workspaceMode === "resolume" && resolumeMap
      ? `${slugify(mapView === "input" ? resolumeMap.name : activeScreen?.name || "output")}-${mapView}-${canvas.width}x${canvas.height}.png`
      : `OpticMesh - ${patternProjectTitle(config.project)} - ${patternModeFilename(config.projectionFormat)} - ${canvas.width}x${canvas.height}.png`;
    await saveBlob(blob, name);
    setNotice(`Exported ${name}`);
  }, [activeScreen, config.project, config.projectionFormat, mapView, renderToCanvas, resolumeMap, saveBlob, workspaceMode]);
  const exportOutputs = useCallback(async () => {
    if (!resolumeMap) return;
    const desktop = (window as PickerWindow).lo2sDesktop,
      generated: Array<{ filename: string; blob: Blob }> = [];
    for (const screen of resolumeMap.screens) {
      const canvas = document.createElement("canvas");
      renderToCanvas(canvas, "resolume", "output", screen, undefined, false);
      const blob = await canvasBlob(canvas);
      if (blob)
        generated.push({
          filename: `${slugify(screen.name)}-output-${canvas.width}x${canvas.height}.png`,
          blob,
        });
    }
    if (desktop?.saveExports) {
      const files = await Promise.all(
          generated.map(async (item) => ({
            filename: item.filename,
            data: await item.blob.arrayBuffer(),
          })),
        ),
        result = await desktop.saveExports(files);
      setNotice(result.ok ? `Exported ${files.length} output maps to OpticMesh\\Test Patterns` : result.error || "Unable to export output maps");
      return;
    }
    const directoryPicker = (window as PickerWindow).showDirectoryPicker;
    let directory: DirectoryHandle | null = null;
    if (directoryPicker)
      try {
        directory = await directoryPicker.call(window);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    for (const item of generated) {
      if (directory) {
        const handle = await directory.getFileHandle(item.filename, {
            create: true,
          }),
          writable = await handle.createWritable();
        await writable.write(item.blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(item.blob),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = item.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    }
    setNotice(`Exported ${generated.length} output maps`);
  }, [renderToCanvas, resolumeMap]);
  const exportSelected = useCallback(async () => {
    if (!selectedSlices.length) return;
    for (const slice of selectedSlices) {
      const rect = mapView === "input" ? slice.input : slice.output,
        shifted = {
          ...slice,
          input: {
            ...slice.input,
            x: 0,
            y: 0,
            points: slice.input.points.map((p) => ({
              x: p.x - rect.x,
              y: p.y - rect.y,
            })),
          },
          output: {
            ...slice.output,
            x: 0,
            y: 0,
            points: slice.output.points.map((p) => ({
              x: p.x - rect.x,
              y: p.y - rect.y,
            })),
          },
        };
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) continue;
      drawPixelMap(ctx, canvas.width, canvas.height, [shifted], mapView, config, logoImage, sliceOverrides, [], false);
      const blob = await canvasBlob(canvas);
      if (blob) await saveBlob(blob, `${slugify(slice.screenName)}-${slugify(slice.name)}-${mapView}-${canvas.width}x${canvas.height}.png`);
    }
    setNotice(`Exported ${selectedSlices.length} selected slice${selectedSlices.length > 1 ? "s" : ""}`);
  }, [config, logoImage, mapView, saveBlob, selectedSlices, sliceOverrides]);

  const projectData = useMemo(
    () =>
      JSON.stringify(
        {
          format: "opticmesh-project",
          version: 3,
          appVersion: packageMetadata.version,
          config,
          patternStyle,
          patternCalibration,
          calculatorSources,
          workspaceMode,
          mapView,
          logoData,
          logoName,
          sliceOverrides,
          rawXml,
          xmlName,
          simulation: {
            transforms: simulationTransforms,
            depthM: simulationDepthM,
            curvature: simulationCurvature,
            curvatureOverrides: simulationCurvatureOverrides,
            tool: simulationTool,
            source: simulationSource,
            quality: simulationQuality,
            sourceOverrides: simulationSourceOverrides,
            camera: simulationCamera,
            transformSpace: simulationTransformSpace,
            pivot: simulationPivot,
            pivotOverrides: simulationPivotOverrides,
            gridVisible: simulationGridVisible,
      snapEnabled: simulationSnapEnabled,
            floorVisible: simulationFloorVisible,
            backgroundLevel: simulationBackgroundLevel,
            visibility: simulationVisibility,
            locks: simulationLocks,
            localNames: simulationLocalNames,
            groups: simulationGroups,
          },
        },
        null,
        2,
      ),
    [calculatorSources, config, logoData, logoName, mapView, patternCalibration, patternStyle, rawXml, simulationBackgroundLevel, simulationCamera, simulationCurvature, simulationCurvatureOverrides, simulationDepthM, simulationFloorVisible, simulationGridVisible, simulationSnapEnabled, simulationGroups, simulationLocalNames, simulationLocks, simulationPivot, simulationPivotOverrides, simulationQuality, simulationSource, simulationSourceOverrides, simulationTool, simulationTransformSpace, simulationTransforms, simulationVisibility, sliceOverrides, workspaceMode, xmlName],
  );
  const encodedProjectData = useCallback(() => {
    const encoded = new TextEncoder().encode(projectData);
    return encoded.buffer as ArrayBuffer;
  }, [projectData]);
  const applyProjectData = useCallback((source: string, successMessage = "Project loaded") => {
    try {
      const data = JSON.parse(source);
      if (data?.format !== "opticmesh-project") throw new Error("This is not a LO2S - OpticMesh project.");
      if (Number(data.version || 1) > 3) throw new Error(`This project uses schema ${data.version}; this version supports schema 3.`);
      const migrated = {
        ...DEFAULT_CONFIG,
        ...data.config,
      } as PatternConfig & { pixelPitchCm?: number; checkerColor?: string };
      if (!data.config?.pixelPitchMm && data.config?.pixelPitchCm) migrated.pixelPitchMm = data.config.pixelPitchCm * 10;
      if (data.config?.checkerColor && !data.config?.checkerColorA) {
        migrated.checkerColorA = data.config.checkerColor;
        migrated.checkerColorB = "#004d3d";
      }
      if (migrated.projectionFormat === "cylindrical" || migrated.projectionFormat === "equirectangular") migrated.projectionFormat = "planar";
      migrated.centerDotSize = normalizeCenterDotSize(migrated.centerDotSize);
      migrated.domeCenterDotSize = normalizeCenterDotSize(migrated.domeCenterDotSize);
      setConfig(migrated);
      const loadedPatternStyle = { ...DEFAULT_PATTERN_STYLE, ...(data.patternStyle || patternStyleFromConfig(migrated)) };
      setPatternStyle({ ...loadedPatternStyle, centerDotSize: normalizeCenterDotSize(loadedPatternStyle.centerDotSize) });
      setPatternCalibration(data.patternCalibration === "gamma" || data.patternCalibration === "seam" ? data.patternCalibration : "none");
      setCalculatorSources(Array.isArray(data.calculatorSources) && data.calculatorSources.length === 2 ? data.calculatorSources : ["physical", "raster"]);
      setWorkspaceMode(data.workspaceMode || "patterns");
      setMapView(data.mapView || "input");
      setSliceOverrides(Object.fromEntries(Object.entries((data.sliceOverrides || {}) as Record<string, SliceOverride>)
        .map(([id, override]) => [id, override.centerDotSize == null ? override : { ...override, centerDotSize: normalizeCenterDotSize(override.centerDotSize) }])));
      setRawXml(data.rawXml || "");
      setXmlName(data.xmlName || "");
      setSelectedScreen(0);
      setSelectedSliceIds([]);
      if (data.rawXml) setResolumeMap(parseResolumeXml(data.rawXml));
      else setResolumeMap(null);
      setLogoData(data.logoData || "");
      setLogoName(data.logoName || "");
      if (data.logoData) {
        const image = new Image();
        image.onload = () => setLogoImage(image);
        image.src = data.logoData;
      } else setLogoImage(null);
      const simulation = data.simulation || {};
      setSimulationTransforms(simulation.transforms || {});
      setSimulationDepthM(clamp(simulation.depthM ?? 0.1, 0.01, 0.5));
      setSimulationCurvature(simulation.curvature || { horizontal: 0, vertical: 0 });
      setSimulationCurvatureOverrides(simulation.curvatureOverrides || {});
      setSimulationTool(simulation.tool || "translate");
      setSimulationSource(normalizeSimulationSource(simulation.source));
      setSimulationQuality(simulation.quality || "latency");
      setSimulationSourceOverrides(normalizeSourceOverrides(simulation.sourceOverrides));
      setSimulationCamera(simulation.camera);
      setSimulationTransformSpace(simulation.transformSpace || "local");
      setSimulationPivot(simulation.pivot || "bottom-center");
      setSimulationPivotOverrides(simulation.pivotOverrides || {});
      setSimulationGridVisible(simulation.gridVisible ?? true);
      setSimulationSnapEnabled(simulation.snapEnabled ?? false);
      setSimulationFloorVisible(simulation.floorVisible ?? true);
      setSimulationBackgroundLevel(simulation.backgroundLevel ?? 100);
      setSimulationVisibility(simulation.visibility || {});
      setSimulationLocks(simulation.locks || {});
      setSimulationLocalNames(simulation.localNames || {});
      setSimulationGroups(Array.isArray(simulation.groups) ? simulation.groups.map(migrateTransformGroup) : []);
      setSelectedGroupIds([]);
      undoHistoryRef.current = [];
      redoHistoryRef.current = [];
      setHistoryState({});
      setNotice(successMessage);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That project file could not be read");
      return false;
    }
  }, []);
  const compileProject = async () => {
    if (compileInFlight.current || !resolumeMap || !rawXml) return;
    compileInFlight.current = true; setCompilingProject(true);
    const desktop = (window as PickerWindow).lo2sDesktop;
    let parent: DirectoryHandle | null = null, destination: DirectoryHandle | null = null, folderName = config.project;
    const created: string[] = [];
    try {
      if (!desktop?.compileProject) {
        const picker = (window as PickerWindow).showDirectoryPicker;
        if (!picker) throw new Error("Compile Project needs folder access. Use the Windows app or a browser with folder picking support.");
        const chosen = window.prompt("Compile Project — File name (new project folder)", config.project);
        if (chosen === null) return;
        folderName = chosen.trim();
        if (!folderName || folderName.length > 120 || /[<>:"/\\|?*\x00-\x1f]/.test(folderName) || /[. ]$/.test(folderName) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(folderName)) throw new Error("Choose a valid project folder name.");
        parent = await picker.call(window);
        try { await parent.getDirectoryHandle(folderName, { create: false }); throw new Error("That folder already exists. Choose a new name."); }
        catch (error) { if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error; }
      }
      setNotice("Compiling project maps…");
      const files: Array<{ filename: string; data: ArrayBuffer }> = [];
      const views: Array<{ filename: string; view: MapView; screen: ResolumeScreen }> = [
        { filename: "Input Map.png", view: "input", screen: resolumeMap.screens[0] },
        ...resolumeMap.screens.map((screen, index) => ({ filename: `Output ${String(index + 1).padStart(3, "0")} - ${slugify(screen.name).slice(0, 80) || "screen"}.png`, view: "output" as const, screen })),
      ];
      for (const entry of views) {
        const canvas = document.createElement("canvas");
        try {
          renderToCanvas(canvas, "resolume", entry.view, entry.screen, undefined, false);
          const blob = await canvasBlob(canvas);
          if (!blob) throw new Error(`Unable to render ${entry.filename}.`);
          files.push({ filename: entry.filename, data: await blob.arrayBuffer() });
        } finally { canvas.width = 1; canvas.height = 1; }
      }
      if (desktop?.compileProject) {
        const result = await desktop.compileProject({ name: config.project, project: projectData, files });
        if (result.cancelled) { setNotice("Compile cancelled"); return; }
        if (!result.ok) throw new Error(result.error || "Unable to compile project.");
        setNotice(`Project compiled to ${result.path}`);
      } else if (parent) {
        const snapshot = JSON.parse(projectData);
        snapshot.config.project = folderName; snapshot.xmlName = `${folderName}.xml`;
        files.push({ filename: `${folderName}.xml`, data: new TextEncoder().encode(rawXml).buffer as ArrayBuffer }, { filename: `${folderName}.lo2s`, data: new TextEncoder().encode(JSON.stringify(snapshot, null, 2)).buffer as ArrayBuffer });
        destination = await parent.getDirectoryHandle(folderName, { create: true });
        for (const file of files) {
          const handle = await destination.getFileHandle(file.filename, { create: true });
          created.push(file.filename);
          const stream = await handle.createWritable();
          try { await stream.write(new Blob([file.data])); await stream.close(); }
          catch (error) { await stream.abort?.().catch(() => {}); throw error; }
        }
        setNotice(`Compiled ${files.length} files to ${folderName}`);
      }
    } catch (error) {
      if (destination && parent) {
        for (const name of created) await destination.removeEntry(name).catch(() => {});
        await parent.removeEntry(folderName).catch(() => {});
      }
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(error instanceof Error ? error.message : "Unable to compile project.");
    } finally { compileInFlight.current = false; setCompilingProject(false); }
  };
  const saveProject = useCallback(async () => {
    const filename = `${slugify(config.project)}.lo2s`;
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (desktop?.saveProject) {
      const result = await desktop.saveProject(filename, encodedProjectData());
      if (result.cancelled) return;
      if (result.ok && result.path) setActiveProjectPath(result.path);
      setNotice(result.ok ? "Project saved" : result.error || "Unable to save the project");
      return;
    }
    const blob = new Blob([projectData], {
        type: "application/x-opticmesh-project",
      }),
      picker = (window as PickerWindow).showSaveFilePicker;
    if (picker) {
      try {
        const handle = await picker.call(window, {
          suggestedName: filename,
          types: [
            {
              description: "LO2S - OpticMesh project",
              accept: { "application/x-opticmesh-project": [".lo2s"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setNotice("Project saved");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(error instanceof Error ? error.message : "Unable to save the project");
      }
      return;
    }
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [config.project, encodedProjectData, projectData]);
  const loadProject = useCallback(
    (file?: File) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (applyProjectData(String(reader.result), `Project loaded: ${file.name}`)) setActiveProjectPath(null);
      };
      reader.readAsText(file);
    },
    [applyProjectData],
  );
  const openProject = useCallback(async () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.openProject) {
      projectInputRef.current?.click();
      return;
    }
    const result = await desktop.openProject();
    if (result.cancelled) return;
    if (!result.ok || !result.content) {
      setNotice(result.error || "Unable to open the project");
      return;
    }
    if (applyProjectData(result.content, `Project loaded: ${result.name || "LO2S project"}`)) setActiveProjectPath(result.path || null);
  }, [applyProjectData]);
  const saveActiveProject = useCallback(async () => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!activeProjectPath || !desktop?.overwriteProject) {
      await saveProject();
      return;
    }
    const result = await desktop.overwriteProject(activeProjectPath, encodedProjectData());
    setNotice(result.ok ? `Saved ${activeProjectPath.split(/[\\/]/).at(-1)}` : result.error || "Unable to overwrite the project");
  }, [activeProjectPath, encodedProjectData, saveProject]);
  const blankProjectSource = useCallback(
    (demo = false, demoWorkspace: "resolume" | "simulation" = "simulation") => {
      const demoMap = demo ? parseResolumeXml(DEMO_RESOLUME_XML) : null;
      const demoPitchMm = 3.9;
      const demoMetresPerPixel = exactPhysicalPitchMm(500, demoPitchMm) / 1000;
      return JSON.stringify({
        format: "opticmesh-project",
        version: 3,
        appVersion: packageMetadata.version,
        config: demoMap ? { ...DEFAULT_CONFIG, project: DEMO_PROJECT_NAME, pixelPitchMm: demoPitchMm, cabinetWidth: 500, cabinetHeight: 500, resolutionWidth: demoMap.compositionWidth, resolutionHeight: demoMap.compositionHeight, wallWidth: demoMap.compositionWidth * demoMetresPerPixel, wallHeight: demoMap.compositionHeight * demoMetresPerPixel } : DEFAULT_CONFIG,
        patternStyle: DEFAULT_PATTERN_STYLE,
        calculatorSources: ["physical", "pitch"],
        workspaceMode: demo ? demoWorkspace : "patterns",
        mapView: "input",
        logoData: "",
        logoName: "",
        sliceOverrides: {},
        rawXml: demo ? DEMO_RESOLUME_XML : "",
        xmlName: demo ? DEMO_XML_NAME : "",
        simulation: {
          transforms: {},
          depthM: 0.1,
          curvature: { horizontal: 0, vertical: 0 },
          curvatureOverrides: {},
          tool: "translate",
          source: "pattern",
          quality: "latency",
          sourceOverrides: {},
          transformSpace: "local",
          pivot: "bottom-center",
          pivotOverrides: {},
          gridVisible: true,
          snapEnabled: false,
          floorVisible: true,
          backgroundLevel: 100,
          visibility: {},
          locks: {},
          localNames: {},
          groups: [],
        },
      });
    },
    [],
  );
  const createBlankProject = useCallback(() => {
    if (applyProjectData(blankProjectSource(), "New blank project")) {
      setActiveProjectPath(null);
      setStartupProjectStatus("New project · autosave active");
    }
  }, [applyProjectData, blankProjectSource]);
  const loadDemoProject = useCallback(async (mode: "resolume" | "simulation") => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (xmlLinkState !== "unlinked") await desktop?.unlinkResolumeMap?.();
    if (applyProjectData(blankProjectSource(true, mode), "Demo project opened")) {
      setActiveProjectPath(null);
      setStartupProjectStatus(desktop?.autosaveProject ? "Demo project · autosave active" : "Manual save only");
      setXmlLinkState("unlinked");
      setXmlPath("");
      setXmlError("");
      setPendingXmlUpdate(null);
      setXmlUpdatedAt(Date.now());
      setSimulationTransformPreview(null);
      setSimulationViewMode("perspective");
      setSimulationFitSignal((value) => value + 1);
      setControlTab(mode === "simulation" ? "scene" : "setup");
      setV070InspectorTab(mode === "simulation" ? "scene" : "source");
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setFullscreenMode("fit");
    }
  }, [applyProjectData, blankProjectSource, xmlLinkState]);
  const openDemoProject = () => { void loadDemoProject("simulation"); };
  const loadDemoScene = openDemoProject;
  const revealProjectsFolder = useCallback(async () => {
    const result = await (window as PickerWindow).lo2sDesktop?.revealProjectsFolder?.();
    if (result && !result.ok) setNotice(result.error || "Unable to open the Projects folder");
  }, []);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.loadStartupProject) {
      queueMicrotask(() => {
        setStartupRestoreReady(true);
        setStartupProjectStatus("Manual save only");
      });
      return;
    }
    let active = true;
    void desktop.loadStartupProject().then((result) => {
      if (!active) return;
      if (result.ok && result.restored && result.content) {
        applyProjectData(result.content, result.recoveryUsed ? "Recovered the previous valid autosave" : "Restored latest working project");
        setActiveProjectPath(null);
      } else if (!result.ok) setNotice(result.error || "The startup project could not be restored");
      setStartupRestoreReady(true);
      setStartupProjectStatus(!result.ok ? `Restore failed: ${result.error || "unable to restore project"}` : result.recoveryUsed ? "Recovery used · autosave active" : result.restored ? "Latest project restored · autosave active" : "Autosave active");
    });
    return () => {
      active = false;
    };
  }, [applyProjectData]);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!startupRestoreReady || !desktop?.autosaveProject) return;
    let active = true;
    queueMicrotask(() => { if (active) setStartupProjectStatus((current) => current.includes("failed") ? current : "Unsaved changes"); });
    const timer = window.setTimeout(() => {
      setStartupProjectStatus("Saving…");
      void desktop.autosaveProject(encodedProjectData()).then((result) => {
        if (active) setStartupProjectStatus(result.ok ? "Latest changes autosaved" : `Autosave failed: ${result.error || "unknown error"}`);
      }).catch(() => { if (active) setStartupProjectStatus("Autosave failed: unable to save changes"); });
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [encodedProjectData, startupRestoreReady]);
  useEffect(() => {
    const handleSave = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveActiveProject();
    };
    window.addEventListener("keydown", handleSave);
    return () => window.removeEventListener("keydown", handleSave);
  }, [saveActiveProject]);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!startupRestoreReady || !desktop?.autosaveProjectSync) return;
    const flush = () => {
      desktop.autosaveProjectSync(encodedProjectData());
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [encodedProjectData, startupRestoreReady]);

  const beginInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceDown)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
      return;
    }
    if (event.button === 0 && workspaceMode === "resolume") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      selectionDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        moved: false,
        additive: event.ctrlKey || event.shiftKey,
        initialIds: [...selectedSliceIds],
      };
      setSelectionMarquee(null);
    }
  };
  const moveInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const dx = event.clientX - dragRef.current.x,
        dy = event.clientY - dragRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      const nextPan = {
        x: dragRef.current.panX + dx,
        y: dragRef.current.panY + dy,
      };
      panRef.current = nextPan;
      setPan(nextPan);
      return;
    }
    const selection = selectionDragRef.current,
      stage = canvasStageRef.current;
    if (!selection || !stage) return;
    selection.currentX = event.clientX;
    selection.currentY = event.clientY;
    if (Math.abs(selection.currentX - selection.startX) + Math.abs(selection.currentY - selection.startY) > 4) selection.moved = true;
    if (!selection.moved) return;
    const stageBox = stage.getBoundingClientRect(),
      left = Math.min(selection.startX, selection.currentX),
      top = Math.min(selection.startY, selection.currentY);
    setSelectionMarquee({
      left: left - stageBox.left,
      top: top - stageBox.top,
      width: Math.abs(selection.currentX - selection.startX),
      height: Math.abs(selection.currentY - selection.startY),
    });
  };
  const endInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    const selection = selectionDragRef.current,
      canvas = canvasRef.current;
    selectionDragRef.current = null;
    setSelectionMarquee(null);
    if (!selection || !canvas) return;
    selection.currentX = event.clientX;
    selection.currentY = event.clientY;
    if (Math.abs(selection.currentX - selection.startX) + Math.abs(selection.currentY - selection.startY) > 4) selection.moved = true;
    const canvasBox = canvas.getBoundingClientRect();
    if (!selection.moved) {
      const insideCanvas = event.clientX >= canvasBox.left && event.clientX <= canvasBox.right && event.clientY >= canvasBox.top && event.clientY <= canvasBox.bottom;
      const sourceX = insideCanvas ? ((event.clientX - canvasBox.left) * outputWidth) / canvasBox.width : -1,
        sourceY = insideCanvas ? ((event.clientY - canvasBox.top) * outputHeight) / canvasBox.height : -1;
      const hit = insideCanvas
        ? [...activeSlices].reverse().find((slice) => {
            const rect = mapView === "input" ? slice.input : slice.output;
            return sourceX >= rect.x && sourceX <= rect.x + rect.width && sourceY >= rect.y && sourceY <= rect.y + rect.height;
          })
        : undefined;
      if (!hit) {
        if (!selection.additive) setSelectedSliceIds([]);
        return;
      }
      if (selection.additive) setSelectedSliceIds((current) => (current.includes(hit.id) ? current.filter((id) => id !== hit.id) : [...current, hit.id]));
      else setSelectedSliceIds([hit.id]);
      return;
    }
    const selectionLeft = Math.min(selection.startX, selection.currentX),
      selectionRight = Math.max(selection.startX, selection.currentX),
      selectionTop = Math.min(selection.startY, selection.currentY),
      selectionBottom = Math.max(selection.startY, selection.currentY);
    const hits = activeSlices
      .filter((slice) => {
        const rect = mapView === "input" ? slice.input : slice.output,
          left = canvasBox.left + (rect.x * canvasBox.width) / outputWidth,
          right = left + (rect.width * canvasBox.width) / outputWidth,
          top = canvasBox.top + (rect.y * canvasBox.height) / outputHeight,
          bottom = top + (rect.height * canvasBox.height) / outputHeight;
        return right >= selectionLeft && left <= selectionRight && bottom >= selectionTop && top <= selectionBottom;
      })
      .map((slice) => slice.id);
    setSelectedSliceIds(selection.additive ? Array.from(new Set([...selection.initialIds, ...hits])) : hits);
  };
  const cancelInteraction = () => {
    dragRef.current = null;
    selectionDragRef.current = null;
    setSelectionMarquee(null);
  };
  const adjustZoom = (next: number, clientX?: number, clientY?: number) => {
    const currentZoom = zoomRef.current,
      target = clamp(next, 0.05 / baseScale, 8 / baseScale),
      canvas = canvasRef.current;
    if (canvas && clientX !== undefined && clientY !== undefined) {
      const box = canvas.getBoundingClientRect(),
        centerX = box.left + box.width / 2,
        centerY = box.top + box.height / 2,
        ratio = target / currentZoom,
        currentPan = panRef.current;
      const nextPan = {
        x: currentPan.x + (clientX - centerX) * (1 - ratio),
        y: currentPan.y + (clientY - centerY) * (1 - ratio),
      };
      panRef.current = nextPan;
      setPan(nextPan);
    }
    zoomRef.current = target;
    setZoom(target);
  };
  const resetView = () => {
    const stage = canvasStageRef.current;
    if (stage?.clientWidth && stage.clientHeight) setStageBounds({ width: stage.clientWidth, height: stage.clientHeight });
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFullscreenMode("fit");
  };
  const actualPixels = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setFullscreenMode("actual");
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const changeMapView = (view: MapView) => {
    setMapView(view);
    setSelectedSliceIds([]);
    resetView();
  };
  const changeWorkspace = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    setSelectedSliceIds([]);
    setControlTab(mode === "simulation" ? "scene" : "setup");
    resetView();
  };
  const applyGlobalToAll = () => {
    setSliceOverrides({});
    setNotice("Global settings applied to every slice");
  };
  const enterFullscreen = useCallback(async () => {
    const host = fullscreenHostRef.current;
    if (!host) return;
    if (document.fullscreenElement === host) await document.exitFullscreen();
    else await host.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const desktop = (window as PickerWindow).lo2sDesktop;
    if (!desktop?.checkForUpdates) return;
    void desktop.checkForUpdates().then((result) => {
      if (!result.ok || !result.available || !result.latestVersion) return;
      const dismissedAt = Number(localStorage.getItem(`lo2s-update-dismissed:${result.latestVersion}`) || 0);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
      setAvailableUpdate(result);
    });
  }, []);
  const selectPattern = (pattern: PatternType) => {
    setWorkspaceMode("patterns");
    if (config.projectionFormat === "dome") {
      if (pattern === "cabinet") return;
      const domeBackground: DomeBackground = pattern === "color" ? "spectrum" : pattern === "gray" ? "grayscale" : pattern === "pixel" ? "uv" : "black";
      setConfig((current) => ({ ...current, pattern, domeBackground }));
      return;
    }
    if (config.projectionFormat === "cubemap" && pattern === "cabinet") return;
    update("pattern", pattern);
  };
  const selectProjectionFormat = (projectionFormat: ProjectionFormat) => {
    setWorkspaceMode("patterns");
    if (projectionFormat === "dome" || projectionFormat === "cubemap") setSequenceActive(false);
    if (projectionFormat === "cubemap") setConfig((current) => ({
      ...current,
      projectionFormat,
      cubemapLayout: current.cubemapLayout === "three-by-two" ? "horizontal-cross" : current.cubemapLayout,
      cubemapResolution: Math.round(clamp(current.cubemapResolution, 1024, 4096)),
      pattern: current.pattern === "cabinet" ? "metric" : current.pattern,
      backgroundMode: "black",
    }));
    else update("projectionFormat", projectionFormat);
    resetView();
  };
  const resetDomeSettings = () => setConfig((current) => ({
    ...current,
    domePatternName: DEFAULT_CONFIG.domePatternName,
    domeScale: DEFAULT_CONFIG.domeScale,
    domeResolution: DEFAULT_CONFIG.domeResolution,
    domeBackground: DEFAULT_CONFIG.domeBackground,
    domeBackgroundColor: DEFAULT_CONFIG.domeBackgroundColor,
    domeCompass: DEFAULT_CONFIG.domeCompass,
    domeLineOpacity: DEFAULT_CONFIG.domeLineOpacity,
    domeDegreeStep: DEFAULT_CONFIG.domeDegreeStep,
    domeDegreeLabels: DEFAULT_CONFIG.domeDegreeLabels,
    domeElevationAngles: DEFAULT_CONFIG.domeElevationAngles,
    domeBorder: DEFAULT_CONFIG.domeBorder,
    domeRingCount: DEFAULT_CONFIG.domeRingCount,
    domeRingWeight: DEFAULT_CONFIG.domeRingWeight,
    domeShowGrid: DEFAULT_CONFIG.domeShowGrid,
    domeShowRings: DEFAULT_CONFIG.domeShowRings,
    domeShowSafeArea: DEFAULT_CONFIG.domeShowSafeArea,
    domeShowLabels: DEFAULT_CONFIG.domeShowLabels,
    domeGridColor: DEFAULT_CONFIG.domeGridColor,
    domeAxisColor: DEFAULT_CONFIG.domeAxisColor,
    domeRingColor: DEFAULT_CONFIG.domeRingColor,
    domeSafeAreaColor: DEFAULT_CONFIG.domeSafeAreaColor,
    domeLabelColor: DEFAULT_CONFIG.domeLabelColor,
    domeShowCenterDot: DEFAULT_CONFIG.domeShowCenterDot,
    domeCenterDotColor: DEFAULT_CONFIG.domeCenterDotColor,
    domeCenterDotSize: DEFAULT_CONFIG.domeCenterDotSize,
    domeShowLogo: DEFAULT_CONFIG.domeShowLogo,
    domeLogoAzimuth: DEFAULT_CONFIG.domeLogoAzimuth,
    domeLogoElevation: DEFAULT_CONFIG.domeLogoElevation,
    domeLogoAngularWidth: DEFAULT_CONFIG.domeLogoAngularWidth,
    domeLogoScale: DEFAULT_CONFIG.domeLogoScale,
    domeLogoOpacity: DEFAULT_CONFIG.domeLogoOpacity,
  }));

  const overlayRows: Array<{
    key: "showLabels" | "showDiagonals" | "showCircles" | "showSafeArea";
    label: string;
    color: "labelColor" | "diagonalColor" | "circleColor" | "safeAreaColor";
  }> = [
    { key: "showLabels", color: "labelColor", label: "Labels" },
    { key: "showDiagonals", color: "diagonalColor", label: "Cross" },
    { key: "showCircles", color: "circleColor", label: "Circle" },
    { key: "showSafeArea", color: "safeAreaColor", label: "Safe area" },
  ];
  const controlTabs: ControlTab[] = workspaceMode === "simulation" ? ["scene", "sources"] : workspaceMode === "resolume" ? ["setup", "info", "deco", "logo"] : ["setup", "overlays", "logo"];
  const infoFields: Array<{
    key: "namePosition" | "coordinatesPosition" | "resolutionPosition" | "aspectPosition" | "physicalSizePosition";
    label: string;
  }> = [
    { key: "namePosition", label: "Name" },
    { key: "coordinatesPosition", label: "Coordinates" },
    { key: "resolutionPosition", label: "Resolution" },
    { key: "aspectPosition", label: "Aspect ratio" },
    { key: "physicalSizePosition", label: "Physical size" },
  ];
  const selectedInfoPosition = (key: typeof infoFields[number]["key"]): InfoPosition | "mixed" => selectedSlices.length
    ? commonSelectionValue(selectedSlices.map((slice) => sliceOverrides[slice.id]?.[key] ?? config[key])) ?? "mixed"
    : config[key];

  const hierarchyGroupMatches = (group: SceneGroup): boolean => {
    const query = hierarchyQuery.trim().toLowerCase();
    return (
      !query ||
      group.name.toLowerCase().includes(query) ||
      groupDescendantSliceIds(group.id, simulationGroups).some((id) => {
        const slice = allSlices.find((item) => item.id === id);
        return Boolean(slice && ((simulationLocalNames[id] || slice.name).toLowerCase().includes(query) || slice.screenName.toLowerCase().includes(query)));
      }) ||
      simulationGroups.some((child) => child.parentId === group.id && hierarchyGroupMatches(child))
    );
  };
  const renderHierarchySlice = (slice: ResolumeSlice, depth: number) => {
    const drop = hierarchyDrop?.targetKind === "slice" && hierarchyDrop.targetId === slice.id ? hierarchyDrop.placement : null;
    return (
      <div
        className={`${!hasGroupSelection && selectedSliceIds.includes(slice.id) ? "hierarchy-row child selected" : "hierarchy-row child"}${drop ? ` drop-${drop}` : ""}`}
        style={{ paddingLeft: `${16 + depth * 14}px` }}
        key={slice.id}
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          setHierarchyDrag({ kind: "slice", id: slice.id });
        }}
        onDragEnd={() => {
          setHierarchyDrag(null);
          setHierarchyDrop(null);
        }}
        onDragOver={(event) => {
          if (!hierarchyDrag || (hierarchyDrag.kind === "slice" && hierarchyDrag.id === slice.id)) return;
          event.preventDefault();
          event.stopPropagation();
          const placement = hierarchyPlacement(event, false);
          setHierarchyDrop({
            targetKind: "slice",
            targetId: slice.id,
            placement,
          });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const placement = hierarchyPlacement(event, false);
          dropHierarchyItem("slice", slice.id, placement);
        }}
        onClick={(event) => selectHierarchySlice(slice.id, event)}
      >
        <button className="hierarchy-type" title={`Select ${slice.name}`} aria-label={`Select ${slice.name}`}><UiIcon name="slice" /></button>
        <input
          value={simulationLocalNames[slice.id] ?? slice.name}
          aria-label={`${slice.name} local name`} title={simulationLocalNames[slice.id] ?? slice.name}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            setSimulationLocalNames((current) => ({
              ...current,
              [slice.id]: event.target.value,
            }))
          }
        />
        <button
          aria-label={simulationVisibility[slice.id] === false ? "Show slice in simulation" : "Hide slice in simulation"}
          title={simulationVisibility[slice.id] === false ? "Show slice in simulation" : "Hide slice in simulation"}
          onClick={(event) => {
            event.stopPropagation();
            toggleSliceVisibility(slice.id);
          }}
        >
          <UiIcon name={simulationVisibility[slice.id] === false ? "hidden" : "eye"} />
        </button>
        <button
          aria-label={simulationLocks[slice.id] ? "Unlock slice" : "Lock slice"}
          title={simulationLocks[slice.id] ? "Unlock slice" : "Lock slice"}
          onClick={(event) => {
            event.stopPropagation();
            toggleSliceLock(slice.id);
          }}
        >
          <UiIcon name={simulationLocks[slice.id] ? "lock" : "unlock"} />
        </button>
      </div>
    );
  };
  const renderHierarchyGroup = (group: SceneGroup, depth = 0): React.ReactNode => {
    if (!hierarchyGroupMatches(group)) return null;
    const childGroups = simulationGroups.filter((item) => item.parentId === group.id),
      drop = hierarchyDrop?.targetKind === "group" && hierarchyDrop.targetId === group.id ? hierarchyDrop.placement : null;
    return (
      <div className="hierarchy-group" key={group.id}>
        <div
          className={`${selectedGroupIds.includes(group.id) ? "hierarchy-row group selected" : "hierarchy-row group"}${drop ? ` drop-${drop}` : ""}`}
          style={{ paddingLeft: `${depth * 14}px` }}
          draggable={editingGroupId !== group.id}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            setHierarchyDrag({ kind: "group", id: group.id });
          }}
          onDragEnd={() => {
            setHierarchyDrag(null);
            setHierarchyDrop(null);
          }}
          onDragOver={(event) => {
            if (!hierarchyDrag || (hierarchyDrag.kind === "group" && hierarchyDrag.id === group.id)) return;
            event.preventDefault();
            event.stopPropagation();
            const placement = hierarchyPlacement(event, true);
            if (hierarchyDrag.kind === "slice" && placement !== "inside" && !group.parentId)
              setHierarchyDrop({
                targetKind: "group",
                targetId: group.id,
                placement,
              });
            else
              setHierarchyDrop({
                targetKind: "group",
                targetId: group.id,
                placement,
              });
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            dropHierarchyItem("group", group.id, hierarchyPlacement(event, true));
          }}
          onClick={(event) => selectHierarchyGroup(group, event)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setEditingGroupId(group.id);
          }}
        >
          <button
            className="hierarchy-disclosure"
            title={group.expanded ? "Collapse group" : "Expand group"}
            aria-label={group.expanded ? "Collapse group" : "Expand group"}
            aria-expanded={group.expanded}
            onClick={(event) => {
              event.stopPropagation();
              setSimulationGroups((current) => current.map((item) => (item.id === group.id ? { ...item, expanded: !item.expanded } : item)));
            }}
          >
            <UiIcon name={group.expanded ? "down" : "right"} />
          </button>
          {editingGroupId === group.id ? (
            <input
              autoFocus
              value={group.name}
              aria-label="Group name"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setSimulationGroups((current) => current.map((item) => (item.id === group.id ? { ...item, name: event.target.value } : item)))}
              onBlur={() => setEditingGroupId(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault();
                  setEditingGroupId(null);
                }
              }}
            />
          ) : (
            <span className="hierarchy-name" title={group.name}>
              {group.name}
            </span>
          )}
          <button
            title={group.visible ? "Hide group in simulation" : "Show group in simulation"}
            aria-label={group.visible ? "Hide group" : "Show group"}
            onClick={(event) => {
              event.stopPropagation();
              const targets = selectedGroupIds.includes(group.id) && selectedGroupIds.length > 1 ? new Set(selectedGroupIds) : new Set([group.id]);
              recordSimulationHistory(`${group.visible ? "Hide" : "Show"} ${targets.size} group${targets.size === 1 ? "" : "s"}`);
              setSimulationGroups((current) => current.map((item) => (targets.has(item.id) ? { ...item, visible: !group.visible } : item)));
            }}
          >
            <UiIcon name={group.visible ? "eye" : "hidden"} />
          </button>
          <button
            title={group.locked ? "Unlock group" : "Lock group"}
            aria-label={group.locked ? "Unlock group" : "Lock group"}
            onClick={(event) => {
              event.stopPropagation();
              const targets = selectedGroupIds.includes(group.id) && selectedGroupIds.length > 1 ? new Set(selectedGroupIds) : new Set([group.id]);
              recordSimulationHistory(`${group.locked ? "Unlock" : "Lock"} ${targets.size} group${targets.size === 1 ? "" : "s"}`);
              setSimulationGroups((current) => current.map((item) => (targets.has(item.id) ? { ...item, locked: !group.locked } : item)));
            }}
          >
            <UiIcon name={group.locked ? "lock" : "unlock"} />
          </button>
        </div>
        {(group.expanded || Boolean(hierarchyQuery)) && (
          <>
            {group.sliceIds.map((id) => {
              const slice = allSlices.find((item) => item.id === id);
              return slice ? renderHierarchySlice(slice, depth + 1) : null;
            })}
            {childGroups.map((child) => renderHierarchyGroup(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  if (uiVersion === "v070") {
    const isV0703D = workspaceMode === "simulation",
      isV070Map = workspaceMode === "resolume",
      isDome = !isV070Map && !isV0703D && config.projectionFormat === "dome",
      isCubemap = !isV070Map && !isV0703D && config.projectionFormat === "cubemap",
      patternName = PATTERNS.find((item) => item.id === config.pattern)?.name || "Metric Grid",
      projectionName = PROJECTION_FORMATS.find((item) => item.id === config.projectionFormat)?.name || "Planar",
      v070Tabs = isV0703D ? (["scene", "geometry", "source"] as const) : isV070Map ? (["source", "geometry", "information", "appearance"] as const) : (["setup", "overlays", "logo"] as const);
    const v070ToolMatches = (...labels: string[]) => {
      const query = v070ToolQuery.trim().toLocaleLowerCase();
      return !query || labels.some((label) => label.toLocaleLowerCase().includes(query));
    };
    const sceneDisplayControls = <>
<ToggleRow label="Floor" value={simulationFloorVisible} onClick={() => { recordSimulationHistory(simulationFloorVisible ? "Hide floor" : "Show floor"); setSimulationFloorVisible((value) => !value); }} styles={v070} />
                  <ToggleRow label="Grid" value={simulationGridVisible} onClick={() => { recordSimulationHistory(simulationGridVisible ? "Hide floor grid" : "Show floor grid"); setSimulationGridVisible((value) => !value); }} styles={v070} />
                  <ToggleRow label="Background brightness" value={simulationBackgroundLevel > 0} onClick={() => { recordSimulationHistory(simulationBackgroundLevel > 0 ? "Disable background brightness" : "Enable background brightness"); setSimulationBackgroundLevel((value) => value > 0 ? 0 : 100); }} styles={v070} />
                  {simulationBackgroundLevel > 0 && <div className={v070.range}><span>Brightness</span><ResetSlider aria-label="Background brightness" resetValue={100} min="1" max="200" value={simulationBackgroundLevel} onEditStart={() => recordSimulationHistory("Change background brightness")}  onValueChange={(value) => setSimulationBackgroundLevel(value)} /></div>}
    </>;
    return <TransformSelectionScope.Provider value={isV0703D ? "v070-3d" : "v070-patterns"}>
      <main className={`${v070.app} ${v070Focused ? v070.focused : ""}`} onClick={() => v070Menu && setV070Menu(null)}>
        <header className={v070.header}>
          <div className={v070.brand}><img src="/brand/lo2s-logo-white.svg" alt="LO2S" /><i /><strong>OpticMesh</strong><span>v0.7.0</span><b>Beta</b></div>
          <nav className={v070.menus}>{["File", "Export", "Output", "Tools", "Help", "About"].map((item) => <div key={item}
            onPointerEnter={(event) => { if (event.pointerType !== "touch") setV070Menu((current) => current === null ? null : item); }}
            onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setV070Menu(null); }}
            onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[aria-controls="toolbar-menu-${(v070Menu || item).toLowerCase()}"]`)?.focus(); setV070Menu(null); } }}
          ><button aria-pressed={v070Menu === item} className={v070Menu === item ? v070.active : ""} aria-expanded={v070Menu === item} aria-controls={`toolbar-menu-${item.toLowerCase()}`} onClick={(event) => { event.stopPropagation(); setV070Menu(v070Menu === item ? null : item); }}>{item}</button>{v070Menu === item && <section id={`toolbar-menu-${item.toLowerCase()}`} onClick={(event) => { event.stopPropagation(); const action = (event.target as Element).closest("button"); if (action && !action.disabled) { event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("button[aria-controls]")?.focus(); setV070Menu(null); } }}>
            {item === "File" && <><button onClick={createBlankProject}>New Project</button><button onClick={openDemoProject}>Open Demo</button><button onClick={openProject}>Open Project…</button><hr /><button onClick={() => void saveActiveProject()}>Save</button><button onClick={saveProject}>Save As…</button><button disabled={compilingProject || !resolumeMap || !rawXml} onClick={() => void compileProject()}>{compilingProject ? "Compiling…" : "Compile Project…"}</button><button onClick={() => void revealProjectsFolder()}>Reveal Projects Folder</button></>}
            {item === "Export" && (isV0703D ? <><strong>3D scene formats</strong><button disabled={!allSlices.length || simulationExporting} onClick={() => void export3DScene("glb")}>GLB · Universal binary</button><button disabled={!allSlices.length || simulationExporting} onClick={() => void export3DScene("gltf")}>glTF · Packaged ZIP</button><button disabled={!allSlices.length || simulationExporting} onClick={() => void export3DScene("obj")}>Wavefront OBJ · Packaged ZIP</button><button disabled={!allSlices.length || simulationExporting} onClick={() => void export3DScene("mvr")}>MVR 1.5 · Scene meshes</button>{simulationExporting && <small>Building 3D export…</small>}</> : <><button onClick={exportCurrent}>{isV070Map ? mapView === "input" ? "Input Map PNG" : "Current Output PNG" : "Current Pattern PNG"}</button>{isV070Map && resolumeMap && <><button onClick={exportSelected} disabled={!selectedSlices.length}>Selected Slices</button><button onClick={exportOutputs}>All Output Maps</button></>}</>)}
            {item === "Output" && <><button aria-pressed={patternOutput === "off"} className={patternOutput === "off" ? v070.active : ""} onClick={() => setPatternOutput("off")}>OFF</button><button aria-pressed={patternOutput === "ndi"} className={patternOutput === "ndi" ? v070.active : ""} onClick={() => setPatternOutput("ndi")}>NDI</button><button aria-pressed={patternOutput === "spout"} className={patternOutput === "spout" ? v070.active : ""} onClick={() => setPatternOutput("spout")}>Spout</button><hr /><small>{patternOutputStatus}</small></>}
            {item === "Tools" && <button onClick={() => { setV070Focused(false); setNotice(`${isV0703D ? "3D" : isV070Map ? "Pixel Map" : "Pattern"} tools are active in the left panel`); }}>{isV0703D ? "3D Tools" : isV070Map ? "Pixel Map Tools" : "Pattern Tools"}</button>}
            {item === "Help" && <><button onClick={() => setHelpTopic("manual")}>OpticMesh Manual</button><button onClick={() => setHelpTopic("shortcuts")}>Keyboard Shortcuts</button></>}
            {item === "About" && <><strong>LO2S - OpticMesh</strong><small>Version 0.7.0 Beta</small></>}
          </section>}</div>)}</nav>
          <div className={v070.historyActions}><button title={historyState.undo ? `Undo · ${historyState.undo}` : "Undo"} disabled={!isV0703D || !historyState.undo} onClick={undoSimulation}>Undo{historyState.undo ? ` · ${historyState.undo}` : ""}</button><button title={historyState.redo ? `Redo · ${historyState.redo}` : "Redo"} disabled={!isV0703D || !historyState.redo} onClick={redoSimulation}>Redo{historyState.redo ? ` · ${historyState.redo}` : ""}</button></div>
        </header>
        <div className={v070.project}><div className={v070.projectMain}><div className={v070.projectInfo}><span>Project</span><strong title={config.project}>{config.project}</strong><span className={v070.saveStatus} data-state={startupProjectStatus.toLowerCase().includes("failed") ? "error" : startupProjectStatus.includes("autosaved") ? "success" : "information"} role="status" aria-live="polite" title={startupProjectStatus}><i />{startupProjectStatus}</span></div><div className={v070.notifications} aria-label="Notifications"><span role="status" aria-live="polite" aria-atomic="true" title={notice || undefined}>{notice}</span>{notice && <button type="button" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => setNotice("")}><UiIcon name="close" /></button>}</div></div><div className={v070.layoutArea}><div className={v070.layoutSwitch}><button aria-pressed={!v070Focused} className={!v070Focused ? v070.active : ""} onClick={() => setV070Focused(false)}>Studio</button><button aria-pressed={v070Focused} className={v070Focused ? v070.active : ""} onClick={() => setV070Focused(true)}>Focused</button></div></div></div>
        <section className={v070.workspace}>
          <nav className={v070.rail}><button aria-pressed={!isV070Map && !isV0703D} className={!isV070Map && !isV0703D ? v070.active : ""} onClick={() => { changeWorkspace("patterns"); setV070InspectorTab("setup"); }}><b><PatternsModeIcon /></b><span>Patterns</span></button><button aria-pressed={isV070Map} className={isV070Map ? v070.active : ""} onClick={() => { changeWorkspace("resolume"); setV070InspectorTab("source"); }}><b><PixelMapModeIcon /></b><span>Pixel Map</span></button><button aria-pressed={isV0703D} className={isV0703D ? v070.active : ""} onClick={() => { changeWorkspace("simulation"); setV070InspectorTab("scene"); }}><b><ThreeDModeIcon /></b><span>3D</span></button><i /><button onClick={() => setHelpTopic("manual")} title="OpticMesh Manual"><b><UiIcon name="book" /></b><span>Guide</span></button></nav>
          <aside className={v070.tools}>
            <div className={v070.panelTitle}><strong>Tools</strong></div>
            <label className={v070.search}><UiIcon name="search" /><input value={v070ToolQuery} onChange={(event) => setV070ToolQuery(event.target.value)} placeholder="Search tools…" aria-label="Search tools" /></label>
            {isV0703D ? <>
              <VSection title="Scene source" styles={v070} query={v070ToolQuery} keywords={["Choose XML", "Load Demo"]}>
                <button className={v070.choose} onClick={chooseXml}>Choose Resolume XML…</button>
                <button className={v070.choose} onClick={loadDemoScene}>Load Demo Scene</button>
              </VSection>
              <ToolList title="Transform" items={[["Move", simulationTool === "translate", () => setSimulationTool("translate")], ["Rotate", simulationTool === "rotate", () => setSimulationTool("rotate")], ["Scale", simulationTool === "scale", () => setSimulationTool("scale")]]} styles={v070} query={v070ToolQuery} />
              <ToolList title="Arrange" items={[["Group", false, groupSelectedSlices, !selectedSliceIds.length || hasGroupSelection], ["Ungroup", false, ungroupSelectedSlices, !hasGroupSelection && !simulationGroups.some((group) => group.sliceIds.some((id) => selectedSliceIds.includes(id)))], ["Align", false, () => openArrangeControls("align"), selectedSliceIds.length < 2], ["Distribute", false, () => openArrangeControls("distribute"), selectedSliceIds.length < 3], ["Set Parent", false, () => { setV070InspectorTab("scene"); setNotice("Drag a slice or subgroup onto a group in Scene Hierarchy to set its parent"); }]]} styles={v070} query={v070ToolQuery} />
              <ToolList title="View" items={[["All Views", simulationViewMode === "four", () => setSimulationViewMode("four")], ["Focus Selection", false, () => setSimulationFocusSignal((value) => value + 1), !selectedSliceIds.length], ["Fit Scene", false, () => { setSimulationViewMode("perspective"); setSimulationFitSignal((value) => value + 1); }]]} styles={v070} query={v070ToolQuery} />
              <VSection title="Scene display" styles={v070} query={v070ToolQuery} keywords={["Floor", "Grid", "Background", "Brightness"]}>{sceneDisplayControls}</VSection>
            </> : isV070Map ? <>
              <VSection title="Advanced Output XML" styles={v070} query={v070ToolQuery} keywords={["Choose XML", "Load Demo", "Link Resolume"]}>
                <button className={v070.choose} onClick={chooseXml}>Choose XML…</button>
                <button className={v070.choose} onClick={() => void loadDemoProject("resolume")}>Load Demo Map</button>
                <button className={`${v070.choose} ${xmlLinkState === "linked" ? v070.active : ""}`} onClick={xmlLinkState === "linked" ? unlinkResolume : linkResolume}>{xmlLinkState === "linked" ? "Unlink Resolume Map" : xmlLinkState === "linking" ? "Linking…" : "Link Resolume Map"}</button>
                <input ref={xmlInputRef} hidden type="file" accept=".xml,text/xml" onChange={(event) => loadXml(event.target.files?.[0])} />
                {xmlName && <div className={v070.fileStatus}><i /><span title={xmlName}><b>{xmlLinkState === "linked" ? "LIVE" : "FILE"}</b>{xmlName}</span></div>}
                {xmlError && <p className={v070.warning}>{xmlError}</p>}
              </VSection>
              <VSection title="Map display" styles={v070} query={v070ToolQuery} keywords={["Input Map", "Output Map", "Screen"]}>
                <div className={v070.segmented}><button aria-pressed={mapView === "input"} className={mapView === "input" ? v070.active : ""} onClick={() => changeMapView("input")}>Input Map</button><button aria-pressed={mapView === "output"} className={mapView === "output" ? v070.active : ""} onClick={() => changeMapView("output")}>Output Map</button></div>
                {resolumeMap && <label className={v070.select}><span>Screen</span><select value={mapView === "input" ? "combined" : selectedScreen} disabled={mapView === "input"} onChange={(event) => { setSelectedScreen(Number(event.target.value)); setSelectedSliceIds([]); resetView(); }}><option value="combined">All Screens</option>{mapView === "output" && resolumeMap.screens.map((screen, index) => <option value={index} key={screen.name}>{screen.name}</option>)}</select></label>}
              </VSection>
              <ToolList title="Selection" items={[["Select all slices", selectedSliceIds.length === activeSlices.length && activeSlices.length > 0, () => setSelectedSliceIds(activeSlices.map((slice) => slice.id)), !activeSlices.length], ["Select current screen", false, () => setSelectedSliceIds(activeScreen?.slices.map((slice) => slice.id) || []), mapView !== "output" || !activeScreen], ["Clear selection", false, () => setSelectedSliceIds([]), !selectedSliceIds.length]]} styles={v070} query={v070ToolQuery} />
              <ToolList title="Display" items={[["Slice labels", selectedBoolean("showLabels", config.showLabels), () => selectedSliceIds.length ? updateSelected({ showLabels: !selectedBoolean("showLabels", config.showLabels) }) : updateGlobal("showLabels", !config.showLabels)], ["Pixel grid", selectedBoolean("showPixelGrid", config.showPixelGrid), () => selectedSliceIds.length ? updateSelected({ showPixelGrid: !selectedBoolean("showPixelGrid", config.showPixelGrid) }) : updateGlobal("showPixelGrid", !config.showPixelGrid)]]} styles={v070} query={v070ToolQuery} />
              {v070ToolMatches("Pattern mode", "Per Slice", "Across Map") && <section className={v070.fill}><h2>Pattern mode</h2><div className={v070.scope}><button aria-pressed={config.mapPatternScope === "slice"} className={config.mapPatternScope === "slice" ? v070.active : ""} onClick={() => updateGlobal("mapPatternScope", "slice")}>Per Slice</button><button aria-pressed={config.mapPatternScope === "map"} className={config.mapPatternScope === "map" ? v070.active : ""} onClick={() => updateGlobal("mapPatternScope", "map")}>Across Map</button></div></section>}
              {v070ToolMatches("Pattern fill", ...MAP_FILLS.map((fill) => fill.name)) && <section className={v070.fill}><h2>Pattern fill</h2><div>{MAP_FILLS.map((fill) => <button key={fill.id} aria-pressed={config.mapFill === fill.id} className={config.mapFill === fill.id ? v070.active : ""} onClick={() => updateGlobal("mapFill", fill.id)}>{fill.name}</button>)}</div></section>}
            </> : <>
              <ToolList title="Pattern elements" items={isDome ? [["Angular Grid", config.domeShowGrid, () => update("domeShowGrid", !config.domeShowGrid)], ["Concentric Rings", config.domeShowRings, () => update("domeShowRings", !config.domeShowRings)], ["Centre Mark", config.domeShowCenterDot, () => update("domeShowCenterDot", !config.domeShowCenterDot)], ["Safe Area", config.domeShowSafeArea, () => update("domeShowSafeArea", !config.domeShowSafeArea)]] : isCubemap ? [["Perspective Grid", config.cubemapShowGrid, () => update("cubemapShowGrid", !config.cubemapShowGrid)], ["Face Edges", config.cubemapShowSeams, () => update("cubemapShowSeams", !config.cubemapShowSeams)]] : [["Resolution Grid", patternStyle.showMetricGrid, () => updatePatternStyle("showMetricGrid", !patternStyle.showMetricGrid)], ["Centre Mark", patternStyle.showCenterDot, () => updatePatternStyle("showCenterDot", !patternStyle.showCenterDot)], ["Safe Area", patternStyle.showSafeArea, () => updatePatternStyle("showSafeArea", !patternStyle.showSafeArea)]]} styles={v070} query={v070ToolQuery} />
              <ToolList title="Identification" items={isDome ? [["Compass", config.domeCompass, () => update("domeCompass", !config.domeCompass)], ["Degree Labels", config.domeDegreeLabels, () => update("domeDegreeLabels", !config.domeDegreeLabels)], ["Elevation Angles", config.domeElevationAngles, () => update("domeElevationAngles", !config.domeElevationAngles)], ["Logo", config.domeShowLogo, () => update("domeShowLogo", !config.domeShowLogo)]] : isCubemap ? [["Face Labels", config.cubemapShowFaceLabels, () => update("cubemapShowFaceLabels", !config.cubemapShowFaceLabels)], ["Directional Logo", config.cubemapShowLogo, () => update("cubemapShowLogo", !config.cubemapShowLogo)]] : [["Project title", patternStyle.showPatternTitle, () => updatePatternStyle("showPatternTitle", !patternStyle.showPatternTitle)], ["Dimensions", patternStyle.showPatternDimensions, () => updatePatternStyle("showPatternDimensions", !patternStyle.showPatternDimensions)], ["Cardinal Labels", patternStyle.showCardinalLabels, () => updatePatternStyle("showCardinalLabels", !patternStyle.showCardinalLabels)], ["Logo", config.showLogo, () => update("showLogo", !config.showLogo)]]} styles={v070} query={v070ToolQuery} />
              {!isCubemap && <ToolList title="Calibration" items={isDome ? [["Dome Border", config.domeBorder, () => update("domeBorder", !config.domeBorder)]] : [["Diagonal Guides", patternStyle.showDiagonals, () => updatePatternStyle("showDiagonals", !patternStyle.showDiagonals)], ["Circles", patternStyle.showCircles, () => updatePatternStyle("showCircles", !patternStyle.showCircles)], ["Cabinet Checker", patternStyle.showPatternCheckerboard, () => updatePatternStyle("showPatternCheckerboard", !patternStyle.showPatternCheckerboard)], ["Gamma Steps", patternCalibration === "gamma", () => setPatternCalibration((current) => current === "gamma" ? "none" : "gamma")], ["Seam Test", patternCalibration === "seam", () => setPatternCalibration((current) => current === "seam" ? "none" : "seam")]]} styles={v070} query={v070ToolQuery} />}
              {v070ToolMatches("Dome background", "Cubemap pattern", "Pattern fill", ...DOME_BACKGROUND_OPTIONS.map((option) => option.label), "Environment Grid", "Axis Face IDs", "Texel Check", "Metric Grid", "Cabinet IDs", "Color Bars", "Pixel Check") && <section className={v070.fill}><h2>{isDome ? "Dome background" : isCubemap ? "Cubemap pattern" : "Pattern fill"}</h2>{isDome ? <><div>{DOME_BACKGROUND_OPTIONS.map((option) => <button key={option.id} aria-pressed={config.domeBackground === option.id} className={config.domeBackground === option.id ? v070.active : ""} onClick={() => update("domeBackground", option.id)}>{option.label}</button>)}</div>{config.domeBackground === "custom" && <label className={v070.colorWide}><span>Custom colour</span><input type="color" value={config.domeBackgroundColor} onChange={(event) => update("domeBackgroundColor", event.target.value)} /></label>}</> : <div>{PATTERNS.filter((pattern) => !isCubemap || pattern.id !== "cabinet").map((pattern) => <button key={pattern.id} aria-pressed={config.pattern === pattern.id} className={config.pattern === pattern.id ? v070.active : ""} onClick={() => selectPattern(pattern.id)}>{isCubemap ? pattern.id === "metric" ? "Environment Grid" : pattern.id === "color" ? "Axis Face IDs" : pattern.id === "gray" ? "Grayscale" : "Texel Check" : pattern.name}</button>)}</div>}</section>}
            </>}
          </aside>
          <section className={`${v070.center} ${v070DiagnosticTab === "performance" ? v070.performanceCenter : ""} ${isV0703D ? v070.threeCenter : ""} ${isV070Map ? v070.mapCenter : ""} ${!v070DiagnosticsOpen ? v070.collapsedCenter : ""}`}>
            <div className={v070.toolbar}><div className={v070.contextControls}>{isV0703D ? <><button aria-pressed={simulationTool === "translate"} className={simulationTool === "translate" ? v070.active : ""} onClick={() => setSimulationTool("translate")}>Move</button><button aria-pressed={simulationTool === "rotate"} className={simulationTool === "rotate" ? v070.active : ""} onClick={() => setSimulationTool("rotate")}>Rotate</button><button aria-pressed={simulationTool === "scale"} className={simulationTool === "scale" ? v070.active : ""} onClick={() => setSimulationTool("scale")}>Scale</button><button aria-pressed={simulationSnapEnabled} className={simulationSnapEnabled ? v070.active : ""} title="Snap movement to the 1 metre world grid" onClick={() => { recordSimulationHistory(simulationSnapEnabled ? "Disable grid snap" : "Enable grid snap"); setSimulationSnapEnabled(value => !value); }}>Snap</button><button aria-pressed={simulationTransformSpace === "local"} className={simulationTransformSpace === "local" ? v070.active : ""} onClick={() => setSimulationTransformSpace("local")}>Local</button><button aria-pressed={simulationTransformSpace === "world"} className={simulationTransformSpace === "world" ? v070.active : ""} onClick={() => setSimulationTransformSpace("world")}>World</button></> : isV070Map ? <><button aria-pressed={mapView === "input"} className={mapView === "input" ? v070.active : ""} onClick={() => changeMapView("input")}>Input Map</button><button aria-pressed={mapView === "output"} className={mapView === "output" ? v070.active : ""} onClick={() => changeMapView("output")}>Output Map</button><button onClick={() => setV070InspectorTab("source")}>All Screens</button></> : PROJECTION_FORMATS.map((format) => <button key={format.id} aria-pressed={config.projectionFormat === format.id} className={config.projectionFormat === format.id ? v070.active : ""} onClick={() => selectProjectionFormat(format.id)}>{format.name}</button>)}</div><div className={v070.viewControls}>{isV0703D ? <><select className={v070.cameraSelect} aria-label="Camera view" value={simulationViewMode} onChange={(event) => setSimulationViewMode(event.target.value as SimulationView)}><option value="perspective">Perspective</option><option value="top">Top</option><option value="right">Right</option><option value="front">Front</option><option value="four">All Views</option></select><span className={v070.cameraButtons}><button aria-pressed={simulationViewMode === "perspective"} className={simulationViewMode === "perspective" ? v070.active : ""} onClick={() => setSimulationViewMode("perspective")}>Perspective</button><button aria-pressed={simulationViewMode === "top"} className={simulationViewMode === "top" ? v070.active : ""} onClick={() => setSimulationViewMode("top")}>Top</button><button aria-pressed={simulationViewMode === "right"} className={simulationViewMode === "right" ? v070.active : ""} onClick={() => setSimulationViewMode("right")}>Right</button><button aria-pressed={simulationViewMode === "front"} className={simulationViewMode === "front" ? v070.active : ""} onClick={() => setSimulationViewMode("front")}>Front</button><button aria-pressed={simulationViewMode === "four"} className={simulationViewMode === "four" ? v070.active : ""} onClick={() => setSimulationViewMode("four")}>All Views</button></span><button disabled={!selectedSliceIds.length} onClick={() => setSimulationFocusSignal((value) => value + 1)}>Focus</button><button onClick={() => setSimulationFitSignal((value) => value + 1)}>Fit Scene</button></> : <><button aria-pressed={fullscreenMode === "fit"} className={fullscreenMode === "fit" ? v070.active : ""} onClick={resetView}>Fit Canvas</button><button aria-pressed={fullscreenMode === "actual"} className={fullscreenMode === "actual" ? v070.active : ""} onClick={actualPixels}>Actual 1:1</button></>}<button onClick={enterFullscreen} aria-label="Fullscreen viewport" title="Fullscreen viewport"><UiIcon name="fullscreen" /></button></div></div>
            <div className={v070.canvasShell} ref={fullscreenHostRef} data-fullscreen-mode={fullscreenMode}>{isV0703D ? <ThreeSimulation performanceMetrics={renderMetrics.simulation} slices={allSlices} compositionWidth={resolumeMap?.compositionWidth || config.resolutionWidth} compositionHeight={resolumeMap?.compositionHeight || config.resolutionHeight} masterPitchMm={simulationMasterPitchMm} pitchBySlice={simulationPitchBySlice} depthBySlice={simulationDepthBySlice} curvatureBySlice={simulationCurvatureBySlice} pivotBySlice={simulationPivotBySlice} selectedIds={selectedSliceIds} visibleIds={simulationVisibleIds} lockedIds={simulationLockedIds} transforms={renderedSimulationTransforms} selectionTransform={selectedGroupSelectionWorldTransform} transformMode={simulationTool} transformSpace={simulationTransformSpace} source={simulationSource} sourceOverrides={simulationSourceOverrides} sourceMedia={simulationSourceMedia} sourceQuality={simulationQuality} cameraState={simulationCamera} textureVersion={simulationTextureVersion} fitSignal={simulationFitSignal} focusSignal={simulationFocusSignal} viewMode={simulationViewMode} snapEnabled={simulationSnapEnabled} gridVisible={simulationGridVisible} floorVisible={simulationFloorVisible} backgroundLevel={simulationBackgroundLevel} interactiveGeometryPreview={simulationGeometryPreview} drawPatternTexture={drawSimulationTexture} onSelectionChange={(ids) => { setSimulationTransformPreview(null); setSelectedGroupIds([]); setSelectedSliceIds(ids); }} onTransformPreview={setSimulationTransformPreview} onTransformsChange={commitSimulationTransforms} onCameraChange={setSimulationCamera} onOutputCaptureReady={(capture) => { simulationOutputCaptureRef.current = capture; }} /> : <div ref={canvasStageRef} className={`canvas-stage ${spaceDown ? "panning" : ""}`} onPointerDown={beginInteraction} onPointerMove={moveInteraction} onPointerUp={endInteraction} onPointerCancel={cancelInteraction} onWheel={(event) => { event.preventDefault(); adjustZoom(zoomRef.current * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY); }}><canvas ref={canvasRef} style={{ width: `${outputWidth * baseScale}px`, height: `${outputHeight * baseScale}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, imageRendering: fullscreenMode === "actual" && displayScale >= 1 ? "pixelated" : "auto" }} aria-label="LO2S - OpticMesh 0.7 live pattern output" /></div>}</div>
            <div className={`${v070.diagnostics} ${isV070Map ? v070.mapDiagnostics : ""}`}>
              <button aria-pressed={v070DiagnosticTab === "validation"} className={v070DiagnosticTab === "validation" ? v070.active : ""} onClick={() => { setV070DiagnosticTab("validation"); setV070DiagnosticsOpen(true); }}>Validation <b>{isV0703D ? invalidCurvedDepthSlices.length : isV070Map ? validations.length : stats.mismatch || stats.cabinetRemainder ? 1 : 0}</b></button>
              {isV070Map && <button aria-pressed={v070DiagnosticTab === "changes"} className={v070DiagnosticTab === "changes" ? v070.active : ""} onClick={() => { setV070DiagnosticTab("changes"); setV070DiagnosticsOpen(true); }}>Map Changes <b>{pendingXmlUpdate ? pendingMapChanges.added + pendingMapChanges.removed + pendingMapChanges.changed : 0}</b></button>}
              <button aria-pressed={v070DiagnosticTab === "output"} className={v070DiagnosticTab === "output" ? v070.active : ""} onClick={() => { setV070DiagnosticTab("output"); setV070DiagnosticsOpen(true); }}>Output <b>{patternOutput.toUpperCase()}</b></button>
              <button aria-pressed={v070DiagnosticTab === "performance"} className={v070DiagnosticTab === "performance" ? v070.active : ""} onClick={() => { setV070DiagnosticTab("performance"); setV070DiagnosticsOpen(true); }}>Performance</button>
              <button className={v070.diagnosticToggle} onClick={() => setV070DiagnosticsOpen((value) => !value)} aria-label={v070DiagnosticsOpen ? "Minimize bottom panel" : "Expand bottom panel"}><UiIcon name={v070DiagnosticsOpen ? "down" : "up"} /></button>
              {v070DiagnosticsOpen && <section>
                {v070DiagnosticTab === "validation" && (isV070Map ? <div className={v070.validationRows}>{resolumeMap ? validations.map((item, index) => <button key={`${item.text}-${index}`} className={v070[item.level]} title={item.details} data-tooltip={item.details} onClick={() => { const affected = allSlices.filter((slice) => item.details.includes(`${slice.screenName} / ${slice.name}`)).map((slice) => slice.id); if (affected.length) { setSelectedSliceIds(affected); setV070InspectorTab("geometry"); } }}><i /><span><b>{item.text}</b><small>{item.details}</small></span>{item.level === "warn" && <em>Focus</em>}</button>) : <p>Choose or link a Resolume Advanced Output XML to begin.</p>}</div> : isV0703D ? <><span>{invalidCurvedDepthSlices.length ? `${invalidCurvedDepthSlices.length} curved screen${invalidCurvedDepthSlices.length === 1 ? "" : "s"} exceed the safe extrusion radius.` : allSlices.length ? "Scene geometry is valid for editing and export." : "Choose a Resolume XML map to build the 3D scene."}</span><strong>{allSlices.length} screens</strong></> : <><span>{stats.mismatch ? "Pixel pitch differs between axes." : stats.cabinetRemainder ? "Wall dimensions do not resolve to complete cabinets." : "Pattern geometry and raster relationship are ready."}</span><strong>{outputWidth} × {outputHeight} px</strong></>)}
                {v070DiagnosticTab === "changes" && isV070Map && (pendingXmlUpdate ? <><span>{pendingXmlUpdate.name} · {pendingMapChanges.added} added · {pendingMapChanges.removed} removed · {pendingMapChanges.changed} changed</span><div className={v070.diagnosticActions}><button onClick={() => { const update = pendingXmlUpdate; applyXmlText(update.xml, update.name, { linked: true, path: update.path, mtimeMs: update.mtimeMs }); setV070DiagnosticTab("validation"); }}>Apply update</button><button onClick={() => { setPendingXmlUpdate(null); setV070DiagnosticTab("validation"); setNotice("Kept the current map"); }}>Keep current</button></div></> : <><span>The linked map matches the current project.</span><strong>No pending changes</strong></>)}
                {v070DiagnosticTab === "output" && <><span>{patternOutputStatus}</span><strong>{patternOutput === "off" ? "Streaming disabled" : `${outputWidth} × ${outputHeight} px`}</strong></>}
                {v070DiagnosticTab === "performance" && <PerformancePanel key={workspaceMode} metrics={renderMetrics[workspaceMode]} three={isV0703D} />}
              </section>}
            </div>
          </section>
          <aside className={v070.inspector}>
            <div className={v070.selection}><span>{isV0703D ? hasGroupSelection ? "Group selection" : selectedSlices.length ? "Slice selection" : "3D scene" : isV070Map ? selectedSlices.length ? "Selected object" : "Pixel map" : "Pattern format"}</span><strong title={isV0703D ? selectedGroup?.name || (hasGroupSelection ? `${selectedGroups.length} groups` : selectedSlices.length === 1 ? selectedSlices[0].name : selectedSlices.length > 1 ? `${selectedSlices.length} screens selected` : resolumeMap?.name || "No scene loaded") : isV070Map ? selectedSlices.length === 1 ? selectedSlices[0].name : selectedSlices.length > 1 ? `${selectedSlices.length} slices selected` : resolumeMap?.name || "No XML loaded" : isDome || isCubemap ? `${projectionName} · ${outputWidth} × ${outputHeight}` : `${projectionName} · ${patternName}`}>{isV0703D ? selectedGroup?.name || (hasGroupSelection ? `${selectedGroups.length} groups` : selectedSlices.length === 1 ? selectedSlices[0].name : selectedSlices.length > 1 ? `${selectedSlices.length} screens selected` : resolumeMap?.name || "No scene loaded") : isV070Map ? selectedSlices.length === 1 ? selectedSlices[0].name : selectedSlices.length > 1 ? `${selectedSlices.length} slices selected` : resolumeMap?.name || "No XML loaded" : isDome || isCubemap ? `${projectionName} · ${outputWidth} × ${outputHeight}` : `${projectionName} · ${patternName}`}</strong></div>
            <nav style={{ gridTemplateColumns: `repeat(${v070Tabs.length}, minmax(0, 1fr))` }}>{v070Tabs.map((item) => <button aria-pressed={v070InspectorTab === item} className={v070InspectorTab === item ? v070.active : ""} key={item} onClick={() => setV070InspectorTab(item)}>{item === "information" ? "Info" : item === "appearance" ? "Style" : item === "overlays" ? "Overlays" : item}</button>)}</nav>
            <div className={v070.inspectorScroll}>
              {!isV070Map && !isV0703D && v070InspectorTab === "setup" && <>
                <VSection title={isDome ? "Dome pattern" : "Project"} styles={v070}>{isDome ? <input aria-label="Dome pattern name" title={config.domePatternName} className={v070.projectInput} value={config.domePatternName} onChange={(event) => update("domePatternName", event.target.value)} /> : <input aria-label="Project name" title={config.project} className={v070.projectInput} value={config.project} onChange={(event) => update("project", event.target.value)} />}</VSection>
                <VSection title="Projection output" styles={v070}>
                  <label className={v070.select}><span>Format</span><select value={config.projectionFormat} onChange={(event) => selectProjectionFormat(event.target.value as ProjectionFormat)}>{PROJECTION_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.name}</option>)}</select></label>
                  {isDome ? <>
                    <ExpressionField label="Resolution" value={config.domeResolution} suffix="px" integer min={256} max={16384} onCommit={(value) => update("domeResolution", Math.round(clamp(value, 256, 16384)))} />
                    <div className={v070.pitchPresets}>{DOME_RESOLUTION_PRESETS.map((resolution) => <button key={resolution} aria-pressed={config.domeResolution === resolution} className={config.domeResolution === resolution ? v070.active : ""} onClick={() => update("domeResolution", resolution)}>{resolution / 1024}K</button>)}</div>
                    <div className={v070.readout}><span>Square output</span><strong>{patternDimensions.width} × {patternDimensions.height} px</strong></div>
                    <label className={v070.select}><span>Background</span><select value={config.domeBackground} onChange={(event) => update("domeBackground", event.target.value as DomeBackground)}>{DOME_BACKGROUND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                    {config.domeBackground === "custom" && <label className={v070.colorWide}><span>Custom colour</span><input type="color" value={config.domeBackgroundColor} onChange={(event) => update("domeBackgroundColor", event.target.value)} /></label>}
                    <button className={v070.choose} onClick={resetDomeSettings}>Reset Dome settings</button>
                  </> : isCubemap ? <>
                    <ExpressionField label="Face resolution" value={config.cubemapResolution} suffix="px" integer min={1024} max={4096} onCommit={(value) => update("cubemapResolution", Math.round(clamp(value, 1024, 4096)))} />
                    <div className={v070.pitchPresets}>{CUBEMAP_RESOLUTION_PRESETS.map((resolution) => <button key={resolution} aria-pressed={config.cubemapResolution === resolution} className={config.cubemapResolution === resolution ? v070.active : ""} onClick={() => update("cubemapResolution", resolution)}>{resolution / 1024}K</button>)}</div>
                    <label className={v070.select}><span>Cross layout</span><select value={config.cubemapLayout} onChange={(event) => update("cubemapLayout", event.target.value as CubemapLayout)}><option value="horizontal-cross">Horizontal Cross</option><option value="vertical-cross">Vertical Cross</option></select></label>
                    <div className={v070.readout}><span>Six faces</span><strong>6 × {config.cubemapResolution} × {config.cubemapResolution} px</strong></div>
                    <div className={v070.readout}><span>Atlas output</span><strong>{patternDimensions.width} × {patternDimensions.height} px</strong></div>
                    <small className={v070.note}>Each face keeps a 90° field of view and its exact square resolution. Layout only changes export packing.</small>
                  </> : <>
                    <div className={v070.readout}><span>Native output</span><strong>{patternDimensions.width} × {patternDimensions.height} px</strong></div>
                    {config.projectionFormat !== "planar" && <small className={v070.note}>Width is the master resolution; OpticMesh derives the format-correct output height.</small>}
                  </>}
                </VSection>
                {config.projectionFormat === "planar" && <><VSection title="Linked wall calculator" styles={v070}><div className={v070.two}><ExpressionField label="Width" value={config.wallWidth} suffix="m" onCommit={(value) => editCalculator("physical", "wallWidth", snapPhysical(value, config.cabinetWidth))} /><ExpressionField label="Height" value={config.wallHeight} suffix="m" onCommit={(value) => editCalculator("physical", "wallHeight", snapPhysical(value, config.cabinetHeight))} /></div><div className={v070.two}><ExpressionField label="Raster W" value={config.resolutionWidth} suffix="px" integer onCommit={(value) => editCalculator("raster", "resolutionWidth", value)} /><ExpressionField label="Raster H" value={config.resolutionHeight} suffix="px" integer onCommit={(value) => editCalculator("raster", "resolutionHeight", value)} /></div><ExpressionField label="Pixel pitch" value={config.pixelPitchMm} suffix="mm" onCommit={(value) => editCalculator("pitch", "pixelPitchMm", value)} /><div className={v070.readout}><span>Calculated pitch</span><strong>{stats.pitchX.toFixed(4)} × {stats.pitchY.toFixed(4)} mm</strong></div></VSection><VSection title="Cabinet geometry" styles={v070}><div className={v070.two}><ExpressionField label="Cabinet W" value={config.cabinetWidth} suffix="mm" integer onCommit={(value) => update("cabinetWidth", value)} /><ExpressionField label="Cabinet H" value={config.cabinetHeight} suffix="mm" integer onCommit={(value) => update("cabinetHeight", value)} /></div><div className={v070.readout}><span>Cabinet count</span><strong>{stats.cols.toFixed(1)} × {stats.rows.toFixed(1)}</strong></div></VSection></>}
                {config.projectionFormat === "planar" && <VSection title="Pattern presentation" styles={v070}><label className={v070.select}><span>Background</span><select value={config.backgroundMode} onChange={(event) => update("backgroundMode", event.target.value as BackgroundMode)}><option value="transparent">Transparent</option><option value="black">Black</option></select></label><ToggleRow label="Run test sequence" value={sequenceActive} onClick={() => setSequenceActive((value) => !value)} styles={v070} /></VSection>}
              </>}
              {!isV070Map && !isV0703D && v070InspectorTab === "overlays" && (isDome ? <>
                <VSection title="Dome guides" styles={v070}>
                  <ToggleRow label="Show labels" value={config.domeShowLabels} onClick={() => update("domeShowLabels", !config.domeShowLabels)} styles={v070} />
                  <ToggleRow label="Compass" value={config.domeCompass} onClick={() => update("domeCompass", !config.domeCompass)} styles={v070} />
                  <ToggleRow label="Degree labels" value={config.domeDegreeLabels} onClick={() => update("domeDegreeLabels", !config.domeDegreeLabels)} styles={v070} />
                  <ToggleRow label="Elevation angles" value={config.domeElevationAngles} onClick={() => update("domeElevationAngles", !config.domeElevationAngles)} styles={v070} />
                  <ToggleRow label="Dome border" value={config.domeBorder} onClick={() => update("domeBorder", !config.domeBorder)} styles={v070} />
                </VSection>
                <VSection title="Degree lines" styles={v070}>
                  <label className={v070.select}><span>Step</span><select value={config.domeDegreeStep} onChange={(event) => update("domeDegreeStep", Number(event.target.value))}>{DOME_DEGREE_STEPS.map((step) => <option key={step} value={step}>{step}°</option>)}</select></label>
                  <div className={v070.range}><span>Line opacity</span><ResetSlider aria-label="Dome Line Opacity" resetValue={DEFAULT_CONFIG.domeLineOpacity} min="5" max="100" value={config.domeLineOpacity} onValueChange={(value) => update("domeLineOpacity", value)} /></div>
                  <PreciseNumberInput label="Line opacity" min={5} max={100} value={config.domeLineOpacity} onChange={(value) => update("domeLineOpacity", value)} />
                </VSection>
                <VSection title="Rings" styles={v070}>
                  <ToggleRow label="Concentric rings" value={config.domeShowRings} onClick={() => update("domeShowRings", !config.domeShowRings)} styles={v070} />
                  <div className={v070.range}><span>Number of rings</span><ResetSlider aria-label="Dome Ring Count" resetValue={DEFAULT_CONFIG.domeRingCount} min="4" max="90" value={config.domeRingCount} onValueChange={(value) => update("domeRingCount", value)} /></div>
                  <PreciseNumberInput label="Ring count" min={4} max={90} value={config.domeRingCount} onChange={(value) => update("domeRingCount", Math.round(value))} />
                  <div className={v070.segmented}>{(["thin", "medium", "bold"] as DomeRingWeight[]).map((weight) => <button key={weight} aria-pressed={config.domeRingWeight === weight} className={config.domeRingWeight === weight ? v070.active : ""} onClick={() => update("domeRingWeight", weight)}>{weight.charAt(0).toUpperCase() + weight.slice(1)}</button>)}</div>
                </VSection>
                <VSection title="Colours" styles={v070}>
                  <label className={v070.colorWide}><span>Angular grid</span><input type="color" value={config.domeGridColor} onChange={(event) => update("domeGridColor", event.target.value)} /></label>
                  <label className={v070.colorWide}><span>Major axes</span><input type="color" value={config.domeAxisColor} onChange={(event) => update("domeAxisColor", event.target.value)} /></label>
                  <label className={v070.colorWide}><span>Rings</span><input type="color" value={config.domeRingColor} onChange={(event) => update("domeRingColor", event.target.value)} /></label>
                  <label className={v070.colorWide}><span>Labels</span><input type="color" value={config.domeLabelColor} onChange={(event) => update("domeLabelColor", event.target.value)} /></label>
                </VSection>
                <VSection title="Center marker" styles={v070}>
                  <div className={v070.colorRow}><ToggleRow label="Center dot" value={config.domeShowCenterDot} onClick={() => update("domeShowCenterDot", !config.domeShowCenterDot)} styles={v070} /><input type="color" value={config.domeCenterDotColor} onChange={(event) => update("domeCenterDotColor", event.target.value)} aria-label="Center dot color" /></div>
                  {config.domeShowCenterDot && <><div className={v070.range}><span>Dot size</span><ResetSlider aria-label="Dome Center Dot Size" resetValue={DEFAULT_CONFIG.domeCenterDotSize} min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={config.domeCenterDotSize} onValueChange={(value) => update("domeCenterDotSize", value)} /></div><PreciseNumberInput label="Dot size" min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={config.domeCenterDotSize} onChange={(value) => update("domeCenterDotSize", value)} /></>}
                </VSection>
              </> : isCubemap ? <>
                <VSection title="Cubemap guides" styles={v070}>
                  <ToggleRow label="Perspective grid" value={config.cubemapShowGrid} onClick={() => update("cubemapShowGrid", !config.cubemapShowGrid)} styles={v070} />
                  <ToggleRow label="Face edges" value={config.cubemapShowSeams} onClick={() => update("cubemapShowSeams", !config.cubemapShowSeams)} styles={v070} />
                  <ToggleRow label="Face labels" value={config.cubemapShowFaceLabels} onClick={() => update("cubemapShowFaceLabels", !config.cubemapShowFaceLabels)} styles={v070} />
                  <label className={v070.select}><span>Grid density</span><select value={config.cubemapGridStep} onChange={(event) => update("cubemapGridStep", Number(event.target.value))}><option value="30">Sparse</option><option value="15">Medium</option><option value="5">Dense</option></select></label>
                </VSection>
                <VSection title="Guide colours" styles={v070}>
                  <label className={v070.colorWide}><span>Perspective grid</span><input type="color" value={patternStyle.metricGridColor} onChange={(event) => updatePatternStyle("metricGridColor", event.target.value)} /></label>
                  <label className={v070.colorWide}><span>Face edges</span><input type="color" value={patternStyle.safeAreaColor} onChange={(event) => updatePatternStyle("safeAreaColor", event.target.value)} /></label>
                  <label className={v070.colorWide}><span>Labels</span><input type="color" value={patternStyle.labelColor} onChange={(event) => updatePatternStyle("labelColor", event.target.value)} /></label>
                  <div className={v070.range}><span>Line width</span><ResetSlider aria-label="Line Width" resetValue={DEFAULT_PATTERN_STYLE.lineWidth} min="1" max="12" step=".5" value={patternStyle.lineWidth} onValueChange={(value) => updatePatternStyle("lineWidth", value)} /></div>
                  <PreciseNumberInput label="Line width" min={1} max={12} step={.5} value={patternStyle.lineWidth} onChange={(value) => updatePatternStyle("lineWidth", value)} />
                </VSection>
              </> : <>
                <VSection title="Pattern surface" styles={v070}>
                  <ToggleRow label="Cabinet checker" value={patternStyle.showPatternCheckerboard} onClick={() => updatePatternStyle("showPatternCheckerboard", !patternStyle.showPatternCheckerboard)} styles={v070} />
                  {patternStyle.showPatternCheckerboard && <><div className={v070.colorGrid}><label><span>Checker A</span><input type="color" value={patternStyle.checkerColorA} onChange={(event) => updatePatternStyle("checkerColorA", event.target.value)} /></label><label><span>Checker B</span><input type="color" value={patternStyle.checkerColorB} onChange={(event) => updatePatternStyle("checkerColorB", event.target.value)} /></label></div><div className={v070.readout}><span>Checker block</span><strong>{cabinetPixels(patternRenderConfig).width} × {cabinetPixels(patternRenderConfig).height} px</strong></div></>}
                </VSection>
                <VSection title="Information & guides" styles={v070}>
                  <ToggleRow label="Resolution grid" value={patternStyle.showMetricGrid} onClick={() => updatePatternStyle("showMetricGrid", !patternStyle.showMetricGrid)} styles={v070} />
                  <ToggleRow label="Project title" value={patternStyle.showPatternTitle} onClick={() => updatePatternStyle("showPatternTitle", !patternStyle.showPatternTitle)} styles={v070} />
                  <ToggleRow label="Dimensions" value={patternStyle.showPatternDimensions} onClick={() => updatePatternStyle("showPatternDimensions", !patternStyle.showPatternDimensions)} styles={v070} />
                  <ToggleRow label="Cardinal labels" value={patternStyle.showCardinalLabels} onClick={() => updatePatternStyle("showCardinalLabels", !patternStyle.showCardinalLabels)} styles={v070} />
                  {overlayRows.map((row) => <div className={v070.colorRow} key={row.key}><ToggleRow label={row.label} value={patternStyle[row.key]} onClick={() => updatePatternStyle(row.key, !patternStyle[row.key])} styles={v070} /><input type="color" value={String(patternStyle[row.color])} onChange={(event) => updatePatternStyle(row.color, event.target.value as never)} aria-label={`${row.label} color`} /></div>)}
                  <div className={v070.range}><span>Line width</span><ResetSlider aria-label="Line Width" resetValue={DEFAULT_PATTERN_STYLE.lineWidth} min="1" max="12" step=".5" value={patternStyle.lineWidth} onValueChange={(value) => updatePatternStyle("lineWidth", value)} /></div><PreciseNumberInput label="Line width" min={1} max={12} step={.5} value={patternStyle.lineWidth} onChange={(value) => updatePatternStyle("lineWidth", value)} />
                  <label className={v070.colorWide}><span>Grid / border</span><input type="color" value={patternStyle.metricGridColor} onChange={(event) => updatePatternStyle("metricGridColor", event.target.value)} /></label>
                </VSection>
                <VSection title="Center marker" styles={v070}>
                  <div className={v070.colorRow}><ToggleRow label="Center dot" value={patternStyle.showCenterDot} onClick={() => updatePatternStyle("showCenterDot", !patternStyle.showCenterDot)} styles={v070} /><input type="color" value={patternStyle.centerDotColor} onChange={(event) => updatePatternStyle("centerDotColor", event.target.value)} aria-label="Center dot color" /></div>
                  {patternStyle.showCenterDot && <><div className={v070.range}><span>Dot size</span><ResetSlider aria-label="Center Dot Size" resetValue={DEFAULT_PATTERN_STYLE.centerDotSize} min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={patternStyle.centerDotSize} onValueChange={(value) => updatePatternStyle("centerDotSize", value)} /></div><PreciseNumberInput label="Dot size" min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={patternStyle.centerDotSize} onChange={(value) => updatePatternStyle("centerDotSize", value)} /></>}
                </VSection>
              </>)}
              {!isV070Map && !isV0703D && v070InspectorTab === "logo" && <VSection title={isDome ? "Dome logo" : isCubemap ? "Cubemap logo" : "Logo"} styles={v070}><button title={logoName || "Choose custom logo"} className={v070.choose} onClick={() => logoInputRef.current?.click()}>{logoName || "Choose custom logo…"}</button><input ref={logoInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => loadLogo(event.target.files?.[0])} />{isDome ? <><ToggleRow label="Logo visible" value={config.domeShowLogo} onClick={() => update("domeShowLogo", !config.domeShowLogo)} styles={v070} /><ExpressionField label="Azimuth" value={config.domeLogoAzimuth} suffix="°" min={0} max={360} onCommit={(value) => update("domeLogoAzimuth", ((value % 360) + 360) % 360)} /><ExpressionField label="Elevation" value={config.domeLogoElevation} suffix="°" min={0} max={90} onCommit={(value) => update("domeLogoElevation", clamp(value, 0, 90))} /><div className={v070.range}><span>Logo size · {config.domeLogoScale}%</span><ResetSlider aria-label="Dome Logo Scale" resetValue={DEFAULT_CONFIG.domeLogoScale} min="25" max="200" value={config.domeLogoScale} onValueChange={(value) => update("domeLogoScale", value)} /></div><PreciseNumberInput label="Logo size" min={25} max={200} value={config.domeLogoScale} onChange={(value) => update("domeLogoScale", value)} /><div className={v070.range}><span>Opacity</span><ResetSlider aria-label="Dome Logo Opacity" resetValue={DEFAULT_CONFIG.domeLogoOpacity} min="10" max="100" value={config.domeLogoOpacity} onValueChange={(value) => update("domeLogoOpacity", value)} /></div><PreciseNumberInput label="Opacity" min={10} max={100} value={config.domeLogoOpacity} onChange={(value) => update("domeLogoOpacity", value)} /><div className={v070.readout}><span>Placement</span><strong>{config.domeLogoAzimuth.toFixed(1)}° AZ · {config.domeLogoElevation.toFixed(1)}° EL · {config.domeLogoScale}%</strong></div></> : isCubemap ? <><ToggleRow label="Logo visible" value={config.cubemapShowLogo} onClick={() => update("cubemapShowLogo", !config.cubemapShowLogo)} styles={v070} /><ExpressionField label="Azimuth" value={config.cubemapLogoAzimuth} suffix="°" min={0} max={360} onCommit={(value) => update("cubemapLogoAzimuth", ((value % 360) + 360) % 360)} /><ExpressionField label="Elevation" value={config.cubemapLogoElevation} suffix="°" min={-90} max={90} onCommit={(value) => update("cubemapLogoElevation", clamp(value, -90, 90))} /><div className={v070.range}><span>Angular size · {config.cubemapLogoAngularWidth}°</span><ResetSlider aria-label="Cubemap Logo Angular Width" resetValue={DEFAULT_CONFIG.cubemapLogoAngularWidth} min="5" max="120" value={config.cubemapLogoAngularWidth} onValueChange={(value) => update("cubemapLogoAngularWidth", value)} /></div><PreciseNumberInput label="Angular size" min={5} max={120} value={config.cubemapLogoAngularWidth} onChange={(value) => update("cubemapLogoAngularWidth", value)} /><div className={v070.range}><span>Opacity</span><ResetSlider aria-label="Cubemap Logo Opacity" resetValue={DEFAULT_CONFIG.cubemapLogoOpacity} min="10" max="100" value={config.cubemapLogoOpacity} onValueChange={(value) => update("cubemapLogoOpacity", value)} /></div><PreciseNumberInput label="Opacity" min={10} max={100} value={config.cubemapLogoOpacity} onChange={(value) => update("cubemapLogoOpacity", value)} /><div className={v070.readout}><span>Direction</span><strong>{config.cubemapLogoAzimuth.toFixed(1)}° AZ · {config.cubemapLogoElevation.toFixed(1)}° EL</strong></div></> : <><ToggleRow label="Logo visible" value={config.showLogo} onClick={() => update("showLogo", !config.showLogo)} styles={v070} /><label className={v070.select}><span>Position</span><select value={config.customLogoPosition} onChange={(event) => update("customLogoPosition", event.target.value as LogoPosition)}>{["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"].map((item) => <option key={item}>{item}</option>)}</select></label><div className={v070.range}><span>Scale · {config.customLogoScale}%</span><ResetSlider aria-label="Custom Logo Scale" resetValue={DEFAULT_CONFIG.customLogoScale} min="25" max="200" value={config.customLogoScale} onValueChange={(value) => update("customLogoScale", value)} /></div><div className={v070.range}><span>Opacity · {config.customLogoOpacity}%</span><ResetSlider aria-label="Custom Logo Opacity" resetValue={DEFAULT_CONFIG.customLogoOpacity} min="10" max="100" value={config.customLogoOpacity} onValueChange={(value) => update("customLogoOpacity", value)} /></div></>}</VSection>}
              {isV0703D && v070InspectorTab === "scene" && <>
                <VSection title="Scene hierarchy" styles={v070}>
                  <input className={v070.projectInput} value={hierarchyQuery} onChange={(event) => setHierarchyQuery(event.target.value)} placeholder="Search hierarchy…" aria-label="Search scene hierarchy" />
                  <div className={v070.sceneActions}><button onClick={groupSelectedSlices} disabled={!selectedSliceIds.length || hasGroupSelection}>Group</button><button onClick={ungroupSelectedSlices} disabled={!hasGroupSelection && !simulationGroups.some((group) => group.sliceIds.some((id) => selectedSliceIds.includes(id)))}>Ungroup</button><button onClick={() => setSimulationFocusSignal((value) => value + 1)} disabled={!selectedSliceIds.length}>Focus</button></div>
                  <div className={`hierarchy-tree ${v070.hierarchyTree}`}><div className="hierarchy-row screen"><span className="hierarchy-type"><UiIcon name="group" /></span><strong>Scene</strong><small>{allSlices.length}</small></div>{simulationGroups.filter((group) => !group.parentId || !simulationGroups.some((parent) => parent.id === group.parentId)).map((group) => renderHierarchyGroup(group))}{resolumeMap?.screens.map((screen) => { const slices = screen.slices.filter((slice) => !groupedSliceIds.has(slice.id) && (!hierarchyQuery || screen.name.toLowerCase().includes(hierarchyQuery.toLowerCase()) || (simulationLocalNames[slice.id] || slice.name).toLowerCase().includes(hierarchyQuery.toLowerCase()))); if (!slices.length) return null; return <div className="hierarchy-screen" key={screen.name}><div className="hierarchy-row screen"><span className="hierarchy-type"><UiIcon name="screen" /></span><strong title={screen.name}>{screen.name}</strong><small>{slices.length}</small></div>{slices.map((slice) => renderHierarchySlice(slice, 0))}</div>; })}{hierarchyDrag && <div className="hierarchy-root-drop" onDragOver={(event) => { event.preventDefault(); setHierarchyDrop(null); }} onDrop={(event) => { event.preventDefault(); dropHierarchyAtRoot(); }}>Move to scene root</div>}</div>
                  <small className={v070.note}>Drag slices and subgroups onto a group to set their parent. Double-click a group name to rename it.</small>
                </VSection>
              </>}
              {isV0703D && v070InspectorTab === "scene" && <>
                <VSection title="Transform axes" styles={v070}><div className={v070.segmented}><button aria-pressed={simulationTransformSpace === "local"} className={simulationTransformSpace === "local" ? v070.active : ""} onClick={() => setSimulationTransformSpace("local")}>Local</button><button aria-pressed={simulationTransformSpace === "world"} className={simulationTransformSpace === "world" ? v070.active : ""} onClick={() => setSimulationTransformSpace("world")}>World</button></div></VSection>
                <VSection title="Coordinates" styles={v070}>{selectedTransformPosition ? <div className={v070.transformFields}><div className={v070.transformFieldGroup}><small className={v070.note}>Position</small><div className="transform-grid"><SignedNumberField label="X" value={selectedTransformPosition[0]} suffix="m" onCommit={(value) => updateManualPosition(0, value)} /><SignedNumberField label="Y" value={selectedTransformPosition[1]} suffix="m" onCommit={(value) => updateManualPosition(1, value)} /><SignedNumberField label="Z" value={selectedTransformPosition[2]} suffix="m" onCommit={(value) => updateManualPosition(2, value)} /></div></div><div className={v070.transformFieldGroup}><small className={v070.note}>Rotation</small><div className="transform-grid"><SignedNumberField label="X" value={selectedTransformRotation?.[0] ?? null} suffix="°" onCommit={(value) => updateManualRotation(0, value)} /><SignedNumberField label="Y" value={selectedTransformRotation?.[1] ?? null} suffix="°" onCommit={(value) => updateManualRotation(1, value)} /><SignedNumberField label="Z" value={selectedTransformRotation?.[2] ?? null} suffix="°" onCommit={(value) => updateManualRotation(2, value)} /></div></div><div className={v070.transformFieldGroup}><small className={v070.note}>Scale</small><div className="transform-grid"><SignedNumberField label="X" value={selectedTransformScale?.[0] ?? null} suffix="" onCommit={(value) => updateManualScale(0, value)} /><SignedNumberField label="Y" value={selectedTransformScale?.[1] ?? null} suffix="" onCommit={(value) => updateManualScale(1, value)} /><SignedNumberField label="Z" value={selectedTransformScale?.[2] ?? null} suffix="" onCommit={(value) => updateManualScale(2, value)} /></div></div><button className={v070.choose} onClick={resetSelectedTransforms}>Reset transform</button></div> : <small className={v070.note}>Select a slice or group to edit its coordinates.</small>}</VSection>
                <VSection title="Pivot" styles={v070}>
                  <fieldset className={v070.pivotEditor} disabled={pivotEditingDisabled}>
                    <label className={v070.pivotMode}><span>Mode</span><select aria-label="Pivot mode" value={pivotEditorValues.mode} onChange={(event) => changeSimulationPivot(event.target.value === "custom" ? (previous, width, height) => ({ custom: pivotOffset(previous, width, height) }) : event.target.value as PivotPreset)}>
                      {pivotEditorValues.mode === "mixed" && <option value="mixed" disabled>Mixed</option>}
                      {PIVOT_PRESETS.map((preset) => <option value={preset} key={preset}>{PIVOT_LABELS[preset]}</option>)}<option value="custom">Custom</option>
                    </select></label>
                    <PivotPad point={pivotEditorValues.point} disabled={pivotEditingDisabled} onCommit={changeSimulationPivot} />
                    <div className={v070.pivotCoordinates}><span>Pivot (m)</span><div className="transform-grid">{([0, 1, 2] as const).map((axis) => <SignedNumberField key={axis} disabled={pivotEditingDisabled} label={["X", "Y", "Z"][axis]} value={pivotEditorValues.values[axis]} suffix="" onCommit={(value) => changeSimulationPivot((previous, width, height) => { const custom = pivotOffset(previous, width, height); custom[axis] = value; return { custom }; })} />)}</div></div>
                  </fieldset>
                  {hasGroupSelection && <small className={v070.note}>Select individual screens to edit their pivots. Groups use their group axis.</small>}
                </VSection>
                <VSection id="scene-align" title="Align centres" styles={v070}><div className={`${v070.segmented} ${v070.axisButtons}`}>{([0, 1, 2] as const).map((axis) => <button key={axis} disabled={selectedSliceIds.length < 2} onClick={() => arrangeSimulationSelection(axis, "align")}>Align {["X", "Y", "Z"][axis]}</button>)}</div></VSection>
                <VSection id="scene-distribute" title="Distribute centres" styles={v070}><div className={`${v070.segmented} ${v070.axisButtons}`}>{([0, 1, 2] as const).map((axis) => <button key={axis} disabled={selectedSliceIds.length < 3} onClick={() => arrangeSimulationSelection(axis, "distribute")}>Space {["X", "Y", "Z"][axis]}</button>)}</div></VSection>
                <VSection title="Scene display" styles={v070}>{sceneDisplayControls}</VSection>
              </>}
              {isV0703D && v070InspectorTab === "geometry" && <>
                <VSection title="Screen geometry" styles={v070}><small className={v070.note}>{selectedSliceIds.length ? `${selectedSliceIds.length} selected screen${selectedSliceIds.length === 1 ? "" : "s"}` : "Scene default"}</small><ExpressionField label="Pixel pitch" value={selectedNumericValues.pixelPitchMm} scopeKey={selectionScopeKey} suffix="mm" onCommit={(value) => selectedSliceIds.length ? updateSelected({ pixelPitchMm: value }) : updateGlobal("pixelPitchMm", value)} /><div className={v070.pitchPresets}>{PIXEL_PITCH_PRESETS.map((pitch) => <button key={pitch} aria-pressed={selectedNumericValues.pixelPitchMm !== null && Math.abs(selectedNumericValues.pixelPitchMm - pitch) < .0001} className={selectedNumericValues.pixelPitchMm !== null && Math.abs(selectedNumericValues.pixelPitchMm - pitch) < .0001 ? v070.active : ""} onClick={() => selectedSliceIds.length ? updateSelected({ pixelPitchMm: pitch }) : updateGlobal("pixelPitchMm", pitch)}>P{pitch}</button>)}</div>{selectedSlices.length === 1 ? <><div className={v070.readout}><span>Dimensions</span><strong>{((selectedSlices[0].input.width * (simulationPitchBySlice[selectedSlices[0].id] || simulationMasterPitchMm)) / 1000).toFixed(3)} × {((selectedSlices[0].input.height * (simulationPitchBySlice[selectedSlices[0].id] || simulationMasterPitchMm)) / 1000).toFixed(3)} m</strong></div><div className={v070.readout}><span>Raster</span><strong>{selectedSlices[0].input.width} × {selectedSlices[0].input.height} px</strong></div>{(selectedCurvatureRadius.horizontal || selectedCurvatureRadius.vertical) && <div className={v070.readout}><span>Calculated diameter</span><strong>{(2 * (selectedCurvatureRadius.horizontal || selectedCurvatureRadius.vertical || 0)).toFixed(3)} m</strong></div>}</> : <div className={v070.readout}><span>Pitch variants</span><strong>{simulationPitchCount}</strong></div>}</VSection>
                <VSection title="Extrusion" styles={v070}><div className={v070.range}><span>Depth · {round(simulationDepthM * 100, 1)} cm</span><ResetSlider aria-label="Extrusion depth" resetValue={10} min="1" max="50" step=".5" value={simulationDepthM * 100} onEditStart={() => recordSimulationHistory("Change extrusion depth")} onValueChange={(value) => setSimulationDepthM(clamp(value, 1, 50) / 100)} /></div><PreciseNumberInput label="Extrusion depth" min={1} max={50} step={.5} value={round(simulationDepthM * 100, 1)} onEditStart={() => recordSimulationHistory("Enter extrusion depth")} onChange={(value) => setSimulationDepthM(value / 100)} /></VSection>
                <VSection title="Curvature" styles={v070}><div className={v070.range}><span>Horizontal · {selectedCurvature.horizontal ?? "Mixed"}°</span><ResetSlider aria-label="Horizontal curve" resetValue={0} min="-360" max="360" value={selectedCurvature.horizontal ?? 0} disabled={verticalCurveActive} onEditStart={() => recordSimulationHistory("Change horizontal curve")} onPointerDown={() => {  setSimulationGeometryPreview(true); }} onPointerUp={() => setSimulationGeometryPreview(false)} onValueChange={(value) => applySimulationCurvature("horizontal", value)} /></div><CurvatureNumberInput label="Horizontal curve" value={selectedCurvature.horizontal} disabled={verticalCurveActive} onEditStart={() => recordSimulationHistory("Enter horizontal curve")} onCommit={(value) => applySimulationCurvature("horizontal", value)} /><div className={v070.range}><span>Vertical · {selectedCurvature.vertical ?? "Mixed"}°</span><ResetSlider aria-label="Vertical curve" resetValue={0} min="-360" max="360" value={selectedCurvature.vertical ?? 0} disabled={horizontalCurveActive} onEditStart={() => recordSimulationHistory("Change vertical curve")} onPointerDown={() => {  setSimulationGeometryPreview(true); }} onPointerUp={() => setSimulationGeometryPreview(false)} onValueChange={(value) => applySimulationCurvature("vertical", value)} /></div><CurvatureNumberInput label="Vertical curve" value={selectedCurvature.vertical} disabled={horizontalCurveActive} onEditStart={() => recordSimulationHistory("Enter vertical curve")} onCommit={(value) => applySimulationCurvature("vertical", value)} />{invalidCurvedDepthSlices.length > 0 && <p className={v070.warning}>Reduce extrusion below the inner curvature radius for {invalidCurvedDepthSlices.length} screen{invalidCurvedDepthSlices.length === 1 ? "" : "s"}.</p>}</VSection>

              </>}
              {isV0703D && v070InspectorTab === "source" && <>
                <VSection title="Video texture" styles={v070}><label className={v070.select}><span>Global feed</span><select value={simulationSource} onChange={(event) => { const next = event.target.value as SimulationSource; recordSimulationHistory("Change global source"); stopSimulationInput(); void disconnectNativeInput(); setSimulationSource(next); setSimulationSourceStatus(next === "pattern" ? "Native · full quality" : "Select or connect the source below"); }}><option value="pattern">Pattern Generator</option><option value="video">Video Devices</option><option value="ndi">NDI</option><option value="spout">Spout</option></select></label><label className={v070.select}><span>Selected</span><select disabled={!selectedSliceIds.length} value={selectedSourceOverride} onChange={(event) => { const value = event.target.value as "inherit" | SimulationSource; recordSimulationHistory("Change selected source routing"); setSimulationSourceOverrides((current) => { const next = { ...current }; selectedSliceIds.forEach((id) => value === "inherit" ? delete next[id] : next[id] = value); return next; }); }}>{selectedSourceOverride === "mixed" && <option value="mixed" disabled>— Multiple sources</option>}<option value="inherit">Inherit global source</option><option value="pattern">Pattern Generator</option><option value="video">Video Device · Full Source</option><option value="ndi">NDI · Full Source</option><option value="spout">Spout · Full Source</option></select></label>{selectedSliceIds.length > 0 && selectedSourceOverride !== "inherit" && <button className={v070.choose} onClick={() => { recordSimulationHistory("Reset selected source routing"); setSimulationSourceOverrides((current) => { const next = { ...current }; selectedSliceIds.forEach((id) => delete next[id]); return next; }); }}>Reset selected routing</button>}</VSection>
                {sourcePanelType !== "pattern" && <VSection title={sourcePanelType === "video" ? "Video device" : sourcePanelType === "ndi" ? "NDI input" : "Spout input"} styles={v070}><div className={v070.segmented}><button aria-pressed={simulationQuality === "latency"} className={simulationQuality === "latency" ? v070.active : ""} onClick={() => setSimulationQuality("latency")}>Low latency</button><button aria-pressed={simulationQuality === "quality"} className={simulationQuality === "quality" ? v070.active : ""} onClick={() => setSimulationQuality("quality")}>High quality</button></div>{sourcePanelType === "video" ? <><label className={v070.select}><span>Device</span><select value={simulationInputDeviceId} onChange={(event) => setSimulationInputDeviceId(event.target.value)}><option value="">Auto-detect</option>{simulationInputDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Video input ${index + 1}`}</option>)}</select></label><button className={v070.choose} onClick={() => void connectSimulationInput()}>{simulationSourceVideo ? "Reconnect device" : "Connect device"}</button>{simulationSourceVideo && <button className={v070.choose} onClick={stopSimulationInput}>Disconnect</button>}</> : <><label className={v070.select}><span>Available</span><select value={sourcePanelType === "ndi" ? simulationNdiSourceId : simulationSpoutSourceId} disabled={!simulationNativeSources.length} onChange={(event) => sourcePanelType === "ndi" ? setSimulationNdiSourceId(event.target.value) : setSimulationSpoutSourceId(event.target.value)}>{!simulationNativeSources.length && <option value="">No sources found</option>}{simulationNativeSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label><button className={v070.choose} disabled={!simulationNativeSources.length} onClick={() => void connectNativeInput()}>Connect source</button><button className={v070.choose} onClick={() => void scanNativeSources(sourcePanelType)}>Refresh list</button>{simulationNativeConnected && <button className={v070.choose} onClick={() => void disconnectNativeInput()}>Disconnect</button>}</>}<div className={v070.fileStatus}><i /><span>{simulationSourceStatus}</span></div></VSection>}
              </>}
              {isV070Map && v070InspectorTab === "source" && <><VSection title="Map summary" styles={v070}><div className={v070.readout}><span>Canvas</span><strong>{outputWidth} × {outputHeight} px</strong></div><div className={v070.readout}><span>Contents</span><strong>{resolumeMap ? `${activeSlices.length} slices · ${mapView === "output" ? 1 : resolumeMap.screens.length} ${mapView === "output" ? "screen" : "screens"}` : "No XML loaded"}</strong></div></VSection>{resolumeMap && <><VSection title="Slice selection" styles={v070}><label className={v070.select}><span>Slice</span><select value={selectedSliceIds.length === 1 ? selectedSliceIds[0] : selectedSliceIds.length > 1 ? "multiple" : "none"} onChange={(event) => setSelectedSliceIds(event.target.value === "none" ? [] : [event.target.value])}><option value="none">Click map or choose…</option>{selectedSliceIds.length > 1 && <option value="multiple">{selectedSliceIds.length} slices selected</option>}{activeSlices.map((slice) => <option key={slice.id} value={slice.id}>{slice.name}</option>)}</select></label>{selectedSlices.length > 0 && <button className={v070.choose} onClick={() => setSelectedSliceIds([])}>Clear selection</button>}</VSection><VSection title="Screens and slices" styles={v070}><div className={v070.mapTree}>{resolumeMap.screens.map((screen, screenIndex) => <section key={screen.name}><button title={screen.name} aria-pressed={mapView === "output" && selectedScreen === screenIndex} className={mapView === "output" && selectedScreen === screenIndex ? v070.active : ""} onClick={() => { setMapView("output"); setSelectedScreen(screenIndex); setSelectedSliceIds(screen.slices.map((slice) => slice.id)); }}><strong title={screen.name}>{screen.name}</strong><span>{screen.width} × {screen.height}</span></button>{screen.slices.map((slice) => <button key={slice.id} title={slice.name} aria-pressed={selectedSliceIds.includes(slice.id)} className={selectedSliceIds.includes(slice.id) ? v070.active : ""} onClick={(event) => setSelectedSliceIds((current) => event.ctrlKey ? current.includes(slice.id) ? current.filter((id) => id !== slice.id) : [...current, slice.id] : [slice.id])}><span>{slice.name}</span><small>{slice.input.width} × {slice.input.height} px</small></button>)}</section>)}</div></VSection></>}</>}
              {isV070Map && v070InspectorTab === "geometry" && <VSection title="LED panel geometry" styles={v070}><small className={v070.note}>{selectedSliceIds.length ? `${selectedSliceIds.length} selected` : "Project default"}</small><div className={v070.two}><ExpressionField label="Panel W" value={selectedNumericValues.cabinetWidth} scopeKey={selectionScopeKey} suffix="mm" integer onCommit={(value) => selectedSliceIds.length ? updateSelected({ cabinetWidth: value }) : updateGlobal("cabinetWidth", value)} /><ExpressionField label="Panel H" value={selectedNumericValues.cabinetHeight} scopeKey={selectionScopeKey} suffix="mm" integer onCommit={(value) => selectedSliceIds.length ? updateSelected({ cabinetHeight: value }) : updateGlobal("cabinetHeight", value)} /></div><ExpressionField label="Pixel pitch" value={selectedNumericValues.pixelPitchMm} scopeKey={selectionScopeKey} suffix="mm" onCommit={(value) => selectedSliceIds.length ? updateSelected({ pixelPitchMm: value }) : updateGlobal("pixelPitchMm", value)} /><div className={v070.pitchPresets}>{PIXEL_PITCH_PRESETS.map((pitch) => <button key={pitch} aria-pressed={selectedNumericValues.pixelPitchMm !== null && Math.abs(selectedNumericValues.pixelPitchMm - pitch) < .0001} className={selectedNumericValues.pixelPitchMm !== null && Math.abs(selectedNumericValues.pixelPitchMm - pitch) < .0001 ? v070.active : ""} onClick={() => selectedSliceIds.length ? updateSelected({ pixelPitchMm: pitch }) : updateGlobal("pixelPitchMm", pitch)}>P{pitch}</button>)}</div><div className={v070.readout}><span>Checker block</span><strong>{selectedPanelPixels ? `${selectedPanelPixels.width} × ${selectedPanelPixels.height} px` : "— Multiple values"}</strong></div>{selectedSlices.length === 1 && <><div className={v070.readout}><span>Input position</span><strong>X {selectedSlices[0].input.x} · Y {selectedSlices[0].input.y} px</strong></div><div className={v070.readout}><span>Output position</span><strong>X {selectedSlices[0].output.x} · Y {selectedSlices[0].output.y} px</strong></div><div className={v070.readout}><span>Data size</span><strong>{selectedSlices[0].input.width} × {selectedSlices[0].input.height} px</strong></div><div className={v070.readout}><span>Physical size</span><strong>{((selectedSlices[0].input.width * (selectedNumericValues.pixelPitchMm || config.pixelPitchMm)) / 1000).toFixed(3)} × {((selectedSlices[0].input.height * (selectedNumericValues.pixelPitchMm || config.pixelPitchMm)) / 1000).toFixed(3)} m</strong></div><small className={v070.note}>Pixel position and data size come from the linked Resolume XML and remain read-only.</small></>}</VSection>}
              {isV070Map && v070InspectorTab === "information" && <VSection title="Slice information" styles={v070}><ToggleRow label="Show information" value={selectedBoolean("showLabels", config.showLabels)} onClick={() => selectedSliceIds.length ? updateSelected({ showLabels: !selectedBoolean("showLabels", config.showLabels) }) : updateGlobal("showLabels", !config.showLabels)} styles={v070} /><label className={v070.select}><span>Orientation</span><select value={selectedInfoOrientation} onChange={(event) => selectedSliceIds.length ? updateSelected({ infoOrientation: event.target.value as InfoOrientation }) : updateGlobal("infoOrientation", event.target.value as InfoOrientation)}>{selectedInfoOrientation === "mixed" && <option value="mixed" disabled>— Multiple values</option>}<option value="normal">Normal</option><option value="rotate-90">Rotate 90°</option><option value="rotate-180">Rotate 180°</option><option value="rotate-270">Rotate 270°</option></select></label><div className={v070.two}><ExpressionField label="Name size" value={selectedNumericValues.labelNameScale} scopeKey={selectionScopeKey} suffix="%" integer min={50} max={250} onCommit={(value) => selectedSliceIds.length ? updateSelected({ labelNameScale: value }) : updateGlobal("labelNameScale", value)} /><ExpressionField label="Data size" value={selectedNumericValues.labelDataScale} scopeKey={selectionScopeKey} suffix="%" integer min={50} max={250} onCommit={(value) => selectedSliceIds.length ? updateSelected({ labelDataScale: value }) : updateGlobal("labelDataScale", value)} /></div>{infoFields.map((field) => <label className={v070.select} key={field.key}><span>{field.label}</span><select value={selectedInfoPosition(field.key)} onChange={(event) => selectedSliceIds.length ? updateSelected({ [field.key]: event.target.value as InfoPosition }) : updateGlobal(field.key, event.target.value as InfoPosition)}>{selectedInfoPosition(field.key) === "mixed" && <option value="mixed" disabled>— Multiple values</option>}{INFO_POSITIONS.map((position) => <option key={position.id} value={position.id}>{position.label}</option>)}</select></label>)}<button className={v070.choose} onClick={selectedSliceIds.length ? () => setSliceOverrides((current) => { const next = { ...current }; selectedSliceIds.forEach((id) => delete next[id]); return next; }) : applyGlobalToAll}>{selectedSliceIds.length ? "Reset selected to global" : "Apply global to all slices"}</button></VSection>}
              {isV070Map && v070InspectorTab === "appearance" && <>
                <VSection title="Cabinet surface" styles={v070}>
                  <ToggleRow label="Cabinet checker" value={selectedBoolean("showCheckerboard", config.showCheckerboard)} onClick={() => selectedSliceIds.length ? updateSelected({ showCheckerboard: !selectedBoolean("showCheckerboard", config.showCheckerboard) }) : updateGlobal("showCheckerboard", !config.showCheckerboard)} styles={v070} />
                  {selectedBoolean("showCheckerboard", config.showCheckerboard) && <><div className={v070.colorGrid}><label><span>{selectedSliceIds.length ? "Checker A" : "Palette seed A"}</span><input type="color" value={selectedSliceIds.length ? selectedOverride.checkerColorA ?? selectedAutomaticColors.colorA : config.checkerColorA} onChange={(event) => selectedSliceIds.length ? updateSelected({ checkerColorA: event.target.value }) : updateGlobal("checkerColorA", event.target.value)} /></label><label><span>{selectedSliceIds.length ? "Checker B" : "Palette seed B"}</span><input type="color" value={selectedSliceIds.length ? selectedOverride.checkerColorB ?? selectedAutomaticColors.colorB : config.checkerColorB} onChange={(event) => selectedSliceIds.length ? updateSelected({ checkerColorB: event.target.value }) : updateGlobal("checkerColorB", event.target.value)} /></label></div><div className={v070.readout}><span>Checker block</span><strong>{selectedPanelPixels ? `${selectedPanelPixels.width} × ${selectedPanelPixels.height} px` : "— Multiple values"}</strong></div></>}
                </VSection>
                <VSection title="Lines & guides" styles={v070}>
                  {overlayRows.filter((row) => row.key !== "showLabels").map((row) => { const enabled = selectedBoolean(row.key, config[row.key]), colorKey = row.color as "diagonalColor" | "circleColor" | "safeAreaColor"; return <div className={v070.colorRow} key={row.key}><ToggleRow label={row.label} value={enabled} onClick={() => selectedSliceIds.length ? updateSelected({ [row.key]: !enabled }) : updateGlobal(row.key, !enabled)} styles={v070} /><input type="color" value={String(selectedOverride[colorKey] ?? config[colorKey])} onChange={(event) => selectedSliceIds.length ? updateSelected({ [colorKey]: event.target.value }) : updateGlobal(colorKey, event.target.value)} aria-label={`${row.label} color`} /></div>; })}
                  <div className={v070.range}><span>Line width</span><ResetSlider aria-label="Line Width" resetValue={DEFAULT_CONFIG.lineWidth} min="1" max="12" step=".5" value={selectedNumericValues.lineWidth ?? config.lineWidth} onValueChange={(value) => selectedSliceIds.length ? updateSelected({ lineWidth: value }) : updateGlobal("lineWidth", value)} /></div><PreciseNumberInput label="Line width" min={1} max={12} step={.5} value={selectedNumericValues.lineWidth ?? config.lineWidth} onChange={(value) => selectedSliceIds.length ? updateSelected({ lineWidth: value }) : updateGlobal("lineWidth", value)} />
                  <label className={v070.colorWide}><span>Grid / border</span><input type="color" value={selectedOverride.metricGridColor ?? config.metricGridColor} onChange={(event) => selectedSliceIds.length ? updateSelected({ metricGridColor: event.target.value }) : updateGlobal("metricGridColor", event.target.value)} /></label>
                </VSection>
                <VSection title="Center marker" styles={v070}>
                  <div className={v070.colorRow}><ToggleRow label="Center dot" value={selectedBoolean("showCenterDot", config.showCenterDot)} onClick={() => selectedSliceIds.length ? updateSelected({ showCenterDot: !selectedBoolean("showCenterDot", config.showCenterDot) }) : updateGlobal("showCenterDot", !config.showCenterDot)} styles={v070} /><input type="color" value={selectedOverride.centerDotColor ?? config.centerDotColor} onChange={(event) => selectedSliceIds.length ? updateSelected({ centerDotColor: event.target.value }) : updateGlobal("centerDotColor", event.target.value)} aria-label="Center dot color" /></div>
                  {selectedBoolean("showCenterDot", config.showCenterDot) && <><div className={v070.range}><span>Dot size</span><ResetSlider aria-label="Center Dot Size" resetValue={DEFAULT_CONFIG.centerDotSize} min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={selectedNumericValues.centerDotSize ?? config.centerDotSize} onValueChange={(value) => selectedSliceIds.length ? updateSelected({ centerDotSize: value }) : updateGlobal("centerDotSize", value)} /></div><PreciseNumberInput label="Dot size" min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={selectedNumericValues.centerDotSize ?? config.centerDotSize} onChange={(value) => selectedSliceIds.length ? updateSelected({ centerDotSize: value }) : updateGlobal("centerDotSize", value)} /></>}
                </VSection>
                <VSection title="Logo" styles={v070}><button title={logoName || "Choose custom logo"} className={v070.choose} onClick={() => v070PixelLogoInputRef.current?.click()}>{logoName || "Choose custom logo…"}</button><input ref={v070PixelLogoInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => loadLogo(event.target.files?.[0])} /><ToggleRow label="Logo visible" value={selectedBoolean("logoVisible", config.showLogo)} onClick={() => selectedSliceIds.length ? updateSelected({ logoVisible: !selectedBoolean("logoVisible", config.showLogo) }) : updateGlobal("showLogo", !config.showLogo)} styles={v070} /><label className={v070.select}><span>Position</span><select value={selectedOverride.logoPosition ?? config.customLogoPosition} onChange={(event) => selectedSliceIds.length ? updateSelected({ logoPosition: event.target.value as LogoPosition }) : updateGlobal("customLogoPosition", event.target.value as LogoPosition)}>{["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"].map((position) => <option key={position} value={position}>{position}</option>)}</select></label><div className={v070.range}><span>Scale · {selectedNumericValues.logoScale ?? config.customLogoScale}%</span><ResetSlider aria-label="Custom Logo Scale" resetValue={DEFAULT_CONFIG.customLogoScale} min="25" max="200" value={selectedNumericValues.logoScale ?? config.customLogoScale} onValueChange={(value) => selectedSliceIds.length ? updateSelected({ logoScale: value }) : updateGlobal("customLogoScale", value)} /></div></VSection>
                <VSection title="Background" styles={v070}><div className={v070.segmented}><button aria-pressed={config.backgroundMode === "transparent"} className={config.backgroundMode === "transparent" ? v070.active : ""} onClick={() => update("backgroundMode", "transparent")}>Transparent</button><button aria-pressed={config.backgroundMode === "black"} className={config.backgroundMode === "black" ? v070.active : ""} onClick={() => update("backgroundMode", "black")}>Black</button></div></VSection>
                <VSection title="Overrides" styles={v070}><button className={v070.choose} onClick={selectedSliceIds.length ? () => setSliceOverrides((current) => { const next = { ...current }; selectedSliceIds.forEach((id) => delete next[id]); return next; }) : applyGlobalToAll}>{selectedSliceIds.length ? "Reset selected to global" : "Apply global to all slices"}</button></VSection>
              </>}

            </div>
          </aside>
        </section>
        <ManualDialog topic={helpTopic} onClose={() => setHelpTopic(null)} />
        <input ref={projectInputRef} hidden type="file" accept=".lo2s,application/x-opticmesh-project,.json,application/json"
          onChange={(event) => { loadProject(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </main>
    </TransformSelectionScope.Provider>;
  }

  return (
    <TransformSelectionScope.Provider value={selectedSliceIds.join("|")}>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <img src="brand/opticmesh-icon.png" alt="LO2S - OpticMesh" className="product-icon" />
            <span className="brand-product">
              LO2S - OpticMesh V.{DISPLAY_VERSION} <b>Beta</b>
            </span>
          </div>
          <nav className="workspace-tabs" aria-label="Workspace mode">
            <button className={workspaceMode === "patterns" ? "active" : ""} onClick={() => changeWorkspace("patterns")}>
              Test Patterns
            </button>
            <button className={workspaceMode === "resolume" ? "active" : ""} onClick={() => changeWorkspace("resolume")}>
              Resolume Pixel Map
            </button>
            <button className={workspaceMode === "simulation" ? "active" : ""} onClick={() => changeWorkspace("simulation")}>
              3D Simulation <em>Beta</em>
            </button>
          </nav>
          <div className="topbar-actions">
            <span className="integrity-chip">
              <i className={workspaceMode === "simulation" || !stats.mismatch ? "green" : "amber"} />
              {workspaceMode === "simulation" ? "WYSIWYG scene" : stats.mismatch ? "Pitch mismatch" : "Ratio preserved"}
            </span>
            {workspaceMode === "simulation" && (
              <>
                <button className="button history-button" disabled={!historyState.undo} title={historyState.undo ? `Undo ${historyState.undo}` : "Nothing to undo"} onClick={undoSimulation}>
                  Undo
                </button>
                <button className="button history-button" disabled={!historyState.redo} title={historyState.redo ? `Redo ${historyState.redo}` : "Nothing to redo"} onClick={redoSimulation}>
                  Redo
                </button>
              </>
            )}
            <button className="button" onClick={enterFullscreen}>
              Fullscreen
            </button>
            {workspaceMode !== "simulation" && (
              <button className="button primary" onClick={exportCurrent}>
                Export PNG
              </button>
            )}
          </div>
        </header>
        <section className="workspace">
          <aside className="left-panel panel">
            <div className="panel-tabs" data-count={controlTabs.length}>
              {controlTabs.map((tab) => (
                <button key={tab} className={controlTab === tab ? "active" : ""} onClick={() => setControlTab(tab)}>
                  {workspaceMode === "resolume" && tab === "setup" ? "Source" : tab}
                </button>
              ))}
            </div>
            <div className="panel-content">
              {controlTab === "scene" && workspaceMode === "simulation" && (
                <>
                  <section className="compact-section">
                    <span className="eyebrow">Resolume scene map</span>
                    <button
                      className="drop-button"
                      onClick={chooseXml}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        loadXml(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <strong>{xmlName || "Choose XML"}</strong>
                      <small>{resolumeMap ? `${allSlices.length} slices across ${resolumeMap.screens.length} screens` : "Import an Advanced Output preset"}</small>
                    </button>
                    <input ref={xmlInputRef} hidden type="file" accept=".xml,text/xml" onChange={(event) => loadXml(event.target.files?.[0])} />
                    {!resolumeMap && (
                      <button className="panel-action demo-action" onClick={loadDemoScene}>
                        Load beta demo scene
                      </button>
                    )}
                    {xmlError && <p className="warning">{xmlError}</p>}
                  </section>
                  <section className="compact-section control-groups simulation-controls">
                    <div className="section-title">
                      <span>Scene geometry</span>
                      <small>physical scale</small>
                    </div>
                    <div className="control-group">
                      <div className="control-group-title">Extrusion depth</div>
                      <div className="slider-control">
                        <ResetSlider
                          aria-label="Base extrusion depth"
                          resetValue={10}
                          min="1"
                          max="50"
                          step="0.5"
                          value={simulationDepthM * 100}
                          onEditStart={() => recordSimulationHistory("Change extrusion depth")} onPointerDown={() => {

                            setSimulationGeometryPreview(true);
                          }}
                          onPointerUp={() => setSimulationGeometryPreview(false)}
                          onPointerCancel={() => setSimulationGeometryPreview(false)}
                          onValueChange={(value) => setSimulationDepthM(clamp(value, 1, 50) / 100)}
                        />
                        <PreciseNumberInput label="Base extrusion depth value" min={1} max={50} step={0.5} value={round(simulationDepthM * 100, 1)} onEditStart={() => recordSimulationHistory("Enter extrusion depth")} onChange={(value) => setSimulationDepthM(value / 100)} />
                        <span>cm</span>
                        <button
                          onClick={() => {
                            if (simulationDepthM === 0.1) return;
                            recordSimulationHistory("Reset extrusion depth");
                            setSimulationDepthM(0.1);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      <label className="select-field pivot-select">
                        <span>{selectedSlices.length ? `Pivot · ${selectedSlices.length} selected` : "Pivot · select slices"}</span>
                        <select disabled={pivotEditingDisabled} value={selectedSimulationPivot === "mixed" ? "" : typeof selectedSimulationPivot === "string" ? selectedSimulationPivot : "custom"} onChange={(event) => changeSimulationPivot(event.target.value as SlicePivot)}>
                          {selectedSimulationPivot === "mixed" && (
                            <option value="" disabled>
                              Mixed pivots
                            </option>
                          )}
                          <option value="custom" disabled>Custom</option><option value="bottom-left">Bottom left</option>
                          <option value="bottom-center">Bottom centre</option>
                          <option value="bottom-right">Bottom right</option>
                        </select>
                      </label>
                      <small className="micro-note">Depth follows the curved surface · transform values follow the selected pivot.</small>
                    </div>
                    <div className="control-group curve-controls">
                      <div className="control-group-title">Screen curvature</div>
                      <div className="appearance-control-title curve-title">
                        <span>Horizontal curve</span>
                        <small>{verticalCurveActive ? "Locked by vertical curve" : selectedCurvature.horizontal === null ? "Mixed" : selectedCurvature.horizontal === 0 ? "Flat" : selectedCurvatureRadius.horizontal ? `${selectedCurvatureRadius.horizontal.toFixed(2)} m radius` : "Per-slice radius"}</small>
                      </div>
                      <div className="slider-control">
                        <ResetSlider
                          disabled={verticalCurveActive}
                          aria-label="Horizontal curve"
                          resetValue={0}
                          min="-360"
                          max="360"
                          step="1"
                          value={selectedCurvature.horizontal ?? 0}
                          onEditStart={() => recordSimulationHistory("Change horizontal curve")} onPointerDown={() => {

                            setSimulationGeometryPreview(true);
                          }}
                          onPointerUp={() => setSimulationGeometryPreview(false)}
                          onPointerCancel={() => setSimulationGeometryPreview(false)}
                          onValueChange={(value) => applySimulationCurvature("horizontal", value)}
                        />
                        <CurvatureNumberInput label="Horizontal curve value" value={selectedCurvature.horizontal} disabled={verticalCurveActive} onEditStart={() => recordSimulationHistory("Enter horizontal curve")} onCommit={(value) => applySimulationCurvature("horizontal", value)} />
                        <span>°</span>
                        <button
                          disabled={verticalCurveActive}
                          onClick={() => {
                            if (selectedCurvature.horizontal === 0) return;
                            recordSimulationHistory("Reset horizontal curve");
                            applySimulationCurvature("horizontal", 0);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      <div className="appearance-control-title curve-title">
                        <span>Vertical curve</span>
                        <small>{horizontalCurveActive ? "Locked by horizontal curve" : selectedCurvature.vertical === null ? "Mixed" : selectedCurvature.vertical === 0 ? "Flat" : selectedCurvatureRadius.vertical ? `${selectedCurvatureRadius.vertical.toFixed(2)} m radius` : "Per-slice radius"}</small>
                      </div>
                      <div className="slider-control">
                        <ResetSlider
                          disabled={horizontalCurveActive}
                          aria-label="Vertical curve"
                          resetValue={0}
                          min="-360"
                          max="360"
                          step="1"
                          value={selectedCurvature.vertical ?? 0}
                          onEditStart={() => recordSimulationHistory("Change vertical curve")} onPointerDown={() => {

                            setSimulationGeometryPreview(true);
                          }}
                          onPointerUp={() => setSimulationGeometryPreview(false)}
                          onPointerCancel={() => setSimulationGeometryPreview(false)}
                          onValueChange={(value) => applySimulationCurvature("vertical", value)}
                        />
                        <CurvatureNumberInput label="Vertical curve value" value={selectedCurvature.vertical} disabled={horizontalCurveActive} onEditStart={() => recordSimulationHistory("Enter vertical curve")} onCommit={(value) => applySimulationCurvature("vertical", value)} />
                        <span>°</span>
                        <button
                          disabled={horizontalCurveActive}
                          onClick={() => {
                            if (selectedCurvature.vertical === 0) return;
                            recordSimulationHistory("Reset vertical curve");
                            applySimulationCurvature("vertical", 0);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      <small className="micro-note">Horizontal and vertical curvature are mutually exclusive. Reset the active axis to 0° before using the other. Both axes support inward and outward curves up to 360°.</small>
                      {invalidCurvedDepthSlices.length > 0 && (
                        <p className="warning">
                          Extrusion must remain below the inner radius. Reduce depth before exporting {invalidCurvedDepthSlices.length} affected screen
                          {invalidCurvedDepthSlices.length > 1 ? "s" : ""}.
                        </p>
                      )}
                    </div>
                    <div className="control-group">
                      <div className="control-group-title">Transform axes</div>
                      <div className="segmented">
                        <button
                          className={simulationTransformSpace === "local" ? "active" : ""}
                          onClick={() => {
                            if (simulationTransformSpace === "local") return;
                            recordSimulationHistory("Use local axes");
                            setSimulationTransformSpace("local");
                          }}
                        >
                          Local axes
                        </button>
                        <button
                          className={simulationTransformSpace === "world" ? "active" : ""}
                          onClick={() => {
                            if (simulationTransformSpace === "world") return;
                            recordSimulationHistory("Use world axes");
                            setSimulationTransformSpace("world");
                          }}
                        >
                          World axes
                        </button>
                      </div>
                      <div className="auto-size">
                        <span>Scale</span>
                        <strong>Editable</strong>
                        <small>Use the Scale gizmo on a selection or group</small>
                      </div>
                    </div>
                    <div className="control-group">
                      <div className="control-group-title">{selectedGroup ? `${selectedGroup.name} · group transform` : "Transform data"}</div>
                      {selectedTransformPosition ? (
                        <>
                          <div className="transform-field-title">Position · world metres</div>
                          <div className="transform-grid">
                            <SignedNumberField label="X" value={selectedTransformPosition[0]} suffix="m" onCommit={(value) => updateManualPosition(0, value)} />
                            <SignedNumberField label="Y" value={selectedTransformPosition[1]} suffix="m" onCommit={(value) => updateManualPosition(1, value)} />
                            <SignedNumberField label="Z" value={selectedTransformPosition[2]} suffix="m" onCommit={(value) => updateManualPosition(2, value)} />
                          </div>
                          <div className="transform-field-title">Rotation · degrees</div>
                          <div className="transform-grid">
                            <SignedNumberField label="X" value={selectedTransformRotation?.[0] ?? null} suffix="°" onCommit={(value) => updateManualRotation(0, value)} />
                            <SignedNumberField label="Y" value={selectedTransformRotation?.[1] ?? null} suffix="°" onCommit={(value) => updateManualRotation(1, value)} />
                            <SignedNumberField label="Z" value={selectedTransformRotation?.[2] ?? null} suffix="°" onCommit={(value) => updateManualRotation(2, value)} />
                          </div>
                          <button className="panel-action" onClick={resetSelectedTransforms}>
                            Reset {selectedGroup ? "group" : "transform"}
                          </button>
                          {selectedGroup ? <small className="micro-note">The group axis is stored at the combined child centre. Its children retain editable local transforms.</small> : selectedSlices.length > 1 && <small className="micro-note">Mixed values show —. Enter or scroll a value to apply it to every selected slice.</small>}
                        </>
                      ) : (
                        <p className="micro-note">Select a slice or group to enter exact transform values. Hold Shift while rotating to snap in 5° increments.</p>
                      )}
                    </div>
                    <div className="control-group">
                      <div className="control-group-title">Scene appearance</div>
                      <div className="visibility-row">
                        <button
                          className={simulationFloorVisible ? "visibility-button active" : "visibility-button"}
                          onClick={() => {
                            recordSimulationHistory(simulationFloorVisible ? "Hide floor" : "Show floor");
                            setSimulationFloorVisible((value) => !value);
                          }}
                        >
                          {simulationFloorVisible ? "Floor visible" : "Floor hidden"}
                        </button>
                        <button
                          className={simulationGridVisible ? "visibility-button active" : "visibility-button"}
                          onClick={() => {
                            recordSimulationHistory(simulationGridVisible ? "Hide floor grid" : "Show floor grid");
                            setSimulationGridVisible((value) => !value);
                          }}
                        >
                          {simulationGridVisible ? "Grid visible" : "Grid hidden"}
                        </button>
                      </div>
                      <div className="appearance-control-title">
                        <span>Background brightness</span>
                        <small>100% original · 200% maximum</small>
                      </div>
                      <div className="slider-control">
                        <ResetSlider aria-label="Background brightness" resetValue={100} min="0" max="200" value={simulationBackgroundLevel} onEditStart={() => recordSimulationHistory("Change background brightness")} onValueChange={(value) => setSimulationBackgroundLevel(value)} />
                        <PreciseNumberInput label="Background brightness value" min={0} max={200} value={simulationBackgroundLevel} onEditStart={() => recordSimulationHistory("Enter background brightness")} onChange={setSimulationBackgroundLevel} />
                        <span>%</span>
                        <button
                          onClick={() => {
                            if (simulationBackgroundLevel === 100) return;
                            recordSimulationHistory("Reset background brightness");
                            setSimulationBackgroundLevel(100);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
              {controlTab === "sources" && workspaceMode === "simulation" && (
                <section className="compact-section control-groups">
                  <div className="section-title">
                    <span>Video texture</span>
                    <small>one decode per source</small>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Global source</div>
                    <label className="select-field">
                      <span>Feed</span>
                      <select
                        value={simulationSource}
                        onChange={(event) => {
                          recordSimulationHistory("Change global source");
                          const next = event.target.value as SimulationSource;
                          stopSimulationInput();
                          void disconnectNativeInput();
                          setSimulationSource(next);
                          setSimulationSourceStatus(next === "pattern" ? "Native · full quality" : "Select or connect the source below");
                        }}
                      >
                        <option value="pattern">Pattern Generator</option>
                        <option value="video">Video Devices</option>
                        <option value="ndi">NDI</option>
                        <option value="spout">Spout</option>
                      </select>
                    </label>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Selected slice override</div>
                    <label className="select-field">
                      <span>{selectedSliceIds.length ? `${selectedSliceIds.length} selected` : "Select a slice first"}</span>
                      <select
                        disabled={!selectedSliceIds.length}
                        value={selectedSourceOverride}
                        onChange={(event) => {
                          const value = event.target.value as "inherit" | SimulationSource;
                          recordSimulationHistory(`Change source for ${selectedSliceIds.length} slice${selectedSliceIds.length > 1 ? "s" : ""}`);
                          stopSimulationInput();
                          void disconnectNativeInput();
                          setSimulationSourceOverrides((current) => {
                            const next = { ...current };
                            selectedSliceIds.forEach((id) => {
                              if (value === "inherit") delete next[id];
                              else next[id] = value;
                            });
                            return next;
                          });
                        }}
                      >
                        {selectedSourceOverride === "mixed" && (
                          <option value="mixed" disabled>
                            Mixed sources
                          </option>
                        )}
                        <option value="inherit">Inherit global source</option>
                        <option value="pattern">Pattern Generator</option>
                        <option value="video">Video Devices · Full Source</option>
                        <option value="ndi">NDI · Full Source</option>
                        <option value="spout">Spout · Full Source</option>
                      </select>
                    </label>
                    <small className="micro-note">Global feeds use each slice’s XML crop. Overrides default to the full source.</small>
                    {selectedSliceIds.length > 0 && (
                      <button
                        className="panel-action"
                        disabled={selectedSourceOverride === "inherit"}
                        onClick={() => {
                          recordSimulationHistory(`Reset source for ${selectedSliceIds.length} slice${selectedSliceIds.length > 1 ? "s" : ""}`);
                          setSimulationSourceOverrides((current) => {
                            const next = { ...current };
                            selectedSliceIds.forEach((id) => delete next[id]);
                            return next;
                          });
                        }}
                      >
                        Reset selected to global
                      </button>
                    )}
                  </div>
                  {sourcePanelType === "pattern" ? (
                    <div className="control-group source-connect">
                      <div className="control-group-title">Pattern Generator</div>
                      <div className="unit-readout">
                        <span>Render quality</span>
                        <strong>Native · full quality</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="control-group source-connect">
                      <div className="control-group-title">{sourcePanelType === "video" ? "Video devices" : sourcePanelType === "ndi" ? "NDI input" : "Spout input"}</div>
                      <div className="segmented">
                        <button
                          className={simulationQuality === "latency" ? "active" : ""}
                          onClick={() => {
                            if (simulationQuality === "latency") return;
                            recordSimulationHistory("Use low latency source");
                            setSimulationQuality("latency");
                            if (sourcePanelType === "video" && simulationSourceVideo) void connectSimulationInput("latency");
                            else if (simulationNativeConnected && (sourcePanelType === "ndi" || sourcePanelType === "spout")) void connectNativeInput("latency", sourcePanelType);
                          }}
                        >
                          Low latency
                        </button>
                        <button
                          className={simulationQuality === "quality" ? "active" : ""}
                          onClick={() => {
                            if (simulationQuality === "quality") return;
                            recordSimulationHistory("Use high quality source");
                            setSimulationQuality("quality");
                            if (sourcePanelType === "video" && simulationSourceVideo) void connectSimulationInput("quality");
                            else if (simulationNativeConnected && (sourcePanelType === "ndi" || sourcePanelType === "spout")) void connectNativeInput("quality", sourcePanelType);
                          }}
                        >
                          High quality
                        </button>
                      </div>
                      {sourcePanelType === "video" ? (
                        <>
                          <label className="select-field">
                            <span>Device</span>
                            <select value={simulationInputDeviceId} onChange={(event) => setSimulationInputDeviceId(event.target.value)}>
                              <option value="">Auto-detect video device</option>
                              {simulationInputDevices.map((device, index) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                  {device.label || "Video input " + (index + 1)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="source-actions">
                            <button className="panel-action" onClick={() => void connectSimulationInput()}>
                              {simulationSourceVideo ? "Reconnect device" : "Connect device"}
                            </button>
                            {simulationSourceVideo && (
                              <button className="panel-action" onClick={stopSimulationInput}>
                                Disconnect
                              </button>
                            )}
                          </div>
                          <p className={simulationSourceVideo ? "source-status connected" : "source-status"}>{simulationSourceStatus}</p>
                          <small className="micro-note">Webcams and capture cards use the existing tested video-device pipeline.</small>
                        </>
                      ) : (
                        <>
                          <label className="select-field">
                            <span>Available</span>
                            <select
                              value={sourcePanelType === "ndi" ? simulationNdiSourceId : simulationSpoutSourceId}
                              disabled={simulationNativeScanning || !simulationNativeSources.length}
                              onChange={(event) => {
                                const sourceId = event.target.value;
                                if (sourcePanelType === "ndi") setSimulationNdiSourceId(sourceId);
                                else setSimulationSpoutSourceId(sourceId);
                                if (simulationNativeConnected) void connectNativeInput(undefined, sourcePanelType, sourceId);
                              }}
                            >
                              {!simulationNativeSources.length && <option value="">{simulationNativeScanning ? "Scanning…" : "No sources found"}</option>}
                              {simulationNativeSources.map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="source-actions">
                            <button className="panel-action" onClick={() => void connectNativeInput()} disabled={!simulationNativeSources.length}>
                              {simulationNativeConnected ? "Reconnect source" : "Connect source"}
                            </button>
                            <button className="panel-action" onClick={() => void scanNativeSources(sourcePanelType)}>
                              Refresh list
                            </button>
                            {simulationNativeConnected && (
                              <button className="panel-action" onClick={() => void disconnectNativeInput()}>
                                Disconnect
                              </button>
                            )}
                          </div>
                          <p className={simulationNativeConnected ? "source-status connected" : "source-status"}>{simulationSourceStatus}</p>
                          <small className="micro-note">{sourcePanelType === "ndi" ? "Direct full-bandwidth NDI receiver · latest-frame delivery." : "Direct Spout sender receiver · no camera bridge."}</small>
                          {sourcePanelType === "ndi" && <NdiAttribution />}
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}
              {controlTab === "setup" && workspaceMode === "patterns" && (
                <>
                  <section className="compact-section">
                    <span className="eyebrow">Project</span>
                    <input className="project-name" value={config.project} onChange={(event) => update("project", event.target.value)} />
                  </section>
                  <section className="compact-section">
                    <div className="section-title">
                      <span>Linked wall calculator</span>
                      <small>{calculatorSources.join(" + ")} → auto</small>
                    </div>
                    <div className="field-grid">
                      <ExpressionField label="Width" value={config.wallWidth} suffix="m" onCommit={(value) => editCalculator("physical", "wallWidth", snapPhysical(value, config.cabinetWidth))} />
                      <ExpressionField label="Height" value={config.wallHeight} suffix="m" onCommit={(value) => editCalculator("physical", "wallHeight", snapPhysical(value, config.cabinetHeight))} />
                    </div>
                    <div className="field-grid">
                      <ExpressionField label="Raster W" value={config.resolutionWidth} suffix="px" integer onCommit={(value) => editCalculator("raster", "resolutionWidth", value)} />
                      <ExpressionField label="Raster H" value={config.resolutionHeight} suffix="px" integer onCommit={(value) => editCalculator("raster", "resolutionHeight", value)} />
                    </div>
                    <ExpressionField label="Pixel pitch" value={config.pixelPitchMm} suffix="mm" onCommit={(value) => editCalculator("pitch", "pixelPitchMm", value)} />
                    <div className="calc-readout">
                      <span>Calculated pitch</span>
                      <strong>
                        {stats.pitchX.toFixed(4)} × {stats.pitchY.toFixed(4)} mm
                      </strong>
                    </div>
                    {stats.mismatch && <p className="warning">Horizontal and vertical pitch do not match.</p>}
                  </section>
                  <section className="compact-section">
                    <div className="section-title">
                      <span>Cabinet calculator</span>
                      <small>expressions enabled</small>
                    </div>
                    <div className="field-grid">
                      <ExpressionField label="Cabinet W" value={config.cabinetWidth} suffix="mm" integer onCommit={(value) => update("cabinetWidth", value)} />
                      <ExpressionField label="Cabinet H" value={config.cabinetHeight} suffix="mm" integer onCommit={(value) => update("cabinetHeight", value)} />
                    </div>
                    <div className="cabinet-summary">
                      <span>
                        {stats.cols.toFixed(1)} × {stats.rows.toFixed(1)}
                      </span>
                      <strong>{Math.round(stats.cols * stats.rows)} cabinets</strong>
                    </div>
                    {stats.cabinetRemainder && <p className="warning">Wall size is not an exact cabinet multiple.</p>}
                  </section>
                </>
              )}
              {controlTab === "setup" && workspaceMode === "resolume" && (
                <>
                  <section className="compact-section">
                    <span className="eyebrow">Advanced Output XML</span>
                    <div className="xml-actions">
                      <button
                        className="drop-button"
                        onClick={chooseXml}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          loadXml(event.dataTransfer.files?.[0]);
                        }}
                      >
                        <strong>Choose XML</strong>
                        <small>Select a preset manually</small>
                      </button>
                      <button className={`drop-button link-button ${xmlLinkState === "linked" ? "active" : ""}`} onClick={xmlLinkState === "linked" ? unlinkResolume : linkResolume}>
                        <strong>{xmlLinkState === "linked" ? "Unlink Resolume Map" : xmlLinkState === "linking" ? "Linking…" : "Link Resolume Map"}</strong>
                        <small>{xmlLinkState === "linked" ? "Watching for saved changes" : "Follow the latest Advanced Output preset"}</small>
                      </button>
                    </div>
                    <input ref={xmlInputRef} hidden type="file" accept=".xml,text/xml" onChange={(event) => loadXml(event.target.files?.[0])} />
                    {xmlName && (
                      <div className={`file-status ${xmlLinkState === "linked" ? "linked" : ""}`} title={xmlPath}>
                        <i />
                        <span>
                          <strong>{xmlLinkState === "linked" ? "LIVE" : "FILE"}</strong> {xmlName}
                          {xmlUpdatedAt ? ` · ${new Date(xmlUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
                        </span>
                      </div>
                    )}
                    {xmlError && <p className="warning">{xmlError}</p>}
                  </section>
                  <section className="compact-section">
                    <span className="eyebrow">Map view</span>
                    <div className="segmented">
                      <button className={mapView === "input" ? "active" : ""} onClick={() => changeMapView("input")}>
                        Input
                      </button>
                      <button className={mapView === "output" ? "active" : ""} onClick={() => changeMapView("output")}>
                        Output
                      </button>
                    </div>
                  </section>
                  {resolumeMap && (
                    <section className="compact-section">
                      <label className="select-field">
                        <span>Screen</span>
                        <select
                          value={mapView === "input" ? "combined" : selectedScreen}
                          disabled={mapView === "input"}
                          onChange={(event) => {
                            setSelectedScreen(Number(event.target.value));
                            setSelectedSliceIds([]);
                            resetView();
                          }}
                        >
                          <option value="combined">Combined Input</option>
                          {mapView === "output" &&
                            resolumeMap.screens.map((screen, index) => (
                              <option key={screen.name} value={index}>
                                {screen.name} — {screen.width} × {screen.height}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="select-field">
                        <span>Slice selection</span>
                        <select value={selectedSliceIds.length === 1 ? selectedSliceIds[0] : selectedSliceIds.length > 1 ? "multiple" : "none"} onChange={(event) => setSelectedSliceIds(event.target.value === "none" ? [] : [event.target.value])}>
                          <option value="none">Click map or choose…</option>
                          {selectedSliceIds.length > 1 && <option value="multiple">{selectedSliceIds.length} slices selected</option>}
                          {activeSlices.map((slice) => (
                            <option key={slice.id} value={slice.id}>
                              {slice.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="map-summary">
                        <strong>
                          {outputWidth} × {outputHeight}
                        </strong>
                        <span>
                          {activeSlices.length} slices · {resolumeMap.screens.length} screens
                        </span>
                      </div>
                    </section>
                  )}
                  <section className="compact-section panel-geometry">
                    <div className="section-title">
                      <span>LED panel geometry</span>
                      <small>{selectedSliceIds.length ? "selected slices" : "project default"}</small>
                    </div>
                    <div className="field-grid">
                      <ExpressionField label="Panel W" value={selectedNumericValues.cabinetWidth} scopeKey={selectionScopeKey} suffix="mm" integer onCommit={(value) => (selectedSliceIds.length ? updateSelected({ cabinetWidth: value }) : updateGlobal("cabinetWidth", value))} />
                      <ExpressionField label="Panel H" value={selectedNumericValues.cabinetHeight} scopeKey={selectionScopeKey} suffix="mm" integer onCommit={(value) => (selectedSliceIds.length ? updateSelected({ cabinetHeight: value }) : updateGlobal("cabinetHeight", value))} />
                    </div>
                    <ExpressionField label="Pixel pitch" value={selectedNumericValues.pixelPitchMm} scopeKey={selectionScopeKey} suffix="mm" onCommit={(value) => (selectedSliceIds.length ? updateSelected({ pixelPitchMm: value }) : updateGlobal("pixelPitchMm", value))} />
                    <div className="pitch-presets" aria-label="Pixel pitch presets">
                      {PIXEL_PITCH_PRESETS.map((pitch) => (
                        <button key={pitch} className={selectedNumericValues.pixelPitchMm !== null && Math.abs(selectedNumericValues.pixelPitchMm - pitch) < 0.0001 ? "active" : ""} onClick={() => (selectedSliceIds.length ? updateSelected({ pixelPitchMm: pitch }) : updateGlobal("pixelPitchMm", pitch))}>
                          P{pitch}
                        </button>
                      ))}
                    </div>
                    <div className="auto-size">
                      <span>Checker block</span>
                      <strong>{selectedPanelPixels ? `${selectedPanelPixels.width} × ${selectedPanelPixels.height} px` : "— Multiple values"}</strong>
                      <small>{selectedPanelPixels ? "Calculated from this panel geometry" : "Enter a value to apply it to all selected slices"}</small>
                    </div>
                  </section>
                </>
              )}
              {controlTab === "overlays" && workspaceMode === "patterns" && (
                <section className="compact-section overlay-stack control-groups">
                  <div className="section-title">
                    <span>Test pattern overlays</span>
                    <small>global</small>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Pattern surface</div>
                    <div className="overlay-row">
                      <button className={patternStyle.showPatternCheckerboard ? "switch on" : "switch"} onClick={() => updatePatternStyle("showPatternCheckerboard", !patternStyle.showPatternCheckerboard)}>
                        <i />
                        <span>Cabinet checker</span>
                      </button>
                    </div>
                    {patternStyle.showPatternCheckerboard && (
                      <>
                        <div className="checker-colors">
                          <label>
                            <span>Checker A</span>
                            <input type="color" value={patternStyle.checkerColorA} onChange={(event) => updatePatternStyle("checkerColorA", event.target.value)} />
                          </label>
                          <label>
                            <span>Checker B</span>
                            <input type="color" value={patternStyle.checkerColorB} onChange={(event) => updatePatternStyle("checkerColorB", event.target.value)} />
                          </label>
                        </div>
                        <div className="auto-size">
                          <span>Checker block</span>
                          <strong>
                            {cabinetPixels(patternRenderConfig).width} × {cabinetPixels(patternRenderConfig).height} px
                          </strong>
                          <small>Locked to LED panel size</small>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Information & guides</div>
                    {overlayRows.map((row) => {
                      const enabled = patternStyle[row.key];
                      return (
                        <div className="overlay-row" key={row.key}>
                          <button className={enabled ? "switch on" : "switch"} onClick={() => updatePatternStyle(row.key, !enabled)}>
                            <i />
                            <span>{row.label}</span>
                          </button>
                          <input type="color" value={String(patternStyle[row.color])} onChange={(event) => updatePatternStyle(row.color, event.target.value as never)} aria-label={`${row.label} color`} />
                        </div>
                      );
                    })}
                    <div className="range-row precise aligned-control">
                      <span>Line width</span>
                      <ResetSlider aria-label="Line Width" resetValue={DEFAULT_PATTERN_STYLE.lineWidth} min="1" max="12" step="0.5" value={patternStyle.lineWidth} onValueChange={(value) => updatePatternStyle("lineWidth", value)} />
                      <PreciseNumberInput label="Line width" min={1} max={12} step={0.5} value={patternStyle.lineWidth} onChange={(value) => updatePatternStyle("lineWidth", value)} />
                    </div>
                    <label className="color-wide">
                      <span>Grid / border</span>
                      <input type="color" value={patternStyle.metricGridColor} onChange={(event) => updatePatternStyle("metricGridColor", event.target.value)} />
                    </label>
                  </div>
                </section>
              )}
              {controlTab === "info" && workspaceMode === "resolume" && (
                <section className="compact-section control-groups">
                  <div className="section-title">
                    <span>Slice information</span>
                    <small>{selectedSliceIds.length ? `${selectedSliceIds.length} selected` : "global master"}</small>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Typography</div>
                    <div className="overlay-row">
                      {(() => {
                        const enabled = selectedBoolean("showLabels", config.showLabels);
                        return (
                          <button className={enabled ? "switch on" : "switch"} onClick={() => (selectedSliceIds.length ? updateSelected({ showLabels: !enabled }) : updateGlobal("showLabels", !enabled))}>
                            <i />
                            <span>Show information</span>
                          </button>
                        );
                      })()}
                    </div>
                    <label className="select-field">
                      <span>Orientation</span>
                      <select
                        value={selectedInfoOrientation}
                        onChange={(event) =>
                          selectedSliceIds.length
                            ? updateSelected({
                                infoOrientation: event.target.value as InfoOrientation,
                              })
                            : updateGlobal("infoOrientation", event.target.value as InfoOrientation)
                        }
                      >
                        {selectedInfoOrientation === "mixed" && (
                          <option value="mixed" disabled>
                            — Multiple values
                          </option>
                        )}
                        <option value="normal">Normal</option>
                        <option value="rotate-90">Rotate 90°</option>
                        <option value="rotate-180">Rotate 180°</option>
                        <option value="rotate-270">Rotate 270°</option>
                      </select>
                    </label>
                    <div className="field-grid compact-inputs">
                      <ExpressionField label="Name size" value={selectedNumericValues.labelNameScale} scopeKey={selectionScopeKey} suffix="%" integer min={50} max={250} onCommit={(value) => (selectedSliceIds.length ? updateSelected({ labelNameScale: value }) : updateGlobal("labelNameScale", value))} />
                      <ExpressionField label="Data size" value={selectedNumericValues.labelDataScale} scopeKey={selectionScopeKey} suffix="%" integer min={50} max={250} onCommit={(value) => (selectedSliceIds.length ? updateSelected({ labelDataScale: value }) : updateGlobal("labelDataScale", value))} />
                    </div>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Content positions</div>
                    {infoFields.map((field) => (
                      <label className="inline-select" key={field.key}>
                        <span>{field.label}</span>
                        <select
                          value={selectedInfoPosition(field.key)}
                          onChange={(event) =>
                            selectedSliceIds.length
                              ? updateSelected({
                                  [field.key]: event.target.value as InfoPosition,
                                })
                              : updateGlobal(field.key, event.target.value as InfoPosition)
                          }
                        >
                          {selectedInfoPosition(field.key) === "mixed" && <option value="mixed" disabled>— Multiple values</option>}
                          {INFO_POSITIONS.map((position) => (
                            <option key={position.id} value={position.id}>
                              {position.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <div className="unit-readout">
                      <span>Physical unit</span>
                      <strong>Metric · metres</strong>
                    </div>
                  </div>
                  {selectedSliceIds.length > 0 ? (
                    <button
                      className="panel-action"
                      onClick={() =>
                        setSliceOverrides((current) => {
                          const next = { ...current };
                          selectedSliceIds.forEach((id) => delete next[id]);
                          return next;
                        })
                      }
                    >
                      Reset selected to global
                    </button>
                  ) : (
                    <button className="panel-action" onClick={applyGlobalToAll}>
                      Apply global to all slices
                    </button>
                  )}
                </section>
              )}
              {controlTab === "deco" && workspaceMode === "resolume" && (
                <section className="compact-section control-groups">
                  <div className="section-title">
                    <span>Slice decoration</span>
                    <small>{selectedSliceIds.length ? `${selectedSliceIds.length} selected` : "global master"}</small>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Cabinet surface</div>
                    {(() => {
                      const enabled = selectedBoolean("showCheckerboard", config.showCheckerboard);
                      return (
                        <>
                          <div className="overlay-row">
                            <button
                              className={enabled ? "switch on" : "switch"}
                              onClick={() =>
                                selectedSliceIds.length
                                  ? updateSelected({
                                      showCheckerboard: !enabled,
                                    })
                                  : updateGlobal("showCheckerboard", !enabled)
                              }
                            >
                              <i />
                              <span>Cabinet checker</span>
                            </button>
                          </div>
                          {enabled && (
                            <>
                              <div className="checker-colors">
                                <label>
                                  <span>{selectedSliceIds.length ? "Checker A" : "Palette seed A"}</span>
                                  <input
                                    type="color"
                                    value={selectedSliceIds.length ? (selectedOverride.checkerColorA ?? selectedAutomaticColors.colorA) : config.checkerColorA}
                                    onChange={(event) =>
                                      selectedSliceIds.length
                                        ? updateSelected({
                                            checkerColorA: event.target.value,
                                          })
                                        : updateGlobal("checkerColorA", event.target.value)
                                    }
                                  />
                                </label>
                                <label>
                                  <span>{selectedSliceIds.length ? "Checker B" : "Palette seed B"}</span>
                                  <input
                                    type="color"
                                    value={selectedSliceIds.length ? (selectedOverride.checkerColorB ?? selectedAutomaticColors.colorB) : config.checkerColorB}
                                    onChange={(event) =>
                                      selectedSliceIds.length
                                        ? updateSelected({
                                            checkerColorB: event.target.value,
                                          })
                                        : updateGlobal("checkerColorB", event.target.value)
                                    }
                                  />
                                </label>
                              </div>
                              <div className="auto-size">
                                <span>Checker block</span>
                                <strong>{selectedPanelPixels ? `${selectedPanelPixels.width} × ${selectedPanelPixels.height} px` : "— Multiple values"}</strong>
                                <small>Locked to LED panel geometry</small>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Lines & guides</div>
                    {overlayRows
                      .filter((row) => row.key !== "showLabels")
                      .map((row) => {
                        const enabled = selectedBoolean(row.key, config[row.key]),
                          colorKey = row.color as "diagonalColor" | "circleColor" | "safeAreaColor";
                        return (
                          <div className="overlay-row" key={row.key}>
                            <button className={enabled ? "switch on" : "switch"} onClick={() => (selectedSliceIds.length ? updateSelected({ [row.key]: !enabled }) : updateGlobal(row.key, !enabled))}>
                              <i />
                              <span>{row.label}</span>
                            </button>
                            <input
                              type="color"
                              value={String(selectedOverride[colorKey] ?? config[colorKey])}
                              onChange={(event) =>
                                selectedSliceIds.length
                                  ? updateSelected({
                                      [colorKey]: event.target.value,
                                    })
                                  : updateGlobal(colorKey, event.target.value)
                              }
                              aria-label={`${row.label} color`}
                            />
                          </div>
                        );
                      })}
                    <div className="range-row precise aligned-control">
                      <span>Line width</span>
                      <ResetSlider aria-label="Line Width"
                        resetValue={DEFAULT_CONFIG.lineWidth}
                        min="1"
                        max="12"
                        step="0.5"
                        value={selectedNumericValues.lineWidth ?? config.lineWidth}
                        onValueChange={(value) =>
                          selectedSliceIds.length
                            ? updateSelected({
                                lineWidth: value,
                              })
                            : updateGlobal("lineWidth", value)
                        }
                      />
                      <PreciseNumberInput label="Line width" min={1} max={12} step={0.5} value={selectedNumericValues.lineWidth ?? config.lineWidth} onChange={(value) => (selectedSliceIds.length ? updateSelected({ lineWidth: value }) : updateGlobal("lineWidth", value))} />
                    </div>
                    <label className="color-wide">
                      <span>Grid / border</span>
                      <input
                        type="color"
                        value={selectedOverride.metricGridColor ?? config.metricGridColor}
                        onChange={(event) =>
                          selectedSliceIds.length
                            ? updateSelected({
                                metricGridColor: event.target.value,
                              })
                            : updateGlobal("metricGridColor", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="control-group">
                    <div className="control-group-title">Center marker</div>
                    {(() => {
                      const enabled = selectedBoolean("showCenterDot", config.showCenterDot);
                      return (
                        <>
                          <div className="overlay-row">
                            <button className={enabled ? "switch on" : "switch"} onClick={() => (selectedSliceIds.length ? updateSelected({ showCenterDot: !enabled }) : updateGlobal("showCenterDot", !enabled))}>
                              <i />
                              <span>Center dot</span>
                            </button>
                            <input
                              type="color"
                              value={selectedOverride.centerDotColor ?? config.centerDotColor}
                              onChange={(event) =>
                                selectedSliceIds.length
                                  ? updateSelected({
                                      centerDotColor: event.target.value,
                                    })
                                  : updateGlobal("centerDotColor", event.target.value)
                              }
                              aria-label="Center dot color"
                            />
                          </div>
                          {enabled && (
                            <div className="range-row precise aligned-control">
                              <span>Dot size</span>
                              <ResetSlider aria-label="Center Dot Size"
                                resetValue={DEFAULT_CONFIG.centerDotSize}
                                min={CENTER_DOT_SIZE.min}
                                max={CENTER_DOT_SIZE.max}
                                value={selectedNumericValues.centerDotSize ?? config.centerDotSize}
                                onValueChange={(value) =>
                                  selectedSliceIds.length
                                    ? updateSelected({
                                        centerDotSize: value,
                                      })
                                    : updateGlobal("centerDotSize", value)
                                }
                              />
                              <PreciseNumberInput label="Dot size" min={CENTER_DOT_SIZE.min} max={CENTER_DOT_SIZE.max} value={selectedNumericValues.centerDotSize ?? config.centerDotSize} onChange={(value) => (selectedSliceIds.length ? updateSelected({ centerDotSize: value }) : updateGlobal("centerDotSize", value))} />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {selectedSliceIds.length > 0 ? (
                    <button
                      className="panel-action"
                      onClick={() =>
                        setSliceOverrides((current) => {
                          const next = { ...current };
                          selectedSliceIds.forEach((id) => delete next[id]);
                          return next;
                        })
                      }
                    >
                      Reset selected to global
                    </button>
                  ) : (
                    <button className="panel-action" onClick={applyGlobalToAll}>
                      Apply global to all slices
                    </button>
                  )}
                </section>
              )}
              {controlTab === "logo" && (
                <section className="compact-section logo-controls">
                  <div className="section-title">
                    <span>Logo placement</span>
                    <small>{selectedSliceIds.length ? `${selectedSliceIds.length} selected` : "global master"}</small>
                  </div>
                  <button className="drop-button logo" onClick={() => logoInputRef.current?.click()}>
                    <strong>{logoName || "Upload logo"}</strong>
                    <small>PNG, JPG, WEBP or SVG</small>
                  </button>
                  <input ref={logoInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => loadLogo(event.target.files?.[0])} />
                  {(() => {
                    const visible = selectedBoolean("logoVisible", config.showLogo);
                    return (
                      <button className={visible ? "visibility-button active" : "visibility-button"} onClick={() => (selectedSliceIds.length ? updateSelected({ logoVisible: !visible }) : updateGlobal("showLogo", !visible))}>
                        {visible ? (selectedSliceIds.length ? "Logo visible on selection" : "Logo visible globally") : selectedSliceIds.length ? "Logo hidden on selection" : "Logo hidden globally"}
                      </button>
                    );
                  })()}
                  <label className="select-field">
                    <span>Position</span>
                    <select
                      value={selectedOverride.logoPosition ?? config.customLogoPosition}
                      onChange={(event) =>
                        selectedSliceIds.length
                          ? updateSelected({
                              logoPosition: event.target.value as LogoPosition,
                            })
                          : updateGlobal("customLogoPosition", event.target.value as LogoPosition)
                      }
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-center">Top center</option>
                      <option value="top-right">Top right</option>
                      <option value="center-left">Center left</option>
                      <option value="center">Center</option>
                      <option value="center-right">Center right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-center">Bottom center</option>
                      <option value="bottom-right">Bottom right</option>
                    </select>
                  </label>
                  <div className="range-row precise">
                    <span>Scale</span>
                    <ResetSlider aria-label="Custom Logo Scale"
                      resetValue={DEFAULT_CONFIG.customLogoScale}
                      min="25"
                      max="200"
                      value={selectedNumericValues.logoScale ?? config.customLogoScale}
                      onValueChange={(value) =>
                        selectedSliceIds.length
                          ? updateSelected({
                              logoScale: value,
                            })
                          : updateGlobal("customLogoScale", value)
                      }
                    />
                    <PreciseNumberInput label="Logo scale" min={25} max={200} value={selectedNumericValues.logoScale ?? config.customLogoScale} onChange={(value) => (selectedSliceIds.length ? updateSelected({ logoScale: value }) : updateGlobal("customLogoScale", value))} />
                  </div>
                  <div className="range-row">
                    <span>
                      Opacity <output>{config.customLogoOpacity}%</output>
                    </span>
                    <ResetSlider aria-label="Custom Logo Opacity" resetValue={DEFAULT_CONFIG.customLogoOpacity} min="10" max="100" value={config.customLogoOpacity} onValueChange={(value) => updateGlobal("customLogoOpacity", value)} />
                  </div>
                  {selectedSliceIds.length > 0 ? (
                    <button
                      className="text-button"
                      onClick={() =>
                        setSliceOverrides((current) => {
                          const next = { ...current };
                          selectedSliceIds.forEach((id) => {
                            if (next[id])
                              next[id] = {
                                ...next[id],
                                logoScale: undefined,
                                logoVisible: undefined,
                                logoPosition: undefined,
                              };
                          });
                          return next;
                        })
                      }
                    >
                      Reset selected logo to global
                    </button>
                  ) : (
                    <button className="text-button" onClick={applyGlobalToAll}>
                      Apply global to all slices
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setLogoData("");
                      setLogoName("");
                      setLogoImage(null);
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                  >
                    Remove uploaded logo
                  </button>
                </section>
              )}
            </div>
          </aside>
          <section className={`stage ${workspaceMode === "simulation" ? "simulation-stage" : ""}`}>
            <div className="stage-bar">
              <div>
                <span className="eyebrow">{workspaceMode === "simulation" ? "3D Simulation" : `Live ${workspaceMode === "resolume" ? `${mapView} map` : "output"}`}</span>
                <h1>{workspaceMode === "simulation" ? resolumeMap?.name || "3D Simulation" : workspaceMode === "resolume" ? resolumeMap?.name || "Resolume Pixel Map" : PATTERNS.find((pattern) => pattern.id === config.pattern)?.name}</h1>
              </div>
              <div className="stage-spec">
                <strong>
                  {outputWidth} × {outputHeight} px
                </strong>
                <span>{workspaceMode === "simulation" ? `${allSlices.length} physical screens · ${round(simulationDepthM * 100, 1)} cm deep` : workspaceMode === "resolume" ? `${activeSlices.length} slices` : `${config.wallWidth} × ${config.wallHeight} m`}</span>
              </div>
            </div>
            <div className="preview-shell" ref={fullscreenHostRef} data-fullscreen-mode={fullscreenMode}>
              {workspaceMode === "simulation" ? (
                <>
                  <div className="preview-toolbar">
                    <span>
                      <i className="green" /> 3D scene · metres · configurable bottom pivots
                    </span>
                    <div className="view-tools simulation-tools">
                      <button className={simulationTool === "translate" ? "active" : ""} onClick={() => setSimulationTool("translate")}>
                        Move
                      </button>
                      <button className={simulationTool === "rotate" ? "active" : ""} onClick={() => setSimulationTool("rotate")}>
                        Rotate
                      </button>
                      <button className={simulationTool === "scale" ? "active" : ""} onClick={() => setSimulationTool("scale")}>
                        Scale
                      </button>
                      <button onClick={() => setSimulationFitSignal((value) => value + 1)}>Fit scene</button>
                    </div>
                  </div>
                  <ThreeSimulation
                    slices={allSlices}
                    compositionWidth={resolumeMap?.compositionWidth || config.resolutionWidth}
                    compositionHeight={resolumeMap?.compositionHeight || config.resolutionHeight}
                    masterPitchMm={simulationMasterPitchMm}
                    pitchBySlice={simulationPitchBySlice}
                    depthBySlice={simulationDepthBySlice}
                    curvatureBySlice={simulationCurvatureBySlice}
                    pivotBySlice={simulationPivotBySlice}
                    selectedIds={selectedSliceIds}
                    visibleIds={simulationVisibleIds}
                    lockedIds={simulationLockedIds}
                    transforms={renderedSimulationTransforms}
                    selectionTransform={selectedGroupSelectionWorldTransform}
                    transformMode={simulationTool}
                    transformSpace={simulationTransformSpace}
                    source={simulationSource}
                    sourceOverrides={simulationSourceOverrides}
                    sourceMedia={simulationSourceMedia}
                    sourceQuality={simulationQuality}
                    cameraState={simulationCamera}
                    textureVersion={simulationTextureVersion}
                    fitSignal={simulationFitSignal}
                    focusSignal={simulationFocusSignal}
                    viewMode={simulationViewMode}
                    snapEnabled={simulationSnapEnabled} gridVisible={simulationGridVisible}
                    floorVisible={simulationFloorVisible}
                    backgroundLevel={simulationBackgroundLevel}
                    interactiveGeometryPreview={simulationGeometryPreview}
                    drawPatternTexture={drawSimulationTexture}
                    onSelectionChange={(ids) => {
                      setSimulationTransformPreview(null);
                      setSelectedGroupIds([]);
                      setSelectedSliceIds(ids);
                    }}
                    onTransformPreview={setSimulationTransformPreview}
                    onTransformsChange={commitSimulationTransforms}
                    onCameraChange={setSimulationCamera}
                    onOutputCaptureReady={(capture) => { simulationOutputCaptureRef.current = capture; }}
                  />
                </>
              ) : (
                <>
                  <div className="preview-toolbar">
                    <span>
                      <i className="green" /> Pixel canvas · {outputWidth} × {outputHeight}
                    </span>
                    <div className="view-tools">
                      <button onClick={() => adjustZoom(zoomRef.current / 1.2)} aria-label="Zoom out">
                        −
                      </button>
                      <output>{Math.round(displayScale * 100)}%</output>
                      <button onClick={() => adjustZoom(zoomRef.current * 1.2)} aria-label="Zoom in">
                        +
                      </button>
                      <button className={fullscreenMode === "fit" && zoom === 1 ? "active" : ""} onClick={resetView}>
                        Fit Canvas
                      </button>
                      <button className={fullscreenMode === "actual" && zoom === 1 ? "active" : ""} onClick={actualPixels}>
                        Actual 1:1
                      </button>
                    </div>
                  </div>
                  <div
                    ref={canvasStageRef}
                    className={`canvas-stage ${spaceDown ? "panning" : ""} ${selectionMarquee ? "selecting" : ""}`}
                    onPointerDown={beginInteraction}
                    onPointerMove={moveInteraction}
                    onPointerUp={endInteraction}
                    onPointerCancel={cancelInteraction}
                    onWheel={(event) => {
                      event.preventDefault();
                      adjustZoom(zoomRef.current * (event.deltaY > 0 ? 0.9 : 1.1), event.clientX, event.clientY);
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      style={{
                        width: `${outputWidth * baseScale}px`,
                        height: `${outputHeight * baseScale}px`,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        imageRendering: fullscreenMode === "actual" && displayScale >= 1 ? "pixelated" : "auto",
                      }}
                      aria-label="Live LED pattern output"
                    />
                    {selectionMarquee && <div className="selection-marquee" style={selectionMarquee} aria-hidden="true" />}
                  </div>
                </>
              )}
            </div>
            {workspaceMode === "simulation" ? (
              <div className="simulation-status">
                <div>
                  <span>Source</span>
                  <strong>{simulationSource === "pattern" ? "Pattern Generator" : simulationSource === "video" ? (simulationSourceVideo ? simulationSourceStatus : "Video Devices · not connected") : simulationNativeConnected && simulationNativeKind === simulationSource ? simulationSourceStatus : simulationSource === "ndi" ? "NDI · not connected" : "Spout · not connected"}</strong>
                </div>
                <div>
                  <span>Mapping</span>
                  <strong>XML crop · stretched composition</strong>
                </div>
                <div>
                  <span>Quality</span>
                  <strong>{simulationSource === "pattern" ? "Native full quality" : simulationQuality === "latency" ? "Low latency proxy" : "High quality native"}</strong>
                </div>
                <div>
                  <span>Geometry</span>
                  <strong>Smooth curve · full extrusion · transform saved</strong>
                </div>
              </div>
            ) : (
              <div className="pattern-bar">
                <div className="pattern-bar-heading">
                  <span>{workspaceMode === "resolume" ? "Slice fill mode" : "Pattern mode"}</span>
                  {workspaceMode === "resolume" && (
                    <div className="scope-control">
                      <button className={config.mapPatternScope === "slice" ? "active" : ""} onClick={() => updateGlobal("mapPatternScope", "slice")}>
                        Per slice
                      </button>
                      <button className={config.mapPatternScope === "map" ? "active" : ""} onClick={() => updateGlobal("mapPatternScope", "map")}>
                        Across map
                      </button>
                    </div>
                  )}
                </div>
                <div className="pattern-buttons">
                  {workspaceMode === "resolume" ? (
                    MAP_FILLS.map((fill) => (
                      <button key={fill.id} className={config.mapFill === fill.id ? "active" : ""} onClick={() => updateGlobal("mapFill", fill.id)}>
                        <i>{fill.code}</i>
                        {fill.name}
                      </button>
                    ))
                  ) : (
                    <>
                      {PATTERNS.map((pattern) => (
                        <button key={pattern.id} className={config.pattern === pattern.id ? "active" : ""} onClick={() => selectPattern(pattern.id)}>
                          <i>{pattern.code}</i>
                          {pattern.name}
                        </button>
                      ))}
                      <button onClick={() => changeWorkspace("resolume")}>
                        <i>MAP</i>Pixel Map
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
          {workspaceMode === "simulation" && (
            <aside className="right-panel panel simulation-inspector">
              <section className="inspector-section">
                <div className="section-title">
                  <span>3D scene integrity</span>
                  <small>beta</small>
                </div>
                <div className="integrity-card">
                  <div>
                    <span>Composition</span>
                    <strong>
                      {outputWidth} × {outputHeight}
                    </strong>
                  </div>
                  <div>
                    <span>Physical layout</span>
                    <strong>
                      Adaptive · {simulationPitchCount || 1} pitch
                      {simulationPitchCount === 1 ? "" : "es"}
                    </strong>
                  </div>
                  <div>
                    <span>Layout anchor</span>
                    <strong>{effectiveLayoutAnchorSlice ? simulationLocalNames[effectiveLayoutAnchorSlice.id] || effectiveLayoutAnchorSlice.name : "Composition centre"} · X 0</strong>
                  </div>
                  <p>
                    <i className="green" /> Any positive pitch · overlap-safe placement
                  </p>
                </div>
              </section>
              <section className="inspector-section scene-hierarchy">
                <div className="section-title">
                  <span>Scene hierarchy</span>
                  <small>
                    {simulationVisibleIds.length}/{allSlices.length} visible
                  </small>
                </div>
                <input className="hierarchy-search" value={hierarchyQuery} onChange={(event) => setHierarchyQuery(event.target.value)} placeholder="Search screens and slices" aria-label="Search scene hierarchy" />
                <div className="hierarchy-actions">
                  <button disabled={!selectedSliceIds.length || hasGroupSelection} onClick={groupSelectedSlices}>
                    Group
                  </button>
                  <button disabled={!hasGroupSelection && !simulationGroups.some((group) => group.sliceIds.some((id) => selectedSliceIds.includes(id)))} onClick={ungroupSelectedSlices}>
                    Ungroup
                  </button>
                  <button disabled={!selectedSliceIds.length} onClick={() => setSimulationFocusSignal((value) => value + 1)}>
                    Focus
                  </button>
                </div>
                <div className="hierarchy-tree">
                  {simulationGroups.filter((group) => !group.parentId || !simulationGroups.some((parent) => parent.id === group.parentId)).map((group) => renderHierarchyGroup(group))}
                  {resolumeMap?.screens.map((screen) => {
                    const slices = screen.slices.filter((slice) => !groupedSliceIds.has(slice.id) && (!hierarchyQuery || screen.name.toLowerCase().includes(hierarchyQuery.toLowerCase()) || (simulationLocalNames[slice.id] || slice.name).toLowerCase().includes(hierarchyQuery.toLowerCase())));
                    if (!slices.length) return null;
                    return (
                      <div className="hierarchy-screen" key={screen.name}>
                        <div className="hierarchy-row screen">
                          <span className="hierarchy-type"><UiIcon name="screen" /></span>
                          <strong title={screen.name}>{screen.name}</strong>
                          <small>{slices.length}</small>
                        </div>
                        {slices.map((slice) => renderHierarchySlice(slice, 0))}
                      </div>
                    );
                  })}
                  {hierarchyDrag && (
                    <div
                      className="hierarchy-root-drop"
                      onDragOver={(event) => {
                        event.preventDefault();
                        setHierarchyDrop(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropHierarchyAtRoot();
                      }}
                    >
                      Move to scene root
                    </div>
                  )}
                </div>
                <small className="micro-note">All Resolume slices import visible. Eye and lock controls affect only the LO2S - OpticMesh 3D scene.</small>
              </section>
              <section className="inspector-section selection-card">
                <div className="section-title">
                  <span>{hasGroupSelection ? "Group selection" : "Slice selection"}</span>
                  <small>{hasGroupSelection ? `${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"} · ${selectedGroupSliceIds.length} slice${selectedGroupSliceIds.length === 1 ? "" : "s"}` : selectedSlices.length ? `${selectedSlices.length} selected` : "click scene"}</small>
                </div>
                {selectedSlices.length ? (
                  <>
                    <strong>{selectedGroup?.name || (hasGroupSelection ? `${selectedGroups.length} groups` : selectedSlices.length === 1 ? selectedSlices[0].name : `${selectedSlices.length} screens`)}</strong>
                    <span>{hasGroupSelection ? "Collective parent transform · editable local children" : selectedSlices.length === 1 ? `${((selectedSlices[0].input.width * (simulationPitchBySlice[selectedSlices[0].id] || config.pixelPitchMm)) / 1000).toFixed(3)} × ${((selectedSlices[0].input.height * (simulationPitchBySlice[selectedSlices[0].id] || config.pixelPitchMm)) / 1000).toFixed(3)} m` : "Move, rotate, or scale together"}</span>
                    <button
                      className="inspector-button"
                      onClick={() => {
                        setSelectedGroupIds([]);
                        setSelectedSliceIds([]);
                      }}
                    >
                      Clear selection
                    </button>
                    <button className="inspector-button" onClick={resetSelectedTransforms}>
                      Reset {hasGroupSelection ? `${selectedGroups.length > 1 ? "group transforms" : "group transform"}` : "adaptive layout"}
                    </button>
                  </>
                ) : (
                  <p>Click, Ctrl/Shift-click, or Ctrl-drag a marquee around visible slices.</p>
                )}
              </section>
              <section className="inspector-section">
                <div className="section-title">
                  <span>Scene state</span>
                  <small>project-saved</small>
                </div>
                <dl className="summary-list">
                  <div>
                    <dt>Transform</dt>
                    <dd>
                      {simulationTool === "translate" ? "Move" : simulationTool === "rotate" ? "Rotate" : "Scale"} · {simulationTransformSpace}
                    </dd>
                  </div>
                  <div>
                    <dt>Scale</dt>
                    <dd>Gizmo editable</dd>
                  </div>
                  <div>
                    <dt>Pivot</dt>
                    <dd>{hasGroupSelection ? "Group axis" : selectedSimulationPivot === "mixed" ? "Mixed" : pivotLabel(selectedSimulationPivot)}</dd>
                  </div>
                  <div>
                    <dt>Depth</dt>
                    <dd>
                      {selectedSlices.length === 1 ? round((simulationDepthBySlice[selectedSlices[0].id] || simulationDepthM) * 100, 1) : round(simulationDepthM * 100, 1)} cm
                      {selectedSlices.length === 1 && (simulationDepthBySlice[selectedSlices[0].id] || simulationDepthM) < simulationDepthM ? " · auto-safe" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>H curve</dt>
                    <dd>{selectedCurvature.horizontal === null ? "Mixed" : `${selectedCurvature.horizontal}°`}</dd>
                  </div>
                  <div>
                    <dt>V curve</dt>
                    <dd>{selectedCurvature.vertical === null ? "Mixed" : `${selectedCurvature.vertical}°`}</dd>
                  </div>
                  <div>
                    <dt>Floor</dt>
                    <dd>{simulationFloorVisible ? "Visible" : "Hidden"}</dd>
                  </div>
                  <div>
                    <dt>Grid</dt>
                    <dd>{simulationGridVisible ? "Visible" : "Hidden"}</dd>
                  </div>
                  <div>
                    <dt>Background</dt>
                    <dd>{simulationBackgroundLevel}%</dd>
                  </div>
                </dl>
              </section>
              <section className="inspector-section export-section">
                <div className="section-title">
                  <span>Export 3D scene</span>
                  <small>UV + transforms</small>
                </div>
                <label className="select-field">
                  <span>Format</span>
                  <select aria-label="3D export format" value={simulationExportFormat} onChange={(event) => setSimulationExportFormat(event.target.value as SceneExportFormat)}>
                    <option value="glb">GLB · Universal</option>
                    <option value="gltf">glTF Package · ZIP</option>
                    <option value="obj">OBJ Package · ZIP</option>
                    <option value="mvr">MVR 1.5 · Scene meshes</option>
                  </select>
                </label>
                <button className="button primary wide export-3d-button" disabled={!allSlices.length || simulationExporting} onClick={() => void export3DScene()}>
                  {simulationExporting ? "Building export…" : "Export 3D scene"}
                </button>
                <p className="micro-note">Exports the complete curved mesh, physical scale, UV map, screen names and saved transforms. Floor, grid, camera and gizmos are excluded.</p>
              </section>
              <section className="inspector-section grow">
                <div className="section-title">
                  <span>Project tools</span>
                  <small>{startupProjectStatus}</small>
                </div>
                <p className="micro-note">Active: {activeProjectPath?.split(/[\\/]/).at(-1) || "Startup Project"}</p>
                <button className="inspector-button" onClick={() => void saveActiveProject()}>
                  Save · Ctrl+S
                </button>
                <button className="inspector-button" onClick={saveProject}>
                  Save project as…
                </button>
                <button className="inspector-button" onClick={openProject}>
                  Load project…
                </button>
                <button className="inspector-button" onClick={createBlankProject}>
                  New blank project
                </button>
                <button className="inspector-button" onClick={openDemoProject}>
                  Open demo project
                </button>
                <button className="inspector-button" onClick={() => void revealProjectsFolder()}>
                  Reveal Projects folder
                </button>
                <input
                  ref={projectInputRef}
                  hidden
                  type="file"
                  accept=".lo2s,application/x-opticmesh-project,.json,application/json"
                  onChange={(event) => {
                    loadProject(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <p className="micro-note">Background recovery always writes only to Documents\OpticMesh\Projects\Startup Project.lo2s.</p>
              </section>
              <div className="beta-safety">LO2S - OpticMesh beta · local project data</div>
            </aside>
          )}
          {workspaceMode !== "simulation" && (
            <aside className="right-panel panel">
              <section className="inspector-section">
                <div className="section-title">
                  <span>Pixel integrity</span>
                  <small>{fullscreenMode === "fit" ? "proportional" : "native pixels"}</small>
                </div>
                <div className="integrity-card">
                  <div>
                    <span>Source</span>
                    <strong>
                      {outputWidth} × {outputHeight}
                    </strong>
                  </div>
                  <div>
                    <span>Aspect</span>
                    <strong>{(outputWidth / outputHeight).toFixed(4)} : 1</strong>
                  </div>
                  <div>
                    <span>Preview</span>
                    <strong>{fullscreenMode === "fit" ? "Uniform fit" : "1 source px"}</strong>
                  </div>
                  <p>
                    <i className="green" /> No horizontal or vertical distortion
                  </p>
                </div>
              </section>
              {workspaceMode === "resolume" && resolumeMap && (
                <>
                  <section className="inspector-section selection-card">
                    <div className="section-title">
                      <span>Slice selection</span>
                      <small>{selectedSlices.length ? "overrides enabled" : "click the map"}</small>
                    </div>
                    {selectedSlices.length ? (
                      <>
                        <strong>{selectedSlices.length === 1 ? selectedSlices[0].name : `${selectedSlices.length} slices`}</strong>
                        <span>{selectedSlices.length === 1 ? `${Math.round((mapView === "input" ? selectedSlices[0].input : selectedSlices[0].output).width)} × ${Math.round((mapView === "input" ? selectedSlices[0].input : selectedSlices[0].output).height)} px` : "Ctrl / Shift click to add or remove"}</span>
                        <button className="inspector-button" onClick={() => setSelectedSliceIds([])}>
                          Clear selection
                        </button>
                      </>
                    ) : (
                      <p>Click a slice to edit it. Ctrl/Shift-click selects multiple slices.</p>
                    )}
                  </section>
                  <section className="inspector-section">
                    <div className="section-title">
                      <span>Background</span>
                      <small>PNG alpha</small>
                    </div>
                    <div className="segmented">
                      <button className={config.backgroundMode === "black" ? "active" : ""} onClick={() => update("backgroundMode", "black")}>
                        Black
                      </button>
                      <button className={config.backgroundMode === "transparent" ? "active" : ""} onClick={() => update("backgroundMode", "transparent")}>
                        Transparent
                      </button>
                    </div>
                  </section>
                  <section className="inspector-section validation-compact">
                    <div className="section-title">
                      <span>XML validation</span>
                      <small>Resolume {resolumeMap.version}</small>
                    </div>
                    <div className="validation-list">
                      {validations.map((item, index) => (
                        <p key={`${item.text}-${index}`} className={item.level} tabIndex={0} title={item.details} data-tooltip={item.details} aria-label={`${item.text}. ${item.details}`}>
                          <i />
                          {item.text}
                          <span className="validation-help" aria-hidden="true">
                            ?
                          </span>
                        </p>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {workspaceMode === "patterns" && (
                <section className="inspector-section">
                  <div className="section-title">
                    <span>Wall summary</span>
                    <small>metric</small>
                  </div>
                  <dl className="summary-list">
                    <div>
                      <dt>Surface</dt>
                      <dd>{stats.area.toFixed(2)} m²</dd>
                    </div>
                    <div>
                      <dt>Pixel pitch</dt>
                      <dd>{stats.pitchX.toFixed(4)} mm</dd>
                    </div>
                    <div>
                      <dt>Cabinet grid</dt>
                      <dd>
                        {stats.cols.toFixed(1)} × {stats.rows.toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt>Total pixels</dt>
                      <dd>{(config.resolutionWidth * config.resolutionHeight).toLocaleString()}</dd>
                    </div>
                  </dl>
                </section>
              )}
              <section className="inspector-section grow">
                <div className="section-title">
                  <span>Project tools</span>
                  <small>{startupProjectStatus}</small>
                </div>
                <p className="micro-note">Active: {activeProjectPath?.split(/[\\/]/).at(-1) || "Startup Project"}</p>
                <button className="inspector-button" onClick={() => void saveActiveProject()}>
                  Save · Ctrl+S
                </button>
                <button className="inspector-button" onClick={saveProject}>
                  Save project as…
                </button>
                <button className="inspector-button" onClick={openProject}>
                  Load project…
                </button>
                <button className="inspector-button" onClick={createBlankProject}>
                  New blank project
                </button>
                <button className="inspector-button" onClick={openDemoProject}>
                  Open demo project
                </button>
                <button className="inspector-button" onClick={() => void revealProjectsFolder()}>
                  Reveal Projects folder
                </button>
                <input
                  ref={projectInputRef}
                  hidden
                  type="file"
                  accept=".lo2s,application/x-opticmesh-project,.json,application/json"
                  onChange={(event) => {
                    loadProject(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <p className="micro-note">Background recovery always writes only to Documents\OpticMesh\Projects\Startup Project.lo2s.</p>
                <button className={sequenceActive ? "inspector-button active" : "inspector-button"} onClick={() => setSequenceActive((current) => !current)} disabled={workspaceMode !== "patterns"}>
                  {sequenceActive ? "Stop test sequence" : "Run test sequence"}
                </button>
              </section>
              <div className="export-stack">
                <button className="button primary wide" onClick={exportCurrent}>
                  {workspaceMode === "resolume" && mapView === "input" ? "Export Input PNG" : "Export Current PNG"}
                </button>
                {workspaceMode === "resolume" && resolumeMap && (
                  <>
                    <button className="button wide" disabled={!selectedSlices.length} onClick={exportSelected}>
                      Export Selected Slice
                      {selectedSlices.length > 1 ? "s" : ""}
                    </button>
                    <button className="button wide" onClick={exportOutputs}>
                      Export Output Maps ({resolumeMap.screens.length})
                    </button>
                  </>
                )}
              </div>
            </aside>
          )}
        </section>
        {notice && (
          <button className="toast" onClick={() => setNotice("")}>
            {notice}
            <span>×</span>
          </button>
        )}
        {availableUpdate && (
          <div className="toast update-toast" role="status">
            <div>
              <strong>LO2S - OpticMesh {availableUpdate.latestVersion} is available</strong>
              <small>{availableUpdate.name || "A newer desktop release is ready."}</small>
            </div>
            <div className="update-actions">
              <button onClick={() => void (window as PickerWindow).lo2sDesktop?.openExternal(availableUpdate.url || "https://github.com/johnjjdave/opticmesh/releases/latest")}>View changes</button>
              <button className="primary" onClick={() => void (window as PickerWindow).lo2sDesktop?.openExternal(availableUpdate.url || "https://github.com/johnjjdave/opticmesh/releases/latest")}>
                Download
              </button>
              <button
                className="dismiss"
                aria-label="Remind me in seven days"
                onClick={() => {
                  if (availableUpdate.latestVersion) localStorage.setItem(`lo2s-update-dismissed:${availableUpdate.latestVersion}`, String(Date.now()));
                  setAvailableUpdate(null);
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </main>
    </TransformSelectionScope.Provider>
  );
}
