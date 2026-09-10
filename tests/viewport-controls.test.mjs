import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createViewportControls } from '../app/viewport-controls.ts';

class Surface extends EventTarget {
  style = {};
  ownerDocument = new EventTarget();
  constructor(left, top) { super(); this.left = left; this.top = top; this.clientWidth = 320; this.clientHeight = 240; }
  getRootNode() { return this.ownerDocument; }
  getBoundingClientRect() { return { left: this.left, top: this.top, width: 320, height: 240 }; }
}
function fixture(index, orthographic = true, zoomObjects) {
  const surface = new Surface(100 + (index % 2) * 320, 80 + Math.floor(index / 2) * 240);
  const camera = orthographic ? new THREE.OrthographicCamera(-4, 4, 3, -3, 0.01, 500) : new THREE.PerspectiveCamera(42, 4/3, 0.01, 500);
  camera.position.set(0, 0, 10);
  const pair = createViewportControls(camera, surface, 'world', zoomObjects);
  pair.controls.enableDamping = false;
  camera.updateMatrixWorld();
  return { surface, camera, ...pair };
}
function wheel(view, x, y) {
  const event = new Event('wheel', { cancelable: true });
  Object.assign(event, { clientX: view.surface.left + x, clientY: view.surface.top + y, deltaY: -120, deltaMode: 0, ctrlKey: false });
  view.surface.dispatchEvent(event);
  view.camera.updateMatrixWorld();
  assert.equal(event.defaultPrevented, true);
}
function pointOnPlane(camera, x, y) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x / 320 * 2 - 1, 1 - y / 240 * 2), camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
}
for (const orthographic of [true, false]) test(`${orthographic ? 'axis' : 'perspective'} zoom anchors to each pane cursor and leaves sibling cameras alone`, () => {
  const views = [0,1,2,3].map(i => fixture(i, orthographic));
  try {
    for (const view of views) {
      const siblings = views.filter(v => v !== view).map(v => ({v, pos:v.camera.position.clone(), target:v.controls.target.clone(), zoom:v.camera.zoom}));
      const anchor = pointOnPlane(view.camera, 235, 85);
      wheel(view,235,85);
      assert.ok(anchor.distanceTo(pointOnPlane(view.camera,235,85)) < 1e-7);
      for (const {v,pos,target,zoom} of siblings) {
        assert.ok(v.camera.position.equals(pos)); assert.ok(v.controls.target.equals(target)); assert.equal(v.camera.zoom,zoom);
      }
    }
  } finally { views.forEach(v => { v.controls.dispose(); v.transform.dispose(); }); }
});

test('each pane gizmo transforms the shared object through one begin/change/commit gesture', () => {
  const views = [0,1,2,3].map(i => fixture(i, i !== 0));
  const scene = new THREE.Scene(), proxy = new THREE.Object3D(); scene.add(proxy);
  views.forEach(v => { v.transform.attach(proxy); scene.add(v.transform.getHelper()); });
  try {
    for (const view of views) {
      proxy.position.set(0,0,0); scene.updateMatrixWorld(true);
      let begin=0,changed=0,commit=0;
      view.transform.addEventListener('mouseDown',()=>begin++);
      view.transform.addEventListener('objectChange',()=>changed++);
      view.transform.addEventListener('mouseUp',()=>commit++);
      // Find the visible X handle with the controller's real raycaster.
      let x=0;
      for (let trial=0.04;trial<0.4;trial+=0.01) {
        view.transform.pointerHover({x:trial,y:0,button:0});
        if(view.transform.axis==='X'){x=trial;break;}
      }
      assert.ok(x>0,'X handle is pickable');
      view.transform.pointerDown({x,y:0,button:0});
      view.transform.pointerMove({x:x+0.15,y:0,button:-1});
      view.transform.pointerUp({button:0});
      assert.ok(proxy.position.x>0); assert.equal(proxy.position.y,0); assert.equal(proxy.position.z,0);
      assert.equal(begin,1); assert.ok(changed>0); assert.equal(commit,1);
      assert.ok(views.every(v=>v.transform.object===proxy));
    }
  } finally { views.forEach(v => { v.controls.dispose(); v.transform.dispose(); }); }
});


test('perspective zoom passes a stale orbit target and preserves the cursor ray on scene geometry', () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const views=[0,1,2,3].map(i=>fixture(i,false,()=>[mesh]));
  try {
    for(const view of views){
      view.controls.target.set(0,0,9.9);view.controls.update();
      const anchor=pointOnPlane(view.camera,235,85);
      const before=view.camera.position.clone();
      wheel(view,235,85);
      assert(view.camera.position.distanceTo(before)>.5,'distance follows the surface, not the exhausted orbit radius');
      assert(anchor.distanceTo(pointOnPlane(view.camera,235,85))<1e-7,'surface remains under pane cursor');
      for(let i=0;i<150;i++)wheel(view,160,120);
      const close=view.camera.position.clone();wheel(view,160,120);
      assert(view.camera.position.distanceTo(close)>.01,'close-up zoom keeps moving');
    }
  } finally {views.forEach(v=>{v.controls.dispose();v.transform.dispose();});mesh.geometry.dispose();mesh.material.dispose();}
});

test('empty/hidden geometry cannot trap perspective travel; disabled controls do not rebase', () => {
 const hidden=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial());hidden.visible=false;hidden.position.z=9.8;hidden.updateMatrixWorld();
 const view=fixture(0,false,()=>[hidden]);
 try {
  view.controls.target.set(0,0,9.9);view.controls.update();
  const before=view.camera.position.clone();wheel(view,160,120);
  assert(view.camera.position.distanceTo(before)>.05,'empty space maintains forward travel');
  view.controls.enabled=false;const target=view.controls.target.clone();
  const e=new Event('wheel',{cancelable:true});Object.assign(e,{clientX:260,clientY:200,deltaY:-120,deltaMode:0,ctrlKey:false});view.surface.dispatchEvent(e);
  assert(view.controls.target.equals(target));
 } finally{view.controls.dispose();view.transform.dispose();hidden.geometry.dispose();hidden.material.dispose();}
});
import { createZoomSurfaceQuery } from '../app/viewport-controls.ts';
import { prepareZoomGeometry } from '../app/zoom-geometry.ts';

test('zoom depth queries cached surfaces under transforms without a full triangle scan', () => {
 const geometry=new THREE.PlaneGeometry(20,20,150,150);geometry.computeBoundingBox();
 prepareZoomGeometry(geometry);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 mesh.position.set(0,0,-4);mesh.rotation.y=.2;mesh.scale.set(2,1,3);mesh.updateMatrixWorld();
 mesh.raycast=()=>{throw new Error('Dense mesh triangle scan during zoom');};
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1)),query=createZoomSurfaceQuery(ray);
 try {
  assert(Math.abs(query([mesh])-14)<1e-7,'rotated and scaled surfaces preserve navigation depth');
  mesh.position.z=-8;assert(Math.abs(query([mesh])-18)<1e-7,'moving a model refreshes navigation bounds');
  const parent=new THREE.Group();parent.add(mesh);parent.visible=false;assert.equal(query([mesh]),undefined,'hidden ancestor excluded');
 }finally{geometry.dispose();mesh.material.dispose();}
});

test('dense hollow meshes do not trap mouse zoom against their enclosing box', () => {
 const geometry=new THREE.TorusGeometry(4,.4,100,240);geometry.computeBoundingBox();prepareZoomGeometry(geometry);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const ring=new THREE.Mesh(geometry,material),screen=new THREE.Mesh(new THREE.PlaneGeometry(30,30),material);
 ring.position.z=9.5;screen.position.z=-10;ring.updateMatrixWorld();screen.updateMatrixWorld();
 ring.raycast=()=>{throw new Error('Full dense scan during wheel');};
 const view=fixture(0,false,()=>[ring,screen]),ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
 try {
  const query=createZoomSurfaceQuery(ray);
  assert.equal(query([ring,screen]),20,'look through the ring to the actual screen');
  const before=view.camera.position.clone();wheel(view,160,120);
  assert(view.camera.position.distanceTo(before)>1,'nearby empty bounds cannot slow mouse dolly');
  ray.ray.origin.set(4,0,10);assert(query([ring,screen])<1,'real curved ring surface still anchors close-up zoom');
  ray.ray.origin.set(0,0,9.5);assert.equal(query([ring,screen]),19.5,'inside bounds remains empty');
 }finally{view.controls.dispose();view.transform.dispose();geometry.dispose();screen.geometry.dispose();material.dispose();}
});

test('unprepared dense geometry is never treated as a solid bounding box or prepared during wheel', () => {
 const geometry=new THREE.TorusGeometry(4,.4,100,240);geometry.computeBoundingBox();
 const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material);
 mesh.raycast=()=>{throw new Error('Unbounded scan');};
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
 try{assert.equal(createZoomSurfaceQuery(ray)([mesh]),undefined);}finally{geometry.dispose();material.dispose();}
});

test('cached zoom surfaces respect near/far and face sides with nonuniform and negative scale', () => {
 const geometry=new THREE.PlaneGeometry(20,20,150,150);geometry.computeBoundingBox();prepareZoomGeometry(geometry);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
 mesh.rotation.y=.3;mesh.scale.set(-2,3,.5);mesh.position.z=-4;mesh.updateMatrixWorld();
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(.1,0,-1).normalize()),query=createZoomSurfaceQuery(ray);
 try{
  for(const side of [THREE.FrontSide,THREE.BackSide,THREE.DoubleSide]){
   material.side=side;const expected=ray.intersectObject(mesh,false)[0]?.distance,actual=query([mesh]);
   if(expected===undefined)assert.equal(actual,undefined);else assert(Math.abs(actual-expected)<1e-6);
  }
  ray.far=2;assert.equal(query([mesh]),undefined);
  ray.far=100;ray.near=20;assert.equal(query([mesh]),undefined);
 }finally{geometry.dispose();material.dispose();}
});

test('zoom triangle work stays bounded across many meshes while selection remains exact', () => {
 const geometry=new THREE.PlaneGeometry(20,20,10,10);geometry.computeBoundingBox();
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),objects=[];let trianglesTested=0;
 for(let i=0;i<180;i++){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.z=-200+i;mesh.updateMatrixWorld();
  const original=mesh.raycast.bind(mesh);mesh.raycast=(ray,hits)=>{trianglesTested+=200;original(ray,hits);};objects.push(mesh);
 }
 const ray=new THREE.Raycaster(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
 try {
  assert.equal(createZoomSurfaceQuery(ray)(objects),31);
  assert(trianglesTested<=20000,'aggregate triangle cost is bounded');
  trianglesTested=0;assert.equal(ray.intersectObjects(objects,false)[0].distance,31);
  assert.equal(trianglesTested,36000,'normal selection raycasts retain the original geometry');
 }finally{geometry.dispose();material.dispose();}
});
