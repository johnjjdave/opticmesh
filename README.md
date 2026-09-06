<p align="center">
  <img src="public/brand/opticmesh-icon.png" width="160" alt="LO2S - OpticMesh">
</p>

# LO2S - OpticMesh

An open-source application for LED test patterns, Resolume pixel maps, and physically scaled 3D scene layout. Designed by LO2S for display calibration and technical production.

**Latest release: 0.7.0 Beta · Windows x64**

[Download for Windows](https://github.com/johnjjdave/opticmesh/releases/latest) · [Open the web app](https://opticmesh.lo2s.com/) · [User manual](MANUAL.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/johnjjdave/opticmesh/issues)

## What you can do

### Patterns

- Create Planar, Dome, and Cubemap calibration patterns at native output resolution.
- Calculate wall size, raster resolution, pixel pitch, and cabinet geometry from known measurements.
- Use metric grids, cabinet IDs, color bars, grayscale, pixel checks, guides, labels, safe areas, and custom logos.
- Configure square Dome output and Cubemap face resolution independently from the Planar wall.
- Inspect with Fit Canvas or Actual 1:1 and export PNG images.

### Pixel Map

- Import Resolume Advanced Output XML and inspect composition input maps and individual output maps.
- Set physical LED dimensions and pixel pitch globally or for selected slices.
- Edit slice labels, colors, guides, and appearance, including multiple slices at once.
- Review XML diagnostics and export selected slices, the input map, or all output maps.
- Link an XML preset for automatic refresh and send the generated input map over NDI® or Spout in Windows.

### 3D

- Arrange slices with Move, Rotate, and Scale tools, exact coordinates, local/world axes, curvature, and extrusion.
- Work in Perspective, Top, Right, Front, or four-pane All Views with independent cameras and synchronized scene edits.
- Use custom slice pivots, 1 m grid snapping, proportional scaling, alignment, distribution, and undo/redo.
- Organize objects in nested groups with visibility, locking, and placement-preserving reparenting.
- Route patterns, video devices, NDI, or Spout sources to the scene or individual slices.
- Monitor viewport performance and export GLB, glTF packages, OBJ packages, or MVR 1.5 scene meshes.

## Getting started

1. Download the installer from [GitHub Releases](https://github.com/johnjjdave/opticmesh/releases/latest) and launch LO2S - OpticMesh.
2. Open a sample project, create a pattern, or import a Resolume Advanced Output XML file in Pixel Map.
3. Set the real LED product’s pixel pitch and cabinet dimensions before judging physical size in 3D.
4. Arrange and configure the scene, then save it as a `.lo2s` project.
5. Export the required maps or 3D format. Use File → Compile Project to collect the project, XML, input map, and output maps in a named folder.

Open **Guide**, **Help → OpticMesh Manual**, or **Help → Keyboard Shortcuts** inside the app for offline instructions. The [Manual](MANUAL.md) includes shortcuts, navigation, troubleshooting, and practical workflows.

## Windows installation and saving

The Windows x64 installer provides Start Menu/Desktop shortcuts and an uninstall entry. It includes the official NDI 6 Runtime prerequisite and opens its installer only when a compatible NDI 5/6 Runtime is not detected. The complete NDI Tools package is not required.

The installer is unsigned; Windows SmartScreen may show an unknown-publisher warning. Download from the official release page and compare the installer with its published `SHA256SUMS.txt` if verifying the download.

```text
Documents\OpticMesh\
├── Projects\
│   ├── Startup Project.lo2s
│   └── Startup Project.previous.lo2s
├── Exports\
└── Test Patterns\
```

- **Projects:** named projects and managed startup/recovery files.
- **Exports:** default location for 3D scene exports.
- **Test Patterns:** default location for PNG patterns and maps.

The Windows app autosaves the working state and restores it on the next launch. Ctrl+S opens Save As for Startup Project; after opening or saving a named project, it updates that named file. Background recovery remains separate. Browser sessions require manual project saving.

## Platform and format notes

- NDI and Spout input/output are Windows desktop features. Video-device access depends on the device and browser permissions.
- Live-input performance depends on resolution, network conditions, hardware, and scene complexity. GPU timing is available only on supported systems.
- This Beta provides layout and simulation tools; it has no photoreal rendering engine or material editor.
- OBJ stores final world placement rather than editable pivot hierarchies. MVR 1.5 exports mesh geometry.
- Projects, XML, logos, and image processing remain local. Desktop update checks contact GitHub; enabled NDI workflows exchange frames over the network. See the [privacy and release policy](CODE_SIGNING_POLICY.md).

## Development and contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, builds, tests, and contribution guidance. The Windows native bridge is documented in [native/README.md](native/README.md).

## License and credits

OpticMesh source code is available under the [MIT License](LICENSE). Existing copyright notices are retained. Bundled third-party components retain their own licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md), including Geist fonts under the SIL Open Font License and Spout2 under BSD 2-Clause.

LO2S and its logo identify the official publisher. NDI® is a registered trademark of Vizrt NDI AB. See [ndi.video](https://ndi.video/) for NDI technology and licensing information.
