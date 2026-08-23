<p align="center">
  <img src="public/brand/opticmesh-icon.png" width="180" alt="OpticMesh icon">
</p>

# OpticMesh

OpticMesh is an open-source LED test-pattern, Resolume pixel-map, and 3D WYSIWYG simulation workspace. It is designed for technical production workflows.

**Current release: OpticMesh v1.3.3 Beta**

[Download the Windows portable app](https://github.com/johnjjdave/opticmesh/releases/tag/v1.3.3-beta) · [Open the web app](https://patternlab.lo2s.com/)

[Read the complete changelog](CHANGELOG.md)

## What is included

### Test Patterns

- Linked physical-size, raster-resolution, pixel-pitch, and cabinet calculations
- Arithmetic expressions inside supported numeric fields, with mouse-wheel adjustment across numeric parameter controls
- Metric grid, cabinet IDs, color bars, grayscale, and native pixel-check patterns
- Configurable labels, guides, circles, safe area, center marker, and uploaded logos
- Unified compact numeric steppers and adjustable line width for the metric grid, borders, cross, circles, and safe area
- Pixel-accurate Fit Canvas and Actual 1:1 viewing with cursor-focused zoom and panning
- Black or transparent PNG export with remembered save locations in the desktop app

### Resolume Pixel Map

- Resolume Advanced Output XML import
- Composition input-map and per-screen output-map rendering
- Automatic per-slice color palettes with global and selected-slice overrides
- One-click P1.2, P1.5, P1.9, P2.5, P2.6, P2.9, P3.9, P4.8, P5.9, and P10 pixel-pitch presets while retaining custom arithmetic entry
- Click, multi-select, and drag-marquee slice selection
- Per-slice information, physical dimensions, and output-map diagnostics
- Selected-slice and multi-screen PNG export
- Optional linked XML workflow in the Windows app for automatic map refresh
- Mutually exclusive NDI or Spout output of the generated test pattern at the exact Resolume input-map dimensions
- Full-resolution RGBA output that updates when the pattern or linked Advanced Output map changes

### 3D Simulation — Beta

- Every Resolume XML slice becomes a separately selectable, physically scaled LED screen
- Independent per-slice pattern textures so overlapping input-map slices retain their own correct content
- Emissive LED materials that preserve the source color and brightness
- Move, rotate, and scale gizmos with local/world axes and arithmetic-enabled transform fields
- Bottom-left, bottom-centre, or bottom-right pivots globally or per slice
- Mutually exclusive horizontal or vertical screen curvature from -360° to +360° with smooth curved extrusion and closed full-cylinder seams
- Configurable extrusion depth, floor, metre grid, and scene background brightness
- Right-side scene hierarchy with visible-by-default imported screens and slices, per-object visibility and locking, local names, search, grouping, focus, and group transforms
- Multi-selection, undo/redo, saved camera state, corrected fullscreen perspective, and Fit Scene controls
- GLB, glTF package, OBJ package, and MVR 1.5 scene export with geometry, UVs, names, and transforms

## Project files

- Projects save as one self-contained `.lo2s` file rather than separate project and XML files
- The file embeds pattern configuration, Resolume XML data, custom logo data, slice overrides, 3D transforms, hierarchy groups, visibility, locks, and camera state
- Native desktop save and load dialogs prevent duplicate browser-download files

## Live video sources

The Windows desktop beta supports:

- Pattern Generator at native quality
- Video Devices such as webcams and capture devices
- NDI source discovery and reception through a low-copy shared-memory desktop transport
- Spout sender discovery and reception
- Low Latency and High Quality modes
- Global source routing with per-slice overrides
- Native-source performance instrumentation for receiver, conversion, copy, and displayed-frame rates

NDI and Spout require the Windows desktop application and its native source bridge. They are not available in the hosted browser version. Higher-resolution live feeds can increase GPU, decoding, and network load depending on the source resolution and number of active feeds.

NDI/Spout source reception and Resolume Pixel Map test-pattern output are separate workflows. Test-pattern output supports either NDI or Spout at one time and preserves RGBA output at the current Advanced Output dimensions.

## Windows release

Download `OpticMesh-1.3.3-beta-Portable.exe` from the [v1.3.3 Beta release](https://github.com/johnjjdave/opticmesh/releases/tag/v1.3.3-beta). The portable build does not require installation.

This is an unsigned open-source beta. Windows Defender SmartScreen may show an “unknown publisher” warning.

The desktop application processes projects, Resolume XML files, logos, source frames, and exports locally. It does not upload project content to LO2S servers.

## Recommended Resolume workflow

**Physical accuracy depends on pixel pitch:** Set the pixel pitch to the exact manufacturer-specified pitch of the real LED product before arranging the screens in 3D. OpticMesh uses the slice raster dimensions and configured pixel pitch to calculate each screen's physical width and height; an incorrect pitch produces an incorrectly scaled 3D simulation even when the Resolume XML pixel map is correct.

1. Configure the composition and slices in Resolume Advanced Output.
2. Open **Resolume Pixel Map** in OpticMesh and import the XML preset.
3. Set the **Pixel pitch** to the exact real-world pitch of the LED product, then confirm the composition, physical scale, slice sizes, and pixel-map output.
4. Open **3D Simulation** and arrange the slices to match the physical LED setup.
5. Select Pattern Generator, Video Devices, NDI, or Spout as the global source.
6. Apply per-slice source overrides only where needed.
7. Optionally stream the generated input-map test pattern through NDI or Spout for real-time verification in Resolume.
8. Save the complete project as one `.lo2s` file and export the required 3D scene format.

Checker blocks are calculated from LED cabinet dimensions and pixel pitch; they are not arbitrary decorative grid sizes.

## Beta notes

- The web app provides the full browser-compatible OpticMesh interface, including 3D layout and pattern simulation.
- NDI and Spout are Windows desktop features because browsers cannot directly access those native protocols.
- MVR export targets version 1.5 for broader compatibility with current lighting and visualization software.
- Live-input performance depends on source resolution, codec, network conditions, GPU, and scene complexity.
- Report reproducible problems through [GitHub Issues](https://github.com/johnjjdave/opticmesh/issues).

## Development

Requirements:

- Node.js 22.13 or newer
- Corepack with pnpm
- Windows and Visual Studio C++ build tools when rebuilding the native NDI/Spout source bridge

Install dependencies and build the web application:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec vite build --config desktop/vite.config.ts
```

Run the project tests:

```bash
pnpm test
```

Package the Windows desktop application:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm exec vite build --config desktop/vite.config.ts
pnpm --dir desktop exec electron-builder --win portable --x64
```

## Licence and trademarks

The source code is released under the [MIT License](LICENSE). Bundled fonts are distributed under the [SIL Open Font License 1.1](public/brand/OFL.txt).

LO2S and the LO2S logo are trademarks of their respective owner. The open-source licence does not grant permission to represent modified versions as official LO2S releases.

See the [code-signing policy](CODE_SIGNING_POLICY.md) for release provenance and signing responsibilities.
