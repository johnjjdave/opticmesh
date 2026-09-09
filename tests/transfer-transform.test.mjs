import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {transferDelta} from '../app/transfer-transform.ts';
const matrix=(p,r,s=[1,1,1])=>new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(...s));
const near=(a,b)=>assert(a.distanceTo(b)<1e-8,`${a.toArray()} vs ${b.toArray()}`);
test('centre-to-centre transfer compensates bottom/custom pivots, rotation and nonuniform scale',()=>{
 for(const center of [new THREE.Vector3(0,2,-.05),new THREE.Vector3(-1,3,2)]){
  const source={matrix:matrix([-4,7,2],[.2,.5,-.3],[2,.8,1.3]),center},target={matrix:matrix([8,3,-1],[.5,-.4,1],[4,2,3]),center:new THREE.Vector3(2,-1,.2)};
  const original=source.matrix.toArray(),delta=transferDelta(source,target),after=delta.clone().multiply(source.matrix),q=new THREE.Quaternion(),scale=new THREE.Vector3(),tq=new THREE.Quaternion();
  near(center.clone().applyMatrix4(after),target.center.clone().applyMatrix4(target.matrix));after.decompose(new THREE.Vector3(),q,scale);target.matrix.decompose(new THREE.Vector3(),tq,new THREE.Vector3());assert(q.angleTo(tq)<1e-7);near(scale,new THREE.Vector3(2,.8,1.3));assert.deepEqual(source.matrix.toArray(),original);
  near(new THREE.Vector3(1,2,3).applyMatrix4(after).applyMatrix4(delta.clone().invert()),new THREE.Vector3(1,2,3).applyMatrix4(source.matrix));
 }
});
test('empty/invalid transforms fail instead of producing non-finite scene geometry',()=>{const valid={matrix:new THREE.Matrix4(),center:new THREE.Vector3()};assert.throws(()=>transferDelta({...valid,matrix:matrix([0,0,0],[0,0,0],[0,1,1])},valid));assert.throws(()=>transferDelta(valid,{...valid,center:new THREE.Vector3(NaN,0,0)}));});
