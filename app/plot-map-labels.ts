import type { PlotFrame, PlotSlice, PlotSource } from './technical-plots-data';

export function wrapPlotText(text: string, width: number, size = 3): string[] {
  const limit = Math.max(1, Math.floor(width / (size * .56)));
  return text.split('\n').flatMap(p => {
    const result: string[] = []; let row = '';
    for (const word of p.split(/\s+/)) {
      if (row.length + word.length + 1 > limit && row) { result.push(row); row = ''; }
      for (let i = 0; i < word.length; i += limit) { const part = word.slice(i, i + limit); if (i) { result.push(row); row = ''; } row += (row ? ' ' : '') + part; }
    }
    result.push(row); return result;
  });
}
const value = (n: number) => Number.isFinite(n) ? String(Number(n.toFixed(3))) : '—';
export function mapSliceLabel(slice: PlotSlice, output: boolean) {
  const r = output ? slice.output : slice.input;
  return `${slice.name}\n${output ? 'Output' : 'Input'} X: ${value(r.x)} · Y: ${value(r.y)} px\n${value(r.width)} × ${value(r.height)} px\n${value(slice.physicalWidth)} × ${value(slice.physicalHeight)} m`;
}

export function mapLabelLayout(f: PlotFrame, source: PlotSource) {
  const output = f.kind === 'output', screen = source.screens[f.screen];
  const width = Math.max(1, (output ? screen?.width : source.width) || 1), height = Math.max(1, (output ? screen?.height : source.height) || 1);
  const rows = source.slices.filter(s => !output || s.screenName === screen?.name);
  const size = 2.8 * f.fontSize / 9, columns = Math.max(1, Math.floor((f.w - 8) / (70 * f.fontSize / 9))), cardWidth = (f.w - 8) / columns;
  const external = new Set<string>();
  let cardHeight = 0, legendHeight = 0, scale = 1;
  for (let pass = 0; pass <= rows.length; pass++) {
    const legend = rows.filter(s => external.has(s.id));
    cardHeight = Math.max(0, ...legend.map(s => wrapPlotText(`${String(source.slices.indexOf(s) + 1).padStart(2, '0')} · ${mapSliceLabel(s, output)}`, cardWidth - 5, size).length * size * 1.4 + 4));
    legendHeight = legend.length ? Math.ceil(legend.length / columns) * cardHeight + 6 : 0;
    scale = Math.max(.0001, Math.min((f.w - 26) / width, Math.max(5, f.h - 38 - legendHeight) / height));
    const before = external.size;
    for (const s of rows) {
      const r = output ? s.output : s.input, rw = r.width * scale, rh = r.height * scale;
      // Reserve callouts for labels that cannot fit after wrapping, not an arbitrary slice width.
      const count = wrapPlotText(mapSliceLabel(s, output), Math.max(1, rw - 4), size).length;
      const overlaps = rows.some(other => { if (other === s) return false; const q = output ? other.output : other.input; return r.x < q.x + q.width - .001 && r.x + r.width > q.x + .001 && r.y < q.y + q.height - .001 && r.y + r.height > q.y + .001; });
      if (rw - 4 < size * .56 * 6 || rh < count * size * 1.4 + 10 || overlaps || r.points?.some(p => !([r.x, r.x + r.width].includes(p.x) && [r.y, r.y + r.height].includes(p.y)))) external.add(s.id);
    }
    if (external.size === before) break;
  }
  return { rows, external, size, columns, cardWidth, cardHeight, legendHeight, scale, width, height, overflow: legendHeight + 48 > f.h };
}


export function screenDetailLayout(f: PlotFrame, s: PlotSlice) {
  const fs = f.fontSize / 9, dimensionSize = 3 * fs, noteSize = 2.6 * fs;
  const note = `Panel grid · ${value(s.panelWidth)} × ${value(s.panelHeight)} mm · ${s.panelPixelsWidth} × ${s.panelPixelsHeight} px per panel · Partial edge panels retained`;
  const noteLines = wrapPlotText(note, f.w - 8, noteSize).length;
  const noteBaseline = f.h - 4 - noteSize * .3 - (noteLines - 1) * noteSize * 1.4;
  const noteTop = noteBaseline - noteSize;
  const top = 44 * Math.max(1, fs);
  // Include the dimension text itself in the drawing envelope on both axes.
  const left = 4 + dimensionSize * 1.3 + 3, right = f.w - 4;
  const bottom = noteTop - 4 - dimensionSize * 1.3 - 3;
  const width = right - left, height = bottom - top;
  const horizontalTextWidth = `${s.input.width} px`.length * dimensionSize * .6;
  const verticalTextLength = `${s.input.height} px`.length * dimensionSize * .6;
  const fits = width >= Math.max(10, horizontalTextWidth) && height >= Math.max(10, verticalTextLength);
  const scale = Math.max(.0001, Math.min(width / Math.max(1, s.input.width), height / Math.max(1, s.input.height)));
  const w = s.input.width * scale, h = s.input.height * scale;
  const x = left + (width - w) / 2, y = top + (height - h) / 2;
  return { x, y, w, h, scale, dimensionSize, widthY: y + h + 3 + dimensionSize, heightX: x - 3, note, noteSize, noteBaseline, noteLines, noteTop, fits };
}
