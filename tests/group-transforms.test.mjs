import assert from "node:assert/strict";
import test from "node:test";
import { releaseSceneGroups, reanchorGroup, canParentGroup, groupDescendantSliceIds, groupTransformFromMovedChild, groupTransformFromWorldBounds, groupTransformFromWorldChildren, groupWorldTransform, localToWorldTransform, matrixTransform, migrateTransformGroup, moveTransformGroup, placeTransformGroup, transformMatrix, worldToLocalTransform } from "../app/group-transforms.ts";

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`);
const closeTransform = (actual, expected) => {
  actual.position.forEach((value, axis) => close(value, expected.position[axis]));
  actual.rotation.forEach((value, axis) => close(value, expected.rotation[axis]));
  (actual.scale || [1, 1, 1]).forEach((value, axis) => close(value, (expected.scale || [1, 1, 1])[axis]));
};

test("grouping at the combined child centre preserves child world transforms", () => {
  const worlds = [
    { position: [-2, 1, 0], rotation: [0, 0.2, 0], scale: [1, 1, 1] },
    { position: [4, 3, 2], rotation: [0, -0.1, 0], scale: [1, 1, 1] },
  ];
  const group = groupTransformFromWorldChildren(worlds);
  closeTransform(group, { position: [1, 2, 1], rotation: [0, 0, 0], scale: [1, 1, 1] });
  worlds.forEach((world) => closeTransform(localToWorldTransform(group, worldToLocalTransform(group, world)), world));
});

test("group movement updates the parent while retaining child-local transforms", () => {
  const local = { position: [2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  const movedWorld = { position: [7, 3, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 1] };
  const parent = groupTransformFromMovedChild(local, movedWorld);
  closeTransform(localToWorldTransform(parent, local), movedWorld);
});

test("matrix decomposition keeps rotations continuous beyond the XYZ ninety-degree branch", () => {
  const oneTwenty = { position: [0, 0, 0], rotation: [0, 120 * Math.PI / 180, 0], scale: [1, 1, 1] };
  const recovered = matrixTransform(transformMatrix(oneTwenty), oneTwenty.rotation);
  close(recovered.rotation[0], 0);
  close(recovered.rotation[1], oneTwenty.rotation[1]);
  close(recovered.rotation[2], 0);

  const fourFifty = { position: [0, 0, 0], rotation: [0, 450 * Math.PI / 180, 0], scale: [1, 1, 1] };
  const multiTurn = matrixTransform(transformMatrix(fourFifty), fourFifty.rotation);
  close(multiTurn.rotation[1], fourFifty.rotation[1]);
});

test("group axis uses the combined world-space geometry bounds", () => {
  const group = groupTransformFromWorldBounds([
    { transform: { position: [-4, 0, 0], rotation: [0, 0, 0] }, min: [-1, 0, -0.1], max: [1, 2, 0.1] },
    { transform: { position: [2, 0, 0], rotation: [0, 0, 0] }, min: [-2, 0, -0.1], max: [2, 4, 0.1] },
  ]);
  closeTransform(group, { position: [-0.5, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
});

test("ungrouping a rotated and uniformly scaled group preserves world transforms", () => {
  const group = { position: [3, -1, 2], rotation: [0.2, -0.4, 0.1], scale: [1.5, 1.5, 1.5] };
  const local = { position: [-2, 4, 1], rotation: [0.1, 0.3, -0.2], scale: [0.8, 0.8, 0.8] };
  const world = localToWorldTransform(group, local);
  closeTransform(worldToLocalTransform(group, world), local);
});

test("selection-only schema-1 groups migrate without moving their children", () => {
  const migrated = migrateTransformGroup({ id: "legacy", name: "Legacy Group", sliceIds: ["a", "b"], visible: true, locked: false });
  assert.equal(migrated.legacySelectionGroup, true);
  assert.equal(migrated.expanded, true);
  assert.equal(migrated.parentId, null);
  closeTransform(migrated.transform, { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
});

test("nested groups compose local transforms and collect descendant slices", () => {
  const groups = [
    migrateTransformGroup({ id: "parent", name: "Parent", sliceIds: ["a"], parentId: null, transform: { position: [5, 0, 0], rotation: [0, 0, 0] } }),
    migrateTransformGroup({ id: "child", name: "Child", sliceIds: ["b"], parentId: "parent", transform: { position: [2, 0, 0], rotation: [0, 0, 0] } }),
    migrateTransformGroup({ id: "grandchild", name: "Grandchild", sliceIds: ["c"], parentId: "child", transform: { position: [0, 3, 0], rotation: [0, 0, 0] } }),
  ];
  closeTransform(groupWorldTransform("grandchild", groups), { position: [7, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
  assert.deepEqual(groupDescendantSliceIds("parent", groups), ["a", "b", "c"]);
  assert.equal(canParentGroup("parent", "grandchild", groups), false);
  assert.equal(canParentGroup("grandchild", "parent", groups), true);
});

test("drag placement changes group parent and sibling order", () => {
  const groups = [
    migrateTransformGroup({ id: "a", name: "A", sliceIds: [] }),
    migrateTransformGroup({ id: "b", name: "B", sliceIds: [] }),
    migrateTransformGroup({ id: "c", name: "C", sliceIds: [] }),
  ];
  const nested = placeTransformGroup(groups, "c", "a", "inside");
  assert.equal(nested.find((group) => group.id === "c").parentId, "a");
  const reordered = placeTransformGroup(nested, "b", "a", "before");
  assert.deepEqual(reordered.map((group) => group.id), ["b", "a", "c"]);
});

test("group hierarchy reordering changes only the requested group order", () => {
  const groups = [{ id: "a", transform: { position: [1, 0, 0] } }, { id: "b", transform: { position: [2, 0, 0] } }, { id: "c", transform: { position: [3, 0, 0] } }];
  const reordered = moveTransformGroup(groups, "b", -1);
  assert.deepEqual(reordered.map((group) => group.id), ["b", "a", "c"]);
  assert.equal(reordered[0], groups[1]);
  assert.deepEqual(moveTransformGroup(groups, "a", -1), groups);
  assert.deepEqual(moveTransformGroup(groups, "c", 1), groups);
});

test('reanchoring rotated scaled groups preserves direct and nested child geometry and reset state',()=>{
 const groups=[migrateTransformGroup({id:'parent',name:'Parent',sliceIds:['screen'],transform:{position:[4,2,1],rotation:[.2,.4,.1],scale:[2,3,4]}}),migrateTransformGroup({id:'child',name:'Child',parentId:'parent',sliceIds:['nested'],transform:{position:[1,2,3],rotation:[.1,0,.2],scale:[1,1,1]}})];
 const transforms={screen:{position:[2,3,4],rotation:[0,0,0],scale:[1,1,1]},nested:{position:[1,0,0],rotation:[0,0,0],scale:[1,1,1]}};
 const world=(gs,ts,nested=false)=>transformMatrix(gs[0].transform).multiply(nested?transformMatrix(gs[1].transform):transformMatrix()).multiply(transformMatrix(ts[nested?'nested':'screen']));
 const before=[world(groups,transforms),world(groups,transforms,true)];
 const result=reanchorGroup(groups,transforms,'parent',[1,-2,3],'custom');
 [world(result.groups,result.transforms),world(result.groups,result.transforms,true)].forEach((m,i)=>m.elements.forEach((v,j)=>close(v,before[i].elements[j])));
 assert.deepEqual(groups[0].transform.position,[4,2,1]);assert.equal(result.groups[0].pivotMode,'custom');
 assert.equal(migrateTransformGroup(JSON.parse(JSON.stringify(result.groups[0]))).pivotMode,'custom');
});

test('nested group pivot preserves rendered child placement under a non-uniform parent',()=>{
 const groups=[migrateTransformGroup({id:'p',name:'Parent',sliceIds:[],transform:{position:[3,4,5],rotation:[.3,.7,.2],scale:[2,3,4]}}),migrateTransformGroup({id:'g',parentId:'p',name:'Group',sliceIds:['s'],transform:{position:[4,1,-2],rotation:[.4,.2,.6],scale:[1.2,2,1]}})];
 const transforms={s:{position:[2,3,4],rotation:[.1,.2,.3],scale:[1,1,1]}};
 const before=transformMatrix(groupWorldTransform('g',groups)).multiply(transformMatrix(transforms.s));
 const result=reanchorGroup(groups,transforms,'g',[1,-2,3],'custom');
 const after=transformMatrix(groupWorldTransform('g',result.groups)).multiply(transformMatrix(result.transforms.s));
 before.elements.forEach((v,i)=>close(v,after.elements[i]));
});

test("removing nested scene containers releases every LED slice with its current world scale and pose",()=>{
 const make=(id,parentId,sliceIds,position)=>({id,name:id,parentId,sliceIds,visible:true,locked:false,expanded:true,transform:{position,rotation:[0,.4,0],scale:[2,2,2]},initialTransform:{position,rotation:[0,0,0],scale:[1,1,1]}});
 const groups=[make('outer',null,['a'],[2,3,4]),make('inner','outer',['b'],[1,2,3])],transforms={a:{position:[1,0,0],rotation:[0,0,0],scale:[1,1,1]},b:{position:[0,1,0],rotation:[0,0,0],scale:[1,1,1]}};
 const world={a:localToWorldTransform(groupWorldTransform('outer',groups),transforms.a),b:localToWorldTransform(groupWorldTransform('inner',groups),transforms.b)};
 const removed=releaseSceneGroups(groups,['outer'],transforms,world,true);assert.equal(removed.groups.length,0);assert.deepEqual(removed.returnedSliceIds,['a','b']);closeTransform(removed.transforms.a,world.a);closeTransform(removed.transforms.b,world.b);
 const ungrouped=releaseSceneGroups(groups,['inner'],transforms,world);assert.equal(ungrouped.groups.length,1);assert.deepEqual(ungrouped.groups[0].sliceIds,['a'],'Released slices do not transfer to an outer scene group');closeTransform(ungrouped.transforms.b,world.b);
 groups[1].locked=true;assert.throws(()=>releaseSceneGroups(groups,['outer'],transforms,world,true),/Unlock/);
});
