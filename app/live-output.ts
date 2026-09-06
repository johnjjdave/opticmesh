export const SIMULATION_OUTPUT_FPS = 3;

/** Fixed 16:9 live camera output, independent of the imported composition raster. */
export function simulationOutputSize(gpuLimit = Infinity) {
  if (Number.isNaN(gpuLimit) || gpuLimit < 1920) throw new Error("This GPU cannot capture 1920 × 1080 3D Output.");
  return { width: 1920, height: 1080 };
}
