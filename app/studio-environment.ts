import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

export type ReflectionPreset = 1 | 2 | 3;
export const reflectionPreset = (value: unknown): ReflectionPreset => value === 2 || value === 3 ? value : 1;
type ReflectionPixels = ReturnType<HDRLoader["parse"]>;
const localPixels = new Map<string, Promise<ReflectionPixels | null>>();

function loadLocalReflection(preset: ReflectionPreset) {
 const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; BASE_URL?: string; VITE_LOCAL_REFLECTION_HDR?: string; VITE_LOCAL_REFLECTION_HDR_2?: string; VITE_LOCAL_REFLECTION_HDR_3?: string } }).env;
 const local = env?.DEV ? [env.VITE_LOCAL_REFLECTION_HDR, env.VITE_LOCAL_REFLECTION_HDR_2, env.VITE_LOCAL_REFLECTION_HDR_3][preset - 1] : undefined;
 const url = local || `${env?.BASE_URL || "/"}reflections/hdri${preset}.hdr`;
 if (!localPixels.has(url)) localPixels.set(url, fetch(url).then(async response => {
  if (!response.ok) throw new Error(`HDR request failed (${response.status})`);
  const pixels = new HDRLoader().parse(await response.arrayBuffer());
  if (!pixels || typeof pixels.width !== "number" || typeof pixels.height !== "number" || pixels.width < 1 || pixels.height < 1 || pixels.width > 2048 || pixels.height > 1024 || pixels.width !== pixels.height * 2) throw new Error("Use an optimised 2:1 reflection panorama, at most 2048 × 1024.");
  return pixels;
 }).catch(error => { localPixels.delete(url); console.warn("Local reflection unavailable; using studio reflections.", error); return null; }));
 return localPixels.get(url)!;
}

export type StudioEnvironment = ReturnType<typeof createStudioEnvironment>;

/** Hidden reflections only. Release presets are bundled; local overrides stay development-only. */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer, onReady?: (texture: THREE.Texture) => void, initial: ReflectionPreset = 1) {
 const fallback = createFallbackEnvironment(renderer);
 const targets = new Map<ReflectionPreset, THREE.WebGLRenderTarget>();
 let target = fallback, disposed = false, request = 0, selected: ReflectionPreset | undefined;
 let ready: Promise<void> = Promise.resolve();
 const select = (preset: ReflectionPreset) => {
  if (disposed || preset === selected) return ready;
  selected = preset;
  const ticket = ++request;
  const activate = (replacement: THREE.WebGLRenderTarget) => {
   if (disposed || ticket !== request) return;
   target = replacement; onReady?.(target.texture);
  };
  const cached = targets.get(preset);
  if (cached) { activate(cached); return ready = Promise.resolve(); }
  return ready = loadLocalReflection(preset).then(pixels => {
   if (disposed || ticket !== request) return;
   if (!pixels) { activate(fallback); return; }
   const source = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat, THREE.HalfFloatType);
   source.colorSpace = THREE.LinearSRGBColorSpace;
   source.mapping = THREE.EquirectangularReflectionMapping;
   source.flipY = true; source.needsUpdate = true;
   const pmrem = new THREE.PMREMGenerator(renderer);
   try {
    const replacement = pmrem.fromEquirectangular(source);
    replacement.texture.name = `OpticMesh HDRI${preset} reflection`;
    targets.set(preset, replacement); activate(replacement);
   } finally { source.dispose(); pmrem.dispose(); }
  }).catch(error => { if (!disposed && ticket === request) selected = undefined; console.warn("Local reflection could not be prepared; retaining previous reflections.", error); });
 };
 select(initial);
 return { get texture() { return target.texture; }, get ready() { return ready; }, select,
  dispose() { if (disposed) return; disposed = true; ++request; fallback.dispose(); targets.forEach(value => value.dispose()); targets.clear(); }
 };
}

/** Static HDR softboxes provide an immediate fallback while the local map loads. */
function createFallbackEnvironment(renderer: THREE.WebGLRenderer) {
 const width=512,height=256,data=new Float32Array(width*height*4);
 const boxes=[{x:.22,y:.32,w:.10,h:.22,power:3},{x:.68,y:.4,w:.16,h:.12,power:2},{x:.46,y:.15,w:.22,h:.05,power:1.5}];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/width,v=y/height;let light=.055;
  for(const b of boxes){const dx=Math.min(Math.abs(u-b.x),1-Math.abs(u-b.x))/b.w,dy=Math.abs(v-b.y)/b.h;light+=b.power*Math.exp(-Math.pow(dx,8)-Math.pow(dy,8));}
  const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=light;data[i+3]=1;
 }
 const source=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.needsUpdate=true;
 const pmrem=new THREE.PMREMGenerator(renderer);
 try{return pmrem.fromEquirectangular(source);}finally{source.dispose();pmrem.dispose();}
}
