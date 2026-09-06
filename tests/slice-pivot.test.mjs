import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { PIVOT_PRESETS, pivotOffset, pivotKey, reanchorTransform, snapPivot } from '../app/slice-pivot.ts';

// Exercise the production geometry builder without mounting a browser/WebGL renderer.
const source = readFileSync(new URL('../app/three-simulation.tsx', import.meta.url), 'utf8');
const geometrySource = source.slice(source.indexOf('function clipPolygon('), source.indexOf('export default function ThreeSimulation'));
const compiled = ts.transpileModule(geometrySource.replace('export function createSliceGeometry','function createSliceGeometry'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const createGeometry = new Function('THREE','pivotOffset',compiled+'\nreturn createSliceGeometry;')(THREE,pivotOffset);
const slice = { id:'test', input:{x:100,y:80,width:800,height:400,points:[]}, output:{x:0,y:0,width:800,height:400,points:[]} };
const width=4, height=2, pitch=.005;
const matrix = t => new THREE.Matrix4().compose(new THREE.Vector3(...t.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation)),new THREE.Vector3(...t.scale));
const close = (a,b) => assert.ok(Math.abs(a-b)<2e-6,`${a} != ${b}`);

test('XY snapping selects all nine anchors and clamps out-of-pad drags',()=>{
  PIVOT_PRESETS.forEach((preset,i)=>assert.equal(snapPivot(i%3/2,Math.floor(i/3)/2),preset));
  assert.equal(snapPivot(-2,3),'bottom-left'); assert.equal(snapPivot(.7,.1),'top-center');
});
for(const curvature of [{horizontal:0,vertical:0},{horizontal:180,vertical:50},{horizontal:360,vertical:0}]) test(`pivot edits preserve vertices and UVs with curvature ${curvature.horizontal}/${curvature.vertical}, rotation, scale, and a transformed parent`,()=>{
  const old='bottom-center', t={position:[3,-2,1],rotation:[.4,-.7,1.1],scale:[2,.5,1.4]};
  const parent=matrix({position:[8,2,1],rotation:[-.2,.4,.1],scale:[1.3,.8,2]});
  const geometry=createGeometry(slice,pitch,.1,curvature,1920,1080,old);
  try {
    for(const next of [...PIVOT_PRESETS,{custom:[.37,-.26,.48]},{custom:[8,4,-2]}]) {
      const changed=reanchorTransform(t,pivotOffset(old,width,height),pivotOffset(next,width,height));
      const other=createGeometry(slice,pitch,.1,curvature,1920,1080,next);
      const beforeMatrix=parent.clone().multiply(matrix(t)),afterMatrix=parent.clone().multiply(matrix(changed));
      try {
        assert.equal(other.attributes.position.count,geometry.attributes.position.count);
        for(let i=0;i<geometry.attributes.position.count;i++) {
          const before=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(beforeMatrix);
          const after=new THREE.Vector3().fromBufferAttribute(other.attributes.position,i).applyMatrix4(afterMatrix);
          before.toArray().forEach((v,axis)=>close(v,after.getComponent(axis)));
        }
        geometry.attributes.uv.array.forEach((v,i)=>close(v,other.attributes.uv.array[i]));
      } finally {other.dispose();}
    }
  } finally {geometry.dispose();}
});
test('custom pivots survive project/snapshot JSON round trips and reverse compensation',()=>{
  const pivot={custom:[.125,-.75,1.5]}, snapshot={pivot:'bottom-center',pivotOverrides:{screen:pivot}};
  const loaded=JSON.parse(JSON.stringify(snapshot));
  assert.equal(pivotKey(loaded.pivotOverrides.screen),pivotKey(pivot));
  const t={position:[2,3,4],rotation:[.2,.3,.4],scale:[2,3,.5]}, previous=pivotOffset('top-right',4,2),next=pivotOffset(pivot,4,2);
  const reverted=reanchorTransform(reanchorTransform(t,previous,next),next,previous);
  t.position.forEach((v,i)=>close(v,reverted.position[i]));
  assert.deepEqual(pivotOffset(loaded.pivot,4,2),[0,-1,0]);
});
