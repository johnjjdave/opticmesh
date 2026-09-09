import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {encodeArray,validateModels,nodeMaterial,nodeStyle,editModelMaterial,DEFAULT_MODEL_MATERIAL,ModelLayer} from '../app/model-data.ts';
import {modelHierarchyRows,orderedSceneModelIds,selectModelHierarchyRange,moveModelNodes,renameModelNode,groupModelsTogether,ungroupModels,promoteModelGroup,transformSceneGroupModels,modelsWithGroupState,sceneGroupModelIds} from '../app/model-hierarchy.ts';
const identity=()=>new THREE.Matrix4().toArray();
const fixture=(id='a')=>({id,name:id,format:'obj',hierarchy:true,warnings:[],triangles:1,geometries:{g:{position:encodeArray(new Float32Array([0,0,0,1,0,0,0,1,0]))}},nodes:[{id:id+'root',name:'Root',parent:null,matrix:identity(),visible:true,locked:false},{id:id+'group',name:'Group',parent:id+'root',matrix:identity(),visible:true,locked:false},{id:id+'part',name:'Part',parent:id+'group',geometry:'g',matrix:new THREE.Matrix4().makeShear(.2,.3,.1,.2,.3,.1).setPosition(3,2,1).toArray(),visible:true,locked:false}]});
const near=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-8));
test('reparent and detach keep geometry, authored shear, pivots and reset matrices',()=>{
 const a=fixture(),b=fixture('b');a.nodes[2].pivot=[1,2,3];a.nodes[2].initialMatrix=[...a.nodes[2].matrix];
 const moved=moveModelNodes([a,b],['apart'],'bgroup');validateModels(moved);const part=moved[1].nodes.find(n=>n.id==='apart');near(part.matrix,a.nodes[2].matrix);assert.deepEqual(part.pivot,[1,2,3]);assert.deepEqual(part.initialMatrix,a.nodes[2].matrix);assert.notEqual(part.geometry,'g');assert.equal(moved[1].geometries[part.geometry],a.geometries.g);
 const detached=moveModelNodes(moved,['apart'],null,'scene-group');validateModels(detached);assert.equal(detached.at(-1).nodes[0].sceneGroupId,'scene-group');near(detached.at(-1).nodes[0].matrix,part.matrix);
});
test('cycles, self drops and locked branches are protected',()=>{const a=fixture();assert.throws(()=>moveModelNodes([a],['aroot'],'agroup'),/descendants/);a.nodes[2].locked=true;assert.throws(()=>moveModelNodes([a],['agroup'],null),/Unlock/);assert.equal(renameModelNode([a],'apart','New')[0],a);});
test('whole imported roots group and ungroup across files without duplicate IDs',()=>{const a=fixture(),b=fixture('b'),grouped=groupModelsTogether([a,b],['aroot','broot']);validateModels(grouped);assert.equal(grouped.length,1);const group=grouped[0].nodes[0];assert.equal(grouped[0].nodes.filter(n=>n.parent===group.id).length,2);const ungrouped=ungroupModels(grouped,[group.id]);validateModels(ungrouped);assert.equal(ungrouped.length,2);near(ungrouped[0].nodes.find(n=>n.id==='apart').matrix,a.nodes[2].matrix);});
test('promotion preserves nested hierarchy and world placement for mixed groups',()=>{const a=fixture();const next=promoteModelGroup([a],[],'agroup');validateModels(next.models);assert.equal(next.groups.length,2);assert.equal(next.groups.find(g=>g.id==='agroup').parentId,'aroot');assert.equal(next.models[0].nodes[0].sceneGroupId,'agroup');near(next.models[0].nodes[0].matrix,a.nodes[2].matrix);assert.deepEqual(sceneGroupModelIds(next.models,next.groups,['aroot']),['apart']);});
test('shared group delta, inherited visibility/lock and ungroup are consistent',()=>{const next=promoteModelGroup([fixture()],[],'agroup'),before=next.models[0].nodes[0].matrix;
 const groups=next.groups.map(g=>g.id==='aroot'?{...g,transform:{...g.transform,position:[g.transform.position[0]+4,...g.transform.position.slice(1)]}}:g);
 const moved=transformSceneGroupModels(next.models,next.groups,groups);assert(Math.abs(moved[0].nodes[0].matrix[12]-before[12]-4)<1e-8);
 const hidden=modelsWithGroupState(moved,groups.map(g=>({...g,visible:false,locked:true})));assert.equal(hidden[0].nodes[0].visible,false);assert.equal(hidden[0].nodes[0].locked,true);assert.equal(moved[0].nodes[0].visible,true);
 const detached=transformSceneGroupModels(moved,groups,[]);assert.equal(detached[0].nodes[0].sceneGroupId,undefined);near(detached[0].nodes[0].matrix,moved[0].nodes[0].matrix);
});

test('model material and display inherit across nested shared groups without baking overrides',()=>{
 const model=fixture();model.nodes[0].sceneGroupId='inner';
 const groups=[{id:'outer',parentId:null,sliceIds:['led'],visible:true,locked:false},{id:'inner',parentId:'outer',sliceIds:[],visible:true,locked:false}];
 const red={...DEFAULT_MODEL_MATERIAL,color:'#ff4400'},blue={...red,color:'#0044ff'};
 const values={outer:{material:red,style:'wireframe'},inner:{style:'shaded'}};
 let effective=modelsWithGroupState([model],groups,values)[0];
 assert.equal(nodeMaterial(effective,effective.nodes[2]),red);assert.equal(nodeStyle(effective,effective.nodes[2]),'shaded');
 assert.equal(effective.nodes[0].material,undefined);assert.equal(model.sceneAppearance,undefined);assert.equal(model.nodes[2].material,undefined);
 const edited=editModelMaterial([effective],['apart'],{roughness:.3})[0];assert.deepEqual(edited.nodes[2].material,{...red,roughness:.3},'Partial child override starts from effective group values');
 model.nodes[2].material=blue;model.nodes[2].style='wireframe';effective=modelsWithGroupState([model],groups,values)[0];
 assert.equal(nodeMaterial(effective,effective.nodes[2]),blue);assert.equal(nodeStyle(effective,effective.nodes[2]),'wireframe');
 delete model.nodes[2].material;delete model.nodes[2].style;values.outer.material=blue;effective=modelsWithGroupState([model],groups,values)[0];assert.equal(nodeMaterial(effective,effective.nodes[2]),blue);
 delete values.outer.material;effective=modelsWithGroupState([model],groups,values)[0];assert.equal(nodeMaterial(effective,effective.nodes[2]),DEFAULT_MODEL_MATERIAL);
 model.nodes[0].sceneGroupId=undefined;effective=modelsWithGroupState([model],groups,values)[0];assert.equal(nodeStyle(effective,effective.nodes[2]),'shaded');
});

test('render layers apply live shared material/style changes without rebuilding mesh geometry',()=>{
 const model=fixture();model.nodes[0].sceneGroupId='group';const groups=[{id:'group',sliceIds:[],visible:true,locked:false}],values={group:{material:{...DEFAULT_MODEL_MATERIAL,color:'#bb4400',metallic:.8,roughness:.2,specular:.4}}};
 const layer=new ModelLayer();try{
  layer.sync(modelsWithGroupState([model],groups,values));const mesh=layer.meshes.get('apart'),geometry=mesh.geometry;
  assert.equal(mesh.material.color.getHexString(),'bb4400');assert.equal(mesh.material.metalness,.8);assert.equal(mesh.material.roughness,.2);assert.equal(mesh.material.specularIntensity,.4);
  values.group.material={...values.group.material,color:'#0044bb'};layer.sync(modelsWithGroupState([model],groups,values));assert.equal(mesh.material.color.getHexString(),'0044bb');assert.equal(mesh.geometry,geometry);
  values.group.style='wireframe';layer.sync(modelsWithGroupState([model],groups,values));assert.equal(mesh.material.wireframe,true);assert.equal(mesh.material.color.getHexString(),'0044bb');assert.equal(mesh.geometry,geometry);
 }finally{layer.dispose();}
});

test('hierarchy ranges use displayed order across imports/shared groups and preserve an anchor',()=>{
 const a=fixture(),b=fixture('b'),c=fixture('c');a.nodes[0].sceneGroupId='outer';b.nodes[0].sceneGroupId='inner';
 const groups=[{id:'outer',parentId:null,expanded:true},{id:'inner',parentId:'outer',expanded:true}],expanded=new Set(['aroot','agroup','broot','bgroup','croot','cgroup']);
 const order=orderedSceneModelIds([a,b,c],groups,expanded);assert.deepEqual(order,['broot','bgroup','bpart','aroot','agroup','apart','croot','cgroup','cpart']);
 const shift={ctrlKey:false,metaKey:false,shiftKey:true};let result=selectModelHierarchyRange(['bpart'],'cpart','bpart',order,shift);assert.deepEqual(result.ids,order.slice(2));assert.equal(result.anchor,'bpart');
 result=selectModelHierarchyRange(result.ids,'apart',result.anchor,order,shift);assert.deepEqual(result.ids,order.slice(2,6),'Repeated Shift-click shrinks the same anchored range');
 assert.deepEqual(selectModelHierarchyRange(['cpart'],'bpart','cpart',order,shift).ids,order.slice(2));
 assert.deepEqual(selectModelHierarchyRange(['cpart'],'bpart',null,order,shift).ids,['bpart']);
 assert.deepEqual(selectModelHierarchyRange(['cpart'],'apart','bpart',order,{...shift,ctrlKey:true}).ids,['cpart',...order.slice(2,6)]);
 assert.deepEqual(selectModelHierarchyRange(['apart','cpart'],'apart','cpart',order,{...shift,ctrlKey:true,shiftKey:false}).ids,['cpart']);
 expanded.delete('agroup');assert(!orderedSceneModelIds([a,b,c],groups,expanded).includes('apart'));
 assert.deepEqual(modelHierarchyRows([c],expanded,'Part').map(row=>row.node.id),['cpart']);
 groups[0].expanded=false;assert.deepEqual(orderedSceneModelIds([a,b,c],groups,expanded),['croot','cgroup','cpart']);
});
