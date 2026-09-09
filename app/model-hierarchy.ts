import * as THREE from "three";
import { descendants, inherited, modelTriangleCount, modelPivotEntry, nodeMaterial, nodeStyle, type ImportedModel, type ModelNode } from "./model-data.ts";
import { groupWorldTransform, transformMatrix, matrixTransform, worldToLocalTransform, type TransformGroup } from "./group-transforms.ts";

export function modelRootsForSelection(models: ImportedModel[], ids: string[]) {
  const chosen = new Set(ids);
  return models.flatMap(model => {
    const byId = new Map(model.nodes.map(n => [n.id,n]));
    return model.nodes.filter(node => {
      if (!chosen.has(node.id)) return false;
      let p=node.parent; while(p){if(chosen.has(p))return false;p=byId.get(p)?.parent || null;}return true;
    }).map(node => ({model,node}));
  });
}
function recount(model: ImportedModel): ImportedModel {
  const used=new Set(model.nodes.flatMap(n=>n.geometry?[n.geometry]:[]));
  const geometries=Object.fromEntries(Object.entries(model.geometries).filter(([id])=>used.has(id)));
  return {...model,geometries,triangles:model.nodes.reduce((n,node)=>n+(node.geometry?modelTriangleCount(geometries[node.geometry]):0),0)};
}
export function renameModelNode(models: ImportedModel[], id: string, value: string) {
  const name=value.trim();if(!name)return models;
  return models.map(model=>{const node=model.nodes.find(n=>n.id===id);return !node || node.name===name || inherited(model,node,"locked") ? model : {...model,nodes:model.nodes.map(n=>n.id===id?{...n,name}:n)};});
}
/** Model matrices are stored in world space: editing hierarchy never decomposes them. */
export function moveModelNodes(models: ImportedModel[], ids: string[], parentId: string|null, sceneGroupId: string|null = null, anchorId?: string, after=false): ImportedModel[] {
  const roots=modelRootsForSelection(models,ids);if(!roots.length)return models;
  const target=models.flatMap(model=>model.nodes.filter(n=>n.id===parentId).map(node=>({model,node})))[0];
  if(parentId && (!target || target.node.geometry || !target.model.hierarchy || inherited(target.model,target.node,"locked")))throw new Error("Choose an unlocked group as the parent.");
  const moved=new Set<string>();
  for(const {model,node} of roots){
    const branch=descendants(model,[node.id]);
    if(inherited(model,node,"locked") || model.nodes.some(n=>branch.has(n.id)&&n.locked))throw new Error("Unlock the selected branch before changing its parent.");
    for(const id of branch)moved.add(id);
  }
  if(parentId && moved.has(parentId))throw new Error("A group cannot be parented to itself or its descendants.");
  if(anchorId && moved.has(anchorId))return models;
  const rootIds=new Set(roots.map(r=>r.node.id));
  const base=models.map(model=>({...model,nodes:model.nodes.filter(n=>!moved.has(n.id))}));
  const transfer=(destination:ImportedModel, entries:typeof roots) => {
    const geometries={...destination.geometries},nodes:ModelNode[]=[];
    for(const {model,node} of entries){
      const branch=descendants(model,[node.id]),geometryIds=new Map<string,string>();
      for(const n of model.nodes.filter(n=>branch.has(n.id))){
        let geometry=n.geometry;
        if(geometry){if(!geometryIds.has(geometry)){const key=geometries[geometry] && geometries[geometry]!==model.geometries[geometry]?crypto.randomUUID():geometry;geometryIds.set(geometry,key);geometries[key]=model.geometries[geometry];}geometry=geometryIds.get(geometry)!;}
        nodes.push({...n,geometry,parent:rootIds.has(n.id)?parentId:n.parent,sceneGroupId:rootIds.has(n.id)?(parentId?undefined:sceneGroupId || undefined):undefined});
      }
    }
    let at=anchorId?destination.nodes.findIndex(n=>n.id===anchorId):destination.nodes.length;if(at<0)at=destination.nodes.length;if(after&&at<destination.nodes.length)at++;
    const ordered=[...destination.nodes];ordered.splice(at,0,...nodes);
    return recount({...destination,nodes:ordered,geometries});
  };
  if(target){const i=base.findIndex(m=>m.id===target.model.id);base[i]=transfer(base[i],roots);}
  else {
    const insert=roots.map(root=>transfer({...root.model,id:crypto.randomUUID(),name:root.node.name,nodes:[],geometries:{}},[root]));
    const at=anchorId?base.findIndex(m=>m.nodes.some(n=>n.id===anchorId)):-1;
    if(at<0)base.push(...insert);else base.splice(at+(after?1:0),0,...insert);
  }
  return base.filter(m=>m.nodes.length).map(recount);
}
export function groupModelsTogether(models: ImportedModel[], ids:string[]) {
  const roots=modelRootsForSelection(models,ids);if(!roots.length)return models;
  const same=roots.every(r=>r.model===roots[0].model && r.node.parent===roots[0].node.parent);
  const parent=same?roots[0].node.parent:null,id=crypto.randomUUID();
  const node:ModelNode={id,parent,name:"Group",matrix:new THREE.Matrix4().toArray(),visible:true,locked:false,sceneGroupId:parent?undefined:roots[0].node.sceneGroupId};
  const destination:ImportedModel=parent?roots[0].model:{id:crypto.randomUUID(),name:"Group",format:"group",hierarchy:true,nodes:[],geometries:{},warnings:[],triangles:0};
  const withGroup=parent?models.map(m=>m.id===destination.id?{...m,nodes:[...m.nodes,node]}:m):[...models,{...destination,nodes:[node]}];
  return moveModelNodes(withGroup,ids,id);
}
export function sceneGroupModelIds(models:ImportedModel[],groups:TransformGroup[],ids:string[]) {
  const chosen=new Set(ids);let changed=true;while(changed){changed=false;for(const g of groups)if(g.parentId&&chosen.has(g.parentId)&&!chosen.has(g.id)){chosen.add(g.id);changed=true;}}
  return models.flatMap(m=>m.nodes.filter(n=>!n.parent&&n.sceneGroupId&&chosen.has(n.sceneGroupId)).map(n=>n.id));
}
/** Keep model world matrices synchronized with shared scene-group edits. */
export function transformSceneGroupModels(models:ImportedModel[],before:TransformGroup[],after:TransformGroup[],move=true) {
  const oldById=new Map(before.map(g=>[g.id,g])),newById=new Map(after.map(g=>[g.id,g]));
  return models.map(model=>{
    const root=model.nodes[0],owner=root.sceneGroupId;if(!owner)return model;
    let nextOwner:string|null=owner;while(nextOwner&&!newById.has(nextOwner))nextOwner=oldById.get(nextOwner)?.parentId || null;
    const beforeGroup=oldById.get(owner),afterGroup=newById.get(owner);
    const oldMatrix=beforeGroup?transformMatrix(groupWorldTransform(owner,before)):null;
    const newMatrix=afterGroup?transformMatrix(groupWorldTransform(owner,after)):null;
    let delta:THREE.Matrix4|null=null;
    if(move&&oldMatrix&&newMatrix&&!oldMatrix.equals(newMatrix)&&Math.abs(oldMatrix.determinant())>1e-12)delta=newMatrix.clone().multiply(oldMatrix.invert());
    if(!delta&&owner===nextOwner)return model;
    return {...model,nodes:model.nodes.map(node=>({...node,sceneGroupId:node.id===root.id?nextOwner || undefined:node.sceneGroupId,...(delta&&!inherited(model,node,"locked")?{matrix:delta.clone().multiply(new THREE.Matrix4().fromArray(node.matrix)).toArray(),initialMatrix:delta.clone().multiply(new THREE.Matrix4().fromArray(node.initialMatrix || node.matrix)).toArray(),rotation:undefined}: {})}))};
  });
}
export function modelsWithGroupState(models:ImportedModel[],groups:TransformGroup[],appearances:Record<string,NonNullable<ImportedModel["sceneAppearance"]>>={}) {
  const byId=new Map(groups.map(g=>[g.id,g]));
  return models.map(model=>{
    const root=model.nodes[0];let parent=root.sceneGroupId,visible=true,locked=false;
    const sceneAppearance:NonNullable<ImportedModel["sceneAppearance"]>={},visited=new Set<string>();
    while(parent&&!visited.has(parent)){
      visited.add(parent);const g=byId.get(parent);if(!g)break;
      visible&&=g.visible;locked||=g.locked;
      sceneAppearance.material??=appearances[parent]?.material;
      sceneAppearance.style??=appearances[parent]?.style;
      parent=g.parentId || undefined;
    }
    // Keep inherited values separate from local overrides so Inherit remains live.
    const appearance=sceneAppearance.material||sceneAppearance.style?sceneAppearance:undefined;
    if(visible&&!locked&&!appearance&&!model.sceneAppearance)return model;
    return {...model,sceneAppearance:appearance,nodes:visible&&!locked?model.nodes:model.nodes.map(n=>n.id===root.id?{...n,visible:n.visible&&visible,locked:n.locked||locked}:n)};
  });
}

/** Promote only the necessary ancestor chain into the shared scene hierarchy. */
export function promoteModelGroup(models:ImportedModel[],groups:TransformGroup[],id:string):{models:ImportedModel[],groups:TransformGroup[]} {
  const model=models.find(m=>m.nodes.some(n=>n.id===id)),node=model?.nodes.find(n=>n.id===id);
  if(!model||!node||node.geometry)throw new Error("Choose a group as the parent.");
  if(inherited(model,node,"locked"))throw new Error("Unlock the group before changing its hierarchy.");
  if(node.parent){const result=promoteModelGroup(models,groups,node.parent);return promoteModelGroup(result.models,result.groups,id);}
  const entry=modelPivotEntry(model,node),world=matrixTransform(entry.frame.clone().setPosition(entry.worldPoint));
  const parentId=node.sceneGroupId || null,parent=parentId?groupWorldTransform(parentId,groups):null,transform=parent?worldToLocalTransform(parent,world):world;
  const group:TransformGroup={id:node.id,name:node.name,sliceIds:[],parentId,visible:node.visible,locked:node.locked,expanded:true,legacySelectionGroup:false,transform,initialTransform:transform,pivotMode:node.pivotMode};
  // Keep inherited appearance when the structural parent changes representation.
  const prepared=models.map(m=>m===model?{...m,nodes:m.nodes.map(n=>n.parent===id?{...n,material:n.material || nodeMaterial(m,n),style:n.style || nodeStyle(m,n)}:n)}:m);
  const children=model.nodes.filter(n=>n.parent===id).map(n=>n.id);
  const detached=children.length?moveModelNodes(prepared,children,null,id):prepared;
  return {models:detached.filter(m=>m.nodes[0].id!==id),groups:[...groups,group]};
}
export function ungroupModels(models:ImportedModel[],ids:string[]) {
  let next=models;
  for(const {node} of modelRootsForSelection(models,ids)){
    if(node.geometry)continue;
    const model=next.find(m=>m.nodes.some(n=>n.id===node.id));if(!model)continue;
    if(inherited(model,node,"locked"))throw new Error("Unlock the group before ungrouping.");
    const children=model.nodes.filter(n=>n.parent===node.id).map(n=>n.id);
    if(children.length)next=moveModelNodes(next,children,node.parent,node.sceneGroupId || null);
    next=next.map(m=>({...m,nodes:m.nodes.filter(n=>n.id!==node.id)})).filter(m=>m.nodes.length).map(recount);
  }
  return next;
}

/** Full displayed model row order, including rows outside the virtualized window. */
export function modelHierarchyRows(models:ImportedModel[],expanded:Set<string>,query="",sceneGroupId:string|null=null,depthOffset=0) {
  const rows:Array<{model:ImportedModel;node:ModelNode;depth:number}>=[],needle=query.toLowerCase();
  for(const model of models){
    if((model.nodes[0].sceneGroupId||null)!==sceneGroupId)continue;
    const children=new Map<string|null,ModelNode[]>();
    for(const node of model.nodes){const list=children.get(node.parent)||[];list.push(node);children.set(node.parent,list);}
    const visit=(parent:string|null,depth:number)=>{for(const node of children.get(parent)||[]){
      if(!query||node.name.toLowerCase().includes(needle))rows.push({model,node,depth});
      if(model.hierarchy&&(query||expanded.has(node.id)))visit(node.id,depth+1);
    }};visit(null,depthOffset);
  }
  return rows;
}
export function orderedSceneModelIds(models:ImportedModel[],groups:TransformGroup[],expanded:Set<string>,query="") {
  const ids:string[]=[],visited=new Set<string>();
  const visit=(group:TransformGroup)=>{
    if(visited.has(group.id))return;visited.add(group.id);
    if(!group.expanded&&!query)return;
    groups.filter(child=>child.parentId===group.id).forEach(visit);
    ids.push(...modelHierarchyRows(models,expanded,query,group.id).map(row=>row.node.id));
  };
  groups.filter(group=>!group.parentId||!groups.some(parent=>parent.id===group.parentId)).forEach(visit);
  ids.push(...modelHierarchyRows(models,expanded,query).map(row=>row.node.id));return ids;
}
export function selectModelHierarchyRange(current:string[],target:string,anchor:string|null,order:string[],modifiers:{ctrlKey:boolean;metaKey:boolean;shiftKey:boolean}) {
  const additive=modifiers.ctrlKey||modifiers.metaKey,start=anchor?order.indexOf(anchor):-1,end=order.indexOf(target);
  if(modifiers.shiftKey&&start>=0&&end>=0){
    const range=order.slice(Math.min(start,end),Math.max(start,end)+1);
    return {ids:additive?[...new Set([...current,...range])]:range,anchor};
  }
  return {ids:additive?(current.includes(target)?current.filter(id=>id!==target):[...current,target]):[target],anchor:target};
}
