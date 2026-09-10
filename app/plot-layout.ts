import type { PlotFrame } from './technical-plots-data';

export type Guide = { x1: number; y1: number; x2: number; y2: number; label?: string };
type Rect = Pick<PlotFrame, 'id' | 'x' | 'y' | 'w' | 'h'>;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const anchors = (r: Rect, axis: 'x' | 'y') => { const size = axis === 'x' ? r.w : r.h; return [r[axis], r[axis] + size / 2, r[axis] + size]; };

export function duplicatePosition(f: Rect, frames: Rect[], grid: number, snap: boolean) {
  const gap = snap ? grid : 5;
  const next = (n: number) => snap ? Math.ceil(n / grid) * grid : n;
  const previous = (n: number) => snap ? Math.floor(n / grid) * grid : n;
  const candidates = [
    { x: next(f.x + f.w + gap), y: f.y },
    { x: f.x, y: next(f.y + f.h + gap) },
    { x: previous(f.x - f.w - gap), y: f.y },
    { x: f.x, y: previous(f.y - f.h - gap) },
  ];
  return candidates.find(p => p.x >= 8 && p.y >= 27 && p.x + f.w <= 412 && p.y + f.h <= 257 && !frames.some(r => p.x < r.x + r.w && p.x + f.w > r.x && p.y < r.y + r.h && p.y + f.h > r.y));
}

// Work in paper millimetres; the caller supplies a screen-pixel sized tolerance.
export function snapLayout(raw: Rect, others: Rect[], grid: number, snap: boolean, tolerance = 2, resize = false) {
  const f = { ...raw }, guides: Guide[] = [];
  const peers = others.filter(r => r.id !== f.id);
  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? 'w' : 'h', limit = axis === 'x' ? 412 : 257, minimum = axis === 'x' ? 8 : 27;
    const moving = resize ? [f[axis] + f[size]] : anchors(f, axis);
    let best = tolerance + .0001, delta: number | undefined;
    if (snap) {
      for (const r of peers) for (const target of anchors(r, axis)) for (const point of moving) {
        const d = target - point; if (Math.abs(d) < best) { best = Math.abs(d); delta = d; }
      }
      if (!resize) {
        // Equal spacing both between two neighbours and extending an existing row.
        const cross = axis === 'x' ? 'y' : 'x', crossSize = axis === 'x' ? 'h' : 'w';
        const aligned = peers.filter(r => r[cross] < f[cross] + f[crossSize] && r[cross] + r[crossSize] > f[cross]);
        for (const a of aligned) for (const b of aligned) {
          const gap = b[axis] - (a[axis] + a[size]); if (a.id === b.id || gap < 0) continue;
          for (const target of [b[axis] + b[size] + gap, a[axis] - gap - f[size], (a[axis] + a[size] + b[axis] - f[size]) / 2]) {
            const d = target - f[axis]; if (Math.abs(d) < best) { best = Math.abs(d); delta = d; }
          }
        }
      }
    }
    const quantize = (n: number) => Math.round(n / (snap ? grid : .1)) * (snap ? grid : .1);
    if (resize) f[size] = clamp(delta === undefined ? quantize(f[size]) : f[size] + delta, 25, limit - f[axis]);
    else f[axis] = clamp(delta === undefined ? quantize(f[axis]) : f[axis] + delta, minimum, limit - f[size]);
  }
  if (snap) for (const axis of ['x', 'y'] as const) {
    for (const r of peers) for (const a of anchors(f, axis)) if (anchors(r, axis).some(b => Math.abs(a - b) < .05)) {
      guides.push(axis === 'x' ? { x1: a, x2: a, y1: Math.min(f.y, r.y) - 2, y2: Math.max(f.y + f.h, r.y + r.h) + 2 } : { y1: a, y2: a, x1: Math.min(f.x, r.x) - 2, x2: Math.max(f.x + f.w, r.x + r.w) + 2 });
    }
  }
  // Nearest non-overlapping neighbour in each direction, with real paper distances.
  for (const axis of ['x', 'y'] as const) for (const sign of [-1, 1]) {
    const size = axis === 'x' ? 'w' : 'h', cross = axis === 'x' ? 'y' : 'x', crossSize = axis === 'x' ? 'h' : 'w';
    const candidates = peers.filter(r => r[cross] < f[cross] + f[crossSize] && r[cross] + r[crossSize] > f[cross]).map(r => ({ r, gap: sign > 0 ? r[axis] - f[axis] - f[size] : f[axis] - r[axis] - r[size] })).filter(c => c.gap >= 0).sort((a, b) => a.gap - b.gap);
    const nearest = candidates[0]; if (!nearest) continue;
    const start = sign > 0 ? f[axis] + f[size] : nearest.r[axis] + nearest.r[size];
    const middle = (Math.max(f[cross], nearest.r[cross]) + Math.min(f[cross] + f[crossSize], nearest.r[cross] + nearest.r[crossSize])) / 2;
    const label = `${Number(nearest.gap.toFixed(1))} mm`;
    guides.push(axis === 'x' ? { x1: start, x2: start + nearest.gap, y1: middle, y2: middle, label } : { y1: start, y2: start + nearest.gap, x1: middle, x2: middle, label });
  }
  return { frame: f, guides };
}

export function framingTransform(captured: Pick<PlotFrame, 'viewZoom' | 'panX' | 'panY'>, next: Pick<PlotFrame, 'viewZoom' | 'panX' | 'panY'>) {
  const scale = next.viewZoom / captured.viewZoom;
  return { scale, x: captured.panX * scale - next.panX, y: next.panY - captured.panY * scale };
}
