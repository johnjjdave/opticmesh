import * as THREE from "three";
import type { SliceTransform } from "./three-simulation";
import { PIVOT_PRESETS, reanchorTransform, type PivotPreset } from "./slice-pivot.ts";

export type TransformGroup = {
  id: string;
  name: string;
  sliceIds: string[];
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  transform: SliceTransform;
  initialTransform: SliceTransform;
  legacySelectionGroup?: boolean;
  pivotMode?: PivotPreset | "custom";
};

export const IDENTITY_TRANSFORM: SliceTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export function normalizeTransform(value?: Partial<SliceTransform> | null): SliceTransform {
  return {
    position: [...(value?.position || IDENTITY_TRANSFORM.position)] as [number, number, number],
    rotation: [...(value?.rotation || IDENTITY_TRANSFORM.rotation)] as [number, number, number],
    scale: [...(value?.scale || IDENTITY_TRANSFORM.scale!)] as [number, number, number],
  };
}

export function transformMatrix(value?: Partial<SliceTransform> | null) {
  const transform = normalizeTransform(value);
  return new THREE.Matrix4().compose(new THREE.Vector3().fromArray(transform.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...transform.rotation, "XYZ")), new THREE.Vector3().fromArray(transform.scale || [1, 1, 1]));
}

function unwrapAngle(value: number, reference: number) {
  const turns = Math.round((reference - value) / (Math.PI * 2));
  return value + turns * Math.PI * 2;
}

export function continuousEuler(rotation: [number, number, number], reference?: [number, number, number]): [number, number, number] {
  if (!reference) return rotation;
  const candidates: Array<[number, number, number]> = [rotation, [rotation[0] + Math.PI, Math.PI - rotation[1], rotation[2] + Math.PI]];
  return candidates
    .map((candidate) => candidate.map((value, axis) => unwrapAngle(value, reference[axis])) as [number, number, number])
    .sort((left, right) => left.reduce((sum, value, axis) => sum + (value - reference[axis]) ** 2, 0) - right.reduce((sum, value, axis) => sum + (value - reference[axis]) ** 2, 0))[0];
}

export function matrixTransform(matrix: THREE.Matrix4, referenceRotation?: [number, number, number]): SliceTransform {
  const position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ"), continuous = continuousEuler([rotation.x, rotation.y, rotation.z], referenceRotation);
  return {
    position: position.toArray() as [number, number, number],
    rotation: continuous,
    scale: scale.toArray() as [number, number, number],
  };
}

export function localToWorldTransform(parent: SliceTransform, local: SliceTransform, referenceRotation?: [number, number, number]) {
  return matrixTransform(transformMatrix(parent).multiply(transformMatrix(local)), referenceRotation);
}

export function worldToLocalTransform(parent: SliceTransform, world: SliceTransform, referenceRotation?: [number, number, number]) {
  return matrixTransform(transformMatrix(parent).invert().multiply(transformMatrix(world)), referenceRotation);
}

export function groupTransformFromWorldChildren(worldTransforms: SliceTransform[]) {
  if (!worldTransforms.length) return normalizeTransform();
  const position: [number, number, number] = [0, 0, 0];
  worldTransforms.forEach((transform) =>
    transform.position.forEach((value, axis) => {
      position[axis] += value / worldTransforms.length;
    }),
  );
  return normalizeTransform({ position });
}

export function groupTransformFromWorldBounds(
  items: Array<{
    transform: SliceTransform;
    min: [number, number, number];
    max: [number, number, number];
  }>,
) {
  if (!items.length) return normalizeTransform();
  const bounds = new THREE.Box3();
  items.forEach((item) => {
    const matrix = transformMatrix(item.transform);
    for (const x of [item.min[0], item.max[0]]) for (const y of [item.min[1], item.max[1]]) for (const z of [item.min[2], item.max[2]]) bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
  });
  return normalizeTransform({
    position: bounds.getCenter(new THREE.Vector3()).toArray() as [number, number, number],
  });
}

export function groupTransformFromMovedChild(local: SliceTransform, world: SliceTransform, referenceRotation?: [number, number, number]) {
  return matrixTransform(transformMatrix(world).multiply(transformMatrix(local).invert()), referenceRotation);
}

export function moveTransformGroup<T extends Pick<TransformGroup, "id">>(groups: T[], id: string, direction: -1 | 1) {
  const index = groups.findIndex((group) => group.id === id),
    target = index + direction;
  if (index < 0 || target < 0 || target >= groups.length) return groups;
  const next = [...groups],
    [group] = next.splice(index, 1);
  next.splice(target, 0, group);
  return next;
}

export function groupWorldTransform(groupId: string, groups: TransformGroup[], visiting = new Set<string>()): SliceTransform {
  const group = groups.find((item) => item.id === groupId);
  if (!group || visiting.has(groupId)) return normalizeTransform();
  if (!group.parentId) return normalizeTransform(group.transform);
  const nextVisiting = new Set(visiting).add(groupId);
  return localToWorldTransform(groupWorldTransform(group.parentId, groups, nextVisiting), group.transform);
}

export function groupDescendantSliceIds(groupId: string, groups: TransformGroup[], visiting = new Set<string>()): string[] {
  const group = groups.find((item) => item.id === groupId);
  if (!group || visiting.has(groupId)) return [];
  const nextVisiting = new Set(visiting).add(groupId);
  return [...group.sliceIds, ...groups.filter((item) => item.parentId === groupId).flatMap((item) => groupDescendantSliceIds(item.id, groups, nextVisiting))];
}

export function groupAncestorIds(groupId: string, groups: TransformGroup[]): string[] {
  const result: string[] = [];
  let current = groups.find((item) => item.id === groupId);
  while (current?.parentId && !result.includes(current.parentId)) {
    result.push(current.parentId);
    current = groups.find((item) => item.id === current?.parentId);
  }
  return result;
}

export function canParentGroup(groupId: string, parentId: string | null, groups: TransformGroup[]) {
  return parentId !== groupId && (!parentId || !groupAncestorIds(parentId, groups).includes(groupId));
}

export function placeTransformGroup(groups: TransformGroup[], groupId: string, targetId: string, placement: "before" | "inside" | "after") {
  const source = groups.find((group) => group.id === groupId),
    target = groups.find((group) => group.id === targetId);
  if (!source || !target || source.id === target.id) return groups;
  const parentId = placement === "inside" ? target.id : target.parentId;
  if (!canParentGroup(source.id, parentId, groups)) return groups;
  const next = groups.filter((group) => group.id !== source.id);
  const targetIndex = next.findIndex((group) => group.id === target.id);
  const insertIndex = placement === "after" ? targetIndex + 1 : placement === "before" ? targetIndex : next.length;
  next.splice(insertIndex, 0, { ...source, parentId });
  return next;
}

export function migrateTransformGroup(value: Partial<TransformGroup> & Pick<TransformGroup, "id" | "name" | "sliceIds">): TransformGroup {
  return {
    id: value.id,
    name: value.name,
    sliceIds: [...value.sliceIds],
    parentId: value.parentId ?? null,
    visible: value.visible ?? true,
    locked: value.locked ?? false,
    expanded: value.expanded ?? true,
    transform: normalizeTransform(value.transform),
    initialTransform: normalizeTransform(value.initialTransform || value.transform),
    legacySelectionGroup: value.transform ? false : true,
    pivotMode: value.pivotMode === "custom" || PIVOT_PRESETS.includes(value.pivotMode as PivotPreset) ? value.pivotMode : undefined,
  };
}

/** Reanchor a group without moving its direct slices or nested groups in world space. */
export function reanchorGroup(groups: TransformGroup[], transforms: Record<string, SliceTransform>, id: string, point: [number,number,number], mode: PivotPreset | "custom") {
  const target=groups.find(g=>g.id===id); if(!target)return {groups,transforms};
  const compensate=(t: SliceTransform): SliceTransform=>({...t,position:t.position.map((v,i)=>v-point[i]) as [number,number,number]});
  const reanchor=(transform: SliceTransform): SliceTransform=>{
    if(!target.parentId)return reanchorTransform(transform,[0,0,0],point);
    // Use the same composed TRS frame as the renderer, including non-uniform parents.
    const parent=groupWorldTransform(target.parentId,groups),world=localToWorldTransform(parent,transform);
    const position=new THREE.Vector3(...point).applyMatrix4(transformMatrix(world)).applyMatrix4(transformMatrix(parent).invert());
    return {...transform,position:position.toArray() as [number,number,number]};
  };
  const nextTransforms={...transforms};
  for(const slice of target.sliceIds) if(nextTransforms[slice])nextTransforms[slice]=compensate(nextTransforms[slice]);
  return {transforms:nextTransforms,groups:groups.map(g=>g.id===id ? {...g,pivotMode:mode,transform:reanchor(g.transform),initialTransform:reanchor(g.initialTransform)} : g.parentId===id ? {...g,transform:compensate(g.transform),initialTransform:compensate(g.initialTransform)} : g)};
}

/** Dissolve scene containers without ever removing source-owned Resolume slices. */
export function releaseSceneGroups(groups: TransformGroup[], ids: string[], transforms: Record<string,SliceTransform>, worldSlices: Record<string,SliceTransform>, removeBranch=false) {
  const removed=new Set(ids.filter(id=>groups.some(g=>g.id===id)));
  if(removeBranch){let changed=true;while(changed){changed=false;for(const group of groups)if(group.parentId&&removed.has(group.parentId)&&!removed.has(group.id)){removed.add(group.id);changed=true;}}}
  if(groups.some(g=>removed.has(g.id)&&(g.locked||groupAncestorIds(g.id,groups).some(id=>groups.find(p=>p.id===id)?.locked))))throw new Error("Unlock the selected groups before removing or ungrouping them.");
  const returnedSliceIds=[...new Set(groups.filter(g=>removed.has(g.id)).flatMap(g=>g.sliceIds))];
  const nextTransforms={...transforms};for(const id of returnedSliceIds){if(!worldSlices[id])throw new Error("A slice transform could not be preserved.");nextTransforms[id]=normalizeTransform(worldSlices[id]);}
  const byId=new Map(groups.map(g=>[g.id,g]));
  const nextGroups=groups.filter(g=>!removed.has(g.id)).map(group=>{
    let parentId=group.parentId;while(parentId&&removed.has(parentId))parentId=byId.get(parentId)?.parentId||null;
    if(parentId===group.parentId)return group;
    const world=groupWorldTransform(group.id,groups),parentWorld=parentId?groupWorldTransform(parentId,groups):null;
    const oldParent=group.parentId?groupWorldTransform(group.parentId,groups):null;
    const initialWorld=oldParent?localToWorldTransform(oldParent,group.initialTransform):group.initialTransform;
    return {...group,parentId,transform:parentWorld?worldToLocalTransform(parentWorld,world):world,initialTransform:parentWorld?worldToLocalTransform(parentWorld,initialWorld):normalizeTransform(initialWorld)};
  });
  return {groups:nextGroups,transforms:nextTransforms,removedIds:[...removed],returnedSliceIds};
}
