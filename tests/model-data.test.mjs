import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_MODEL_MATERIAL, applyBodyMaterial, nodeMaterial, editModelMaterial, encodeArray, validateModels, transformModels, groupModelNodes, ModelLayer, packModelGeometry, modelGeometry, removeModelNodes, modelPivotEntry, modelSelectionPivot, setModelPivots, modelCoordinateItems, editModelCoordinate, resetModelCoordinates } from '../app/model-data.ts';
const fixture=()=>({id:'model',name:'Stage',format:'obj',hierarchy:true,triangles:1,warnings:[],geometries:{g:{position:encodeArray(new Float32Array([0,0,0,1,0,0,0,1,0]))}},nodes:[{id:'root',parent:null,name:'Root',matrix:new THREE.Matrix4().toArray(),visible:true,locked:false},{id:'part',parent:'root',name:'Part',geometry:'g',matrix:new THREE.Matrix4().makeTranslation(3,2,1).toArray(),visible:true,locked:false}]});

test('live views share decoded arrays with independent GPU ownership and release the last owner',()=>{
 const model=fixture(), original=new THREE.BoxGeometry(2,3,4,20,20,20);
 model.geometries.g=packModelGeometry(original,'Stage',()=>{});original.dispose();
 const main=new ModelLayer(),preview=new ModelLayer();main.sync([model]);preview.sync([model]);
 const a=main.meshes.get('part').geometry,b=preview.meshes.get('part').geometry;
 assert.notEqual(a,b);assert.notEqual(a.attributes.position,b.attributes.position);
 for(const field of ['position','normal','uv'])assert.equal(a.attributes[field].array,b.attributes[field].array);
 assert.equal(a.index.array,b.index.array);assert.notEqual(a.boundingBox,b.boundingBox);
 let mainDisposals=0,previewDisposals=0;
 a.addEventListener('dispose',()=>mainDisposals++);b.addEventListener('dispose',()=>previewDisposals++);
 preview.dispose();preview.dispose();assert.equal(previewDisposals,1);assert.equal(mainDisposals,0);
 const reopened=new ModelLayer();reopened.sync([model]);assert.equal(reopened.meshes.get('part').geometry.attributes.position.array,a.attributes.position.array);
 main.sync([]);assert.equal(mainDisposals,1);assert.equal(reopened.meshes.size,1);
 const retained=reopened.meshes.get('part').geometry.attributes.position.array;
 reopened.dispose();const fresh=new ModelLayer();fresh.sync([model]);
 assert.notEqual(fresh.meshes.get('part').geometry.attributes.position.array,retained,'last owner releases decoded cache');
 assert.deepEqual(fresh.meshes.get('part').geometry.attributes.position.array,retained);
 fresh.dispose();main.dispose();
});

test('material, transform and geometry replacement keep other views isolated',()=>{
 const model=fixture(),main=new ModelLayer(),preview=new ModelLayer();main.sync([model]);preview.sync([model]);
 const before=preview.meshes.get('part'),data=before.geometry.attributes.position.array;
 const moved=transformModels([model],['part'],new THREE.Matrix4().makeTranslation(4,0,0).toArray());
 main.sync(moved);assert.equal(main.meshes.get('part').matrix.elements[12],7);assert.equal(before.matrix.elements[12],3);
 assert.notEqual(main.meshes.get('part').material,before.material);
 const replacement={...model,geometries:{g:{position:encodeArray(new Float32Array([0,0,0,2,0,0,0,2,0]))}}};
 main.sync([replacement]);assert.equal(before.geometry.attributes.position.array,data);
 assert.notEqual(main.meshes.get('part').geometry.attributes.position.array,data);
 preview.sync([replacement]);assert.equal(preview.meshes.get('part').geometry.attributes.position.array,main.meshes.get('part').geometry.attributes.position.array);
 const editable=modelGeometry(replacement.geometries.g);assert.notEqual(editable.attributes.position.array,main.meshes.get('part').geometry.attributes.position.array);editable.dispose();
 main.dispose();preview.dispose();
});
test('parent/child selection transforms only once and grouping preserves world matrices',()=>{
 const model=fixture(), delta=new THREE.Matrix4().makeTranslation(2,0,0).toArray();
 const moved=transformModels([model],['root','part'],delta)[0];assert.equal(moved.nodes[1].matrix[12],5); assert.equal(model.nodes[1].matrix[12],3);
 const grouped=groupModelNodes([model],['part'])[0];assert.deepEqual(grouped.nodes[1].matrix,model.nodes[1].matrix);
 const restored=groupModelNodes([grouped],[grouped.nodes.at(-1).id],true)[0];assert.equal(restored.nodes[1].parent,'root');assert.deepEqual(restored.nodes[1].matrix,model.nodes[1].matrix);
});
test('saved assets validate and retain bounds; visibility and locks inherit',()=>{
 const model=validateModels(JSON.parse(JSON.stringify([fixture()])))[0],layer=new ModelLayer();layer.sync([model]);assert.deepEqual(layer.bounds().min.toArray(),[3,2,1]);
 const hidden={...model,nodes:model.nodes.map(n=>n.id==='root'?{...n,visible:false}:n)};layer.sync([hidden]);assert(layer.bounds().isEmpty());
 const locked={...model,nodes:model.nodes.map(n=>n.id==='root'?{...n,locked:true}:n)};const result=transformModels([locked],['root'],new THREE.Matrix4().makeTranslation(9,0,0).toArray());assert.deepEqual(result[0].nodes[1].matrix,model.nodes[1].matrix);layer.dispose();
});
test('invalid/cyclic models fail before project application',()=>{ const m=fixture();m.nodes[0].parent='part';assert.throws(()=>validateModels([m]),/hierarchy/);const bad=fixture();bad.nodes[1].matrix[0]=NaN;assert.throws(()=>validateModels([bad]),/transform/); });
test('invalid optional normals and UVs recover without changing positions',()=>{
 const g=modelGeometry(fixture().geometries.g), original=Array.from(g.getAttribute('position').array), warnings=[];
 g.setAttribute('normal',new THREE.Float32BufferAttribute([NaN,0,1,0,0,1,0,0,1],3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,Infinity,0,0,1],2));
 const packed=packModelGeometry(g,'Platform',message=>warnings.push(message));
 assert.equal(packed.normal,undefined);assert.equal(packed.uv,undefined);assert.equal(warnings.length,2);
 const restored=modelGeometry(packed);assert.deepEqual(Array.from(restored.getAttribute('position').array),original);
 assert.deepEqual(Array.from(restored.getAttribute('normal').array),[0,0,1,0,0,1,0,0,1]);g.dispose();restored.dispose();
});
test('invalid vertices retain a precise error instead of being silently changed',()=>{
 const g=modelGeometry(fixture().geometries.g);g.getAttribute('position').setY(1,NaN);
 assert.throws(()=>packModelGeometry(g,'Tower',()=>{}),/Tower.*vertex 2 \(Y\)/);g.dispose();
});
test('mismatched optional attributes recover while invalid indices are rejected',()=>{
 const g=modelGeometry(fixture().geometries.g),warnings=[];g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1],3));
 assert.equal(packModelGeometry(g,'Stage',message=>warnings.push(message)).normal,undefined);assert.equal(warnings.length,1);
 g.setIndex([0,1,3]);assert.throws(()=>packModelGeometry(g,'Stage',()=>{}),/Stage.*indices/);g.dispose();
});
test('child removal traverses large hierarchies once and retains immutable undo assets',()=>{
 const model=fixture();let parentReads=0;
 const original=model.nodes[1];model.geometries.unused={...model.geometries.g};
 model.nodes=[model.nodes[0],...Array.from({length:12000},(_,i)=>({...original,id:`part-${i}`,get parent(){parentReads++;return 'root';}}))];
 const result=removeModelNodes([model],['part-11999'])[0];
 assert.equal(result.nodes.length,12000);assert.equal(result.triangles,11999);assert.equal(result.geometries.unused,undefined);
 assert.equal(result.geometries.g,model.geometries.g);assert.equal(model.nodes.length,12001);assert(model.geometries.unused);
 assert(parentReads<100000,`Expected bounded traversal, read parents ${parentReads} times`);
});
test('removal preserves locked descendants and removes entire unlocked branches',()=>{
 const model=fixture();const locked={...model,nodes:model.nodes.map(n=>n.id==='part'?{...n,locked:true}:n)};
 assert.equal(removeModelNodes([locked],['root'])[0],locked);
 assert.deepEqual(removeModelNodes([model],['root','part']),[]);
});
test('compressed geometry preserves every attribute byte, saved projects and deletion counts',()=>{
 const g=new THREE.BoxGeometry(2,3,4,20,20,20), packed=packModelGeometry(g,'Stage',()=>{});
 assert.equal(packed.encoding,'gzip');
 const model=fixture();model.geometries.g=packed;model.triangles=g.index.count/3;
 const saved=validateModels(JSON.parse(JSON.stringify([model])))[0];const restored=modelGeometry(saved.geometries.g);
 for(const field of ['position','normal','uv'])assert.deepEqual(restored.getAttribute(field).array,g.getAttribute(field).array);
 assert.deepEqual(restored.index.array,new Uint32Array(g.index.array));
 const rawBytes=['position','normal','uv'].reduce((sum,f)=>sum+g.getAttribute(f).array.byteLength,0)+g.index.count*4;
 assert(JSON.stringify(packed).length<rawBytes/2,'Repetitive stage geometry compresses materially');
 model.nodes.push({...model.nodes[1],id:'other'});
 const removed=removeModelNodes([model],['other'])[0];assert.equal(removed.triangles,g.index.count/3);
 g.dispose();restored.dispose();
});
test('compressed attributes reject corruption and invalid declared lengths before allocation',()=>{
 const g=new THREE.BoxGeometry(),packed=packModelGeometry(g,'Stage',()=>{});
 assert.throws(()=>modelGeometry({...packed,encoding:'unknown'}),/encoding/);
 for(const size of [0,-4,4.5,NaN,Infinity,1024*1024*1024])assert.throws(()=>modelGeometry({...packed,byteLengths:{...packed.byteLengths,position:size}}),/length/);
 assert.throws(()=>modelGeometry({...packed,byteLengths:{...packed.byteLengths,position:4}}),/length/);
 const bytes=Uint8Array.from(atob(packed.position),c=>c.charCodeAt(0));bytes[bytes.length-8]^=1;
 assert.throws(()=>modelGeometry({...packed,position:encodeArray(bytes)}),/Corrupt/);
 assert.throws(()=>modelGeometry({...packed,position:'AA=='}),/compressed/);g.dispose();
});

test('model pivots preserve geometry, use metres for scaled imports, and travel with transforms',()=>{
 const model=fixture();model.nodes[1].matrix=new THREE.Matrix4().compose(new THREE.Vector3(4,2,1),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,.4)),new THREE.Vector3(.01,.01,.01)).toArray();
 const entry=modelPivotEntry(model,model.nodes[1]);assert(Math.abs(entry.width-.01)<1e-8);assert(Math.abs(entry.height-.01)<1e-8);
 const changed=setModelPivots([model],['part'],'top-left')[0];assert.deepEqual(changed.nodes[1].matrix,model.nodes[1].matrix);assert.equal(changed.geometries,model.geometries);assert.equal(changed.nodes[1].pivotMode,'top-left');
 const p=modelSelectionPivot([changed],['part']);const expected=new THREE.Vector3(0,1,0).applyMatrix4(new THREE.Matrix4().fromArray(model.nodes[1].matrix));assert(p.distanceTo(expected)<1e-8);
 const delta=new THREE.Matrix4().makeTranslation(...p.toArray()).multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2)).multiply(new THREE.Matrix4().makeTranslation(...p.clone().negate().toArray()));
 const rotated=transformModels([changed],['part'],delta.toArray());assert(modelSelectionPivot(rotated,['part']).distanceTo(p)<1e-8);
 assert.deepEqual(validateModels(JSON.parse(JSON.stringify([changed])))[0].nodes[1].pivot,changed.nodes[1].pivot);
 const locked={...model,nodes:model.nodes.map(n=>({...n,locked:true}))};assert.equal(setModelPivots([locked],['part'],'center')[0].nodes[1],locked.nodes[1]);
 const invalid=structuredClone(changed);invalid.nodes[1].pivot=[0,NaN,0];assert.throws(()=>validateModels([invalid]),/pivot/);
});
test('root pivot changes leave all descendant matrices unchanged and use one parent pivot',()=>{
 const model=fixture(),changed=setModelPivots([model],['root'],{custom:[2,3,4]})[0];
 assert.deepEqual(changed.nodes.map(n=>n.matrix),model.nodes.map(n=>n.matrix));
 assert(modelSelectionPivot([changed],['root','part']).distanceTo(modelSelectionPivot([changed],['root']))<1e-8);
});

test('shared model coordinate edits are absolute per item, preserve locks and reset baseline',()=>{
 const model=fixture();model.nodes.push({...model.nodes[1],id:'second',matrix:new THREE.Matrix4().makeTranslation(-2,3,0).toArray()});
 const before=modelCoordinateItems([model],['part','second']);let next=editModelCoordinate([model],['part','second'],'position',0,7);
 const edited=modelCoordinateItems(next,['part','second']);assert(edited.every(i=>Math.abs(i.position[0]-7)<1e-8));edited.forEach((i,j)=>assert.equal(i.position[1],before[j].position[1]));
 next=editModelCoordinate(next,['part'],'rotation',2,810);assert(Math.abs(modelCoordinateItems(next,['part'])[0].rotation[2]-Math.PI*4.5)<1e-8);
 const saved=validateModels(JSON.parse(JSON.stringify(next)));assert.equal(saved[0].nodes[1].initialMatrix.length,16);
 const reset=resetModelCoordinates(saved,['part','second']);reset[0].nodes.forEach((n,i)=>n.matrix.forEach((v,j)=>assert(Math.abs(v-model.nodes[i].matrix[j])<1e-8)));
 const locked={...model,nodes:model.nodes.map(n=>n.id==='part'?{...n,locked:true}:n)};assert.equal(editModelCoordinate([locked],['part'],'position',0,10)[0].nodes[1],locked.nodes[1]);
});
test('model parent/child coordinate selection applies once and child reset follows parent movement',()=>{
 const model=fixture();let next=editModelCoordinate([model],['root','part'],'position',0,10);assert.equal(modelCoordinateItems(next,['root','part']).length,1);
 const childBase=[...next[0].nodes[1].matrix];next=editModelCoordinate(next,['part'],'position',1,20);next=resetModelCoordinates(next,['part']);next[0].nodes[1].matrix.forEach((v,i)=>assert(Math.abs(v-childBase[i])<1e-8));
});


test('model materials inherit, override independently, respect locks and persist',()=>{
 const source=fixture();let [model]=editModelMaterial([source],['root'],{color:'#ff4400',metallic:.6});
 assert.equal(nodeMaterial(model,model.nodes[1]).color,'#ff4400');assert.equal(source.nodes[0].material,undefined);
 [model]=editModelMaterial([model],['part'],{roughness:.2});assert.equal(model.nodes[1].material.metallic,.6);
 [model]=editModelMaterial([model],['root'],{color:'#0044ff'});assert.equal(nodeMaterial(model,model.nodes[1]).color,'#ff4400');
 [model]=editModelMaterial([model],['part'],null);assert.equal(nodeMaterial(model,model.nodes[1]).color,'#0044ff');
 const saved=validateModels(JSON.parse(JSON.stringify([model])))[0];assert.deepEqual(nodeMaterial(saved,saved.nodes[1]),model.nodes[0].material);
 saved.nodes[0].locked=true;assert.equal(editModelMaterial([saved],['part'],{diffuse:0})[0].nodes[1].material,undefined);
 for(const patch of [{roughness:NaN},{diffuse:2},{metallic:-1},{specular:Infinity},{color:'url(remote)'}]){const bad=fixture();bad.nodes[0].material={...DEFAULT_MODEL_MATERIAL,...patch};assert.throws(()=>validateModels([bad]),/material/);}
});
test('model renderer shares and reuses materials, then releases unused materials',()=>{
 const layer=new ModelLayer();let model=fixture();model.nodes.push({...model.nodes[1],id:'second'});layer.sync([model]);
 const initial=layer.meshes.get('part').material;assert.equal(initial,layer.meshes.get('second').material);let disposed=0;initial.addEventListener('dispose',()=>disposed++);
 [model]=editModelMaterial([model],['root'],{color:'#ff0000',diffuse:.5,roughness:.3,metallic:.7,specular:.4});layer.sync([model]);
 const mat=layer.meshes.get('part').material;assert.equal(disposed,0);assert.equal(mat,initial);assert(mat instanceof THREE.MeshPhysicalMaterial);assert.equal(mat.color.r,.5);assert.equal(mat.metalness,.7);assert.equal(mat.roughness,.3);assert.equal(mat.specularIntensity,.4);assert.equal(mat,layer.meshes.get('second').material);
 assert.equal(layer.meshes.get('part').geometry,layer.meshes.get('second').geometry);
 let freed=0;mat.addEventListener('dispose',()=>freed++);layer.sync([]);assert.equal(freed,1);layer.dispose();
});

test('imported selection tracks visible descendants without creating polygon-edge geometry',()=>{
 const model=fixture(),layer=new ModelLayer();try{
  layer.sync([model]);const mesh=layer.meshes.get('part'),geometry=mesh.geometry;assert.equal(mesh.userData.selected,false);
  layer.sync([model],['root']);assert.equal(mesh.userData.selected,true);assert.equal(mesh.children.length,0,'Selection never adds triangle/feature edge overlays');
  layer.sync(transformModels([model],['part'],new THREE.Matrix4().makeTranslation(4,0,0).toArray()),['part']);assert.equal(mesh.geometry,geometry);assert.equal(mesh.matrixWorld.elements[12],7);
  layer.sync([model]);assert.equal(mesh.userData.selected,false);layer.sync([]);assert.equal(layer.meshes.size,0);
 }finally{layer.dispose();}
});

test('wireframe colours inherit independently, reuse materials and ignore reflective properties',()=>{
 const model=fixture();model.nodes[0].style='wireframe';model.nodes[0].material={...DEFAULT_MODEL_MATERIAL,color:'#ff2200',diffuse:.5};model.nodes.push({...model.nodes[1],id:'other',material:{...DEFAULT_MODEL_MATERIAL,color:'#00aaff'}});
 const layer=new ModelLayer();try{
  layer.sync([model]);const wire=layer.meshes.get('part').material,other=layer.meshes.get('other').material;assert(wire.isMeshBasicMaterial);assert.equal(wire.wireframe,true);assert.notEqual(wire,other);assert.equal(other.color.getHexString(),'00aaff');assert(wire.color.equals(new THREE.Color('#ff2200').multiplyScalar(.5)));
  model.nodes[0].material={...model.nodes[0].material,metallic:1,roughness:0,specular:0};layer.sync([model]);assert.equal(layer.meshes.get('part').material,wire);assert.equal(layer.meshes.get('other').material,other);
  model.nodes[0].material={...model.nodes[0].material,color:'#aaff00'};layer.sync([model]);assert.equal(layer.meshes.get('part').material,wire);assert.equal(other.color.getHexString(),'00aaff','Changing one wire colour never recolours a different material');
  let disposed=0;wire.addEventListener('dispose',()=>disposed++);layer.sync([]);assert.equal(disposed,1);
 }finally{layer.dispose();}
});
test('LED wireframes use unlit diffuse emission and recover stored shading when switched back',()=>{
 const body=new THREE.MeshPhysicalMaterial(),value={...DEFAULT_MODEL_MATERIAL,color:'#bb4422',diffuse:.6,metallic:.8,roughness:.2,specular:.3};
 applyBodyMaterial(body,value,true);assert(body.wireframe);assert(body.emissive.equals(new THREE.Color(value.color).multiplyScalar(value.diffuse)));assert.equal(body.color.getHex(),0);assert.equal(body.specularIntensity,0);assert.equal(body.envMapIntensity,0);
 applyBodyMaterial(body,value,false);assert(!body.wireframe);assert.equal(body.emissive.getHex(),0);assert.equal(body.metalness,.8);assert.equal(body.roughness,.2);assert.equal(body.specularIntensity,.3);assert(body.color.equals(new THREE.Color(value.color).multiplyScalar(value.diffuse)));body.dispose();
});
