export type PhysicalLayoutRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhysicalLayoutPivot = "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";

export type PhysicalLayoutPosition = [number, number, number];

type AxisSpan = { start: number; end: number; pitchMm: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueSorted(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Resolume coordinates are texture-space pixels. For a mixed-pitch map there is
 * no single millimetres-per-pixel conversion, so each occupied interval is
 * expanded using the largest effective pitch that crosses it. This preserves
 * source ordering and guarantees that separated source rectangles do not gain
 * an overlap merely because their physical pitches differ.
 */
export function createAdaptiveAxis(totalPixels: number, spans: AxisSpan[], fallbackPitchMm: number) {
  const safeTotal = Math.max(1, totalPixels);
  const boundaries = uniqueSorted([
    0,
    safeTotal,
    ...spans.flatMap((span) => [clamp(span.start, 0, safeTotal), clamp(span.end, 0, safeTotal)]),
  ]);
  const millimetres = new Map<number, number>([[boundaries[0], 0]]);
  let totalMm = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const activePitches = spans
      .filter((span) => span.start < end && span.end > start)
      .map((span) => span.pitchMm)
      .filter((pitch) => Number.isFinite(pitch) && pitch > 0);
    const intervalPitch = activePitches.length ? Math.max(...activePitches) : fallbackPitchMm;
    totalMm += (end - start) * intervalPitch;
    millimetres.set(end, totalMm);
  }

  const at = (pixel: number) => {
    const target = clamp(pixel, 0, safeTotal);
    const exact = millimetres.get(target);
    if (exact !== undefined) return exact;
    const upperIndex = boundaries.findIndex((boundary) => boundary > target);
    const lowerIndex = Math.max(0, upperIndex - 1);
    const lower = boundaries[lowerIndex];
    const upper = boundaries[upperIndex] ?? safeTotal;
    const lowerMm = millimetres.get(lower) ?? 0;
    const upperMm = millimetres.get(upper) ?? totalMm;
    const ratio = upper === lower ? 0 : (target - lower) / (upper - lower);
    return lowerMm + (upperMm - lowerMm) * ratio;
  };

  return { at, totalMm };
}

export function choosePhysicalLayoutAnchor(slices: PhysicalLayoutRect[], compositionWidth: number, compositionHeight: number): string | null {
  if (!slices.length) return null;
  const centreX = compositionWidth / 2, centreY = compositionHeight / 2;
  const containsCentre = slices.filter((slice) => slice.x <= centreX && slice.x + slice.width >= centreX && slice.y <= centreY && slice.y + slice.height >= centreY);
  const candidates = containsCentre.length ? containsCentre : slices;
  return [...candidates].sort((left, right) => {
    const leftCentreX = left.x + left.width / 2, leftCentreY = left.y + left.height / 2;
    const rightCentreX = right.x + right.width / 2, rightCentreY = right.y + right.height / 2;
    const leftDistance = Math.hypot(leftCentreX - centreX, leftCentreY - centreY);
    const rightDistance = Math.hypot(rightCentreX - centreX, rightCentreY - centreY);
    if (containsCentre.length) {
      const areaDifference = right.width * right.height - left.width * left.height;
      if (Math.abs(areaDifference) > 0.0001) return areaDifference;
    }
    if (Math.abs(leftDistance - rightDistance) > 0.0001) return leftDistance - rightDistance;
    return right.width * right.height - left.width * left.height;
  })[0]?.id || null;
}

export function resolvePhysicalLayout(
  slices: PhysicalLayoutRect[],
  compositionWidth: number,
  compositionHeight: number,
  pitchBySlice: Record<string, number>,
  pivotBySlice: Record<string, PhysicalLayoutPivot>,
  fallbackPitchMm: number,
  requestedAnchorId?: string,
): Record<string, PhysicalLayoutPosition> {
  const effectivePitch = (id: string) => {
    const pitch = pitchBySlice[id];
    return Number.isFinite(pitch) && pitch > 0 ? pitch : fallbackPitchMm;
  };
  const xAxis = createAdaptiveAxis(
    compositionWidth,
    slices.map((slice) => ({ start: slice.x, end: slice.x + slice.width, pitchMm: effectivePitch(slice.id) })),
    fallbackPitchMm,
  );
  const yAxis = createAdaptiveAxis(
    compositionHeight,
    slices.map((slice) => ({ start: slice.y, end: slice.y + slice.height, pitchMm: effectivePitch(slice.id) })),
    fallbackPitchMm,
  );
  const centreX = xAxis.totalMm / 2000;
  const anchorId = slices.some((slice) => slice.id === requestedAnchorId) ? requestedAnchorId! : choosePhysicalLayoutAnchor(slices, compositionWidth, compositionHeight);
  const anchorSlice = slices.find((slice) => slice.id === anchorId);
  const anchorCentreM = anchorSlice ? xAxis.at(anchorSlice.x) / 1000 - centreX + anchorSlice.width * effectivePitch(anchorSlice.id) / 2000 : 0;

  return Object.fromEntries(slices.map((slice) => {
    const pitchM = effectivePitch(slice.id) / 1000;
    const widthM = slice.width * pitchM;
    const leftM = xAxis.at(slice.x) / 1000 - centreX;
    const bottomM = (yAxis.totalMm - yAxis.at(slice.y + slice.height)) / 1000;
    const pivot = pivotBySlice[slice.id] || "bottom-center";
    const pivotOffset = pivot.endsWith("left") ? 0 : pivot.endsWith("right") ? widthM : widthM / 2;
    const pivotOffsetY = pivot.startsWith("top") ? slice.height * pitchM : pivot.startsWith("bottom") ? 0 : slice.height * pitchM / 2;
    return [slice.id, [leftM + pivotOffset - anchorCentreM, bottomM + pivotOffsetY, 0] satisfies PhysicalLayoutPosition];
  }));
}

export function commonSelectionValue<T>(values: T[]): T | null {
  if (!values.length) return null;
  return values.every((value) => Object.is(value, values[0])) ? values[0] : null;
}
