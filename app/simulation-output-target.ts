import * as THREE from "three";

/** Keep thin screen bodies distinct from their emitting faces in distant captures. */
export function createSimulationOutputTarget(width: number, height: number, maxSamples: number) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    // A fixed-point depth attachment can quantize front/back faces to the same
    // depth. Floating point retains the precision of reversed-depth rendering.
    depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType),
    samples: Math.min(4, maxSamples),
    // Only colour is read back; avoid an unnecessary multisample depth resolve.
    resolveDepthBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  return target;
}
