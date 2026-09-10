import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resetNavigationHorizon, savedNavigationUp, restoreNavigationUp } from '../app/camera-orientation.ts';
import { createViewportControls } from '../app/viewport-controls.ts';
import { spaceMouseState, applySpaceMouseFrame, createSpaceMouseControls } from '../app/spacemouse-controls.ts';
class Surface extends EventTarget {
  style={};ownerDocument=new EventTarget();clientWidth=640;clientHeight=480;
  getRootNode(){return this.ownerDocument;}
  getBoundingClientRect(){return {left:0,top:0,width:640,height:480};}
}
function fixture(ortho=false){const surface=new Surface(),camera=ortho?new THREE.OrthographicCamera(-4,4,3,-3,.01,500):new THREE.PerspectiveCamera(42,4/3,.01,500);camera.position.set(0,0,10);const pair=createViewportControls(camera,surface,'world');pair.controls.enableDamping=false;return {camera,surface,...pair};}
function cleanup(view){view.controls.dispose();view.transform.dispose();}
test('camera state uses metres and the native column-major camera-to-world transform',()=>{const v=fixture();try{const s=spaceMouseState(v,new THREE.Box3(new THREE.Vector3(-3,0,-2),new THREE.Vector3(3,5,2)));assert(new THREE.Vector3(...s.matrix.slice(12,15)).distanceTo(new THREE.Vector3(0,0,10))<1e-7);assert.deepEqual(s.bounds,[-3,0,-2,3,5,2]);assert.equal(s.distance,10);assert.equal(s.perspective,true);assert.equal(s.frustum[4],.01);}finally{cleanup(v);}});
test('SpaceMouse pose and roll survive OrbitControls updates and ordinary wheel input',()=>{const v=fixture();try{const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.4,.3));const matrix=new THREE.Matrix4().compose(new THREE.Vector3(5,3,12),q,new THREE.Vector3(1,1,1));assert(applySpaceMouseFrame(v,{matrix:matrix.toArray(),extents:[]}));v.controls.update();assert(v.camera.position.distanceTo(new THREE.Vector3(5,3,12))<1e-7);assert(v.camera.quaternion.angleTo(q)<1e-7);const before=v.camera.position.clone();const event=new Event('wheel',{cancelable:true});Object.assign(event,{clientX:320,clientY:240,deltaY:-120,deltaMode:0,ctrlKey:false});v.surface.dispatchEvent(event);assert(event.defaultPrevented);assert(v.camera.position.distanceTo(before)>.01);assert(v.controls.enabled);}finally{cleanup(v);}});
test('axis view pans and zooms without rotation; malformed input leaves camera intact',()=>{const v=fixture(true);try{const initial=v.camera.quaternion.clone();const matrix=new THREE.Matrix4().makeTranslation(2,3,10).toArray();assert(applySpaceMouseFrame(v,{matrix,extents:[-2,-1.5,-500,2,1.5,-.01]}));v.controls.update();assert.equal(v.camera.zoom,2);assert(v.controls.target.distanceTo(new THREE.Vector3(2,3,0))<1e-7);assert(v.camera.quaternion.angleTo(initial)<1e-7);const before=v.camera.position.clone();assert.equal(applySpaceMouseFrame(v,{matrix:Array(16).fill(NaN),extents:[]}),false);assert(v.camera.position.equals(before));}finally{cleanup(v);}});

test('focus routing excludes paused/hidden workspaces, dialogs and text fields, and closes cleanly',()=>{
  const Previous=globalThis.HTMLElement;globalThis.HTMLElement=class extends EventTarget{};
  const v=fixture(),events=[];let allowed=true,focused=true,dialog=false,pending=null,changed=0;
  const doc={activeElement:null,hidden:false,hasFocus:()=>focused,querySelector:()=>dialog?{}:null,defaultView:new EventTarget()};
  const host={ownerDocument:doc,clientWidth:640,clientHeight:480};
  const bridge={open:()=>{events.push('open');return true;},focus:value=>events.push(value?'on':'off'),sync:()=>events.push('sync'),poll:()=>{const f=pending;pending=null;return f;},close:()=>events.push('close')};
  const controller=createSpaceMouseControls(bridge,host,()=>v,()=>new THREE.Box3(),()=>allowed,()=>changed++);
  try{controller.tick();assert.deepEqual(events,['open','off','sync','on']);
    pending={matrix:new THREE.Matrix4().makeTranslation(1,2,10).toArray(),extents:[]};controller.tick();assert.equal(changed,1);
    controller.sync();assert.equal(events.at(-1),'sync');allowed=false;controller.tick();assert.equal(events.at(-1),'off');
    pending={matrix:new THREE.Matrix4().makeTranslation(9,9,9).toArray(),extents:[]};controller.tick();assert.equal(changed,1);pending=null;
    allowed=true;focused=false;controller.tick();assert.equal(events.at(-1),'off');focused=true;dialog=true;controller.tick();assert.equal(events.at(-1),'off');
    dialog=false;const input=new globalThis.HTMLElement();input.closest=()=>true;doc.activeElement=input;controller.tick();assert.equal(events.at(-1),'off');doc.activeElement=null;
    controller.tick();assert.equal(events.at(-1),'on');host.clientWidth=0;controller.tick();assert.equal(events.at(-1),'off');
    controller.dispose();assert.equal(events.at(-1),'close');const n=events.length;controller.tick();assert.equal(events.length,n);
  }finally{cleanup(v);globalThis.HTMLElement=Previous;}
});


test('object navigation reference follows selected world bounds independently of the mouse target',()=>{
 const v=fixture();try{
  const scene=new THREE.Box3(new THREE.Vector3(-20,0,-10),new THREE.Vector3(80,30,10));
  const selected=new THREE.Box3(new THREE.Vector3(48,5,-2),new THREE.Vector3(52,9,2));
  v.controls.target.set(1,2,3);
  const state=spaceMouseState(v,scene,selected);
  assert.deepEqual(state.pivot,[50,7,0]);assert.deepEqual(state.selectionBounds,[48,5,-2,52,9,2]);assert.deepEqual(state.target,[1,2,3]);
  const cleared=spaceMouseState(v,scene);assert.deepEqual(cleared.selectionBounds,[]);assert.deepEqual(cleared.pivot,[30,15,0]);
 }finally{cleanup(v);}
});

test('orbit around an off-origin model and dolly retain driver pose and interest depth',()=>{
 const v=fixture();try{
  const target=new THREE.Vector3(50,7,-15),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.8);
  for(const distance of [20,12,5,12,20]){
   const position=target.clone().add(new THREE.Vector3(0,0,distance).applyQuaternion(q));
   const matrix=new THREE.Matrix4().compose(position,q,new THREE.Vector3(1,1,1));
   assert(applySpaceMouseFrame(v,{matrix:matrix.toArray(),extents:[],target:target.toArray()}));v.controls.update();
   assert(v.camera.position.distanceTo(position)<1e-7);assert(v.camera.quaternion.angleTo(q)<1e-7);
   assert(v.controls.target.distanceTo(target)<1e-7);assert(Math.abs(v.camera.position.distanceTo(v.controls.target)-distance)<1e-7);
  }
  // A panned camera may look beside the pivot. Preserve its orientation rather than aiming it back at the object.
  const position=target.clone().add(new THREE.Vector3(4,0,20).applyQuaternion(q));
  assert(applySpaceMouseFrame(v,{matrix:new THREE.Matrix4().compose(position,q,new THREE.Vector3(1,1,1)).toArray(),extents:[],target:target.toArray()}));
  assert(v.camera.quaternion.angleTo(q)<1e-7);assert(Math.abs(v.camera.position.distanceTo(v.controls.target)-20)<1e-7);
 }finally{cleanup(v);}
});


test('ordinary mouse orbit, pan and zoom match the original controls after device pitch and yaw',()=>{
 const v=fixture(),reference=fixture();try{
  reference.camera.position.set(12,8,20);reference.controls.target.set(3,2,-1);reference.controls.update();reference.camera.updateMatrixWorld();
  assert(applySpaceMouseFrame(v,{matrix:reference.camera.matrixWorld.toArray(),extents:[],target:reference.controls.target.toArray()}));
  for(let i=0;i<15;i++){
   for(const action of [c=>c.rotateLeft(.08),c=>c.rotateUp(-.025),c=>c.pan(3,-2),c=>c.dollyIn(1.03)]){
    action(v.controls);action(reference.controls);v.camera.updateMatrixWorld();reference.camera.updateMatrixWorld();
    assert(v.camera.up.equals(new THREE.Vector3(0,1,0)),'Device pitch must not tilt the mouse orbit axis');
    assert(v.camera.position.distanceTo(reference.camera.position)<1e-7);
    assert(v.controls.target.distanceTo(reference.controls.target)<1e-7);
    assert(v.camera.quaternion.angleTo(reference.camera.quaternion)<1e-7);
   }
  }
 }finally{cleanup(v);cleanup(reference);}
});

test('device roll remains visible without changing the vertical orbit axis or forcing idle redraws',()=>{
 const v=fixture(),reference=fixture();try{
  reference.camera.position.set(12,8,20);reference.controls.target.set(3,2,-1);reference.controls.update();
  const roll=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.4);
  const orientation=reference.camera.quaternion.clone().multiply(roll);
  assert(applySpaceMouseFrame(v,{matrix:new THREE.Matrix4().compose(reference.camera.position,orientation,new THREE.Vector3(1,1,1)).toArray(),extents:[],target:reference.controls.target.toArray()}));
  for(let i=0;i<12;i++){
   v.controls.rotateLeft(.12);reference.controls.rotateLeft(.12);
   assert(v.camera.up.equals(new THREE.Vector3(0,1,0)));
   assert(v.camera.position.distanceTo(reference.camera.position)<1e-7);
   assert(v.camera.quaternion.angleTo(reference.camera.quaternion.clone().multiply(roll))<1e-7);
  }
  assert.equal(v.controls.update(),false,'Idle rolled camera does not continuously invalidate');
 }finally{cleanup(v);cleanup(reference);}
});

test('saved and earlier tilted-up camera poses reopen without contaminating mouse orbit',()=>{
 const v=fixture(),restored=fixture(),reference=fixture();try{
  reference.camera.position.set(10,6,12);reference.controls.target.set(3,1,0);reference.controls.update();
  const roll=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.3);
  const orientation=reference.camera.quaternion.clone().multiply(roll);
  assert(applySpaceMouseFrame(v,{matrix:new THREE.Matrix4().compose(reference.camera.position,orientation,new THREE.Vector3(1,1,1)).toArray(),extents:[],target:reference.controls.target.toArray()}));
  restored.camera.position.copy(v.camera.position);restored.controls.target.copy(v.controls.target);
  restoreNavigationUp(restored.camera,restored.controls.target,savedNavigationUp(v.camera).toArray());restored.controls.update();
  assert(restored.camera.up.equals(new THREE.Vector3(0,1,0)));assert(restored.camera.quaternion.angleTo(orientation)<1e-7);
  restored.controls.rotateLeft(.2);reference.controls.rotateLeft(.2);
  assert(restored.camera.position.distanceTo(reference.camera.position)<1e-7);
  assert(restored.camera.quaternion.angleTo(reference.camera.quaternion.clone().multiply(roll))<1e-7);
  // Earlier versions saved the tilted screen-up even when there was no roll.
  const legacyUp=new THREE.Vector3(0,1,0).applyQuaternion(reference.camera.quaternion);
  restoreNavigationUp(restored.camera,restored.controls.target,legacyUp.toArray());restored.controls.update();
  assert(restored.camera.up.equals(new THREE.Vector3(0,1,0)));
  assert(restored.camera.quaternion.angleTo(reference.camera.quaternion)<1e-7);
 }finally{cleanup(v);cleanup(restored);cleanup(reference);}
});

test('Fit Scene horizon reset clears device roll and keeps subsequent mouse navigation level',()=>{
 const v=fixture();try{
  const position=new THREE.Vector3(10,7,12),target=new THREE.Vector3(3,1,0);
  const level=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position,target,new THREE.Vector3(0,1,0)));
  const rolled=level.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),1.1));
  applySpaceMouseFrame(v,{matrix:new THREE.Matrix4().compose(position,rolled,new THREE.Vector3(1,1,1)).toArray(),extents:[],target:target.toArray()});
  resetNavigationHorizon(v.camera,v.controls.target);v.controls.update();
  assert(v.camera.quaternion.angleTo(level)<1e-7);assert(v.camera.position.distanceTo(position)<1e-7);
  assert.deepEqual(savedNavigationUp(v.camera).toArray(),[0,1,0]);
  v.controls.rotateLeft(.2);
  const expected=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v.camera.position,v.controls.target,new THREE.Vector3(0,1,0)));
  assert(v.camera.quaternion.angleTo(expected)<1e-7);
 }finally{cleanup(v);}
});
