# Changelog

Features, improvements, fixes and compatibility notes for LO2S - OpticMesh.

## [0.9.0 Beta] - 2026-09-10

A preview release for testing Technical Plots. Keep a separate project copy before opening it in an older version. The hosted web app remains at v0.7.0.

- Reviewed the manual and shortcut guide around the Pixel Map → 3D Simulation → Technical Plots workflow. Added illustrated Plots topics for layouts, templates, maps, specifications, framing, text and delivery; refreshed workspace images and corrected outdated saving, export and feature-limit descriptions.

- Matched Technical Plots scrollbars to the dark inspector styling and kept the page layout stable when notes are expanded. Fixed spaces being intercepted while typing in text areas.

- Added text-frame formatting controls for bold, italic, underline and alignment, preserved in projects, templates, duplicates and printed/PDF pages.

- Added a Technical Plots workspace with fixed A3 landscape sheets, editable frame layouts, reusable templates and user-supplied logos and title blocks.
- Added input/output maps, screen detail grids, and specification tables covering pixel pitch, raster, aspect ratios, physical dimensions and mapping coordinates. Long tables continue onto additional sheets.
- Added orthographic and isometric scene views with shaded/wireframe choices and optional stage geometry.
- Added desktop PDF export, an OpticMesh print preview with page navigation and printer selection, project persistence, and Undo/Redo for plot layouts.
- Added cursor-based frame placement, adjustable grid snapping, and drag-and-drop sheet reordering.
- Added paper fonts and frame text sizes, multiline footer notes, and arithmetic fields with the shared adjustment controls and Shift steps of 10.
- Scene frames refresh automatically when their settings change, follow camera names until renamed, and support independent pan and zoom.
- Screen Specifications and Screen Detail use the configured physical panel sizes and panel raster; map labels wrap instead of disappearing on narrow slices.
- Screen Detail reserves space for horizontal and vertical pixel dimensions and wrapped panel notes, preventing overlap with the grid or frame edges.
- Technical Plots uses the shared amber notifications and its own Tools menu label.
- Added Ctrl+D, Duplicate frame and Alt-drag frame copying, preserving settings with independent editing, snapped placement and Undo/Redo.
- Added bottom-right frame resizing, live dimensions, edge/centre alignment guides and equal-spacing snapping with millimetre measurements.
- Input and output maps show each slice’s corresponding X/Y origin, pixel dimensions and physical size. Narrow slices keep wrapped labels inside whenever they fit; numbered callouts are reserved for insufficient space or overlapping/warped geometry.
- Improved scene framing with an immediate drag/zoom preview and a sharp update after interaction. Removed the shifting view-update footer control.
- Changing a plot frame’s camera view now resets its pan and zoom to Fit View; custom titles remain unchanged.
- New view titles use capitalized camera names and can be renamed directly, without an automatic-title checkbox.

## [0.8.0 Beta] - 2026-09-09

Version 0.8.0 is a beta preview. Version 0.7.0 remains the stable Windows release and hosted web app.

### Updated Windows installer — 2026-09-10

- Added 3Dconnexion SpaceMouse navigation in the main 3D viewport, alongside the regular mouse. Selected models, groups and slices act as the Object-mode rotation reference. Open Tools → 3Dconnexion Settings to adjust the installed driver; SpaceMouse control does not affect Floating Preview.
- Fit Scene and its F shortcut straighten the camera horizon after rolling the view.
- Renamed Windowed output to **Floating Preview** throughout the app and guide. Its Output menu item is available only in 3D; an open preview continues running across workspace changes.
- Tools menu items now show whether the tools panel is visible and toggle between Studio and Focused mode.
- Added File → Open Recent with the six most recently opened or saved projects, retained between sessions. Demo access is now exclusively File → Open Demo.
- Opening another project asks to save unsaved work. Closing offers Cancel, Quit without saving, and Save or Save As. Startup displays a loading window while the project and opening view are prepared.
- Save prompts open without selecting an action; Tab and arrow keys navigate their buttons. Cancelling a file or folder picker keeps Import 3D Model open with its preview and options intact.
- Fixed project names after opening and Save As, and distant first-load camera framing. Existing saved camera views are preserved.
- Fixed mouse zoom slowing against empty space around detailed imported models. Zoom follows the visible surface beneath the cursor, including through openings in a model.
- Kept background surfaces and the floor/grid stable when zooming between foreground objects and distant parts of a scene.
- Made hierarchy visibility and lock states clearer with matching highlights and distinct open/closed padlocks. Notifications use amber text and an outline while retaining their normal background and ten-second dismissal.

### Imported stages and scene editing

- Import static stage geometry from MVR 1.4/1.5/1.6, GDTF 1.1/1.2, FBX, OBJ, glTF/GLB, 3DS, Collada/DAE and STL. USD-family import is experimental.
- Inspect the model and its dimensions before importing. Choose source units where required and import either a whole model or its available hierarchy. MVR uses its defined scale automatically and excludes lighting metadata that has no stage geometry.
- Use one consistent hierarchy for imported models, LED slices and editable groups. Rename, reorder and reparent items; create mixed groups; and control visibility and locks with matching controls.
- Edit imported models through the same Coordinates and Pivot tools as LED slices, including arithmetic, wheel adjustment, Shift steps, live transform values and reset. Pivot edits preserve object placement.
- Use Transfer to match a selected object's position and orientation to a reference object while accounting for different pivots.
- Imported models support viewport selection, box selection, hierarchy range selection, ancestor highlights and a restrained outer selection outline. Hierarchy Focus reveals the selected item; viewport Focus frames it.
- Delete removes editable model content while protecting Resolume slices. Removing mixed groups returns their slices to their original screen containers without changing placement or source links.
- GLB, glTF, OBJ and MVR exports include imported geometry. Added STL and USDZ export paths; format-specific hierarchy, material and unit limits are documented in the manual.

### Materials and reflections

- Added the 3D Material tab with diffuse colour/intensity, metallic, roughness and specular controls, inheritance, multi-selection, slider reset and Undo/Redo.
- Apply materials to imported models and LED extrusions while keeping LED display surfaces on their assigned source content.
- Choose shaded or wireframe display. Diffuse colour controls wireframe line colour; reflective controls are disabled while wireframe is selected.
- Added three selectable HDRI reflection environments in Scene Display. Both control rows remain synchronized, and the chosen look is saved with the project. Reflections do not replace the background or LED content.
- Improved colour-picker responsiveness and corrected material inheritance in mixed groups.

### Floating Preview and performance

- Added an independent, camera-only Floating Preview. The Windows preview stays above other applications and continues updating across workspace changes.
- Move the window with its borderless top-left handle, resize from the bottom-right corner and close with the top-right button or Escape. Left-drag inside orbits, right-drag pans and the wheel zooms.
- Pause the main viewport while Floating Preview remains live. Closing the preview resumes the main viewport automatically; native output remains independently controlled.
- Reduced repeated model loading and memory duplication when opening Floating Preview. Returning from Patterns or Pixel Map retains the loaded 3D scene and camera.
- Improved navigation and autosave responsiveness with large imported scenes, including close-up cursor zoom. Model detail is preserved without polygon reduction.
- Expanded Performance with UI FPS, viewport redraws, scene/drawn triangle counts, CPU and memory readings, and supported NVIDIA GPU/VRAM telemetry. Load colours distinguish normal, elevated and high readings.
- Fixed floor/grid visibility at close zoom levels and steep camera angles.

### Projects, maps and interface

- New Project and Load Demo ask whether to save before replacing the current work and clearing Undo history.
- Projects containing imported geometry embed it in the project file. The combined embedded-model allowance is 150 MiB; earlier supported project formats remain readable.
- Project restore opens the Scene inspector and starts LED slices on Pattern Generator for deliberate live-source reconnection. Disconnected feeds display black instead of white.
- Pixel Map opens with a checkerboard canvas and an import prompt when no map is loaded. Output Map selects a valid screen instead of the former blank All Screens option.
- Added Run test sequence to Pixel Map. It continues into 3D, respects Across Map/Per Slice scope and remains live across workspaces when Floating Preview is open.
- Updated the Pixel Map icon and 3D toolbar icons, unified imported-model hierarchy styling, constrained long names, preserved expanded branches and removed redundant tools/help text from the interface.
- Rebuilt the illustrated manual around linked sections, search, adjustable text size, enlarged screenshots and an integrated shortcut reference. Manual versioning follows the application.
- Fixed malformed optional model attributes, worker compatibility for FBX files containing cameras/images, and triangulation of certain curved FBX extrusions. Reimport affected models to apply geometry fixes.
- Improved OBJ unit guidance and retained the 1920 × 1080, 30 fps target for native 3D output with antialiasing and distant-screen depth corrections.

### Compatibility

- Keep a separate copy of projects needed in v0.7.0. Imported-model projects require v0.8.0 or later.
- NDI/Spout and native always-on-top output require Windows. GPU/VRAM telemetry requires supported NVIDIA driver telemetry; other systems retain the available performance readings.
- Imported stages are static geometry. Lighting simulation, animation playback, polygon reduction, DWG and Technical Plots are not included.
- USD-family import and complex referenced/layered scenes remain experimental. Verify exported units, geometry and supported materials in the receiving application.
- Web packages remain in separate deployment storage; public release downloads contain the Windows installer and its checksum.

## [0.7.0 Beta] - 2026-09-06

### New features

- Redesigned the application around Patterns, Pixel Map, and 3D workspaces with searchable Tools, contextual inspectors, and Studio/Focused layouts.
- Added an offline Guide and keyboard/mouse reference with clickable Contents and keyboard navigation.
- Added All Views with Perspective, Top, Front, and Right panes. Each pane has independent pan and cursor-centred zoom; selecting and transforming objects updates every pane in real time.
- Added 3D view shortcuts: F1 Perspective, F2 Top, F3 Right, F4 Front, and F5 All Views.
- Added S for Focus Selection, F for Fit Scene, E/R/T for Move/Rotate/Scale, Ctrl+G for grouping, and viewport-scoped Ctrl+A for selecting all slices.
- Added 1 m Move snapping for object, group, and shared selection pivots. Snapping works with the grid hidden and preserves spacing within a selection.
- Added proportional scaling with Shift-drag in single view and All Views.
- Added a Pivot editor with nine named anchors, custom XYZ coordinates, and a draggable XY pad. Pivot changes preserve visible placement and are included in project files, undo/redo, and scene exports.
- Added File → Compile Project to create a named folder containing the project, imported Resolume XML, full-resolution input map, and every output map.
- Added live viewport performance measurements: redraw FPS, CPU drawing times, render size, draw calls, triangles, resource counts, and GPU drawing time where supported.
- Added Dome patterns with independent square resolution, angular guides, rings, compass and elevation labels, backgrounds, safe area, and spherical logo placement.
- Added Cubemap patterns with independent face resolution, 3 × 2, Horizontal Cross, and Vertical Cross layouts, face labels, perspective guides, seam references, and directional logo placement.

### Interface and workflow improvements

- Unified typography, spacing, icons, selection states, numeric controls, and panel alignment across the application.
- Added double-click reset to sliders throughout Patterns, Pixel Map, and 3D.
- Kept a numeric field’s panel stationary during wheel editing; leaving the field restores panel scrolling.
- Added larger Increase/Decrease controls while preserving arithmetic entry, wheel adjustment, and undo.
- Renamed Exact Transform to Coordinates and placed Pivot, Align Centres, and Distribute Centres directly below it.
- Connected the Tools Align and Distribute buttons to their corresponding inspector controls.
- Moved Scene Display to the Scene inspector and added synchronized controls in the left Tools panel.
- Added distinct icons for screen containers and editable slices/objects.
- Improved top-menu browsing, keyboard access, and Export menu readability. Output status appears inside its menu and diagnostic panel.
- Reserved project-bar space for notifications while keeping Studio/Focused controls and inspector borders aligned.
- Improved narrow-window layouts and added a compact camera selector.
- Displayed accurate manual-save, pending, saving, saved, and failure states.
- Separated Patterns, Dome, and Pixel Map appearance settings so edits in one workspace do not change another.
- Improved Dome label orientation, proportional typography, logo rendering, and responsiveness during editing.
- Updated the built-in sample project and set new Planar projects to a 10 × 6 m example wall at 3.9 mm nominal pixel pitch.
- Set center-dot size controls to 50–200 output pixels, with a 50 px default.
- Consolidated Planar directional controls under Cardinal Labels and placed export commands in the top Export menu.

### Bug fixes

- Fixed All Views navigation and gizmos using the wrong pane bounds, including high-DPI displays.
- Fixed Fit Scene omitting objects moved outside the original imported layout.
- Prevented a viewport focus outline from appearing unexpectedly after mouse interaction or tool shortcuts.
- Prevented Shift-dragging a scale gizmo from returning focus to a previously edited numeric field.
- Disabled pivot editing when no unlocked slices are selected.
- Fixed Pixel Map Info placement menus displaying stale values for multiple selected slices.
- Fixed multi-selection checker-size readouts to show the common calculated value or Multiple values.
- Corrected output dimensions for Resolume XML presets with nested virtual output devices.
- Fixed project opening in the browser interface.
- Fixed zero entry in supported arithmetic fields and overlapping Dome labels/controls.
- Fixed the Patterns center marker across all pattern fills.
- Prevented stale save completions from overwriting newer save status.

### Compatibility notes

- Windows x64 is the desktop platform. NDI and Spout require the Windows application; compatible NDI runtimes are detected by the installer.
- Existing project settings are retained where supported. Older projects receive independent appearance settings; saved dot sizes outside 50–200 px are adjusted to the nearest limit.
- Snap affects Move gizmos; numeric coordinates remain exact. F always fits the entire visible scene, while S focuses the selection.
- Compile Project creates a new folder and leaves the working project’s save path unchanged. Its XML retains imported coordinates; 3D edits are stored in the project file. Live feeds are not included.
- Project, recovery, and export locations remain under Documents\OpticMesh: Projects, Exports, and Test Patterns.

### Known limitations

- This release remains Beta. The 3D workspace is a layout and simulation tool, without a photoreal rendering engine or material editor.
- Custom group-axis placement and mixed group-and-slice selection are unavailable.
- GPU timing depends on hardware and driver support; system-wide GPU usage and VRAM usage are not reported.
- High-resolution patterns, complex geometry, and live feeds can reduce responsiveness.
- OBJ preserves final world geometry but does not retain editable pivot hierarchies. MVR 1.5 exports scene meshes, not lighting-fixture data.
- The Windows installer is unsigned and may show an unknown-publisher warning.

## [0.6.4] - 2026-09-06

- Released the Windows installer with the matching browser application.
- Published the matching 0.6.4 browser build at `opticmesh.lo2s.com` and enabled HTTPS for the new canonical hostname.
- Added the official NDI 6 Runtime redistributable to the Windows installer prerequisite flow, removing the need to install the complete NDI Tools package before using OpticMesh NDI input or output.
- Detects existing NDI 5/6 x64 runtimes through the official environment variables and standard installation locations, skipping prerequisite installation when a compatible runtime is already present.
- Runs the vendor's visible NDI Runtime installer so its own licence terms remain user-visible; OpticMesh installation can still complete with a precise warning if the prerequisite is cancelled or fails.
- Packaged the prerequisite-enabled Windows installer as `LO2S-OpticMesh-0.6.4-beta-Setup.exe`.

## [0.6.3 Beta] - 2026-08-31

- Added Ctrl-click group toggling and Shift-click hierarchy-range selection for multiple groups.
- Made the shared gizmo, Position/Rotation fields, reset, visibility, lock, focus, and ungroup actions operate collectively on selected groups.
- Prevented nested parent and child groups from receiving the same collective transform twice when both are selected.
- Removed the apparent ±90° group-rotation limit by preserving the continuous XYZ Euler representation nearest the existing group rotation.
- Stopped Y rotations beyond ±90° from unexpectedly adding compensating X/Z values.
- Added continuous per-drag rotation tracking so the gizmo retains values through multiple turns instead of wrapping after one revolution.
- Added the first complete `MANUAL.md` source for onboarding, production tutorials, projects and recovery, every current workspace, hierarchy/grouping, live sources, exports, shortcuts, troubleshooting, and Help.

## [0.6.2 Beta] - 2026-08-31

- Replaced hierarchy Up/Down buttons with direct drag-and-drop ordering.
- Added visual insertion feedback for placing an item before, after, or inside a hierarchy group.
- Added slice reparenting by dragging slices into groups, between children, or back to the scene root.
- Added true nested groups and subgroups with recursive selection, visibility, locking, transforms, save/load, undo/redo, and scene export.
- Preserved visible world placement whenever a slice or group changes parent by converting it into the new parent's local coordinate space.
- Changed group renaming to start only on double-click while single-click remains selection and drag remains hierarchy organisation.
- Advanced the `.lo2s` project format to schema 3; schema-1 and schema-2 groups migrate automatically with root-level parentage.

## [0.6.1 Beta] - 2026-08-31

- Updated the group Position and Rotation inspector fields continuously while a selected group is moved or rotated with the 3D gizmo.
- Kept live inspector previews separate from the final persisted transform so one completed drag remains one undoable project change.
- Added saved expand/collapse state for parent groups in the 3D scene hierarchy.
- Added an initial Up and Down ordering control, superseded by direct hierarchy drag-and-drop in `0.6.2 Beta`.
- Changed new Resolume Pixel Map projects to use transparent output by default while retaining Black as an explicit option and preserving saved project choices.
- Expanded XML validation warnings with hover/focus diagnostics that name every duplicate, warped, or out-of-canvas slice and report output bounds where relevant.

## [0.6.0 Beta] - 2026-08-31

- Replaced selection-only grouping with persisted parent transforms containing position, rotation, scale, and a combined-geometry centre axis.
- Converted grouped children to local space and derived their world transforms from the parent while preserving their visible placement during grouping and ungrouping.
- Made hierarchy group selection drive the Move, Rotate, and Scale gizmos and exposed exact group Position and Rotation fields.
- Preserved independent child-local editing inside transformed groups.
- Added Shift-based 5° interactive rotation snapping without changing exact numeric entry.
- Added project schema 2 with automatic migration of schema-1 selection groups to real transform groups.
- Preserved hierarchy nodes in GLB, glTF, and MVR exports while OBJ continues to bake the resulting world placement.

## [0.5.0 Beta] - 2026-08-30

- Added separate startup-recovery and named-project save behavior.
- Made `Ctrl+S` open Save As for the managed startup project and atomically overwrite an explicitly opened or saved named `.lo2s` file.
- Kept background autosave isolated to `Documents\OpticMesh\Projects\Startup Project.lo2s`, so it never silently overwrites a named project.
- Added New blank project, Open demo project, and Reveal Projects folder actions.
- Added project-format and schema validation, including a safe rejection message for unsupported newer schemas.
- Added distinct latest-project restore, previous-autosave recovery, autosave success, and autosave failure feedback.
- Refactored the 3D scene update path so selection and transform changes no longer rebuild every slice mesh, texture, material, and edge object.
- Added throttled transform previews and lower-detail interactive extrusion/curvature previews, with full-detail geometry restored when editing ends.
- Retained the **Beta** badge for the pre-production development cycle.

## [0.4.1 Beta] - 2026-08-30

- Improved the installed Windows project workflow.
- Added the canonical `Documents\OpticMesh` workspace with `Projects`, `Exports`, and `Test Patterns` subfolders.
- Added a managed startup project that autosaves the complete current working state and restores it automatically on the next launch.
- Added a final synchronous save during window close and a recoverable previous autosave generation.
- Made manual project Open and Save As dialogs start in `Documents\OpticMesh\Projects`.
- Made 3D exports start in `Documents\OpticMesh\Exports` and test-pattern exports start in `Documents\OpticMesh\Test Patterns`.

## [0.4.0 Beta] - 2026-08-30

- Continued the pre-production `0.x` version line.
- Applied the canonical **LO2S - OpticMesh** name to the in-app lockup, metadata, desktop window title, package identity, and scene-export provider metadata.
- Retained the Beta badge for the complete `0.x` development cycle.
- Fixed multi-selection geometry and typography fields so shared values display normally and differing values show **Multiple values**.
- Fixed pixel-pitch presets and manual pitch entry to apply to every selected slice while immediately refreshing the inspector.
- Added adaptive mixed-pitch 3D placement based on each slice's effective pitch, accepting any valid positive manual value rather than limiting placement to named presets.
- Added automatic central/most-prominent layout anchoring so the chosen reference screen remains at `X = 0` while surrounding slices adapt without new overlaps.
- Replaced the legacy portable packaging target with an installable Windows executable that provides shortcuts and a standard uninstall entry.
- Added Shift range selection and Ctrl/Cmd additive selection to the 3D scene hierarchy.
- Made slice eye and lock actions apply to the full active multi-selection.
- Removed the duplicate right-side History panel while preserving toolbar Undo/Redo and keyboard shortcuts.
- Removed the redundant **Experimental WYSIWYG Workspace** label.

## [0.3.3 Beta] - 2026-08-22

- Fixed NDI and Spout senders stopping on generated pattern frames by making the Windows native frame pipe read RGBA data in binary mode.

## [0.3.2 Beta] - 2026-08-22

- Fixed the uncaught Electron `EPIPE` exception when a native NDI or Spout sender closes while a frame is being delivered.
- Added guarded native-output writes and process-specific callbacks so stopping, restarting, or switching output protocols cannot write into a stale sender.
- Kept native sender failures inside the Live Test Pattern status panel instead of displaying a Windows main-process error dialog.

## [0.3.1 Beta] - 2026-08-22

- Fixed desktop project saving so one native save dialog writes exactly one self-contained `.lo2s` file.
- Moved the 3D scene hierarchy to the right inspector above Slice Selection and removed the duplicate simulation Project Tools panel.
- Gave every 3D slice its own generated pattern texture so overlapping input-map slices cannot overwrite one another in simulation.
- Added mutually exclusive NDI or Spout output for the generated Resolume Pixel Map test pattern.
- Added full-resolution RGBA streaming, automatic pattern refreshes, and live output dimension changes when the Advanced Output map updates.
- Replaced the application artwork with the new symbol-only OpticMesh icon.

## [0.3.0 Beta] - 2026-08-22

- Renamed the application to OpticMesh and introduced the new application icon and Windows identity.
- Added a 3D scene hierarchy with visible-by-default imported screens and slices, per-object visibility and locking, local names, search, grouping, and group transforms.
- Added selection scaling and camera focus while preserving simulation-only visibility during exports.
- Fixed fullscreen 3D sizing and camera projection updates.
- Extended the established XYZ mouse-wheel adjustment behavior to numeric parameter fields.
- Replaced the two-file project export with one versioned, self-contained `.lo2s` project file.

## [0.2.0 Beta] - 2026-08-02

This is the first public beta of the 3D Simulation workspace and the main public download after v0.0.1. The Windows portable build retains a separate beta application identity so it does not replace the installed stable application.

### Current v0.2.0 Beta refresh

- Replaced the NDI renderer IPC frame path with a reusable three-slot shared-memory transport and added receiver, conversion, copy, overwrite, and displayed-frame instrumentation.
- Extended horizontal and vertical curvature to -360 degrees through +360 degrees, added closed full-cylinder seams, and made the two curve axes mutually exclusive to match physical LED construction.
- Fixed manual negative curvature entry so a leading minus sign remains editable and signed arithmetic commits correctly.
- Removed the automatic depth override above 90 degrees; curved extrusion now follows the selected depth, with validation when depth exceeds the inner radius.
- Hid unselected front-face outlines so adjacent LED slices read as one seamless display while preserving selected-screen feedback.
- Added a consistent minimal increment/decrement arrow design to numeric controls throughout Test Patterns, Resolume Pixel Map, and 3D Simulation.
- Changed transform-field wheel increments to 0.1 normally and 0.5 while holding Shift.
- Made Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y work while parameter inputs have focus.
- Prevented unfinished transform and curvature drafts from carrying into a newly selected slice.
- Added P1.2, P1.5, P1.9, P2.5, P2.6, P2.9, P3.9, P4.8, P5.9, and P10 pixel-pitch preset buttons while preserving manual arithmetic entry.
- Fixed Test Patterns Line Width so it now controls the metric grid, centre axes, border, cross, circles, and safe-area strokes.
- Preserved the original compact slider/value layout while applying the unified arrow design.
- Corrected source-panel spacing, removed redundant 3D status content, and added visible application version details plus design-matched update notifications.

### New features

#### 3D Simulation workspace

- Added a dedicated **3D Simulation** workspace alongside Test Patterns and Resolume Pixel Map.
- Converts every imported Resolume Advanced Output XML slice into an independently selectable 3D LED screen.
- Builds screens at their calculated physical width and height while locking scale to the XML raster and physical pixel-pitch data.
- Places screens from their XML input-map coordinates on initial load and preserves saved world transforms when slice dimensions change.
- Maps the full composition texture across all screens with cropped, clamped UVs for pixel-map-accurate WYSIWYG playback; textures do not tile or repeat.
- Uses unlit, emissive-style LED faces so source colors and brightness are not altered by scene lighting, distance, or material falloff.
- Adds configurable screen extrusion from 1–50 cm, with a 10 cm default, direct value entry, slider control, and reset.
- Adds mutually exclusive horizontal or vertical curvature from -360° to +360°, direct value entry, sliders, reset controls, smooth subdivisions, closed full-cylinder seams, and curved extrusion.
- Adds independently controlled floor visibility, one-metre grid visibility, and scene background brightness.
- Uses a fixed 2,000 × 2,000 metre world-space floor and one-metre grid rather than a camera-following visual plane.

#### Scene editing and navigation

- Added move and rotate gizmos with switchable local and world axes.
- Added bottom-left, bottom-centre, and bottom-right pivots, configurable globally or per selected slice.
- Added exact world-position and rotation fields with arithmetic-expression support.
- Transform readouts update live while dragging, accept mouse-wheel changes when hovered, and display cleaned practical decimal values.
- Added click selection, Ctrl/Shift-click multi-selection, and Ctrl-drag marquee selection of visible screens.
- Multi-slice numeric edits apply the entered value to each selected screen instead of treating the selection only as a temporary group offset.
- Added up to 100 steps of undo and redo, including Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y shortcuts.
- Added orbit, right-drag view panning, cursor-centred wheel zoom, Fit Scene, saved camera state, desktop fullscreen, and Escape-to-exit fullscreen.

#### Sources and routing

- Added Pattern Generator, Video Devices, NDI, and Spout as 3D texture sources.
- Added one global source with optional per-slice source overrides.
- Added dedicated source discovery, selection, connection, reconnection, refresh, and disconnect controls for NDI and Spout.
- Added dedicated device selection for webcams and capture devices instead of presenting them as NDI or Spout sources.
- Added **Low Latency** and **High Quality** live-input modes while keeping Pattern Generator at native full quality.
- Added a native Windows source bridge for NDI and Spout reception; browser builds continue to provide browser-compatible sources only.
- Automatically disconnects and reinitializes native inputs when the feed, sender, or quality mode changes.

#### Project and export workflow

- Added beta project save/load for transforms, pivots, source routing, source quality, depth, curvature, axis mode, floor, grid, background, and camera state.
- Added GLB export with embedded texture, named screen nodes, UVs, physical scale, and transforms.
- Added glTF package export as a ZIP containing the scene and supporting assets.
- Added OBJ package export as a complete world-positioned scene with UV mapping and baked transforms.
- Added MVR 1.5 export with a single embedded uncompressed GLB scene resource for broader visualizer compatibility.
- GLB and glTF exports intentionally avoid Draco compression to support importers that do not ship a Draco decoder.
- Remembers the last desktop save location separately for PNG and 3D scene exports.

### Interface and workflow improvements

- Expanded the application navigation and side panels for the new simulation, source-routing, geometry, transform, appearance, export, and project controls.
- Standardized the interface on the Geist typeface for clearer small text and removed Geist Mono from compact controls.
- Simplified live-source quality labels to **Low Latency** and **High Quality** and corrected source-panel spacing and alignment.
- Made numeric spinner controls transparent so only their arrows remain visible.
- Removed the redundant 3D status strip and duplicate informational/history panels from the visible simulation layout, allowing the live viewer to use the recovered space.
- Added clearer selection counts, physical screen dimensions, locked-scale status, saved-state feedback, and local-only beta messaging.
- Kept the existing Test Patterns and Resolume Pixel Map workflows available in the same interface.

### Bug fixes since v0.0.1

#### 3D rendering and camera

- Fixed screen colors fading or shifting when the camera zoomed away from the scene.
- Fixed close-up black combing, z-fighting, and extrusion artifacts on thin or curved screens.
- Fixed distant screen and floor clipping by making camera depth handling adapt to the viewed scene.
- Fixed right-drag panning moving the apparent world, floor, or screen arrangement instead of only moving the camera view.
- Fixed the floor/grid scale and anchoring so the scene reads as a stable physical world at different zoom distances.
- Fixed Pattern Generator textures appearing pixelated by rendering them at native quality with appropriate texture filtering.
- Fixed rotation gizmos remaining on default world axes when local axes were selected.

#### XML placement, transforms, and selection

- Fixed incorrect 3D slice placement by deriving initial pivot positions directly from Resolume input-map coordinates and the master physical pixel scale.
- Fixed mixed-pitch sizing so each screen uses its own physical pitch while the composition retains one consistent master coordinate scale.
- Fixed transform fields showing floating-point noise for values that resolve cleanly, such as -7.5 or 4.5 metres.
- Fixed selection delays and made selected-state feedback more responsive.
- Fixed transform values updating only after releasing the gizmo instead of during the drag.
- Fixed multi-selection edits being interpreted only as a group transform when per-screen values were intended.
- Fixed changing multiple selected slices back to **Inherit global source**.
- Fixed the automatic curve-driven depth override; the chosen extrusion now remains under user control at every curve angle.

#### Live inputs

- Fixed NDI discovery returning only remote-connection entries while omitting active local/network senders.
- Fixed NDI low-latency reception using an overly compressed proxy; it now receives the full NDI raster and creates its local low-latency texture from the newest available frame.
- Reduced NDI frame backlog and latency by discarding stale queued frames before display.
- Fixed NDI and Spout freezing or going black after switching quality modes by restarting the native receiver automatically.
- Fixed Spout textures being vertically mirrored.
- Fixed Spout low-latency alpha/black handling that previously held the last frame when a Resolume fader reached black.
- Fixed source changes retaining the previous native receiver until users disconnected it manually.
- Preserved the working Video Devices implementation as its own source type.

#### Export and desktop

- Fixed GLB/glTF compatibility problems caused by importer-dependent compression and packaging.
- Fixed OBJ world placement by exporting one complete scene with transforms baked into vertices; OBJ's lack of standardized editable local pivots is documented in the package.
- Fixed MVR files that imported empty, omitted some slices, or produced inconsistent screen scales by targeting MVR 1.5 and embedding the complete scene as one GLB resource.
- Fixed desktop fullscreen so only the live viewer enters fullscreen and Escape exits as expected.
- Fixed the Windows portable packaging configuration and added build validation for published web and desktop artifacts.

### Known beta limitations

- NDI and Spout require the Windows desktop build and are unavailable in a standard web browser.
- High-resolution NDI, Spout, and video-device feeds increase decoding, memory, GPU-upload, and rendering load; NDI High Quality can have more latency on demanding sources or systems.
- OBJ preserves geometry, UVs, and final world placement but cannot represent the editable per-object pivot hierarchy used by OpticMesh. Use GLB, glTF, or MVR when hierarchy and transform nodes matter.
- MVR export targets version 1.5 for compatibility and carries mesh geometry rather than lighting-fixture data.
- The Windows beta executable is unsigned, so Microsoft Defender SmartScreen may show an unknown-publisher warning.

### Release artifact

- Windows portable: `LO2S-Pattern-Lab-3D-Beta-1.2.0-beta-Portable.exe`

## [0.0.1] - 2026-07-31

- Added **Link Resolume Map** to the Windows application alongside one-time manual XML selection.
- Watched Resolume Arena's `Documents\Resolume Arena\Presets\Advanced Output` directory and automatically loaded the most recently saved XML preset.
- Refreshed the active map when Resolume saved changes, with filesystem watching, polling fallback, and debounced updates.
- Preserved the current screen and any still-valid slice selections when a linked XML map refreshed.
- Added linked/file status, source path, update time, explicit unlinking, and user-facing link errors.
- Added a native desktop XML picker with file-type and 32 MB safety validation.
- Added a context-isolated preload bridge for the new desktop integration.
- Updated the Pattern Lab application icon, social preview artwork, package metadata, and Windows release configuration.
- Corrected the Windows release dependency policy and kept automated build validation in the release workflow.


## [0.0.0 — LO2S Pattern Lab] - 2026-07-31

The first published release established the original Pattern Lab application as a browser-compatible workspace with an offline portable Windows build.

### Test-pattern workflow

- Added a linked wall calculator connecting physical width and height, native raster resolution, and pixel pitch.
- Added arithmetic expressions directly inside numeric fields, including multiplication and other practical calculations.
- Added metric-grid, cabinet-ID, color-bar, grayscale, and native pixel-check pattern modes.
- Added configurable checkerboards, labels, diagonals, circles, safe-area guides, centre markers, colors, line widths, and uploaded logos.
- Added cabinet-dimension calculations and warnings for pitch mismatch or incomplete cabinet multiples.

### Resolume pixel-map workflow

- Added Resolume Arena Advanced Output XML import.
- Parsed compositions, screens, slices, input rectangles, and output rectangles into an interactive pixel-map workspace.
- Added input-map and individual output-screen views.
- Added automatic slice color palettes with global defaults and per-slice overrides.
- Added single selection, additive multi-selection, and drag-marquee selection.
- Added selected-slice controls for geometry, labels, palette, guides, and visibility.

### Viewing, projects, and exports

- Added Fit Canvas and Actual 1:1 viewing, cursor-centred zooming, panning, and fullscreen output.
- Added black or transparent PNG export for the current pattern or pixel map.
- Added selected-slice export and multi-screen output export.
- Added local project save/load for Pattern Lab configuration, imported XML, logos, and slice overrides.
- Added an offline portable Electron application that processed projects, XML files, logos, and exports locally.
- Added the hosted browser build, desktop build integration, brand fonts and artwork, licensing, privacy notes, checksum guidance, and the initial Windows release workflow.

### Initial release limitations

- The Windows executable was unsigned and could trigger a Microsoft Defender SmartScreen unknown-publisher warning.
- Resolume XML updates required manual re-import; automatic desktop linking arrived in `0.0.1`.
- The product contained Test Patterns and Resolume Pixel Map only; the 3D Simulation workspace arrived in `0.2.0 Beta`.

[0.6.4]: https://github.com/johnjjdave/opticmesh/releases/tag/v0.6.4
