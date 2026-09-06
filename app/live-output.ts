export const SIMULATION_OUTPUT_MAX_EDGE = 2048;
export const SIMULATION_OUTPUT_FPS = 15;

/** Bound live 3D capture before allocating GPU or CPU storage; never upscale. */
export function simulationOutputSize(width: number, height: number, gpuLimit = SIMULATION_OUTPUT_MAX_EDGE) {
  const sourceWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1;
  const sourceHeight = Number.isFinite(height) ? Math.max(1, Math.round(height)) : 1;
  const limit = Math.max(1, Math.min(SIMULATION_OUTPUT_MAX_EDGE, Math.floor(gpuLimit) || SIMULATION_OUTPUT_MAX_EDGE));
  const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
}
