import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix4} from 'three';
import {triangulateExtrudedPolygon} from '../app/extruded-polygon.ts';
import {FBXLoader} from '../app/vendor/FBXLoader.js';
import {FBXLoader as UpstreamLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
const strip=()=>{
 const curve=Array.from({length:9},(_,i)=>new Vector3(Math.cos(i*Math.PI/12)*10,0,Math.sin(i*Math.PI/12)*10));
 return [...curve,...curve.toReversed().map(v=>v.clone().add(new Vector3(0,2,0)))];
};
function checkStrip(points, triangles){
 assert.equal(triangles.length,points.length-2);
 const edges=new Map();
 for(const tri of triangles){
  const [a,b,c]=tri.map(i=>points[i]);
  assert(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-7);
  // Each face spans only a single adjacent curved segment, never the arc interior.
  const columns=new Set(tri.map(i=>Math.round(Math.atan2(points[i].z,points[i].x)*12/Math.PI)));
  assert.equal(columns.size,2);
  assert.equal(Math.max(...columns)-Math.min(...columns),1);
  for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);}
 }
 for(let i=0;i<points.length;i++)assert.equal(edges.get([i,(i+1)%points.length].sort((a,b)=>a-b).join(',')),1);
 assert([...edges.values()].every(n=>n===1||n===2));
}
test('curved extrusion keeps every boundary segment, winding and triangle count',()=>{
 const points=strip();checkStrip(points,triangulateExtrudedPolygon(points));
 for(let start=0;start<points.length;start++)for(const reversed of [false,true]){
  let reordered=[...points.slice(start),...points.slice(0,start)];if(reversed)reordered=reordered.toReversed();
  checkStrip(reordered,triangulateExtrudedPolygon(reordered));
  const triangles=triangulateExtrudedPolygon(reordered), [a,b,c]=triangles[0].map(i=>reordered[i]);
  const normal=b.clone().sub(a).cross(c.clone().sub(a));const radial=a.clone().setY(0);
  assert(reversed ? normal.dot(radial)>0 : normal.dot(radial)<0);
 }
});
test('recognition is independent of object rotation, translation and physical units',()=>{
 const points=strip();for(const scale of [.001,1,1000]){
 const matrix=new Matrix4().makeRotationX(.8).premultiply(new Matrix4().makeRotationZ(.3)).premultiply(new Matrix4().makeScale(scale,scale,scale)).premultiply(new Matrix4().makeTranslation(50,10,-30));
 assert.deepEqual(triangulateExtrudedPolygon(points.map(v=>v.clone().applyMatrix4(matrix))),triangulateExtrudedPolygon(points));
 }
});
test('planar, unmatched, degenerate and invalid polygons retain loader fallback',()=>{
 assert.equal(triangulateExtrudedPolygon([new Vector3(0,0,0),new Vector3(1,0,0),new Vector3(1,1,0),new Vector3(0,1,0)]),null);
 const flat=strip().map(v=>v.clone().setZ(0));assert.equal(triangulateExtrudedPolygon(flat),null);
 const unmatched=strip();unmatched[0].y+=.1;assert.equal(triangulateExtrudedPolygon(unmatched),null);
 const bad=strip();bad[0].x=NaN;assert.equal(triangulateExtrudedPolygon(bad),null);
 assert.equal(triangulateExtrudedPolygon(strip().slice(1)),null);
});
function fbx(points){
 return new TextEncoder().encode(`; FBX 7.4.0 project file
FBXHeaderExtension:  {
 FBXHeaderVersion: 1003
 FBXVersion: 7400
}
Objects:  {
 Geometry: 1, "Geometry::Surface", "Mesh" {
  Vertices: *${points.length*3} {
   a: ${points.flatMap(v=>v.toArray()).join(',')}
  }
  PolygonVertexIndex: *${points.length} {
   a: ${points.map((_,i)=>i===points.length-1?-i-1:i).join(',')}
  }
 }
 Model: 2, "Model::Surface", "Mesh" {
  Version: 232
 }
}
Connections:  {
 C: "OO",1,2
 C: "OO",2,0
}
`.replace(/^ +/gm, indent => '\t'.repeat(indent.length))).buffer;
}
test('FBX loader uses strip faces and leaves ordinary polygon conversion unchanged',()=>{
 const points=strip(),buffer=fbx(points),root=new FBXLoader().parse(buffer,'');
 const mesh=root.children[0];assert(mesh.isMesh);
 const positions=mesh.geometry.getAttribute('position');
 const ids=Array.from({length:positions.count},(_,i)=>points.findIndex(p=>p.distanceTo(new Vector3().fromBufferAttribute(positions,i))<1e-5));
 checkStrip(points,Array.from({length:ids.length/3},(_,i)=>ids.slice(i*3,i*3+3)));
 const planar=[new Vector3(0,0,0),new Vector3(2,0,0),new Vector3(2,1,0),new Vector3(1,.4,0),new Vector3(0,1,0)];
 const a=new FBXLoader().parse(fbx(planar),'').children[0].geometry;
 const b=new UpstreamLoader().parse(fbx(planar),'').children[0].geometry;
 assert.deepEqual(a.getAttribute('position').array,b.getAttribute('position').array);
});
