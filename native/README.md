# LO2S - OpticMesh native source bridge

This Windows-only helper receives real NDI and Spout frames for the 3D simulation and publishes the generated Resolume Pixel Map or 3D camera preview through one selected output protocol. It keeps native SDK work outside the browser renderer.

The OpticMesh NSIS installer embeds the official NDI 6 Runtime redistributable and runs it only when no compatible NDI 5/6 x64 Runtime is detected. Release builds obtain the redistributable from `https://ndi.link/NDIRedistV6` and verify the pinned SHA-256 before packaging. NDI® is a registered trademark of Vizrt NDI AB.

- NDI always receives the full-bandwidth source. Low Latency uses a fused RGBA conversion/downscale, drains queued frames, and always presents the newest available frame instead of accumulating delay. High Quality retains the larger raster with a controlled frame cadence.
- NDI frames use a three-slot Windows shared-memory ring consumed by an Electron Node-API addon. Only the final reusable-buffer copy and canvas/GPU upload remain in the renderer. Live metrics report capture, publication and display rates, conversion time, shared-memory copy time, canvas upload time and overwritten frames.
- Spout uses the official Spout2 `SpoutLibrary` receiver and enumerates actual Spout senders.
- Video Devices remain on Chromium's existing `getUserMedia` path.
- 3D camera output is limited to a maximum 1920 × 1080 raster at 30 FPS, preserving the camera aspect ratio. Pixel Map output uses the map raster. The bridge accepts RGBA frames, retains the latest generated pattern, and continuously publishes it through either NDI or Spout. A changed Advanced Output map can replace the frame and dimensions without restarting the app.

## Components and builds

- `source-bridge.cpp` and `source-bridge.vcxproj`: Windows x64 executable, built with Visual Studio 2022 C++ tools and NDI SDK headers. The project’s include path must point to the installed SDK.
- `shared-frame-addon.cpp` and `addon/binding.gyp`: Node-API shared-memory addon for Electron.
- `vendor/Spout2`: SpoutLibrary interface and its BSD license notice.
- `../desktop/native`: runtime bridge, addon, and SpoutLibrary files included in Windows packages.

The NDI Runtime is loaded dynamically and is distinct from the SDK required to rebuild the bridge. The Windows installer supplies the runtime prerequisite. Native NDI/Spout support is unavailable in ordinary browser sessions.

## Verification and licensing

Use the native smoke scripts under `tests` to check shared memory, output, and source discovery on Windows. Tests generate their own small frames; source-reception benchmarks require an available sender. Build and test changes to native components before replacing the packaged binaries.

See [third-party notices](../THIRD_PARTY_NOTICES.md) and the [Spout2 license](vendor/Spout2/LICENSE). NDI uses its vendor’s separate terms. OpticMesh’s MIT License does not replace those terms.
