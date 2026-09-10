export const PAPER = { width: 420, height: 297 } as const;
export const VIEW_DIRECTIONS = {
  front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0],
  'Upper front right': [1, 1, 1], 'Upper front left': [-1, 1, 1], 'Upper rear right': [1, 1, -1], 'Upper rear left': [-1, 1, -1],
  'Lower front right': [1, -1, 1], 'Lower front left': [-1, -1, 1], 'Lower rear right': [1, -1, -1], 'Lower rear left': [-1, -1, -1],
} satisfies Record<string, number[]>;
export const viewLabel = (view: string) => view.replace(/\b[a-z]/g, letter => letter.toUpperCase());
export type PlotKind = 'input' | 'output' | 'view' | 'schedule' | 'text' | 'pattern';
export type PlotFrame = { id: string; kind: PlotKind; title: string; x: number; y: number; w: number; h: number; screen: number; view: keyof typeof VIEW_DIRECTIONS; style: 'shaded' | 'wireframe'; stage: boolean; text: string; textBold?: boolean; textItalic?: boolean; textUnderline?: boolean; textAlign?: 'left' | 'center' | 'right'; offset: number; autoTitle: boolean; fontSize: number; viewZoom: number; panX: number; panY: number };
export type PlotSheet = { id: string; title: string; frames: PlotFrame[] };
export type PlotDocument = { format: 'opticmesh-plot-template'; version: 1; projectTitle: string; company: string; logo: string; author: string; revision: string; date: string; notes: string; fontFamily: string; fontSize: number; grid: number; snap: boolean; sheets: PlotSheet[] };
export type PlotRect = { x: number; y: number; width: number; height: number; points?: { x: number; y: number }[] };
export type PlotSlice = { id: string; name: string; screenName: string; input: PlotRect; output: PlotRect; nominalPitch: number; effectivePitch: number; physicalWidth: number; physicalHeight: number; warped: boolean; panelWidth: number; panelHeight: number; panelPixelsWidth: number; panelPixelsHeight: number };
export type PlotSource = { name: string; width: number; height: number; screens: { name: string; width: number; height: number }[]; slices: PlotSlice[] };
export const uid = () => crypto.randomUUID();
export function frame(kind: PlotKind, x = 12, y = 30, w = 396, h = 222): PlotFrame {
  return { id: uid(), kind, title: { input: 'Input map', output: 'Output map', view: 'Upper Front Right', schedule: 'Screen specifications', text: 'Delivery notes', pattern: 'Screen detail' }[kind], x, y, w, h, screen: 0, view: 'Upper front right', style: 'shaded', stage: true, text: '', offset: 0, autoTitle: true, fontSize: 9, viewZoom: 1, panX: 0, panY: 0 };
}
export function sheet(preset: 'input' | 'output' | 'views' | 'schedule' | 'notes' | 'blank' | 'pattern'): PlotSheet {
  const frames = preset === 'blank' ? [] : preset === 'views' ? [frame('view', 12, 30, 194, 108), frame('view', 214, 30, 194, 108), frame('view', 12, 146, 194, 108), frame('view', 214, 146, 194, 108)] : [frame(preset === 'notes' ? 'text' : preset)];
  if (preset === 'views') frames.forEach((f, i) => { f.view = ['front', 'top', 'Upper front left', 'Upper front right'][i] as PlotFrame['view']; f.title = viewLabel(f.view); });
  return { id: uid(), title: { input: 'Input mapping', output: 'Output mapping', views: 'Stage views', schedule: 'Screen specifications', notes: 'Content delivery', pattern: 'Screen detail', blank: 'Untitled sheet' }[preset], frames };
}
export function defaultPlotDocument(): PlotDocument {
  return { format: 'opticmesh-plot-template', version: 1, projectTitle: '', company: '', logo: '', author: '', revision: 'A', date: new Date().toISOString().slice(0, 10), notes: '', fontFamily: 'Arial', fontSize: 9, grid: 5, snap: true, sheets: [sheet('input'), sheet('output'), sheet('views'), sheet('schedule')] };
}
export function readPlotDocument(value: unknown): PlotDocument {
  if (!value) return defaultPlotDocument();
  const v = value as PlotDocument;
  if (v.format !== 'opticmesh-plot-template' || v.version !== 1 || !Array.isArray(v.sheets) || !v.sheets.length || v.sheets.length > 100) throw new Error('Choose a supported plot template (up to 100 sheets).');
  const str = (s: unknown, max = 4000) => typeof s === 'string' ? s.slice(0, max) : '';
  const number = (n: unknown, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return { format: v.format, version: 1, projectTitle: str(v.projectTitle, 100), company: str(v.company, 100), logo: typeof v.logo === 'string' && v.logo.length < 3000000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v.logo) ? v.logo : '', author: str(v.author, 100), revision: str(v.revision, 30), date: str(v.date, 30), notes: str(v.notes, 500), fontFamily: ['Arial', 'Verdana', 'Georgia', 'Courier New'].includes(v.fontFamily) ? v.fontFamily : 'Arial', fontSize: number(v.fontSize, 6, 16, 9), grid: number(v.grid, 1, 50, 5), snap: v.snap !== false, sheets: v.sheets.map(s => ({ id: uid(), title: str(s.title, 100), frames: (Array.isArray(s.frames) ? s.frames.slice(0, 24) : []).map(f => {
    const x = number(f.x, 8, 387, 12), y = number(f.y, 27, 232, 30);
    return { ...frame(['input', 'output', 'view', 'schedule', 'text', 'pattern'].includes(f.kind) ? f.kind : 'text'), title: f.kind === 'view' && (f.autoTitle !== false && (f.autoTitle === true || f.title === f.view || f.title === 'Scene view')) ? viewLabel(Object.hasOwn(VIEW_DIRECTIONS, f.view) ? f.view : 'front') : str(f.title, 100), x, y, w: number(f.w, 25, 412 - x, 100), h: number(f.h, 25, 257 - y, 80), screen: Math.floor(number(f.screen, 0, 10000, 0)), view: Object.hasOwn(VIEW_DIRECTIONS, f.view) ? f.view : 'front', style: f.style === 'wireframe' ? 'wireframe' : 'shaded', stage: f.stage !== false, text: str(f.text), textBold: f.textBold === true, textItalic: f.textItalic === true, textUnderline: f.textUnderline === true, textAlign: f.textAlign === 'center' || f.textAlign === 'right' ? f.textAlign : 'left', offset: Math.floor(number(f.offset, 0, 100000, 0)), autoTitle: f.autoTitle ?? (f.title === f.view || f.title === 'Scene view'), fontSize: number(f.fontSize, 6, 24, 9), viewZoom: number(f.viewZoom, .1, 20, 1), panX: number(f.panX, -500, 500, 0), panY: number(f.panY, -500, 500, 0) };
  }) })) };
}
export const scheduleCapacity = (f: PlotFrame) => Math.max(1, Math.floor((f.h - 20) / specificationRowHeight(f)));
export function plotWarnings(document: PlotDocument, source: PlotSource) {
  const result: string[] = [];
  for (const s of document.sheets) for (const f of s.frames) {
    if (f.x < 8 || f.y < 27 || f.x + f.w > 412.01 || f.y + f.h > 257.01) result.push(`${s.title}: a frame extends into the margin or title block.`);
    if (f.w < 40 || f.h < (f.kind === 'pattern' ? 80 : 50)) result.push(`${s.title}: increase the frame size to fit its content.`);
    if (f.kind === 'pattern' && !source.slices[f.screen]) result.push(`${s.title}: choose an available screen slice.`);
    if (f.kind === 'schedule' && f.h < specificationRowHeight(f) + 20) result.push(`${s.title}: increase the specifications frame height for this text size.`);
    if (f.kind === 'schedule' && f.w < 160) result.push(`${s.title}: specifications need a frame at least 160 mm wide.`);
    if ((f.kind === 'input' || f.kind === 'output' || f.kind === 'schedule' || f.kind === 'pattern') && !source.slices.length) result.push(`${s.title}: no pixel map loaded.`);
    if (f.kind === 'output' && !source.screens[f.screen]) result.push(`${s.title}: choose an available output screen.`);
  }
  return [...new Set(result)];
}
// Continuations retain the exact sheet layout and paper size; nothing is silently omitted.
export function printSheets(document: PlotDocument, source: PlotSource): PlotSheet[] {
  return document.sheets.flatMap(s => {
    const count = Math.max(1, ...s.frames.filter(f => f.kind === 'schedule').map(f => Math.ceil(Math.max(0, source.slices.length - f.offset) / scheduleCapacity(f))));
    return Array.from({ length: count }, (_, page) => ({ ...s, id: `${s.id}-${page}`, title: s.title + (page ? ` / continued ${page + 1}` : ''), frames: s.frames.map(f => f.kind === 'schedule' ? { ...f, offset: f.offset + page * scheduleCapacity(f) } : f) }));
  });
}
export function ratio(w: number, h: number) { return h > 0 ? `${Number((w / h).toFixed(3))}:1` : '—'; }
export const value = (n: number, places = 3) => Number.isFinite(n) ? String(Number(n.toFixed(places))) : '—';

export const specificationRowHeight = (f: PlotFrame) => f.w < 300 ? Math.max(42, f.fontSize / 9 * 42) : Math.max(17, f.fontSize / 9 * 17);
export function placeFrame(f: PlotFrame, x: number, y: number, grid: number, snap: boolean) {
  const quantize = (n: number) => snap ? Math.round(n / grid) * grid : Math.round(n * 10) / 10;
  return { x: Math.max(8, Math.min(412 - f.w, quantize(x))), y: Math.max(27, Math.min(257 - f.h, quantize(y))) };
}
export const viewSignature = (f: PlotFrame) => JSON.stringify([f.w, f.h, f.view, f.style, f.stage, f.viewZoom, f.panX, f.panY, f.fontSize]);
export function reorderSheets(sheets: PlotSheet[], id: string, before: number) {
  const from = sheets.findIndex(s => s.id === id); if (from < 0) return sheets;
  const list = sheets.filter(s => s.id !== id); list.splice(Math.max(0, Math.min(list.length, before > from ? before - 1 : before)), 0, sheets[from]); return list;
}
