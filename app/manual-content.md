# LO2S - OpticMesh Software Manual

**Manual version:** 0.9.0

LO2S - OpticMesh is an LED test-pattern, Resolume pixel-map, physically scaled 3D simulation, and technical-plot application designed by LO2S. Use this manual to learn the workspaces, controls, shortcuts, and export workflows. Open it offline through **Help → OpticMesh Manual** or **Guide**; use **Help → Keyboard Shortcuts** for the control reference.

## Contents

In the in-app Manual, choose a section in the left navigation to open its topic on the right. Search finds topics by title or content. Use **Text size** to adjust reading size; screenshots open in a larger view with zoom controls. Keyboard users can Tab to a section link and press Enter; focus moves to the topic heading. **Help → Keyboard Shortcuts** opens the keyboard and mouse section in this same guide.

1. [What LO2S - OpticMesh does](#1-what-lo2s---opticmesh-does)
2. [Installation and first launch](#2-installation-and-first-launch)
3. [Application structure](#3-application-structure)
4. [Quick-start workflows](#4-quick-start-workflows)
5. [Projects, autosave, and recovery](#5-projects-autosave-and-recovery)
6. [Test Patterns workspace](#6-test-patterns-workspace)
7. [Resolume Pixel Map workspace](#7-resolume-pixel-map-workspace)
8. [3D Simulation workspace](#8-3d-simulation-workspace)
9. [Technical Plots](#9-technical-plots)
10. [Scene hierarchy and grouping](#10-scene-hierarchy-and-grouping)
11. [Live sources and routing](#11-live-sources-and-routing)
12. [Exporting](#12-exporting)
13. [Keyboard and mouse reference](#13-keyboard-and-mouse-reference)
14. [Numeric fields and mixed values](#14-numeric-fields-and-mixed-values)
15. [Production workflow recommendations](#15-production-workflow-recommendations)
16. [Troubleshooting](#16-troubleshooting)
17. [Projection formats and current limitations](#17-projection-formats-and-current-limitations)
18. [Terminology](#18-terminology)

[Floating Preview controls](#115-floating-preview)

[Importing stage models](#stage-model-import)

---

## 1. What LO2S - OpticMesh does

LO2S - OpticMesh combines four connected workflows:

- **Test Patterns** creates pixel-accurate LED calibration and identification images.
- **Resolume Pixel Map** reads Resolume Advanced Output XML, visualizes input and output mappings, applies physical LED information, validates slices, and exports maps.
- **3D Simulation** turns the imported slices into physically sized LED screens that can be arranged, curved, grouped, textured, and exported as a 3D scene.
- **Technical Plots** prepares printable pixel-mapping sheets with screen specifications, scene views and your own title block.

The main production workflow is **Resolume Pixel Map → 3D Simulation → Technical Plots**. Patterns is a supporting mode for calibration and content checks. Confirm the real screen dimensions and 3D arrangement before preparing the plots.

The intended production flow is:

```text
Resolume Advanced Output XML
            ↓
Set the real LED pixel pitch and cabinet geometry
            ↓
Verify input/output maps and XML diagnostics
            ↓
Build and verify the physical 3D arrangement
            ↓
Create Technical Plots from the verified mapping and scene
            ↓
Save one self-contained .lo2s project
            ↓
Export the plots as PDF or print; export maps or a 3D scene as needed
```

### 1.1 What the application stores locally

The Windows application creates this folder structure:

```text
Documents\OpticMesh\
├── Projects\
│   ├── Startup Project.lo2s
│   └── Startup Project.previous.lo2s
├── Exports\
└── Test Patterns\
```

- **Projects** contains named projects and managed recovery files.
- **Exports** is the default destination for 3D scene exports and Technical Plots PDFs.
- **Test Patterns** is the default destination for exported PNG maps and patterns.

Project content and source frames are processed locally. LO2S - OpticMesh does not require uploading project files to an LO2S server.

---

## 2. Installation and first launch

### 2.1 Supported distribution

Install LO2S - OpticMesh on Windows x64 to use desktop saving, recovery, and native video sources.

1. Run `LO2S-OpticMesh-<version>-Setup.exe`.
2. Choose the installation location if required.
3. If a compatible NDI® 5/6 Runtime is not already installed, complete the official NDI 6 Runtime prerequisite installer when it opens. The full NDI Tools package is not required.
4. Complete the OpticMesh installer.
5. Launch **LO2S - OpticMesh** from the Desktop or Start Menu shortcut.

The current open-source Beta may trigger a Windows SmartScreen **Unknown publisher** warning. Verify that the installer came from the official LO2S - OpticMesh repository or another trusted LO2S release location before continuing.

### 2.2 First launch

At first launch, the app creates the `Documents\OpticMesh` workspace and starts a managed **Startup Project**. You can immediately work without naming or manually saving that project. The latest state is restored when the app is reopened.

The Windows loading window stays visible while your project and its opening view are prepared. Larger stages may take longer to open. If startup fails, use **Retry** or close the loading window.

Use **File → Open Demo** to learn the interface without preparing a Resolume file.

---

## 3. Application structure

### 3.1 Workspaces

Use the left mode rail to switch between four workspaces:

| Workspace | Purpose |
|---|---|
| **Patterns** | Design standalone LED calibration patterns from physical and raster specifications. |
| **Pixel Map** | Import and inspect Resolume Advanced Output maps, edit slice presentation, validate XML, and export maps. |
| **3D** | Arrange the mapped slices as physical LED screens in a 3D scene. |
| **Plots** | Create technical sheets from the verified pixel map and 3D arrangement. |

Changing workspace does not create a new project. All four workspaces belong to the same `.lo2s` project.

### 3.2 Main interface regions

- **Top bar:** File, Export, Output, Tools, Help, About, and Undo/Redo.
- **Project bar:** project name, save status, notifications, and Studio/Focused layout controls.
- **Left mode rail:** Patterns, Pixel Map (outlined Resolume symbol), 3D, Plots, and Guide.
- **Tools panel:** searchable tools for the active workspace. Focused mode hides this panel to give the viewport more room.
- **Tools menu:** the workspace Tools item toggles between Studio and Focused mode. Its background is highlighted while the tools panel is visible; select it again to hide or restore the panel.
- **Central viewport and toolbar:** the pattern, map, 3D scene, or plot sheet with its editing and viewing controls.
- **Right inspector:** settings and selection details for the active workspace.
- **Bottom area:** Patterns, Pixel Map and 3D show diagnostics such as validation, output and performance. Plots shows the printed sheet count and paper size.

Patterns inspector tabs are **Setup**, **Overlays**, and **Logo**; Pixel Map uses **Source**, **Geometry**, **Info**, and **Style**; 3D uses **Scene**, **Geometry**, and **Source**. Plots has sheet and frame properties, including camera view, text and layout settings. Its left panel contains sheets, templates and the project title block. Export commands are in the top **Export** menu. Patterns background and Run test sequence are in **Setup → Pattern presentation**.

Interface labels and buttons do not select text when dragged across. Text fields still support selection, copying and editing, including names, searches and coordinate expressions. Scene-object selection and hierarchy range selection work normally.

### 3.3 Notifications

Notifications appear in a dedicated space in the project bar above the viewport toolbar, immediately left of the Studio/Focused area. Its right edge aligns with the left edge of the inspector. They clear automatically after ten seconds; click × to dismiss sooner. Hover over a shortened message to read its full text. The notification space remains reserved when empty, keeping the layout steady.

---

## 4. Quick-start workflows

### 4.1 From Resolume Pixel Map to 3D and Technical Plots

1. Finish the slice layout in Resolume Advanced Output.
2. Save/export the Advanced Output preset as XML.
3. Open **Pixel Map**.
4. Choose the XML file or use **Link Resolume Map** in the Windows app.
5. Enter the exact manufacturer-specified pixel pitch before judging physical scale.
6. Confirm slice dimensions and XML validation.
7. Open **3D**.
8. Arrange the screens, add curvature or extrusion, and create groups as needed.
9. Verify physical sizes, positions and orientation in the 3D scene.
10. Open **Plots**, choose a template, and prepare the maps, specifications and scene views.
11. Review the sheets, then press `Ctrl+S` to save the project.
12. Export the plots as PDF or print them. Export a separate 3D scene if required.

### 4.2 Create and export a standalone test pattern

New projects start with a **10 × 6 m** example wall at **3.9 mm** pixel pitch. The example raster is **2560 × 1536 px**, based on 20 × 12 of the default 500 mm cabinets, each 128 × 128 pixels (3.90625 mm effective pitch). The calculator initially uses physical size and pitch as its inputs; editing wall dimensions recalculates resolution. Opening an existing project restores its saved settings.

1. Open **Patterns**.
2. Enter wall width, wall height, resolution, pixel pitch, and cabinet size.
3. Select **Metric Grid**, **Cabinet IDs**, **Color Bars**, **Grayscale**, or **Pixel Check**.
4. Configure overlays, labels, line width, colors, and logo.
5. Choose **Fit Canvas** for an overview or **Actual 1:1** for native-pixel inspection.
6. Choose transparent or black background when applicable.
7. Select **Export PNG** or **Export Current PNG**.

### Save status

The project bar reports whether your work is unsaved, saving or autosaved. **Manual save only** means you need to save explicitly. An autosave failure stays visible in the strip with an error indicator until another save changes the state. Hover over a shortened status to read the full message. A manual-save indicator does not mean the current work has been saved.

### 4.3 Continue the latest job

Simply reopen LO2S - OpticMesh. The managed startup project restores the latest working state. If you had explicitly opened or saved a named `.lo2s` project, reopen that named file to continue treating it as the active named project.

---

## 5. Projects, autosave, and recovery

### 5.1 The `.lo2s` project file

A `.lo2s` file is self-contained. It stores:

- project and test-pattern configuration;
- the imported Resolume XML data;
- uploaded logo data;
- per-slice overrides;
- 3D transforms, pivots, extrusion, and curvature;
- hierarchy groups, subgroups, order, visibility, locks, and collapse state;
- source quality settings; live feeds need reconnecting after opening a project (see [Global sources](#111-global-sources));
- imported 3D models and their OpticMesh material settings;
- camera and viewport state;
- Technical Plots sheets, frames, text formatting, selected views and title-block details.

Keep a named project file with each delivery revision. Use OpticMesh to open and edit it; a PDF is a finished document and cannot restore your editable scene or plot layout.

### 5.2 Startup Project versus named project

LO2S - OpticMesh distinguishes two concepts:

| Project state | `Ctrl+S` behaviour |
|---|---|
| Managed **Startup Project** | Opens **Save As…** so you can create a named project. |
| Named project opened with **Open Project…** | Saves your changes to that named file. |
| Named project created with **Save As…** | Saves your changes to that named file. |

Background autosave always writes to the managed startup/recovery files. It never silently overwrites a named project. A named project is overwritten only by an explicit save command.

**Closing the Windows app:** If your work has not been saved to a project file, OpticMesh asks **Do you want to save your project?** Choose **Save As…** to create a named file, or **Save** to update the active file. **Cancel** or Escape keeps the project open. **Quit without saving** closes the app without saving your changes to a project file. If you choose to save, closing proceeds only after a successful save; cancelling the file dialog or a failed save keeps your work open. An unchanged saved project closes normally, and its saved-file destination is remembered on restart while the file remains available.

Save prompts open without selecting a button. Use Tab, Shift+Tab or the arrow keys to move between actions, then Enter or Space to activate one. Escape cancels the prompt.

### 5.3 Project commands

- **Save:** applies the correct Startup Project or named-project behaviour described above.
- **Save project as…:** creates a named `.lo2s` file and makes it active for the session.
- **Open Project…:** opens an existing `.lo2s` project and makes that path active.
- **Open Recent:** shows the six most recently opened or saved projects in a submenu. The list is retained when you restart OpticMesh. Hover over a project name to see its full location. If a file has moved or been deleted, use Open Project to locate it again.
- **New Project:** starts a fresh project after the save confirmation.
- **Open Demo:** loads a sample project for exploring Pixel Map, 3D and Technical Plots.
- **Reveal Projects folder:** opens `Documents\OpticMesh\Projects`.

**File → Open Demo** opens the sample project in 3D. Switch to Pixel Map to inspect its mapping, then Plots to explore the delivery sheets. Loading the demo replaces the current working state and disconnects any linked XML file.

**Before replacing a project:** New Project and Open Demo open a centred confirmation with **Cancel**, **Continue without saving**, and **Save and continue**. Open Project and Open Recent also show this confirmation when the current project has unsaved changes. Cancel or Escape keeps the current project. No action is selected when the prompt opens. Tab, Shift+Tab and the arrow keys move between available actions; Enter or Space activates the focused button. Save and continue saves to the active named project, or opens Save As when a named destination is needed; replacement happens only after a successful save. A cancelled or failed save leaves the project and confirmation open. Controls are temporarily disabled while saving.

The confirmation also appears after autosave: startup recovery follows the current working project and is not a permanent named backup. Project replacement clears the scene Undo history, so Ctrl+Z cannot restore the preceding project after choosing to continue.

### 5.4 Compile Project

Choose **File → Compile Project…** with a Resolume XML loaded. Enter the project name in the Save dialog's **File name** field and choose its parent location. OpticMesh creates a new folder using that name.

The folder contains:

- **Your Project.lo2s** — the current project, including imported 3D models, scene settings and editable Technical Plots layouts, with the compiled project title.
- **Your Project.xml** — the imported Resolume XML, including its original coordinates and spacing.
- **Input Map.png** — the full composition raster without selection decorations.
- **Output 001 - screen-name.png**, etc. — every screen's full-resolution output map. Numeric prefixes keep names unique.

Compilation preserves the current working project's name, active save path and selection. Existing destination folders are rejected; use a new name. Canceling does not create a folder. The bundled XML represents the imported map; 3D edits are saved in the `.lo2s` file and do not rewrite Resolume coordinates. Live video/NDI/Spout feeds are not copied into this bundle.

Imported models are embedded in the `.lo2s` file; you do not need to copy the original FBX/OBJ separately to reopen the scene. Finished Technical Plots PDFs are not generated by Compile Project: export them from **Plots** and add them to your delivery folder.

**Tip:** open the compiled `.lo2s` to continue that copy of the job. The PNG maps are generated at native resolution, regardless of viewport zoom or preview quality.

### 5.5 Recovery

The application maintains a current and previous valid startup file. If the latest startup file is unreadable, the previous valid recovery may be restored. Watch the project status text for messages such as:

- **Latest changes autosaved**
- **Restored latest working project**
- **Recovered the previous valid autosave**
- **Autosave failed**

If autosave fails, verify that the Documents folder is writable and that security software is not blocking the application.

---

## 6. Test Patterns workspace

### 6.1 Pattern types

| Pattern | Primary use |
|---|---|
| **Metric Grid** | Measure alignment, geometry, scale, and line continuity. |
| **Cabinet IDs** | Identify cabinet or panel divisions and data organisation. |
| **Color Bars** | Check primary colors, channel order, reproduction, and processing. |
| **Grayscale** | Check brightness steps, clipping, contrast, and uniformity. |
| **Pixel Check** | Inspect native pixels and identify scaling or sampling problems. |

**Run test sequence** automatically cycles through the available test patterns approximately every three seconds. Use it for rapid visual inspection, then stop the sequence before making pattern-specific adjustments.

### 6.2 Linked wall calculator

The calculator links physical size, raster resolution, and pixel pitch. Choose two known groups of values and the remaining group is calculated.

Typical examples:

- Known physical size + known resolution → calculate pixel pitch.
- Known physical size + known pixel pitch → calculate resolution.
- Known resolution + known pixel pitch → calculate physical size.

Cabinet snapping can align physical dimensions to complete cabinet increments. Always confirm calculated values against the real LED manufacturer's specification.

### 6.3 LED panel geometry

Configure:

- cabinet width and height in millimetres;
- pixel pitch in millimetres;
- total wall width and height in metres;
- total resolution in pixels.

Checker blocks are derived from cabinet dimensions and pixel pitch. They are not an arbitrary decorative grid.

**Checker block means pixels per cabinet.** Each checker tile represents one cabinet. Its raster width is `round(cabinet width in mm ÷ pixel pitch in mm)`, with the same calculation for height. For a 500 × 500 mm cabinet, P2 gives 250 × 250 px; P4 gives 125 × 125 px. Increasing pitch increases physical pixel spacing and reduces the number of pixels in the same cabinet.

Pixel Map keeps the XML raster fixed: an 800-pixel-wide slice grows from 1.6 m at P2 to 3.2 m at P4, and contains more fixed-size cabinets. In Patterns with physical wall size held fixed, increasing pitch reduces the output raster and the cabinet's pixel count together, retaining the cabinet count across the wall. Use Actual 1:1 to inspect raster pixels; Fit Canvas is a scaled preview.

For multiple selected slices, Geometry and Style show the common calculated checker resolution, or **Multiple values** when the calculated widths/heights differ. Different cabinet dimensions and pitch values can still produce the same checker resolution.

### 6.4 Style and information

Available presentation controls include:

- cabinet checker;
- grid and border;
- diagonal guides;
- circles;
- safe area;
- center marker;
- adjustable line width;
- project, slice, coordinate, resolution, aspect, and physical-size labels;
- label position, orientation, scale, and color;
- custom logo visibility, position, opacity, and scale.

The **Overlays** tab in Patterns is independent from the **Style** tab in Pixel Map. Pattern colours and guides affect generated standalone patterns only; Pixel Map styles affect imported Resolume slices only. Planar Patterns uses **Cardinal Labels** for directional labels. Pixel Map provides an information-orientation menu.

**Center dot size:** Planar and Dome Patterns and Pixel Map use a diameter of **50–200 output pixels**, with **50 px** as the default. The slider and numeric field share these limits. Double-click the slider to reset to 50 px. Dot settings in older projects outside this range are brought to the nearest limit when opened, including per-slice overrides; values already within the range are retained.

### 6.5 Canvas viewing

- **Fit Canvas** scales the complete output uniformly into the viewport.
- **Actual 1:1** displays one output pixel as one display pixel.
- Mouse wheel zooms toward the pointer.
- Hold `Space` and left-drag, or middle-drag, to pan.

Fit Canvas is for composition overview. Actual 1:1 is the reliable mode for checking native pixel detail.

### 6.6 Transparent and black backgrounds

The default map background is transparent. Select **Black** when a solid background is required. Transparency is retained in PNG exports.

---

## 7. Resolume Pixel Map workspace

The Pixel Map navigation button uses the outlined Resolume Arena A to identify the Resolume mapping workspace.

### 7.1 Importing an Advanced Output XML

Without a Resolume map, Pixel Map displays the transparency checkerboard with **Import a Resolume XML map** centred in the viewport. Use **Tools → Advanced Output XML → Choose XML…** or **File → Open Demo** to populate it. The standalone test pattern appears only in Patterns mode.

Use one of two methods:

- **Choose XML:** load a specific Resolume Advanced Output XML file.
- **Link Resolume Map:** follow the latest selected Advanced Output preset and refresh when Resolume saves changes.

The linked workflow is available in the installed Windows application. Unlink the map when automatic refresh is no longer wanted.

### 7.2 Input and output maps

- **Input Map** shows slice crops inside the Resolume composition.
- **Output Map** shows the selected screen's output-device arrangement.

Output Map starts with the first available screen. Choose another screen under **Tools → Map Display → Screen**; switching to Input Map and back retains that choice. Input Map already includes all screens in the composition and needs no screen selector. Output Map displays one real screen at a time; use **Export → All Output Maps** to export every screen as a separate map.

**Pattern scope in 3D:** **Across Map** uses the full input composition as one pattern; each LED screen shows the portion at its input-map position. **Per Slice** restarts the pattern on each screen. This scope is retained during the test sequence and in Floating Preview for surfaces using the pattern source.

**Tools → Pattern Fill → Run test sequence** cycles through Cabinet Checker, Metric Grid, Cabinet IDs, Color Bars, Grayscale and Pixel Check every three seconds, starting after the current fill and looping. It works with Input and Output maps and retains **Per Slice / Across Map** scope. Load a map to enable the toggle. Switch it off to keep the current fill for inspection or export. The sequence continues between Pixel Map and 3D without restarting its three-second interval. In 3D, LED surfaces using the pattern source show the changing fills; other assigned media retain their source. With Floating Preview open, the map sequence also keeps running while editing in Patterns. Otherwise it pauses in Patterns and resumes on return to Pixel Map or 3D if still enabled. Turn it off in Pixel Map; its toggle is independent of the Patterns sequence. It changes the map's global fill, not its geometry or slice selection.

### 7.3 Pixel pitch and physical scale

Pixel pitch is the physical distance between LED pixels, in millimetres. LO2S - OpticMesh supports every finite positive pitch value.

Preset buttons—P1.2, P1.5, P1.9, P2.5, P2.6, P2.9, P3.9, P4.8, P5.9, and P10—are shortcuts only. They are not a closed list of supported products.

The effective physical size of a slice is calculated from:

```text
physical width  = slice pixel width  × pixel pitch
physical height = slice pixel height × pixel pitch
```

Set the correct pitch before opening or judging the 3D layout. Each slice can have its own pitch override; adaptive placement uses the effective pitch of each slice and does not force the project onto a fixed global scale.

### 7.4 Selecting slices

- Click a slice to select it.
- `Ctrl`-click or `Shift`-click to add or remove a slice.
- Drag a selection rectangle around slices.
- Hold `Ctrl` or `Shift` while marquee-selecting to add the new region to the existing selection.
- Use **Clear selection** to deselect everything.

When several selected slices share a value, that value is displayed normally. When values differ, the field shows a dash or **Multiple values**. Entering a new value applies it to every selected slice.

In **Pixel Map → Info**, the Name, Coordinates, Resolution, Aspect ratio and Physical size placement menus reflect all selected slices, including values inherited from global settings. A mixed selection displays **Multiple values**; choosing a placement applies it to the selection and immediately displays the chosen value. With no slices selected, these menus show the global settings. **Reset selected to global** restores the inherited placements.

### 7.5 Per-slice overrides

Selected slices can override global values such as:

- pixel pitch and cabinet size;
- pattern and checker colors;
- line width and overlay visibility;
- label contents, position, orientation, and scale;
- logo visibility, position, and scale.

Changing a global value clears the corresponding per-slice override so the selection returns to the new global state.

### 7.6 XML validation

The XML validation section reports:

- duplicate slice definitions;
- warped slices requiring advanced geometry handling;
- input or output geometry outside its canvas;
- valid geometry and map state.

Hover over or keyboard-focus a warning to see details naming the exact screen or slice involved. Validation reports the imported state; it does not modify the Resolume file.

### 7.7 Live test-pattern output

The Windows application can send the generated Resolume input-map pattern through:

- **NDI**, or
- **Spout**.

Only one output protocol is active at a time. Selecting NDI stops Spout; selecting Spout stops NDI. Pattern and Pixel Map output preserves its native raster dimensions and RGBA data.

In **3D**, NDI and Spout use a fixed **1920 × 1080** stream targeting **30 fps**, independent of the composition raster. The output camera uses a 16:9 frame without stretching scene geometry. The Output panel shows the stream dimensions. All Views output uses the Perspective camera; the four editing panes remain independently controllable. The viewport's refresh rate is independent of the stream rate.

3D output preserves the separation between screen faces and their backing at a distance and smooths object edges with antialiasing where supported. These improvements apply to all 3D sources without additional controls.

**Tip:** use the Output panel to check stream size. The 3D streaming limit does not change project dimensions, physical geometry, PNG maps, or compiled project exports. Actual streaming speed depends on scene complexity, hardware, and the receiver.

This output workflow is separate from receiving NDI or Spout as a texture in the 3D Simulation workspace.

---

## 8. 3D Simulation workspace

### 8.1 How the initial physical layout is built

Each Resolume slice becomes a separately selectable physical LED object. Its size and initial position are derived from its pixel geometry and effective pitch.

LO2S - OpticMesh chooses the central or most prominent screen as the automatic layout anchor and keeps that screen at `X = 0`. Other slices retain the Resolume map's relative layout while adapting to their own physical scale. The app does not assume one fixed pitch for the entire scene.

### 8.2 Viewport navigation

Switching to Pixel Map or Patterns and returning to 3D preserves the camera position and framing. Perspective and each Top, Right and Front view keep their own pan and zoom, including in All Views. Previous Fit Scene or Focus actions are not repeated when returning. Use **Fit Scene / F** or **Focus / S** when you want to change the framing. Opening a different project uses that project's saved camera; a new project starts with its default view.

The outline around the whole 3D viewport is a **keyboard-focus indicator**, separate from selected object edges and gizmos. It appears when you reach the viewport with **Tab/Shift+Tab** and clears when you click or drag inside it. Mouse interaction still activates viewport shortcuts such as **Ctrl+A**; using E/R/T or returning from a field does not add an outline.

| Action | Control |
|---|---|
| Orbit camera | Left-drag empty viewport space |
| Pan camera | Right-drag |
| Zoom toward pointer | Mouse wheel |
| Fit all scene objects and straighten the horizon | **Fit Scene** or `F` over the viewport |
| Frame selection | **Focus** above the viewport, or `S` over the viewport |
| Reveal selection in the list | **Focus** in the hierarchy actions, or `S` while hovering or focused in Scene Hierarchy |
| Select object | Click a screen |
| Toggle object in selection | `Ctrl`-click or `Shift`-click |
| Add objects with marquee | `Ctrl`-drag empty viewport space |

Camera state is saved with the project.

Selected imported models and parts show a thin, muted silhouette around their visible selection. Internal polygon edges and seams between touching selected parts are not highlighted, so materials remain readable while editing. Selecting a group outlines the combined visible shape of its mesh descendants. The highlight follows transforms and clears when deselected, hidden or removed. These editing highlights are excluded from Floating Preview, NDI/Spout output and scene exports.

Selected items have a highlighted, bold hierarchy row. Ancestor groups show a subtler highlight and bold name, including when collapsed, so you can trace the selection without selecting those groups. To find a selected item, hover over Scene Hierarchy and press **S**, or click its **Focus** button. This clears the hierarchy search, expands the selected paths and scrolls to the selected row; with multiple items selected, it reveals the last selected model item, group or slice in that order. Camera framing stays unchanged. Press **S** over the viewport to frame the selection instead. Search and rename fields keep S as text.

### 8.3 Transform tools

- **Snap:** toggle 1 m world-grid snapping for Move gizmos. The dragged slice pivot, group pivot, or shared multi-selection pivot snaps on the world axes being moved; spacing within the selection is preserved. It works in single view and All Views, even with Grid and Floor hidden. The floor wireframe is 1 × 1 m on X/Z; vertical moves snap to 1 m height increments. Snap is off in new/older projects and is saved with the project. Numeric coordinate entry remains exact; rotation and scaling are unaffected.
- **Move:** translates slices or groups.
- **Rotate:** rotates slices or groups around their active pivot or group axis.
- **Scale:** scales the current selection.
- **Local:** aligns the gizmo to the selected object's local axes.
- **World:** aligns the gizmo to world axes.

Position values are stored in metres. Rotation values are displayed in degrees and are not restricted to ±90° or one revolution. Values such as `120`, `-270`, or `450` are valid.

Hold `Shift` while dragging the rotation gizmo to snap in 5° increments. Numeric entry always remains exact and is not quantized. Hold `Shift` while dragging a scale handle to apply the same relative scale factor on X/Y/Z, preserving the initial proportions. You can press or release Shift during the drag. This works for individual objects, multi-selection and groups in single view or All Views; one drag creates one undo step.

In the **Scene** inspector, **Coordinate System** selects Local or World orientation for the transform gizmo. **Coordinates** contains the Position, Rotation, and Scale fields. **Pivot** comes immediately after Coordinates, followed by **Align Centres**, **Distribute Centres**, and **Scene Display**.

Use **Scene → Align centres** or **Distribute centres** in the right inspector, then choose an axis to apply the operation. Align requires at least two selected slices; Distribute requires at least three. These controls are available directly in the inspector without duplicate shortcuts in the left Tools panel.

**Tip:** use Coordinates for exact numeric edits, set the pivot below it, then use the alignment and distribution controls to arrange the selection.

The 3D viewport toolbar uses icons: four-way arrows for **Move (E)**, a circular arrow for **Rotate (R)**, diagonal arrows for **Scale (T)**, a magnet for **Snap**, axes for **Local**, and a globe for **World**. Hover over an icon for its name and available shortcut. Active icons stay highlighted. The labelled Local/World controls also remain in **Scene → Coordinate System**.

### Transfer position and orientation

Select one unlocked LED slice, imported mesh, imported model root or editable group, then choose **Tools → Arrange → Transfer**. A transfer cursor appears over the viewport. Click a different visible slice or imported object to match its geometric centre and orientation. This also works in All Views. To move several items together, group them first; a mixed group transfers as one assembly.

Transfer compensates for the source and target pivots internally. A bottom-centre slice can align with a centred imported object without changing either pivot. Geometric centre means the centre of the geometry bounds in the object's oriented frame, including extrusion; it is not a surface attachment point. Size, proportions, materials, LED mapping and hierarchy remain unchanged. The target stays unchanged and may be locked. A source containing locked items cannot be transferred.

**Escape** or clicking Transfer again cancels target picking. Clicking empty space or the source itself keeps the tool ready for a valid target. Changing selection, workspace or transform tool cancels picking. A completed transfer exits the tool and creates one **Undo/Redo** action; the resulting placement is saved with the project.

Orientation follows the target object's coordinate axes. Geometry exported with rotations baked into its vertices may have axes that differ from the visible screen face. Transfer does not infer face normals, resize the slice or establish a live attachment to the target.

### 8.4 Pivots

The pivot editor combines **Mode**, manual **Pivot (m)** XYZ values, and a draggable XY pad.

- Choose any of the nine anchors: top/centre/bottom × left/centre/right. **Bottom centre** is the default.
- Drag the pad’s marker to preview the nearest anchor and release to apply it. Clicking a point also works. A drag creates one undo step.
- Enter an X, Y, or Z value to switch to **Custom**, or choose Custom in Mode to retain the current coordinates. Values are metres from the unscaled screen centre: +X right, +Y up, +Z toward the emitting face. The pad shows XY; use the fields for depth or positions beyond the screen bounds. Off-screen XY markers are shown at the pad edge.
- With the pad focused, arrow keys move between anchors and Home chooses Centre. Escape cancels an active drag. Presets/pad snaps set Z to zero.
- Numeric fields support arithmetic, wheel adjustments, and Shift+wheel for larger steps. Press Enter to commit. For mixed selections, editing one axis preserves each screen’s other axes.

The editor applies to selected unlocked slices, screen groups, imported models and imported parts. With no selection, Mode, the XY pad and XYZ values are greyed out and cannot change any slice or the default pivot. Selecting one or multiple unlocked items enables the editor; an entirely locked selection remains disabled. Named anchors adapt to each screen’s dimensions; Custom uses absolute local metre offsets. Changing a pivot keeps the visible screen in place, including curved, rotated, or scaled screens. Coordinates may change because they track the new pivot. Undo/redo, project saving, and exports retain the pivot.

**Tip:** select a group to edit its shared pivot, or select its individual members to edit their own pivots. Choose a named anchor or use Custom for an exact measured offset.

screen groups and imported model items use the same nine-position pad and custom XYZ controls. Offsets are measured from the combined bounds centre along the selected item’s axes. Screen-group offsets use the group’s local metre coordinates; imported-model offsets are shown in metres after source-unit conversion. Presets choose the current bounds and zero the depth offset. Repositioning a pivot preserves all visible geometry and nested child placement. Imported model Coordinates and the viewport gizmo use each item’s pivot for rotation and scaling. Multiple selected model items use a shared gizmo at the average of their pivots, counting selected parents only once. Pivot choices are saved with the project and support Undo/Redo.

### 8.5 Extrusion depth

Extrusion creates physical depth behind the LED surface. Depth is stored in metres and shown in the interface in practical units where applicable.

Very deep extrusion can intersect tight curvature. LO2S - OpticMesh blocks an invalid 3D export when the requested depth reaches or exceeds the available curvature radius.

### 8.6 Curvature

Slices support:

- horizontal curvature from `-360°` to `+360°`; or
- vertical curvature from `-360°` to `+360°`.

Horizontal and vertical curvature are mutually exclusive for one slice. Applying a non-zero value on one axis resets or locks the other axis. Full ±360° curvature closes the cylinder seam.

Use the displayed radius to check the curved screen’s physical dimensions.

### 8.7 Scene appearance

**Scene Display** is the last section in the **Scene** inspector and is also available below View in the left 3D **Tools** panel. Floor, Grid, and Background brightness are synchronized between both locations.

**Tip:** search the left tools for “Scene display”, “Floor”, “Grid”, or “Brightness” to reach these controls quickly. Double-click the brightness slider to reset it to 100%.

The current scene appearance controls include:

- floor visibility;
- one-metre world grid visibility;
- background brightness;
- pattern, video, NDI, or Spout textures;
- interactive geometry preview for responsive curve/extrusion editing.

Floor, grid, camera, and gizmos are viewport aids and are excluded from 3D scene exports.

### 8.8 Undo and redo

The 3D workflow keeps up to 100 history steps. A completed gizmo drag is treated as one history operation. Undo and Redo are available in the top bar and through keyboard shortcuts.

---

Hidden visibility and locked controls use the same highlighted treatment; normal visible and unlocked controls stay muted. The crossed-out eye and closed padlock identify their active states, and the open padlock indicates an unlocked item.

### SpaceMouse navigation (Windows)

With 3Dconnexion 3DxWare installed and a SpaceMouse connected, use the main 3D viewport to pan, zoom and orbit with the device. The regular mouse remains available for navigation, selection and editing. Select a model, group or LED slice to keep its centre as the rotation reference in Object mode. Clearing the selection restores automatic rotation-centre behaviour. SpaceMouse navigation changes the camera only; it does not move or rotate scene objects. In Top, Front and Right views, SpaceMouse pans and zooms without rotating the view. In All Views, move the pointer over the pane you want to navigate.

SpaceMouse navigation stops while the main viewport is paused, another workspace or application is active, or a dialog or text field has focus. It is not enabled in Floating Preview or Technical Plots. Open **Tools → 3Dconnexion Settings…** in the Windows 3D workspace to adjust device sensitivity, axis direction and navigation preferences.

3D input device development tools and related technology are provided under license from 3Dconnexion. © 3Dconnexion 1992 - 2025. All rights reserved.

## 9. Technical Plots

Use **Resolume Pixel Map → 3D Simulation → Technical Plots** to prepare a delivery set. First check the map, pixel pitch and panel dimensions, then arrange the screens correctly in 3D. The plots describe that project; they cannot correct missing or inaccurate physical information.

Open **Plots** below 3D in the mode rail. The left panel manages sheets, templates and the project title block. The right inspector edits the sheet and selected frame. The centre shows the page that will be delivered, with temporary editing controls when needed.

Every page is **A3 landscape, 420 × 297 mm**. **Fit sheet** and the zoom selector change only your viewing size. The paper dimensions remain fixed. Patterns is a separate supporting mode for test images; a plot is the documentation you send with them.

### 9.1 Choose sheets and content

Start with **Pixel mapping set**, or use **Add sheet** to build your own set.

| Sheet | Use it for |
|---|---|
| Input map | Slice locations within the Resolume composition, with input coordinates and dimensions. |
| Output map | Slice locations on one selected output screen, with output coordinates and dimensions. |
| Stage views | Front, Top, side and isometric views of the physical arrangement. |
| Screen detail | One slice's raster, physical size, pixel pitch and panel grid. |
| Screen Specifications | A reference table for the slices, including pitch, panel sizes and map coordinates. |
| Delivery notes | Content instructions or production notes. |
| Blank sheet | A page you populate with your own frames. |

A **sheet** is one layout in the left list; a **frame** is a content area on that sheet. You can mix frame types on a page. Select a sheet to work on it and edit **Sheet title** in the inspector. Drag sheet rows above or below one another; the insertion line marks their new position. Sheets cannot be grouped or nested. **Duplicate** copies a sheet; **Remove** removes it. Undo restores an accidental removal.

### 9.2 Place, resize and align frames

1. Choose a sheet, then select a content type in **Add frame**.
2. Move the outline over the paper. A new frame starts at **180 × 100 mm**; click to place it or press **Escape** to cancel.
3. Turn on **Edit layout** to select and drag frames. The right inspector also lists each frame by title.
4. Drag the selected frame's **bottom-right handle** to resize it. Its top-left corner stays in place. Enter exact X, Y, Width or Height values in millimetres when needed.
5. Choose **Finish layout** to review the page without the editing overlays.

Under **Page layout**, enable **Snap to grid** and set **Grid spacing** in millimetres. Frame placement, movement and resizing snap to this grid. Nearby edges, centres and equal spacing between frames also provide snap targets, with temporary alignment lines and gap measurements. These guides, selection borders and resize handles never print. Text frames omit the coloured editing title so it cannot cover the note.

### 9.3 Copy frames

Select a frame and press **Ctrl+D**, or choose **Duplicate frame**. The copy retains its size, title, content choices, typography, camera and framing. It is placed beside the original when space allows. If no neighbouring space is free, click on the sheet to place the copy or press Escape to cancel.

In **Edit layout**, hold **Alt** before dragging to place a copy yourself. The same grid and alignment guides apply. Each copy is independent: for example, duplicate a Screen detail frame and choose another **Screen slice** without changing the original. Each duplication is one Undo step. Ctrl+D does not duplicate frames while you are typing in a field.

### 9.4 Templates and branding

A template stores your sheet layout, frame settings and branding for reuse. Enter **Template title**, then choose **Save template to library**. Choosing a saved preset fills this field with that preset's name. Keep the name to update that library entry, or enter a new name to save a separate template. **Import** and **Export** exchange template files with another computer.

Applying a template replaces the current plot layout; Undo restores it. Templates do not contain the imported stage model or Resolume map. After applying one to another project, review every **Output screen** and **Screen slice** choice, since those bindings follow their position in the project's lists.

Use **Project title block → Add your logo…** for a PNG or JPG logo. Fill in the project title, company, author, revision, date and footer note. An empty logo area stays blank; OpticMesh does not add advertising to the printed page. The footer note accepts spaces and line breaks and wraps on the paper. Drag the bottom of its input box downwards for more writing room; this does not enlarge the printed footer.

Save the `.lo2s` project to keep the layout and title block with the scene. A template is a reusable layout, not a replacement for saving the project.

### 9.5 Input and output maps

Input maps use the composition's **top-left origin**. Output maps use the selected output screen's **top-left origin**; choose **Output screen** in Frame settings. Add or duplicate an Output frame for each output you need to document.

Every slice is identified by its name and ID, the corresponding X/Y origin in pixels, pixel width and height, and physical width and height in metres. Screen IDs follow imported Resolume screen order, then slice order within each screen. The same IDs connect the maps to the specification table.

Labels wrap inside a slice when space permits. Small, overlapping or warped slices may use matching numbered callouts below the map. Review these at a comfortable page zoom before exporting. If labels cannot fit, enlarge the frame or reduce **Frame text size**. Map coordinates and raster sizes come from Resolume; verify pitch and panel geometry in Pixel Map to get meaningful physical dimensions. Do not measure metres from the printed pixel-map layout.

### 9.6 Screen details and specifications

A **Screen detail** frame shows the selected slice's raster and aspect ratio, nominal and effective pitch, surface size, panel dimensions in millimetres, and pixels per panel. Choose the slice under **Frame settings → Screen slice**. Its checker cells follow the configured panel grid, including per-slice overrides. For example, a 500 × 500 mm cabinet using 128 × 128 pixels has an effective pitch of 3.90625 mm. Partial panels remain partial at the screen edges.

Dimension labels sit outside the grid, with space before the panel note and frame border. Enlarge the frame or reduce its text size if the measurements cannot fit. Use the PNG exports in Patterns or Pixel Map for pixel-accurate test images; the grid on an A3 sheet is a reference drawing.

**Screen Specifications** lists all slices with raster, aspect ratio, nominal/effective pitch, physical size, panel dimensions and raster, input origins and output coordinates. Physical size describes the screen surface, not its projected width in a stage view.

Long specification tables continue onto additional printed pages automatically. Their number depends on the frame size, text size and slice count. The left list keeps the original sheet; use the continuation-page selector above the paper to inspect the extra pages. PDF and print include them automatically. Other frames on the specification sheet repeat on each continuation, so keep that layout simple.

### 9.7 Camera views and framing

Choose **Front, Back, Left, Right, Top, Bottom**, or an upper/lower **isometric** view. These are parallel views. Choose **Neutral shaded** or **Wireframe**, and whether to **Include imported models**. New frames use the camera name as their title. Change **Title** to give one a custom name.

Changing a camera, render style or framing refreshes that view automatically. **Refresh views** updates the scene views from the current project. Export also updates outdated views before creating the pages. The main 3D camera stays unchanged.

Use **Adjust view framing** to drag the composition inside its frame and scroll to zoom. A responsive preview follows the gesture; the sharp image updates when you stop. **View zoom** and **View pan X/Y** provide numeric control. **Fit view** resets the composition. Choose **Finish framing** or press Escape when done.

Changing **Camera view** fits the new angle and resets that frame's zoom and pan. It keeps the frame's position and dimensions. Scene views are labelled **Not to scale** because you can freely zoom and frame them; use the stated dimensions, not measurements taken from the printed image.

### 9.8 Text and typography

Choose the paper font and text size under **Page layout**. Changing the page text size also updates its frames; use **Frame text size** afterwards to adjust an individual frame. Check the final page after changing typography, since larger text can need more space.

Selecting a text frame reveals **Text formatting** with **Bold, Italic, Underline**, and **Left/Centre/Right** alignment. These controls apply to the entire note body, not individual selected words. They leave other frame types and the frame title unchanged. Text formatting is retained when saving, duplicating, exporting PDF or printing.

Enter note content in **Text**, using Enter for a new line. Keep delivery instructions concise and check that they fit inside the frame. The bottom title-block **Footer note** is separate from a text frame and is intended for short notes.

### 9.9 PDF and print

With Plots active, choose **Export → Export A3 PDF…** for the complete sheet set, including specification continuations. Select a filename and destination. Editing guides and application controls are excluded. Review any amber notification before retrying a blocked export.

**Export → Print…** opens OpticMesh's page preview. Browse with the arrows, choose an installed printer, select all sheets or the current preview sheet, and set the number of copies. **Export PDF** is also available here. Pages remain A3 landscape; the printer and paper settings must support that size.

Before issuing a set, check the project title and revision, correct input/output screen choices, every slice label, panel sizes and pitch, useful camera framing, and note legibility. Save the `.lo2s` project alongside the final PDF. **Compile Project** includes the editable plot layout in the project file; export the PDF separately when you need a finished document in the delivery folder.

---

## 10. Scene hierarchy and grouping

Hierarchy icons distinguish the item types: a **monitor** represents a Resolume screen, an **outlined cube** represents an editable slice/object, and the **group symbol** represents a group. Grouped slices keep their object icon.

### 10.1 Hierarchy objects

The hierarchy can contain:

- Resolume screen containers and their original slices;
- imported models and mesh parts;
- editable groups containing slices, models or both;
- nested editable subgroups.

Moving, rotating or scaling a group also moves its children. You can still select and adjust a child within that group. Resolume screen containers accept only their own original slices; imported models belong in editable groups.

### 10.2 Selecting groups

- Click a group to select it.
- `Ctrl`-click toggles individual groups in a multi-group selection.
- `Shift`-click selects a continuous range in hierarchy order.
- Selected groups share the transform gizmo and collective actions.

If a selected parent and one of its selected descendants are transformed together, only the highest selected parent receives the transform. This prevents the descendant from moving twice.

**Imported-model range selection:** click the first item, scroll to the last and Shift-click it to select every model row in between. Scrolling and switching inspector tabs retain the anchor. Ctrl-click toggles one item; Ctrl+Shift-click adds a range. Expand any branches whose children you want included before selecting the range.

### 10.3 Creating a group

1. Select one or more ungrouped slices.
2. Choose **Group**.
3. A new parent group is created around the combined geometry centre.
4. The slices are converted to local child transforms without changing their visible world placement.

### 10.4 Renaming

Double-click a group name to rename it. Press `Enter` to accept the edit or `Escape` to leave editing. A single click selects the group; it does not begin renaming.

### 10.5 Reordering and reparenting

Drag directly in the hierarchy:

- drop before or after a group to reorder it;
- drop inside a group to create a child relationship;
- drag a slice into a group;
- reorder slices among group children;
- drag a slice or group to **Move to scene root**;
- drag groups into other groups to create subgroups.

Reparenting converts transforms so the object does not visibly jump in world space.

### 10.6 Collapse and expand

All groups use the same four-square icon, whether they contain screen slices or imported model parts. Use the separate disclosure arrow beside a group to collapse or expand its children. The expanded state is saved in the project. Searching the hierarchy temporarily reveals matching descendants.

### 10.7 Visibility and locking

- The eye control shows or hides an object in the 3D scene.
- The lock control enables or prevents editing.
- Parent visibility and locking are inherited by descendants.
- When multiple groups are selected, clicking the visibility or lock control on one selected group applies that state to every selected group.
- When multiple slices are selected, clicking a slice visibility or lock control applies the state to the selected slices.

### 10.8 Ungrouping

Choose **Ungroup** to dissolve selected groups while preserving world placement. direct Resolume slice children return to their original screen containers, retaining their current position, rotation and scale. Surviving nested editable groups and imported items retain a valid scene parent.

---

### Stage model import

In **3D → Tools → 3D Models**, choose **Import Model…**. Use **Choose files** for a model and its companion files, or **Choose folder** to retain asset-folder paths. The left side contains the main-model selector, scale/orientation and hierarchy controls. Press **Read model** to inspect the larger preview on the right, with separate Width (X), Height (Y), Depth (Z), mesh and triangle readouts. **Cancel** and **Import into scene** stay in the bottom action bar. Supported formats are available in an expandable list. Cancelling the file or folder picker returns to this dialog, keeping any prepared preview and settings. You can then choose a different file or folder. The dialog’s **Cancel** or **×** button, or Escape while the dialog is active, closes the import without changing the scene.

Before importing, inspect the preview and resulting dimensions. Set **Source units** to mm, cm or metres and select Y-up or Z-up. Formats with built-in unit conversion expose their decoded units in this dialog. Use the dimension readout to confirm the intended physical size. The source origin is retained.

**MVR scale and orientation are automatic.** MVR scene coordinates and embedded 3DS geometry use millimetres internally; embedded glTF geometry is converted according to its own convention. OpticMesh handles these conversions and shows final dimensions in metres. The authoring application's displayed units do not change MVR's coordinate convention, so no manual source-unit or up-axis choice is required for MVR.

OBJ and STL do not reliably declare physical units, so **Source units must be chosen explicitly** before import. A centimetre-based model interpreted as metres becomes 100 times too large; fitting it can move the camera beyond the floor/grid area and make LED screens appear tiny. Correct the import units rather than changing the scene display settings.

**Polygon conversion:** Imported surfaces are represented as triangles for rendering. Quads and larger polygons may be split by the format loader; this is not polygon reduction. Different splits of non-planar faces, unsupported subdivision surfaces or differences in surface normals can change the appearance. FBX curved extrusions with matching translated contours are split along their existing segments to preserve the curved surface. Other polygon layouts use the format loader. Inspect curved and concave surfaces in the import preview. Reimport a model to apply importer corrections; previously saved geometry is not rewritten automatically. Where an exporter supports it, exporting an evaluated triangle mesh with normals can give the source application control over the split. Original files are not modified.

Review import warnings before confirming. Invalid surface normals are regenerated and invalid UV coordinates are omitted without changing valid vertex positions. If a vertex position or object transform is invalid, import stops and identifies the affected item; check that item in the source application before exporting again.

**Import model hierarchy** is enabled initially. It preserves supported object boundaries and nested groups beneath a dedicated **3D Model — filename** root in Scene Hierarchy. Turn it off to select and move the imported model as one item. A single selectable item retains the underlying mesh detail; it is not polygon reduction. Switching this option keeps the preview and its camera view unchanged; the choice is applied when importing into the scene.

Open the **Scene** inspector tab to find imported models inside the main hierarchy below the screen groups. Import clears the hierarchy search and reveals the new model selection.

Long model and part names are shortened with an ellipsis in the hierarchy and inspector. Hover over a shortened name to see its complete value. Selecting a long name keeps the panel and viewport widths unchanged.

Screens and imported models use the same hierarchy row layout, selection highlight, eye visibility controls and open/closed lock icons. Use the disclosure arrow to expand a model or group; mesh parts use the shared object icon. Visibility and lock actions do not change the current selection. Screens and imported models share one hierarchy scrollbar. Expanded model branches remain available in that same scrolling area.

| Import format | Scope and limits |
| --- | --- |
| MVR 1.4 / 1.5 / 1.6 | Scene mesh resources, transforms, symbols and their supporting groups/layers. Lighting-fixture definitions, patch addresses, focus points and empty metadata branches are excluded. Embedded GDTF definitions are not expanded; standalone GDTF remains a separate static-geometry import. |
| GDTF 1.1 / 1.2 | Static physical device geometry and component hierarchy. Some predefined shapes use dimensioned box placeholders. Beams, DMX response and fixture simulation are excluded. |
| glTF 2.0 / GLB | Static mesh scenes and hierarchy. Include companion buffers where required. Assets requiring an unavailable compression decoder or extension cannot be imported. |
| FBX | Supported ASCII 7.0+ and binary 6400+ mesh scenes. Verify units and placement in the preview. Skinned meshes use a static pose. Source cameras and lights are excluded; their presence does not prevent mesh import. Source image textures are not imported. |
| OBJ | Meshes and named object/group boundaries; original nested assemblies may not be represented. |
| 3DS | Mesh geometry and names. Legacy keyframer hierarchy is not preserved. |
| COLLADA / DAE | Supported static meshes and scene hierarchy, with source unit/axis conversion. |
| STL | Triangle geometry; source units and meaningful object hierarchy may be absent. |
| USD / USDA / USDC / USDZ | Experimental static geometry support. Advanced composition, references, animation and materials may not be reproduced. |

Expanded and collapsed model branches stay as you left them when switching between Scene, Geometry and Source. This is workspace UI state; opening another project starts with its model hierarchy collapsed.

### Imported-model materials

All imported models initially use subdued **neutral shading**. Source textures, lights and animation are excluded. Select a model, group or part and open **Material** in the bottom panel, before Validation. This tab appears only in 3D mode. **Display** offers **Shaded**, **Wireframe**, or **Inherit**. A part inherits its closest parent display setting unless overridden, including through shared groups containing LED slices and imported models. This affects the stage reference only; LED screen content remains unchanged. Wireframe draws the mesh's triangle edges as thin GPU lines, not a texture or strips of polygon geometry. Triangle diagonals are visible; this display mode is separate from the selection silhouette. **Diffuse colour** sets line colour and **Diffuse intensity** sets brightness. Wireframe lines are unlit and receive no HDR reflections. Metallic, Roughness and Specular apply only to shaded surfaces; these controls are disabled when the selected items use wireframe, and their stored values return on switching to Shaded. Inheritance, multi-selection and Undo work for line colour. LED extrusion wireframes use the same colour/intensity controls while display faces retain their content. Wireframe improves technical readability but does not guarantee faster rendering.

**Material controls**

| Control | Effect |
| --- | --- |
| Material: Inherit / Custom | Follow the closest parent material or use an independent material. Editing a value creates a Custom override; choosing Inherit restores the parent appearance. |
| Diffuse colour | Base surface colour. |
| Diffuse intensity | Strength of the base colour, from 0–100%. |
| Metallic | Blend from a non-metal surface to a metal surface. Higher values reduce diffuse lighting and tint metallic highlights with the base colour. |
| Roughness | Low values give tight highlights; high values spread and soften them. |
| Specular | Strength of non-metal light highlights. Its influence decreases as Metallic approaches 100%. |

Changes preview live and support Undo/Redo and project saving. Colour dragging uses one Undo action per gesture; the final colour is applied when editing ends. Multiple selections show common values or **Multiple values**; edits apply to selected unlocked items. Double-click a slider to reset its built-in default: Diffuse 100%, Metallic 5%, Roughness 82%, Specular 100%. Locked or empty selections cannot be edited. Shading settings are retained while Wireframe is active.

**Tip:** start with a low Metallic value and moderate Roughness for readable stage reference geometry. The selected HDRI supplies reflections that help make smooth metallic surfaces readable. It applies only to imported-model materials and LED extrusions: it never appears in the background or changes the floor or LED display faces. It does not reflect live LED imagery or the actual stage. Normal maps, displacement and dynamic reflections are not part of these controls. Material appearance is included in GLB/glTF and their MVR mesh resources; OBJ and USDZ use the material properties supported by those formats, so their appearance can differ. STL contains geometry only.

### Editing imported models

Use **Scene → Coordinates** or the viewport gizmo to position selected model items. Screens, screen groups and imported model items share the same Coordinates controls and appearance. All support arithmetic expressions, 0.1 wheel/step adjustments, 0.5 adjustments with Shift, and live position/rotation/scale updates while dragging. Focused numeric fields prevent the inspector from scrolling. Differing selected values show an em dash; an absolute coordinate edit applies to each selected item while preserving its other axes. E/R/T select Move/Rotate/Scale; S frames the model selection over the viewport or reveals it over the hierarchy; F fits visible scene content. In the hierarchy, Ctrl-click toggles individual model items and Shift-click selects the continuous range from the anchor row to the clicked row. Ctrl+Shift-click adds that range to the existing selection. Ranges follow the displayed imported-model row order across imports and shared groups, including offscreen rows; collapsed children and search-filtered rows are excluded. Repeated Shift-clicks extend or shrink the range from the same anchor. In the viewport, Ctrl/Shift-click continues toggling individual meshes. Ctrl-drag a box in the viewport to add visible model parts; with hierarchy import disabled, it selects whole imported models. Box selection also works within each All Views pane. It extends the active selection type (models or screens); when nothing is selected, visible model hits take priority over screen hits. Click empty space to clear selection before switching types. With an imported model selected and the viewport focused, Ctrl+A selects imported model roots; otherwise it selects screen slices. Ctrl-click LED slice and imported-model rows to build a mixed selection, then use **Group** or **Ctrl+G** to create one group. Groups can contain LED slices, imported parts and nested groups. Group/Ungroup preserve world placement. Arbitrary mesh segmentation is not available.

**Resolume screen containers are source-owned.** A screen header (monitor icon) contains only slices belonging to that screen in the XML. Imported objects and editable groups cannot be placed inside it, and a slice cannot be reassigned to a different Resolume screen. Slices may join editable scene groups, including mixed groups, while retaining their original source ownership. Drag a grouped slice back onto its original screen header or use **Return to original screen**. Screen headers remain visible even when all their slices are grouped elsewhere. Removing or ungrouping editable containers never deletes Resolume slices or changes their source mapping.

Drag a model part, imported root or group onto a group to change its parent. Drop near the top or bottom of a model row to reorder siblings; drop onto **Move to scene root** to detach an imported item or group. A Resolume slice uses **Return to original screen**. LED slices can also be dropped into imported-model groups. Their necessary parent groups join the shared hierarchy, preserving names, nested structure, geometry placement and material appearance. Locked branches and parent cycles are protected.

Double-click an imported item or group name to rename it. **Enter** or clicking outside commits the name; **Escape** cancels. Blank names are ignored. Rename, grouping and parenting support Undo/Redo and project saving. A mixed group moves, rotates and scales its LED slices and imported geometry together; the Coordinates fields update while dragging. Its pivot uses their combined bounds. Group visibility and locks apply to both kinds of content. **Delete** or **Remove selected groups** removes the selected editable group branch and its removable imported contents. Resolume slices return to their original screen containers with their current position, rotation and scale preserved; their XML links and IDs remain intact. Directly selected Resolume slices cannot be deleted. GLB/glTF retain shared group parents; mesh-only export formats retain world placement.

Model visibility and locks appear in the hierarchy. Remove selected model items from their inspector. Import, edits, grouping and removal support Undo/Redo. All Views, Floating Preview and 3D streaming display imported geometry; the Floating Preview remains camera-only.

Deleting the last selected model item clears the viewport gizmo immediately.

Removing a model-only group removes its imported descendants. Locked items and groups containing locked descendants are protected. Undo restores removed items and their geometry.

In 3D mode, **Delete** removes selected imported models, groups or parts. It never deletes screens or Resolume slices. The shortcut is inactive while editing a field, using a menu/dialog, or interacting with the camera-only Floating Preview. Use **Ctrl+Z** to undo removal.

### Imported-model storage and limits

Imported geometry is saved inside the project, so reopening does not depend on the original model file. Use v0.9.0 or later to retain both imported models and Technical Plots; keep a separate copy before working with older releases. Compile Project includes the imported geometry in the project file when a Resolume map is present. Source texture files, animation and other application-specific editing features are not retained.

There is no polygon-count gate. Selected/expanded file data has a 512 MiB import working budget; compressed embedded model data is limited to 150 MiB in total across all imported models, within a 192 MiB desktop project limit. The remaining space accommodates the Resolume XML, logos and project settings. Actual memory use can exceed file size. For heavy files, export only the stage geometry needed for screen alignment. Polygon reduction is not part of this version.

### LED extrusion materials

Select LED slices or a screen group and open **Material** in the bottom panel. The same colour, diffuse intensity, metallic, roughness, specular and Display controls affect only the sides and back of the extrusion. LED display faces retain their source imagery, brightness and texture.

A slice inherits the closest parent-group material/display unless overridden. In a mixed group, group material edits reach both inheriting imported model surfaces and LED extrusions. Explicit child overrides take priority; set **Material** or **Display** to **Inherit** to restore that property's parent setting. Inheritance remains live through nested groups and saved projects. A group edit changes its inherited children together; multiple selections show common or mixed values. **Material → Inherit** removes a custom override. Empty and locked selections cannot be edited. Undo/Redo, project saving and supported scene exports retain extrusion materials. Double-click defaults are Diffuse 100%, Metallic 28%, Roughness 78% and Specular 100%, with the original dark extrusion colour as the inherited default.

The reflection environment is a viewport aid and is not bundled with scene exports. Receiving applications supply their own reflection environment. Use the current OpticMesh version when exchanging projects with material overrides or Technical Plots.

In **Scene Display**, choose **HDRI1**, **HDRI2** or **HDRI3** to compare reflection looks. The three buttons appear side by side in both the left Tools panel and the Scene inspector; either row changes the same setting. The chosen look also updates Floating Preview, is saved with the project, and supports Undo/Redo. New projects start with **HDRI1**. **Tip:** lower Roughness to reveal reflection detail, or raise it for a softer surface. These fixed environments affect shaded imported models and LED extrusions; they do not change the background, floor, wireframes or LED display content, and do not reflect live imagery or moving scene objects. The HDRI files are not embedded in projects or scene exports.

### Imported-model transform reset

**Reset transform** in Coordinates restores the recorded transform baseline while retaining the chosen pivot. New imports record their initial placement; model items from older projects without a recorded baseline use their placement before their first edit. Descendant reset baselines follow parent transformations. Reset and numeric edits respect locks and support Undo/Redo.

## 11. Live sources and routing

### 11.1 Global sources

The 3D Simulation can use:

| Source | Description |
|---|---|
| **Pattern Generator** | Uses the current LO2S - OpticMesh test pattern at native quality. |
| **Video Devices** | Uses a webcam, capture device, or another available camera source. |
| **NDI** | Discovers and receives an NDI source through the Windows native bridge. |
| **Spout** | Discovers and receives a local Spout sender through the Windows native bridge. |

NDI and Spout are desktop-only features.

**On startup:** Opening a project or restoring the latest session starts all LED slices on **Pattern Generator**, with per-slice source routing reset to **Inherit global source**. The 3D inspector opens on **Scene**. To resume a live preview, open **Source**, select the global feed, then choose and connect the sender or device. Reapply individual slice routing where needed. Source quality, scene geometry and materials remain saved.

When a selected live feed has no connected image, its LED display faces show solid black. Connected images retain their normal colours; this does not change the scene background or extrusion materials.

### 11.2 Source quality

- **Low Latency** prioritizes responsiveness and a latest-frame workflow.
- **High Quality** prioritizes source detail and may require more decoding, transfer, and GPU resources.

Use Low Latency while arranging complex scenes. Switch to High Quality when inspecting texture detail or creating a final visual review.

### 11.3 Per-slice source overrides

Selected slices can:

- inherit the global source;
- use Pattern Generator;
- use a full video-device source;
- use a full NDI source;
- use a full Spout source.

If selected slices have different source routing, the inspector displays a mixed state. **Reset selected routing** returns the selection to the global source.

### 11.4 Performance status

Open **Performance** below the viewport for live measurements. The panel contains readings and their status labels; the colour key, measurement guidance and troubleshooting tips are documented here. The panel refreshes twice per second and can be collapsed with the diagnostic-bar chevron. At smaller window sizes, scroll the panel to see all metrics.

| Metric | Meaning |
| --- | --- |
| UI FPS | Interface responsiveness while the panel is visible. It stays active when the scene is idle and differs from viewport or video-output FPS. |
| UI frame · peak | Longest interface frame time in the last second. Repeated spikes can correspond to visible stutters. |
| CPU · app | Combined Electron-process CPU usage, normalized across all logical processors. Requires desktop; external NDI/Spout helper processes are excluded. The first reading needs a sampling baseline. |
| CPU · system | Whole-machine CPU usage, including other applications and external helpers. Requires desktop. |
| App memory · private | Combined private committed memory of Electron processes on Windows. This is not exclusively resident RAM and does not include external helpers or VRAM. |
| RAM · system | Physical RAM used / total for the whole machine. Requires desktop. |
| GPU / VRAM | Per-device NVIDIA GPU utilization and dedicated memory used / total, including all applications. Requires the desktop app and supported NVIDIA driver telemetry; unavailable readings are not reported as zero. |
| Viewport redraws / s | Actual viewport redraws per second, measured over the last second. A still scene displays **Idle** because no redraw is needed; a hidden window or manually paused main viewport displays **Paused**. This is separate from monitor refresh rate and incoming video FPS. |
| CPU render · avg / peak | Average and slowest CPU time spent drawing the viewport during the last second. Higher values mean more drawing work. |
| Last CPU draw | Most recent draw duration, retained while idle. |
| Last GPU draw | Latest measured GPU drawing time across visible 3D panes. Not available on every system or for the 2D canvas. |
| Render size | Actual 3D drawing-buffer dimensions or 2D preview raster. An interactive working raster can differ from native export dimensions. |
| Scene triangles | Total triangles in LED and imported meshes, including hidden items. Each mesh instance is counted once; camera movement, selection outlines and All Views do not change this total. Geometry changes, imports and deletions update it. Floor, grid and gizmos are excluded. |
| Draw calls / Drawn triangles | Calls and triangles submitted for the latest complete 3D viewport frame. Camera culling changes which objects are drawn; selection outlines and additional panes can draw geometry again. This measures rendering work, not model size. Output capture is excluded. |
| Textures / geometries | Renderer-tracked allocated resource counts; these are counts, not memory bytes. |

**Reading the counters:** UI FPS continues while **Viewport redraws / s** may show **Idle** when the scene is still. That is normal. CPU/memory readings update about once per second and supported NVIDIA readings about every 2–3 seconds. Missing or unsupported values are labelled; they do not mean zero load.

**Performance colours:** readings use off-white **Normal**, warm amber **Attention**, and soft coral **High pressure**, with a text label beside the value. RAM and VRAM include a percentage alongside used/total memory. GPU utilization and VRAM are rated independently.

| Reading | Normal | Attention | High pressure |
| --- | --- | --- | --- |
| CPU, system RAM, VRAM | Below 80% | 80% to below 95% | 95% or above |
| GPU utilization | Below 90% | 90% to below 98% | 98% or above |
| UI FPS | 45 or above | 25 to below 45 | Below 25 |

Hover a reading to see its scope and thresholds. UI FPS uses fixed responsiveness thresholds, not a detected display-refresh target. Colours indicate current load or reduced responsiveness, not a prediction of a crash. Idle, paused, missing and stale readings stay neutral; private app-memory bytes and draw statistics have no percentage rating.

If drawing is heavy, hide unnecessary models or pause the main viewport while using Floating Preview. For memory pressure, close unused applications or reduce scene complexity; hiding a model does not release its loaded memory.

**Navigation and selection:** Click a mesh to select it. Dragging to orbit or pan preserves the current selection; selecting a mesh is resolved when the click is released. Gizmo dragging and marquee selection keep their dedicated behavior.

**Camera redraws:** The Viewport redraws reading increases while you orbit, pan or zoom. An idle reading is normal when the view is still and no animated content is playing.

**Finding a bottleneck:** compare the same camera movement or source playback across readings. Falling UI FPS with a high UI frame peak can indicate main-thread work, though other system activity can also cause it. High GPU utilization with longer GPU draw times can indicate GPU load; high VRAM occupancy indicates memory pressure, but includes other applications. Low overall CPU usage does not rule out one busy CPU core. Compare system usage with app usage before attributing a slowdown to the current scene. No single reading proves the cause.

Native-source status can report source resolution, displayed frame rate, conversion time, copy time, canvas time, and overwritten/missed frames. Performance depends on source resolution, codec, network conditions, GPU, scene geometry, and the number of active feeds.

---

### 11.5 Floating Preview

In **3D**, open **Output → Floating Preview** to create a camera-only preview. This menu item is greyed out outside 3D. It starts from the editor's current perspective camera and then navigates independently. Scene geometry, visibility, source textures, floor, grid, and background continue to update from the editor. Objects cannot be selected, moved, rotated, scaled, grouped, or deleted in this preview.

| Action | Control |
| --- | --- |
| Move the window | Drag the **top-left move handle** |
| Orbit the preview camera | Left-drag inside the preview |
| Pan the preview camera | Right-drag |
| Zoom towards the cursor | Mouse wheel |
| Resize the window | Drag the **bottom-right corner** only |
| Close the preview | Small **top-right ×**, **Escape** while preview is focused, or toggle **Output → Floating Preview** off in 3D |

**Pause the main viewport:** With Floating Preview open, choose **Output → Pause main viewport**. The editor shows a paused notice and **Resume viewport** button while the undocked preview keeps its camera and live updates. The pause applies to the main 3D view, including All Views; Pixel Map, Patterns and Plots remain editable. Closing Floating Preview automatically resumes the main view. This setting is temporary and is not saved in projects.

Pausing can reduce rendering load while Floating Preview continues. It does not unload the scene or stop active NDI/Spout output. The benefit is greatest with moving sources or running test sequences.

The Windows application opens a borderless window above other applications, without a bright outer outline. The top-left move handle, top-right close button and bottom-right resize handle remain visible. Windows start at 640 × 360 and can be resized freely down to 240 × 160; the camera adapts to the window's aspect ratio without stretching models. Changing the window size does not change model dimensions or native stream resolution.

**Tips:** Use the move handle to position the window, then drag inside the preview to choose the camera angle. Make scene edits in the main editor and watch them update in the preview. Floating Preview can remain open alongside NDI or Spout; its camera does not change their editor-camera view. Closing the preview leaves native streaming running. **Output → OFF** stops both. Switching to Pixel Map, Patterns or Plots keeps the preview open with its camera, position and size intact, so map style and logo edits can be previewed live. The Floating Preview menu item is disabled outside 3D. To close an existing preview from those workspaces, use its × button or Escape while it is focused, or choose Output → OFF. Closing or reloading the editor also closes the preview. Reopening starts from the editor's perspective camera again; window placement and the preview camera are temporary and are not saved in the project.

## 12. Exporting

Choose the deliverable for the recipient:

| Deliverable | Where to create it |
|---|---|
| Pixel-accurate test image or map | **Export** in Patterns or Pixel Map. |
| 3D scene for another application | **Export** in 3D. |
| Printable mapping and stage documentation | **Export A3 PDF…** or **Print…** in Plots. |
| Editable OpticMesh project plus XML and PNG maps | **File → Compile Project…**. Export the PDF separately. |


### 12.1 PNG export

- **Export PNG / Export Current PNG:** exports the current Test Pattern or current map view.
- **Export Input PNG:** exports the full Resolume composition input map.
- **Export Selected Slice:** exports each selected slice at its own pixel dimensions.
- **Export All Outputs:** exports one output map for every Resolume screen.

Desktop PNG exports are routed to `Documents\OpticMesh\Test Patterns` unless another location is explicitly selected by the workflow.

### 12.2 3D scene export formats

| Format | Use |
|---|---|
| **GLB** | Single-file universal glTF delivery with embedded scene data. |
| **glTF Package** | ZIP package containing glTF scene resources. |
| **OBJ Package** | ZIP package with metre-based coordinates. Import at scale 1 with source units set to metres. |
| **MVR 1.5** | Scene meshes for compatible entertainment-production workflows. |
| **STL** | Binary world-positioned triangle geometry. No materials or hierarchy; coordinates are written in metres, so select metres when importing into unitless consumers. |
| **USDZ** | Packaged scene geometry and supported appearance. Compatibility with receiving applications should be checked. |

3D exports include:

- complete flat or curved screen meshes;
- physical scale;
- extrusion geometry;
- UV mapping and screen textures where supported;
- screen and group names;
- saved slice and hierarchy transforms.

3D exports exclude the viewport floor, grid, camera, selection outlines, and transform gizmos.

visible imported stage geometry is included alongside screens and can also be exported without a Resolume map. Display wireframe is an editor option; model geometry exports as a neutral shaded surface. OBJ includes its neutral material definition. Import availability does not imply export support for the same format: FBX, 3DS, DAE, standalone GDTF and separate USD/USDA/USDC export are not provided.

**OBJ units:** one exported coordinate unit equals one metre, with Y as the up axis. OBJ has no standard physical-unit declaration, so select **metres** in the receiving application's import settings. The package README and OBJ comments identify this convention, but cannot configure the importer automatically. Choosing millimetres makes the geometry 1,000 times too small; choosing centimetres makes it 100 times too small. Changing only the receiving application's displayed unit does not correct an import-scale mismatch. Reimport using the correct source unit. This applies equally to LED screens and imported stage models, regardless of their original source units.

### Technical Plots export

Prepare and review the A3 sheets in **Plots**, then use **Export → Export A3 PDF…** or **Print…**. Specification continuation pages are included. Page zoom does not affect output size, and editing guides are excluded. See [PDF and print](#99-pdf-and-print) for the delivery checks and printer options.

### 12.3 Export validation

Export may be blocked when a curved screen's extrusion depth is physically invalid for its radius. Reduce extrusion or curvature, then export again.

---

## 13. Keyboard and mouse reference

### 13.1 Current keyboard shortcuts

| Shortcut | Scope | Action |
|---|---|---|
| `Ctrl+D` | Technical Plots | Duplicate the selected frame with all its settings. Inactive while editing a field. |
| `Alt`-drag | Technical Plots, Edit layout | Drag a copy of a frame with the current snapping and alignment guides. |
| `Ctrl+Z` | Technical Plots | Undo a plot edit when not typing in a field. |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Technical Plots | Redo a plot edit when not typing in a field. |
| `Shift` + Up/Down or mouse wheel | Technical Plots numeric fields | Increase or decrease by 10. Without Shift, change by 1. |
| `Escape` | Technical Plots | Cancel pending frame placement or finish view framing. In a numeric field, restore the uncommitted value. |
| `Ctrl+S` | Application | Save. Opens Save As for Startup Project; overwrites the active named project. |
| `Ctrl+Z` | 3D Simulation | Undo the latest 3D history operation. Works while a parameter input has focus. |
| `Ctrl+Shift+Z` | 3D Simulation | Redo. |
| `Ctrl+Y` | 3D Simulation | Redo. |
| `F1` | 3D Simulation | Switch to Perspective. |
| `F2` | 3D Simulation | Switch to Top. |
| `F3` | 3D Simulation | Switch to Right. |
| `F4` | 3D Simulation | Switch to Front. |
| `F5` | 3D Simulation | Switch to All Views (four-view layout). |
| `S` | 3D Simulation | Over or focused in Scene Hierarchy: expand ancestors and reveal the selected row. Over the viewport: frame selection in the active view. Does nothing with no selection; text fields keep normal typing. |
| `F` | 3D Simulation | Fit the entire visible scene in all views and straighten the camera horizon, regardless of selection. |
| `Ctrl+A` | Focused 3D viewport | Select all imported model roots when a model is selected; otherwise select all scene slices. Click the viewport or Tab to it first. |
| `E` | 3D Simulation | Activate Move. |
| `R` | 3D Simulation | Activate Rotate. |
| `T` | 3D Simulation | Activate Scale. |
| `Ctrl+G` | 3D Simulation | Group selected editable model parts, groups and LED slices, including mixed selections. Disabled while typing or browsing menus/dialogs. |
| `Delete` | 3D Simulation | Delete selected imported models/groups/parts only. Screens and Resolume slices are protected. Respects locks; inactive in fields and menus/dialogs. |
| `Shift` while scaling | 3D viewport | Scale proportionally on all axes, preserving the initial proportions. |
| `Shift` while rotating | 3D viewport | Snap interactive rotation to 5° increments. |
| `Ctrl`-click | Pixel Map / hierarchy / 3D | Toggle an item in a multi-selection. |
| `Shift`-click | Pixel Map / hierarchy / 3D | Select a range between hierarchy rows; in the viewport, extend or toggle the current selection. |
| `Ctrl`-drag | 3D viewport | Add visible model items or screens inside a marquee, using the active selection type. |
| `Space` + left-drag | 2D canvas | Pan the pattern or map. Does not activate while typing in text or numeric fields. |
| `Enter` | Numeric or group-name field | Commit the entered value or finish group renaming. |
| `Escape` | Editable field | Cancel/revert supported field editing or finish group renaming without continuing the edit mode. |
| `Tab` / `Shift+Tab` / arrow keys | Save or project-replacement prompt | Move focus between available actions. No action starts selected. |
| `Enter` / `Space` | Save or project-replacement prompt | Activate the focused button. |
| `Escape` | Save or project-replacement prompt | Cancel and keep the project open. |

These shortcuts describe the Windows application.

The 3D letter shortcuts accept lowercase and uppercase. Letter and F1–F5 view shortcuts do not run while typing or editing a field, using a select control, or while a menu or dialog is open. Ctrl+A keeps normal text-selection behavior in fields and selects scene content only when the viewport has keyboard focus. Selecting all does not unlock or reveal hidden items; pivot and transform edits still respect locks.

**Tip:** with the 3D workspace active and no field, menu, or dialog open, press F to fit the entire visible scene. Use S to focus selected objects; in All Views, hover the pane you want to focus before pressing S. F reframes all panes, straightens the horizon and keeps your selection.

### 13.2 Mouse controls

| Control | 2D canvas | 3D viewport |
|---|---|---|
| Left click | Select slice or interact with controls | Select a screen, imported model or gizmo axis |
| Left drag | Marquee selection in Pixel Map | Orbit camera on empty space |
| Middle drag | Pan | Dolly (zoom) |
| Right drag | Browser/platform dependent | Pan camera |
| Mouse wheel | Zoom toward cursor | Zoom toward cursor |
| Wheel over numeric field | Adjust value | Adjust value |
| `Shift` + wheel over numeric field | Larger adjustment | Larger adjustment |

### 13.3 All Views navigation

Press **F1** for Perspective, **F2** for Top, **F3** for Right, **F4** for Front, or **F5** for All Views. View shortcuts use the function keys without Ctrl, Alt, or Shift. On keyboards with media controls, hold **Fn** if required to send the function key. Switching views preserves object placement and selection.

Choose **All Views** in the 3D toolbar. The panes are Perspective (upper left), Top (upper right), Front (lower left), and Right (lower right).

- Wheel zoom is anchored to the cursor inside the pane under the pointer. Each camera keeps its own pan and zoom. In Perspective, zoom distance follows the visible screen or model surface under the cursor, with finer movement close up. Navigation continues through empty space without stopping at an old orbit target. Openings and concave shapes allow zoom towards visible surfaces behind them. Moving between nearby and distant subjects keeps background surfaces and the floor/grid stable. Floor, grid and gizmos do not set the zoom distance.
- Left-drag orbits Perspective. Left-drag pans the fixed-axis orthographic panes; right-drag pans any pane.
- Select a screen and drag its Move, Rotate, or Scale gizmo in any pane. The same scene updates in all four views. Undo/redo applies to the shared edit.
- Ctrl-drag marquee stays inside the pane where the drag began. Ctrl/Shift-click retains multi-selection behavior.
- Switching between a single view and All Views preserves camera framing for this workspace session. **Fit Scene** reframes all cameras using current visible object bounds, including moved screens; **Focus** above the viewport frames the selection in the last-used pane. S over the viewport runs this action; S over Scene Hierarchy reveals the selection in the list. F always runs Fit Scene, regardless of selection.
- 3D output uses Perspective in All Views, or the displayed camera in a single view, without editor gizmos.

---

### 13.4 Floating Preview controls

Floating Preview is a camera-only preview. Its controls are separate from the editor's object tools.

| Control | Action |
| --- | --- |
| Top-left move-handle drag | Move the preview window |
| Left-drag inside the preview | Orbit the preview camera |
| Right-drag | Pan the preview camera |
| Wheel | Zoom the preview camera towards the cursor |
| Bottom-right drag | Resize the preview window |
| Escape / top-right × | Close the preview |

Object-selection, transform, grouping, delete, undo/redo, and project shortcuts do not run while the preview is focused. Continue scene editing in the main editor.

### 13.5 Technical Plots controls

| Control | Action |
|---|---|
| Click a sheet row | Open that sheet. |
| Drag a sheet row | Reorder it at the insertion line; no nesting. |
| Add frame, then click the page | Place the outline at the cursor. Escape cancels. |
| Drag a frame in Edit layout | Move it with the current grid and alignment snapping. |
| Drag the bottom-right handle | Resize the selected frame. |
| Alt-drag / Ctrl+D | Copy a frame with its settings. |
| Left-drag in Adjust view framing | Pan the view inside its frame. |
| Wheel in Adjust view framing | Zoom that view. |
| Escape / Finish framing | Leave view framing. |
| Wheel over the page outside view framing | Scroll the paper; use Fit sheet or its zoom selector for page magnification. |
| Up/Down or wheel over a numeric field | Adjust by 1; hold Shift to adjust by 10. |
| Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z | Undo / redo plot edits when not typing. |

Text fields retain normal editing keys. Bold, Italic and Underline use the buttons in **Text formatting**; no dedicated formatting keyboard shortcuts are assigned.

## 14. Numeric fields and mixed values

### 14.1 Arithmetic entry

Supported numeric fields accept arithmetic expressions containing:

- addition: `+`
- subtraction: `-`
- multiplication: `*`
- division: `/`
- parentheses: `(` and `)`

Examples:

```text
500*8
3840/2
(2.9*1000)/500
90+45
-360/2
```

Press `Enter` or leave the field to commit. Invalid, non-finite, or out-of-range results are rejected.

### Numeric adjustment buttons

Click the double-chevron control at the right of a numeric field to open its Increase and Decrease buttons. These buttons have larger click targets; they retain the field’s existing increment, limits, and undo behavior. Use Tab to reach the buttons and Enter or Space to activate them. Escape closes the controls and returns focus to the adjustment button; clicking elsewhere also closes them. Direct entry and wheel adjustment remain available. Hover over a numeric value or shortened project label to recover its full text.

### 14.2 Signed fields

Position, rotation, and curvature fields accept negative values. Physical size, resolution, cabinet size, and pixel pitch must remain positive.

### Numeric editing and panel scrolling

Scrolling over a numeric value adjusts it without moving the surrounding panel. While a value is selected for editing, that panel stays fixed even if the pointer moves off the field. Click elsewhere or press Enter to leave the field and resume panel scrolling. Scrolling elsewhere in the locked panel does not change another value. Other panels and the 3D viewport remain independently usable.

The existing step size and Shift adjustment continue to apply where supported. When no numeric value is selected, hovering a numeric control still allows wheel adjustment without simultaneously scrolling its panel.

### 14.3 Mixed selections

When several selected objects have different values, the relevant field shows a dash, blank mixed state, or **Multiple values**. Enter a value to apply it across the selected objects.

Entering a value into a mixed field applies that value to every selected compatible object.

### Slider reset

Double-click a slider's thumb or track to restore that setting's built-in default. This works throughout Patterns, Pixel Map, and 3D without a separate reset button. For example, line width returns to 1 px, logo scale/opacity to 100%, extrusion to 10 cm, curvature to 0°, and background brightness to 100%.

The reset uses the same scope as dragging: selected-slice controls update the selected slices, while global controls update the project setting. It changes only that parameter; disabled sliders remain disabled. The readout and preview update immediately, and the reset is saved with the project. Existing 3D undo/redo also applies to slider resets.

### 14.4 Rotation continuity

Rotation values can pass ±90° and continue beyond a full revolution. Numeric fields retain a continuous angle close to the previous value while you rotate.

Multiple-turn values are retained where possible so `450°` remains meaningful instead of being displayed only as its equivalent `90°` orientation.

---

## 15. Production workflow recommendations

### Top toolbar menus

Click File, Export, Output, Tools, Help, or About to open its list. With a list open, move across the other toolbar headings to browse their menus without clicking again. Moving into the workspace leaves the active list open. Select a command, click the active heading again, click elsewhere, or press Escape to close it. Hovering the toolbar while all menus are closed does not open a list.

For keyboard use, Tab to a toolbar button and press Enter or Space to toggle its list, then Tab through its actions. Escape closes the list and returns focus to its button; tabbing outside the button/list closes it too. On touch screens, tap to toggle or tap outside to dismiss.

**Tip:** click once, then sweep across the menu headings to find the command you need. The toolbar label stays **Output**. Open its menu to see OFF/NDI/Spout and the detailed output status; the dedicated bottom panel also shows output status.

### Quick tips

- Double-click a slider thumb or track to restore its built-in default.
- Use the wheel over a numeric field for small adjustments and Shift+wheel for larger steps. While the field is focused, its inspector stays still; press Enter or click elsewhere to resume panel scrolling.
- In All Views, use Front to align horizontal/vertical placement, Top for horizontal/depth placement, and Right for vertical/depth placement. Watch Perspective to check the combined result.
- Zoom into the working pane around the cursor without disturbing the other camera views. Use Focus for the selection in the last-used pane; reserve Fit Scene for reframing all cameras.

### 15.1 Before importing

- Give Resolume screens and slices clear, production-safe names.
- Confirm composition resolution.
- Remove unused or accidental slices.
- Save a clean Advanced Output XML revision.

### 15.2 Establish physical truth first

The most important rule is: **set the real pixel pitch before judging 3D size or spacing**.

Do not choose a preset simply because it is close. Enter the manufacturer's exact nominal pitch when needed. Confirm cabinet dimensions and resulting panel raster.

### 15.3 Build in stages

1. Import and validate XML.
2. Set pixel pitch and cabinet geometry.
3. Verify input and output maps.
4. Confirm the automatic anchor and physical scale.
5. Arrange individual screens.
6. Group only after the basic arrangement is trustworthy.
7. Add curvature and extrusion.
8. Connect live sources.
9. Review the arrangement and source routing.
10. Prepare Technical Plots from that verified scene; check screen choices, coordinates, dimensions and page framing.
11. Save a named project and export the final PDF, maps and any required 3D scene files.

### 15.4 Grouping strategy

- Group screens according to real scenic or structural assemblies.
- Use nested groups for a complete structure containing subassemblies.
- Keep names short but descriptive, such as `Centre Wall`, `Stage Left Tower`, or `Header Assembly`.
- Avoid selecting both a parent and its child unless you intentionally need hierarchy-range selection; the app prevents double transformation, but a cleaner selection is easier to understand.
- Confirm group placement and alignment before final export.

### 15.5 Save strategy

- Let Startup Project autosave protect work in progress.
- Create a named file for meaningful project milestones.
- Use deliberate versioned names for major revisions, for example `Project-V03.lo2s`.
- Press `Ctrl+S` after verified production changes.
- Keep exported deliverables separate from editable `.lo2s` files.

---

## 16. Troubleshooting

### 16.1 All screens overlap in 3D

Check the following:

1. Pixel pitch is positive and correct for every selected slice.
2. Per-slice pitch overrides are not unintentionally mixed.
3. The Resolume input rectangles have distinct positions.
4. The project was not loaded from an older build with invalid transforms.
5. Use **Reset adaptive layout** on the affected slices if custom transforms are no longer wanted.

### 16.2 Physical spacing looks wrong

- Confirm the central/primary screen is the automatic anchor at `X = 0`.
- Confirm exact pitch rather than relying on a nearby preset.
- Check cabinet width and raster consistency.
- Inspect whether selected slices have individual overrides.
- Remember that the Resolume pixel map provides a 2D relationship, not stage depth; Z placement must be created in the 3D scene.

### 16.3 Selected fields show a dash

The selected objects contain different values. Enter a value to unify them, or select one object to inspect its exact setting.

### 16.4 Rotation changes X or Z near 90°

Rotation fields should remain continuous as you drag. If another axis changes unexpectedly, note the following when reporting the issue:

- identify whether the group is nested;
- note whether the gizmo is in Local or World mode;
- record the values before and after crossing 90°;
- report whether the change occurred during one drag or after repeated drags.

### 16.5 Rotation wraps after one revolution

For an exact multi-turn result, enter the desired degree value directly. Rotation fields accept values beyond one revolution.

### 16.6 Group or slice jumps when reparented

Reparenting is designed to preserve the world transform. If a jump occurs, record:

- source parent and target parent;
- parent rotations and scales;
- whether either group is nested;
- the object transform before and after the drop.

Save a copy of the `.lo2s` file before attempting to reproduce the problem.

### 16.7 NDI source is not found

- Use the installed Windows application.
- Open Windows **Installed apps** and confirm **NDI Runtime** is present. The OpticMesh installer supplies it automatically when needed; rerun or repair the installer if it was cancelled.
- Confirm sender and receiver are on compatible networks.
- Allow the application and native bridge through the firewall.
- Choose **Scan** again.
- Confirm the sender is active and its source name is visible to another NDI application.
- Try Low Latency quality first.

### 16.8 Spout source is not found

- Confirm the Spout sender is running on the same Windows computer.
- Confirm GPU compatibility between sender and receiver.
- Scan again after starting the sender.
- Close software that may hold the sender exclusively.

### 16.9 3D interaction becomes slow

- Use Low Latency source quality.
- Disconnect live video while arranging geometry.
- Reduce scene complexity and the number of simultaneously selected curved screens.
- Avoid editing high curvature and deep extrusion across a very large selection at once.
- Close other GPU-heavy applications.
- Use the Performance panel to identify which interactions take the longest to draw.

### 16.10 3D export is blocked

Read the notification. If a curved screen has invalid extrusion, reduce depth or curvature until the body fits within the available radius.

### 16.11 Startup project does not restore

- Open **Reveal Projects folder**.
- Check for `Startup Project.lo2s` and `Startup Project.previous.lo2s`.
- Verify the files are not zero bytes and the folder is writable.
- Avoid renaming managed recovery files while the app is open.
- Try loading a known named `.lo2s` project manually.

---

### Technical Plots: missing labels, views or pages

- **Missing or cramped labels:** enlarge the frame or reduce Frame text size. Check numbered callouts below input/output maps and read the amber notification.
- **Wrong physical dimensions:** confirm pitch and panel geometry in Pixel Map, then verify the 3D arrangement before reissuing the plots.
- **Wrong slice or output after applying a template:** choose the correct Screen slice or Output screen in each affected frame.
- **View too small or cropped:** use Adjust view framing or Fit view. Changing Camera view also fits the new angle.
- **More specification pages than sheet rows:** use the continuation-page selector; the full set is included in PDF and print.
- **Notes cut short:** enlarge the text frame, reduce text size or shorten the note. Expanding the footer input gives typing room but does not enlarge the printed footer.
- **Print unavailable or failed:** check that a printer is installed and supports A3 landscape, or export PDF for printing elsewhere.

---

## 17. Projection formats and current limitations

### 17.1 Choosing a view

Use the 3D toolbar to choose **Perspective**, **Top**, **Right**, **Front**, or **All Views**. Narrower windows show a camera selector; wider windows show individual view buttons. Each pane in All Views has independent camera controls and displays the same scene.

### 17.2 Projection formats

The Patterns viewport toolbar separates the projection format from Pattern Fill:

- **Planar:** existing square or rectangular LED and projection pattern workflow.
- **Dome:** independent square 180° fisheye calibration workflow. Set any square resolution directly or use 1K/2K/4K/6K/8K presets. The dome always fills the selected square raster to its maximum stroke-safe diameter; there is no separate Pattern Size control. Controls include pattern name, black/grayscale/spectrum/UV/transparent/custom backgrounds, compass, line opacity, degree step, degree and elevation labels, border, ring count and weight, safe area, centre marker, colours, logo, reset, and native PNG export. Labels face outward: BACK points toward the top, FRONT toward the bottom, LEFT/RIGHT toward their sides, and low-to-high elevation values run from perimeter to centre. When compass labels are visible, duplicate cardinal degree values are omitted to prevent overlap. The central marker remains unobstructed without a `ZENITH` label. The pattern title and resolution follow readable left-to-right constant-angle arcs. A custom logo is warped as a spherical patch and positioned with azimuth, elevation, a single 25–200% size control, visibility, and opacity. LED cabinet dimensions, pixel pitch, Cabinet IDs, and Cabinet Checker do not apply and are unavailable.
- **Cubemap:** six labelled and oriented faces with independent face resolution. Choose **3 × 2**, **Horizontal Cross**, or **Vertical Cross** in Setup. Configure face labels, perspective grid, seam references, and directional logo placement.

Dome owns a dedicated square resolution and a separate saved Style block. Its controls do not change Planar or Pixel Map appearance. Cubemap uses its own face resolution and derives the output size from the selected face layout. Custom logo, project save/load, Fit Canvas, Actual 1:1, and native PNG export apply where relevant.

While you adjust a Dome control, the preview temporarily uses a lower resolution for responsiveness, then returns to the chosen resolution when you stop. **Actual 1:1** and **Export Current PNG** use native resolution.

Dome typography is proportional to the selected native raster, so its apparent label size remains consistent when moving between 1K, 2K, 4K, 6K, and 8K. Ring weight is selected as **Thin**, **Medium**, or **Bold**.

### 17.3 Current limitations

- The 3D Simulation remains Beta and is not a photoreal render engine.
- Technical Plots currently uses A3 landscape pages; other paper sizes and fixed drawing scales are not available.
- Stage views in plots are images in a parallel projection, labelled Not to scale; maps and text remain vector content in PDF.
- Text formatting applies to a complete note body; individual-word formatting is not available.
- Technical Plots documents pixel mapping and screen geometry. LED processor routing, sending-card layouts and lighting patch are outside its scope.
- Large scenes, curvature, and multiple live sources can reduce responsiveness. Use the Performance panel to monitor viewport drawing.

---

## 18. Terminology

| Term | Meaning |
|---|---|
| **Advanced Output** | Resolume's screen and slice mapping system. |
| **Composition** | The main Resolume input raster from which slices sample content. |
| **Screen** | A Resolume output device or logical output canvas containing slices. |
| **Slice** | A mapped rectangular or warped region with input and output geometry. |
| **Pixel pitch** | Physical distance between adjacent LED pixels, expressed in millimetres. |
| **Cabinet** | A manufactured LED panel unit containing a fixed pixel matrix. |
| **Input map** | Arrangement of slice crops within the composition raster. |
| **Output map** | Arrangement of slices on a Resolume output screen/device. |
| **Pivot** | The point around which an individual slice moves and rotates. |
| **Group axis** | The parent transform origin used to move, rotate, or scale a group. |
| **Local transform** | Position, rotation, and scale relative to an object's parent. |
| **World transform** | Final position, rotation, and scale after all parent transforms are applied. |
| **Curvature** | Angular bend applied horizontally or vertically to an LED surface. |
| **Extrusion** | Physical depth created behind the LED surface mesh. |
| **NDI** | Network video protocol used for IP video transport. |
| **Spout** | Windows GPU texture-sharing system used between applications on one computer. |
| **GLB/glTF** | Modern 3D scene formats supporting meshes, transforms, and UV data. |
| **MVR** | Entertainment-production scene exchange format. |
| **Technical Plot** | A printable sheet documenting mapping, physical screen information and scene views. |
| **Frame** | A content area placed on a Technical Plots sheet. |
| **Template** | A reusable plot layout and branding setup; it does not include the project scene. |
| **Isometric view** | A parallel three-axis view showing the arrangement without perspective convergence. |

NDI® is a registered trademark of Vizrt NDI AB. Visit [ndi.video](https://ndi.video/) for official NDI technology, licensing, runtime, and tools information.
