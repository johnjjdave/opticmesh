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
function fixture(index, orthographic = true) {
  const surface = new Surface(100 + (index % 2) * 320, 80 + Math.floor(index / 2) * 240);
  const camera = orthographic ? new THREE.OrthographicCamera(-4, 4, 3, -3, 0.01, 500) : new THREE.PerspectiveCamera(42, 4/3, 0.01, 500);
  camera.position.set(0, 0, 10);
  const pair = createViewportControls(camera, surface, 'world');
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
