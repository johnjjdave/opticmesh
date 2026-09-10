import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { updateSceneCameraClipping } from '../app/camera-clipping.ts';
import { WORLD_FLOOR_SIZE_METRES } from '../app/scene-ground.ts';
import { createViewportControls } from '../app/viewport-controls.ts';

class Surface extends EventTarget {
 style={};ownerDocument=new EventTarget();
 getRootNode(){return this.ownerDocument;}
 getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}
}
test('foreground and distant mouse zoom targets cannot change clipping at the same camera pose',()=>{
 const camera=new T.PerspectiveCamera(42,4/3,.001,5000);camera.position.set(0,1.6,100);
 const mesh=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshBasicMaterial({side:T.DoubleSide}));
 const bounds=new T.Box3(new T.Vector3(-100,0,-100),new T.Vector3(100,40,100));
 const surface=new Surface(),{controls,transform}=createViewportControls(camera,surface,'world',()=>[mesh]);controls.enableDamping=false;
 const pose=camera.position.clone();let projection;
 try{
  for(const distance of [.2,2,100,500]){
   camera.position.copy(pose);controls.target.set(0,1.6,0);controls.update();mesh.position.z=100-distance;mesh.updateMatrixWorld();
   const e=new Event('wheel',{cancelable:true});Object.assign(e,{clientX:400,clientY:300,deltaY:-120,deltaMode:0,ctrlKey:false});surface.dispatchEvent(e);
   assert(camera.position.distanceTo(pose)>0,'ordinary zoom still moves');
   camera.position.copy(pose);updateSceneCameraClipping(camera,bounds);
   if(projection)assert.deepEqual(camera.projectionMatrix.elements,projection);else projection=[...camera.projectionMatrix.elements];
  }
 }finally{controls.dispose();transform.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});
test('clipping includes remote models and every floor corner, with and without scene geometry',()=>{
 const floor=WORLD_FLOOR_SIZE_METRES/2;
 for(const camera of [new T.PerspectiveCamera(),new T.OrthographicCamera()]){
  camera.position.set(3200,1800,-2400);
  for(const bounds of [new T.Box3(),new T.Box3(new T.Vector3(-20000,0,-100),new T.Vector3(-18000,20,100))]){
   updateSceneCameraClipping(camera,bounds);
   assert(camera.near>0&&camera.far>camera.near);
   for(const x of [-floor,floor])for(const z of [-floor,floor])assert(camera.far>camera.position.distanceTo(new T.Vector3(x,0,z)));
   if(!bounds.isEmpty())assert(camera.far>camera.position.distanceTo(bounds.min));
   const projection=camera.projectionMatrix.elements.slice();updateSceneCameraClipping(camera,bounds);assert.deepEqual(camera.projectionMatrix.elements,projection);
  }
 }
});
