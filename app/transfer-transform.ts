import * as THREE from "three";
export type TransferFrame={matrix:THREE.Matrix4;center:THREE.Vector3};
/** A rigid world-space delta: match geometry centres/orientations without editing pivots or scale. */
export function transferDelta(source:TransferFrame,target:TransferFrame){
 const frame=({matrix,center}:TransferFrame)=>{
  if(!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-12||!center.toArray().every(Number.isFinite))throw new Error("Transfer requires valid object geometry and transforms.");
  const rotation=new THREE.Quaternion();matrix.decompose(new THREE.Vector3(),rotation,new THREE.Vector3());
  return new THREE.Matrix4().compose(center.clone().applyMatrix4(matrix),rotation.normalize(),new THREE.Vector3(1,1,1));
 };
 return frame(target).multiply(frame(source).invert());
}
