# LO2S native source bridge

This Windows-only helper receives real NDI and Spout frames for the 3D simulation and publishes the generated Resolume Pixel Map test pattern through one selected output protocol. It keeps native SDK work outside the browser renderer.

- NDI always receives the full-bandwidth source. Low Latency uses a fused RGBA conversion/downscale, drains queued frames, and always presents the newest available frame instead of accumulating delay. High Quality retains the larger raster with a controlled frame cadence.
- NDI frames use a three-slot Windows shared-memory ring consumed by an Electron Node-API addon. Only the final reusable-buffer copy and canvas/GPU upload remain in the renderer. Live metrics report capture, publication and display rates, conversion time, shared-memory copy time, canvas upload time and overwritten frames.
- Spout uses the official Spout2 `SpoutLibrary` receiver and enumerates actual Spout senders.
- Video Devices remain on Chromium's existing `getUserMedia` path.
- Output accepts full-resolution RGBA frames, retains the latest generated pattern, and continuously publishes it through either NDI or Spout. A changed Advanced Output map can replace the frame and dimensions without restarting the app.
