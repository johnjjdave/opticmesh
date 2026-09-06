import * as THREE from "three";
import type { SliceTransform } from "./three-simulation";

export const PIVOT_LABELS = {
  "top-left": "Top left", "top-center": "Top centre", "top-right": "Top right",
  "center-left": "Centre left", center: "Centre", "center-right": "Centre right",
  "bottom-left": "Bottom left", "bottom-center": "Bottom centre", "bottom-right": "Bottom right",
} as const;
export type PivotPreset = keyof typeof PIVOT_LABELS;
export type SlicePivot = PivotPreset | { custom: [number, number, number] };
export const PIVOT_PRESETS = Object.keys(PIVOT_LABELS) as PivotPreset[];
export const pivotKey = (pivot: SlicePivot) => JSON.stringify(pivot);
export const pivotLabel = (pivot: SlicePivot) => typeof pivot === "string" ? PIVOT_LABELS[pivot] : "Custom";
// Coordinates are metres from the unscaled screen centre; positive Z is toward its emitting face.
export function pivotOffset(pivot: SlicePivot, width: number, height: number): [number, number, number] {
  if (typeof pivot !== "string") return pivot.custom.map(value => Number.isFinite(value) ? value : 0) as [number, number, number];
  return [pivot.endsWith("left") ? -width / 2 : pivot.endsWith("right") ? width / 2 : 0,
    pivot.startsWith("top") ? height / 2 : pivot.startsWith("bottom") ? -height / 2 : 0, 0];
}
export function reanchorTransform(transform: SliceTransform, previous: [number, number, number], next: [number, number, number]): SliceTransform {
  const shift = new THREE.Vector3(...next).sub(new THREE.Vector3(...previous))
    .multiply(new THREE.Vector3(...(transform.scale || [1, 1, 1])))
    .applyEuler(new THREE.Euler(...transform.rotation, "XYZ"));
  return { ...transform, position: transform.position.map((value, axis) => value + shift.getComponent(axis)) as [number, number, number] };
}
export function snapPivot(x: number, y: number): PivotPreset {
  return PIVOT_PRESETS[Math.round(Math.max(0, Math.min(1, y)) * 2) * 3 + Math.round(Math.max(0, Math.min(1, x)) * 2)];
}
