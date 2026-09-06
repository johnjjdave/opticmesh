import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the official 0.7 layout by default", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /v0\.7\.0/);
  assert.match(html, /Pattern elements/);
  assert.match(html, /Cabinet IDs/);
  assert.match(html, /Fit Canvas/);
  assert.match(html, /Actual 1:1/);
  assert.match(html, /Linked wall calculator/);
  assert.match(html, /Dome/);
  assert.match(html, /Cubemap/);
  assert.doesNotMatch(html, /Equirectangular/);
  assert.doesNotMatch(html, /Cylindrical/);
  assert.doesNotMatch(html, /Domemaster/);
  assert.match(html, /Pixel Map/);
  assert.match(html, /3D/);
  assert.match(html, new RegExp('aria-controls="toolbar-menu-output"[^>]*>Output</button>'));
});

test("keeps the connected 0.7 Pixel Map milestone wired to production logic", async () => {
  const [page, v070Css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v070/v070.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Load Demo Map/);
  assert.match(page, /Advanced Output XML/);
  assert.match(page, /Map display/);
  assert.match(page, /Per Slice/);
  assert.match(page, /Across Map/);
  assert.match(page, /LED panel geometry/);
  assert.match(page, /selectedNumericValues\.pixelPitchMm/);
  assert.match(page, /validations\.map/);
  assert.match(page, /All Output Maps/);
  assert.match(page, /setPatternOutput\("ndi"\)/);
  assert.match(page, /setPatternOutput\("spout"\)/);
  assert.doesNotMatch(page, /Live test pattern/);
  assert.match(page, /LO2S - OpticMesh Output/);
  assert.match(page, /1000 \/ 15/);
  assert.match(page, /onOutputCaptureReady/);
  assert.match(page, /arrangeSimulationSelection/);
  assert.match(page, /10_000/);
  assert.match(page, /Palette seed A/);
  assert.match(page, /Grid \/ border/);
  assert.match(page, /Center marker/);
  assert.match(page, /item === "appearance" \? "Style" : item === "overlays" \? "Overlays"/);
  assert.match(page, /Pattern surface/);
  assert.match(page, /Information & guides/);
  assert.match(page, /Checker A/);
  assert.match(page, /Checker B/);
  assert.match(page, /useState\(DEFAULT_PATTERN_STYLE\)/);
  assert.match(page, /patternStyleFromConfig/);
  assert.match(page, /drawPatternCenterDot/);
  assert.match(page, /function drawDomePattern/);
  assert.match(page, /function drawCubemapPattern/);
  assert.match(page, /function drawPanoramicPattern/);
  assert.match(page, /projectionFormat: "planar"/);
  assert.match(page, /Horizontal Cross/);
  assert.match(page, /domeResolution: 4096/);
  assert.match(page, /DOME_RESOLUTION_PRESETS = \[1024, 2048, 4096, 6144, 8192\]/);
  assert.match(page, /DOME_DEGREE_STEPS = \[1\.5, 2, 2\.5, 5, 10, 15, 22\.5, 30, 45, 90\]/);
  assert.doesNotMatch(page, /Cabinet Checker · Planar only/);
  assert.doesNotMatch(page, /Cabinet IDs · Planar/);
  assert.match(page, /config\.projectionFormat === "planar" &&/);
  assert.doesNotMatch(page, /Native square 180° fisheye/);
  assert.doesNotMatch(page, />Pattern size</);
  assert.match(page, /Black–white gradient/);
  assert.match(page, /UV map/);
  assert.match(page, /Degree lines/);
  assert.match(page, /Number of rings/);
  assert.match(page, /domeShowGrid: true/);
  assert.match(page, /domeShowRings: true/);
  assert.match(page, /domePatternName: "Dome Test Pattern"/);
  assert.match(page, /Reset Dome settings/);
  assert.match(page, /config\.projectionFormat !== "dome" && config\.projectionFormat !== "cubemap"\) drawPatternCenterDot/);
  assert.match(page, /cubemapResolution: 1024/);
  assert.match(page, /Face resolution/);
  assert.match(page, /Vertical Cross/);
  assert.match(page, /Perspective Grid/);
  assert.match(page, /Directional Logo/);
  assert.match(page, /function drawTextOnDomeArc/);
  assert.match(page, /function drawDomeRadialLabel/);
  assert.match(page, /\[\["BACK", 0\], \["RIGHT", 90\], \["FRONT", 180\], \["LEFT", 270\]\]/);
  assert.match(page, /radius \* \(1 - elevation \/ 90\)/);
  assert.match(page, /degreeLabelSize = Math\.max\(13, width \/ 42\)/);
  assert.match(page, /Math\.min\(width, height\) \/ 2 - major \* 1\.5/);
  assert.match(page, /if \(config\.domeCompass && isCardinal\) continue/);
  assert.match(page, /elevationSize = Math\.max\(11, width \/ 72\)/);
  assert.match(page, /weight\.charAt\(0\)\.toUpperCase\(\) \+ weight\.slice\(1\)/);
  assert.doesNotMatch(page, /fillText\("ZENITH"/);
  assert.doesNotMatch(page, /PX · 180°/);
  assert.match(page, /function drawLogoOnDome/);
  assert.match(page, /domeLogoAzimuth: 180/);
  assert.match(page, /domeLogoElevation: 35/);
  assert.match(page, /domeLogoScale: 100/);
  assert.match(page, /Logo size · \{config\.domeLogoScale\}%/);
  assert.doesNotMatch(page, /<ExpressionField label="Angular width"/);
  assert.match(page, /let angle = centreAngle \+ totalAngle \/ 2/);
  assert.match(page, /u = 0\.5 - delta \/ angularWidth/);
  assert.match(page, /function buildDomeLogoPatch/);
  assert.doesNotMatch(page, /for \(let strip = 0; strip < strips/);
  assert.match(page, /ctx\.imageSmoothingQuality = "high"/);
  assert.match(page, /2400 \/ Math\.max\(width, height\)/);
  assert.match(page, /previewQualityTimerRef\.current = window\.setTimeout/);
  assert.doesNotMatch(page, /The logo is warped as a spherical patch/);
  assert.match(page, /OpticMesh - \$\{patternProjectTitle\(config\.project\)\} - \$\{patternModeFilename\(config\.projectionFormat\)\} - \$\{canvas\.width\}x\$\{canvas\.height\}\.png/);
  assert.match(page, /EQUIRECTANGULAR 360° × 180°/);
  assert.doesNotMatch(page, /\{ id: "cylindrical", name: "Cylindrical" \}/);
  assert.match(page, /drawPatternCenterDot\(ctx, width, height, patternStyle\)/);
  assert.match(page, /updatePatternStyle\("showCenterDot"/);
  assert.match(page, /patternStyle,/);
  assert.match(page, /Minimize bottom panel/);
  assert.match(page, /Expand bottom panel/);
  assert.doesNotMatch(page, /\["LO2S Logo"/);
  assert.match(page, /value=\{v070ToolQuery\} onChange=\{\(event\) => setV070ToolQuery\(event\.target\.value\)\}/);
  assert.match(page, /const DOME_BACKGROUND_OPTIONS/);
  assert.match(page, /\{ id: "transparent", label: "Transparent" \}/);
  assert.match(page, /\{ id: "custom", label: "Custom colour" \}/);
  assert.match(page, /DOME_BACKGROUND_OPTIONS\.map\(\(option\)/);
  assert.match(page, /PATTERNS\.filter\(\(pattern\) => !isCubemap \|\| pattern\.id !== "cabinet"\)/);
  assert.match(page, /mapView === "output" \? 1 : resolumeMap\.screens\.length/);
  assert.match(page, /ToggleRow label="Background brightness" value=\{simulationBackgroundLevel > 0\}/);
  // Bloom is not an available 0.7 control; do not expose unfinished controls.
  assert.doesNotMatch(page, /ToggleRow label="Bloom"/);
  assert.match(page, /isV0703D \? \(\["scene", "geometry", "source"\] as const\)/);
  assert.doesNotMatch(page, /Screen colour/);
  assert.doesNotMatch(page, /Change selected screen brightness/);
  assert.match(v070Css, /--surface-control/);
  assert.match(v070Css, /--control-height/);
  assert.match(v070Css, /\.inspector>nav button\+button/);
  assert.match(v070Css, /\.toggleRow\+:global\(\.number-field\)\{margin-top:10px\}/);
});

test("server-renders the retained legacy workspace", async () => {
  const response = await render("/legacy");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>LO2S - OpticMesh/);
  assert.match(html, /Resolume Pixel Map/);
  assert.match(html, /Linked wall calculator/);
  assert.match(html, /Fit Canvas/);
  assert.match(html, /Actual 1:1/);
  assert.match(html, /Export Current PNG/);
  assert.match(html, /Pixel pitch/);
  assert.match(html, /mm/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});

test("keeps pixel-map and arithmetic features in the product source", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function evaluateExpression/);
  assert.match(page, /evaluateExpression\(draft, min <= 0\)/);
  assert.match(page, /function parseResolumeXml/);
  assert.match(page, /function automaticSliceColors/);
  assert.match(page, /function drawSliceInformation/);
  assert.match(page, /function logoDimensions/);
  assert.match(page, /const logoCenter = drawSliceInformation/);
  assert.match(page, /coordinatesPosition/);
  assert.match(page, /physicalSizePosition/);
  assert.match(page, /infoOrientation/);
  assert.match(page, /ResizeObserver/);
  assert.match(page, /showPatternCheckerboard: false/);
  assert.match(page, /Cabinet Checker/);
  assert.match(page, /Metric Grid/);
  assert.match(page, /Cabinet IDs/);
  assert.match(page, /Color Bars/);
  assert.match(page, /Grayscale/);
  assert.match(page, /Pixel Check/);
  assert.match(page, /Per slice/);
  assert.match(page, /Across map/);
  assert.match(page, /Apply global to all slices/);
  assert.match(page, /customLogoPosition/);
  assert.match(page, /event\.clientX,\s*event\.clientY/);
  assert.match(page, /8 \/ baseScale/);
  assert.match(page, /zoomRef\.current/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /selectionMarquee/);
  assert.match(page, /const beginInteraction/);
  assert.match(page, /const endInteraction/);
  assert.match(page, /insideCanvas/);
  assert.match(page, /selection\.initialIds/);
  assert.match(page, /const selectedBoolean/);
  assert.match(page, /selectedSlices\.every/);
  assert.match(page, /selectedBoolean\(\s*"showLabels"/);
  assert.match(page, /selectedBoolean\(\s*"showCheckerboard"/);
  assert.match(page, /selectedBoolean\(\s*"logoVisible"/);
  assert.match(css, /selection-marquee/);
  assert.match(page, /previewScale = interactivePreview/);
  assert.match(page, /displayScale \* \(typeof window === "undefined" \? 1 : window\.devicePixelRatio \|\| 1\)/);
  assert.match(page, /canvas\.width = Math\.max\(1, Math\.round\(width \* previewScale\)\)/);
  assert.match(page, /renderToCanvas\(canvasRef\.current, workspaceMode, mapView, activeScreen, undefined, true, useWorkingRaster\)/);
  assert.match(page, /const box = canvas\.getBoundingClientRect\(\)/);
  assert.match(page, /\(clientX - centerX\) \* \(1 - ratio\)/);
  assert.doesNotMatch(page, /maxArea = preview/);
  assert.doesNotMatch(page, /Horizon & [Aa]xes/);
  assert.doesNotMatch(page, /title="Planar-only tools"/);
  assert.doesNotMatch(page, /globalAlpha = 0\.(62|78)/);
  assert.match(page, /Export Output Maps/);
  assert.match(page, /Export Selected Slice/);
  assert.match(page, /Transparent/);
  assert.match(page, /middle mouse|Middle mouse|event\.button === 1/);
  assert.doesNotMatch(page, /Checker size/);
  assert.match(page, /showDirectoryPicker/);
  assert.match(page, /requestFullscreen/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /data-fullscreen-mode=fit/);
  assert.match(css, /data-fullscreen-mode=actual/);
  assert.match(layout, /Resolume pixel maps/);
});

test("keeps the desktop beta hotfix safeguards in source", async () => {
  const [page, geometry, sceneExport, preload, desktop, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/three-simulation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/scene-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/electron-main.cjs", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /LO2S - OpticMesh V\.\{DISPLAY_VERSION\}/);
  assert.match(page, /<b>Beta<\/b>/);
  assert.doesNotMatch(page, /Experimental WYSIWYG workspace/);
  assert.doesNotMatch(page, /<span>History<\/span>/);
  assert.match(page, /selectHierarchySlice/);
  assert.match(page, /Multiple values/);
  assert.match(page, /renderedSimulationTransforms/);
  assert.match(page, /max="360"/);
  assert.match(page, /invalidCurvedDepthSlices/);
  assert.match(page, /document\.fullscreenElement === host/);
  assert.match(page, /lo2s-update-dismissed/);
  assert.match(geometry, /clamp\(curvature\.horizontal \|\| 0, -360, 360\)/);
  assert.match(geometry, /clamp\(curvature\.vertical \|\| 0, -360, 360\)/);
  assert.match(geometry, /closedHorizontal/);
  assert.match(geometry, /closedVertical/);
  assert.match(page, /Locked by vertical curve/);
  assert.match(page, /Locked by horizontal curve/);
  assert.match(page, /function CurvatureNumberInput/);
  assert.match(page, /evaluateExpression\(draft, true\)/);
  assert.match(page, /onCommit=\{\(value\) =>\s*applySimulationCurvature\("horizontal", value\)\s*\}/);
  assert.match(page, /onCommit=\{\(value\) =>\s*applySimulationCurvature\("vertical", value\)\s*\}/);
  assert.match(page, /increment = shifted \? 0\.5 : 0\.1/);
  assert.match(page, /<FieldStepper label=\{label\}>/);
  assert.match(page, /const PIXEL_PITCH_PRESETS = \[1\.2, 1\.5, 1\.9, 2\.5, 2\.6, 2\.9, 3\.9, 4\.8, 5\.9, 10\]/);
  assert.match(page, /aria-label="Pixel pitch presets"/);
  assert.match(page, /function PreciseNumberInput/);
  assert.match(page, /const lineScale = clamp\(config\.lineWidth, 1, 12\)/);
  assert.match(page, /Math\.max\(2, width \/ 1000\) \* lineScale/);
  assert.match(css, /\.pitch-presets/);
  assert.match(css, /\.range-row\.precise>\.precise-stepper\{grid-column:2!important;grid-row:2/);
  assert.match(page, /lo2s-history-navigation/);
  assert.doesNotMatch(page, /event\.target instanceof HTMLInputElement \|\| event\.target instanceof HTMLTextAreaElement/);
  assert.match(css, /\.precise-stepper/);
  assert.match(page, /onNativeSourceMetrics/);
  assert.match(preload, /app:check-update/);
  assert.match(preload, /lo2s-shared-frame\.node/);
  assert.match(preload, /conversionMs/);
  assert.match(preload, /project:load-startup/);
  assert.match(preload, /project:autosave-sync/);
  assert.match(preload, /project:overwrite/);
  assert.match(preload, /workspace:reveal-projects/);
  assert.match(desktop, /releases\/latest/);
  assert.match(desktop, /WORKSPACE_DIRECTORY_NAME = "OpticMesh"/);
  assert.match(desktop, /"Projects"/);
  assert.match(desktop, /"Exports"/);
  assert.match(desktop, /"Test Patterns"/);
  assert.match(desktop, /Startup Project\.previous\.lo2s/);
  assert.match(desktop, /SUPPORTED_PROJECT_SCHEMA = 3/);
  assert.match(desktop, /writableProjectPaths\.has\(targetPath\)/);
  assert.match(desktop, /candidate === locations\.previousStartupProject/);
  assert.match(page, /Restored latest working project/);
  assert.match(page, /Recovered the previous valid autosave/);
  assert.match(page, /Latest changes autosaved/);
  assert.match(page, /void saveActiveProject\(\)/);
  assert.match(page, /New blank project/);
  assert.match(page, /Reveal Projects folder/);
  assert.match(geometry, /interactiveGeometryPreview/);
  assert.doesNotMatch(geometry, /uniform sampler2D sourceTexture/);
  assert.match(geometry, /geometryKey/);
  assert.match(geometry, /lastTransformPreviewAt/);
  assert.match(geometry, /setRotationSnap\(event\.shiftKey \? THREE\.MathUtils\.degToRad\(5\) : null\)/);
  assert.match(page, /groupTransformFromWorldBounds/);
  assert.match(page, /worldToLocalTransform/);
  assert.match(page, /selectionTransform=\{selectedGroupSelectionWorldTransform\}/);
  assert.match(page, /hierarchyGroupSelectionAnchorRef/);
  assert.match(page, /selectedGroupIds\.includes\(group\.id\)/);
  assert.match(geometry, /continuousRotation\(mesh\.quaternion, start\.continuousRotation\)/);
  assert.match(page, /Double-click a group name to rename it/);
  assert.match(page, /dropHierarchyItem/);
  assert.match(page, /Move to scene root/);
  assert.match(page, /backgroundMode: "transparent"/);
  assert.doesNotMatch(page, /Move group up/);
  assert.match(page, /Collapse group/);
  assert.match(page, /data-tooltip=\{item\.details\}/);
  assert.match(page, /version: 3/);
  assert.match(sceneExport, /groupObjects/);
  assert.match(sceneExport, /groupId: group\.id/);
  assert.match(sceneExport, /group\.parentId/);
  assert.doesNotMatch(preload, /viewer:fullscreen/);
  assert.doesNotMatch(css, /viewer-fullscreen/);
});
