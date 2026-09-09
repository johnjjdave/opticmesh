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
  const first=environment.texture;material.roughness=.02;
  await environment.select(2);material.envMap=environment.texture;const second=environment.texture,secondPixels=pixels();
  await environment.select(3);material.envMap=environment.texture;const third=environment.texture,thirdPixels=pixels();
  await environment.select(1);const reused=environment.texture===first;
  const rapidA=environment.select(2),rapidB=environment.select(3);await Promise.all([rapidA,rapidB]);
  const differences=(a,b)=>a.reduce((n,v,i)=>n+(Math.abs(v-b[i])>10?1:0),0);
  const presets={secondName:second.name,thirdName:third.name,reused,lastWins:environment.texture===third,diff12:differences(after,secondPixels),diff23:differences(secondPixels,thirdPixels)};
  const result={presets,changed,roughChanged,disposedCallbacks,reflectionName:environment.texture.name,backgroundUnchanged:[0,1,2,3].every(i=>before[i]===after[i]),sceneEnvironment:scene.environment};environment.dispose();sphere.geometry.dispose();material.dispose();renderer.dispose();return result;
 });assert.equal(result.presets.secondName,'OpticMesh HDRI2 reflection');assert.equal(result.presets.thirdName,'OpticMesh HDRI3 reflection');assert(result.presets.reused);assert(result.presets.lastWins);assert(result.presets.diff12>500);assert(result.presets.diff23>500);assert(result.changed>500);assert(result.roughChanged>500);assert(result.backgroundUnchanged);assert.equal(result.disposedCallbacks,0);assert.equal(result.sceneEnvironment,null);console.log('Hidden studio reflections:',result);
}finally{await browser.close();}
