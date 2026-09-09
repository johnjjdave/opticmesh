import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
try{
 await page.goto('http://localhost:3000/');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {createStudioEnvironment}=await import('/app/studio-environment.ts');
  const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);const scene=new THREE.Scene();scene.background=new THREE.Color('#090b0c');
  const camera=new THREE.PerspectiveCamera(40,1,.01,100);camera.position.z=4;
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:1,roughness:.02});const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),material);scene.add(sphere);
  const pixels=()=>{renderer.render(scene,camera);const bytes=new Uint8Array(256*256*4);renderer.getContext().readPixels(0,0,256,256,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,bytes);return bytes;};
  let disposedCallbacks=0;const closed=createStudioEnvironment(renderer,()=>disposedCallbacks++);closed.dispose();await closed.ready;
  const before=pixels();const environment=createStudioEnvironment(renderer);await environment.ready;material.envMap=environment.texture;material.envMapIntensity=.65;material.needsUpdate=true;const after=pixels();material.roughness=.8;const rough=pixels();
  let changed=0,roughChanged=0;for(let i=0;i<after.length;i+=4){if(after[i]>before[i]+20)changed++;if(Math.abs(after[i]-rough[i])>10)roughChanged++;}
  const result={changed,roughChanged,disposedCallbacks,reflectionName:environment.texture.name,backgroundUnchanged:[0,1,2,3].every(i=>before[i]===after[i]),sceneEnvironment:scene.environment};environment.dispose();sphere.geometry.dispose();material.dispose();renderer.dispose();return result;
 });assert(result.changed>500);assert(result.roughChanged>500);assert(result.backgroundUnchanged);assert.equal(result.disposedCallbacks,0);assert.equal(result.sceneEnvironment,null);console.log('Hidden studio reflections:',result);
}finally{await browser.close();}
