import * as THREE from "three";
import { setNavigationOrientation } from "./camera-orientation.ts";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
type View = { camera: Camera; controls: OrbitControls; surface: HTMLElement };
export type SpaceMouseState = { matrix: number[]; target: number[]; pivot: number[]; selectionBounds: number[]; bounds: number[]; extents: number[]; frustum: number[]; plane: number[]; perspective: boolean; distance: number };
export type SpaceMouseFrame = { matrix: number[]; extents: number[]; target?: number[] };
export type SpaceMouseBridge = { open(state: SpaceMouseState): boolean; sync(state: SpaceMouseState): void; poll(): SpaceMouseFrame | null; focus(active: boolean): void; close(): void };

export function spaceMouseState(view: View, bounds: THREE.Box3, selection = new THREE.Box3()): SpaceMouseState {
  const { camera, controls } = view;
  camera.updateMatrixWorld();
  const perspective = camera instanceof THREE.PerspectiveCamera;
  const halfHeight = perspective ? Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.near / camera.zoom : (camera.top - camera.bottom) / (2 * camera.zoom);
  const halfWidth = perspective ? halfHeight * camera.aspect : (camera.right - camera.left) / (2 * camera.zoom);
  const normal = new THREE.Vector3(); camera.getWorldDirection(normal);
  const box = bounds.isEmpty() ? new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)) : bounds;
  return { matrix: camera.matrixWorld.toArray(), target: controls.target.toArray(),
    pivot: (selection.isEmpty() ? box : selection).getCenter(new THREE.Vector3()).toArray(),
    selectionBounds: selection.isEmpty() ? [] : [...selection.min.toArray(), ...selection.max.toArray()], bounds: [...box.min.toArray(), ...box.max.toArray()],
    extents: [-halfWidth,-halfHeight,-camera.far,halfWidth,halfHeight,-camera.near],
    frustum: [-halfWidth,halfWidth,-halfHeight,halfHeight,camera.near,camera.far],
    plane: perspective ? [0,1,0,0] : [...normal.toArray(),-normal.dot(controls.target)],
    perspective, distance: Math.max(.1,camera.position.distanceTo(selection.isEmpty() ? controls.target : selection.getCenter(new THREE.Vector3()))) };
}

export function applySpaceMouseFrame(view: View, frame: SpaceMouseFrame) {
  if (!Array.isArray(frame.matrix) || frame.matrix.length !== 16 || !frame.matrix.every(Number.isFinite)) return false;
  const matrix = new THREE.Matrix4().fromArray(frame.matrix);
  if (Math.abs(matrix.determinant() - 1) > .01) return false;
  const { camera, controls } = view;
  let distance = Math.max(controls.minDistance,camera.position.distanceTo(controls.target));
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  matrix.decompose(position,quaternion,scale);
  if (camera instanceof THREE.OrthographicCamera) {
    // Axis views remain axis aligned: the device pans and zooms only.
    if (!Array.isArray(frame.extents) || frame.extents.length !== 6 || !frame.extents.every(Number.isFinite)) return false;
    const height = frame.extents[4] - frame.extents[1]; if (height <= 0) return false;
    camera.zoom = THREE.MathUtils.clamp((camera.top-camera.bottom)/height,controls.minZoom,controls.maxZoom);
    controls.target.add(position.clone().sub(camera.position));
    camera.position.copy(position);camera.updateProjectionMatrix();
  } else {
    camera.position.copy(position);camera.quaternion.copy(quaternion);
    setNavigationOrientation(camera, quaternion);
    // Preserve the driver camera exactly, while letting mouse orbit/zoom resume
    // at the current interest depth (which changes during a SpaceMouse dolly).
    if (frame.target?.length === 3 && frame.target.every(Number.isFinite)) {
      const depth = new THREE.Vector3(...frame.target).sub(position).dot(new THREE.Vector3(0,0,-1).applyQuaternion(quaternion));
      if (depth >= controls.minDistance) distance = depth;
    }
    controls.target.copy(position).add(new THREE.Vector3(0,0,-distance).applyQuaternion(quaternion));
  }
  controls.update();
  camera.updateMatrixWorld();
  return true;
}

export function createSpaceMouseControls(bridge: SpaceMouseBridge, host: HTMLElement, getView: () => View, getBounds: () => THREE.Box3, allowed: () => boolean, changed: () => void, getSelectionBounds: () => THREE.Box3 = () => new THREE.Box3()) {
  let opened = false, active = false, disposed = false, applying = false, retryAt = 0;
  let lastView: View | undefined;
  const deactivate = () => { if(active){active=false;bridge.focus(false);} };
  const sync = () => { if(opened && active && !applying) bridge.sync(spaceMouseState(getView(),getBounds(),getSelectionBounds())); };
  const tick = () => {
    if(disposed)return;
    const doc=host.ownerDocument, focused=doc.activeElement;
    const blocked=focused instanceof HTMLElement && !!focused.closest('input,textarea,select,[contenteditable="true"]');
    if(!allowed() || !doc.hasFocus() || doc.hidden || !host.clientWidth || !host.clientHeight || blocked || doc.querySelector('[role="dialog"]')) {deactivate();return;}
    const view=getView(); if(!view.controls.enabled){deactivate();return;}
    if(!opened){if(performance.now()<retryAt)return;opened=bridge.open(spaceMouseState(view,getBounds(),getSelectionBounds()));if(!opened){retryAt=performance.now()+5000;return;}}
    if(!active || lastView!==view){bridge.focus(false);bridge.sync(spaceMouseState(view,getBounds(),getSelectionBounds()));bridge.focus(true);active=true;lastView=view;}
    const frame=bridge.poll();
    if(frame){applying=true;try{if(applySpaceMouseFrame(view,frame))changed();}finally{applying=false;}}
  };
  const blur=()=>deactivate();host.ownerDocument.defaultView?.addEventListener("blur",blur);
  return {tick,sync,deactivate,dispose:()=>{disposed=true;deactivate();if(opened)bridge.close();host.ownerDocument.defaultView?.removeEventListener("blur",blur);}};
}
