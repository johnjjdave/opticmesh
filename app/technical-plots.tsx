import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultPlotDocument, frame, plotWarnings, printSheets, readPlotDocument, sheet, VIEW_DIRECTIONS, type PlotDocument, type PlotFrame, type PlotSource, reorderSheets, viewSignature, viewLabel, uid } from './technical-plots-data';
import { PlotPaper } from './technical-plots-paper';
import { createPlotCaptureSession } from './technical-plots-scene';
import type { SceneExportOptions } from './scene-export';
import './technical-plots.css';
import PlotNumberField from './plot-number-field';
import UiIcon from './ui-icon';
import { snapLayout, duplicatePosition, type Guide } from './plot-layout';
import PlotViewFraming from './plot-view-framing';
import { mapLabelLayout, screenDetailLayout } from './plot-map-labels';
import PlotPrintDialog from './plot-print-dialog';

type PlotBridge = { printTechnicalPlots?: (payload: { pages: string[]; name: string; print: boolean; deviceName?: string; copies?: number }) => Promise<{ canceled?: boolean; error?: string; path?: string }>; saveExport?: (name: string, mime: string, data: Uint8Array, category: string) => Promise<unknown> };
const desktop = () => (window as unknown as { lo2sDesktop?: PlotBridge }).lo2sDesktop;
type Template = { name: string; document: PlotDocument };
export default function TechnicalPlots({ document, onChange, source, scene, active, focused, exportRef, onNotice }: { document: PlotDocument; onChange: (document: PlotDocument) => void; source: PlotSource; scene: SceneExportOptions; active: boolean; focused: boolean; onNotice: (message: string) => void; exportRef: React.RefObject<((print?: boolean) => void) | null> }) {
  const [index, setIndex] = useState(0), [selected, setSelected] = useState(''), [edit, setEdit] = useState(false), [zoom, setZoom] = useState(0);
  const [images, setImages] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const setStatus = onNotice;
  const [pending, setPending] = useState<PlotFrame | null>(null), [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [dragSheet, setDragSheet] = useState(''), [dropIndex, setDropIndex] = useState<number | null>(null), [compose, setCompose] = useState(false);
  const [printOpen, setPrintOpen] = useState(false), [copySource, setCopySource] = useState('');
  const cache = useRef<Record<string, { key: string; scene: SceneExportOptions }>>({}), running = useRef(false), failed = useRef('');
  const [library, setLibrary] = useState<Template[]>(() => { try { const stored = JSON.parse(localStorage.getItem('opticmesh.plot-templates.v1') || '[]'); return Array.isArray(stored) ? stored.slice(0, 20).map(v => ({ name: String(v.name).slice(0, 100), document: readPlotDocument(v.document) })) : []; } catch { return []; } }), [templateName, setTemplateName] = useState('My template');
  const capture = useRef<AbortController | null>(null);
  const [continuation, setContinuation] = useState(0);
  const [interaction, setInteraction] = useState(false), [draftFrame, setDraftFrame] = useState<PlotFrame | null>(null), [guides, setGuides] = useState<Guide[]>([]);
  const session = useRef<{ scene: SceneExportOptions; capture: ReturnType<typeof createPlotCaptureSession> } | null>(null);
  const capturedFrames = useRef<Record<string, PlotFrame>>({});
  const viewport = useRef<HTMLDivElement>(null), [available, setAvailable] = useState({ width: 800, height: 700 });
  const file = useRef<HTMLInputElement>(null), logo = useRef<HTMLInputElement>(null);
  const current = document.sheets[Math.min(index, document.sheets.length - 1)], element = draftFrame?.id === selected ? draftFrame : current.frames.find(f => f.id === selected);
  const views = document.sheets.flatMap(s => s.frames.filter(f => f.kind === 'view'));
  const frameKey = (f: PlotFrame) => JSON.stringify([document.fontFamily, viewSignature(f)]);
  const signature = JSON.stringify(views.map(f => [f.id, frameKey(f)]));
  const stale = views.some(f => cache.current[f.id]?.key !== frameKey(f) || cache.current[f.id]?.scene !== scene || !images[f.id]);
  const printable = useMemo(() => printSheets(document, source), [document, source]);
  const warnings = [...plotWarnings(document, source), ...document.sheets.flatMap(s => s.frames.filter(f => f.kind === 'pattern' && source.slices[f.screen] && !screenDetailLayout(f, source.slices[f.screen]).fits).map(() => `${s.title}: enlarge the screen detail frame or reduce its text size to fit the dimensions.`)), ...document.sheets.flatMap(s => s.frames.filter(f => (f.kind === 'input' || f.kind === 'output') && mapLabelLayout(f, source).overflow).map(() => `${s.title}: enlarge the map frame or reduce its text size to fit all slice coordinates.`))];
  const scale = zoom || Math.max(.1, Math.min((available.width - 48) / 1587.402, (available.height - 48) / 1122.52));
  useEffect(() => { if (!active || !viewport.current) return; const observer = new ResizeObserver(([entry]) => setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(viewport.current); return () => observer.disconnect(); }, [active]);
  useEffect(() => () => { capture.current?.abort(); session.current?.capture.dispose(); }, []);
  const updateSheet = (patch: Partial<typeof current>) => onChange({ ...document, sheets: document.sheets.map(s => s.id === current.id ? { ...s, ...patch } : s) });
  const updateFrame = (patch: Partial<PlotFrame>) => updateSheet({ frames: current.frames.map(f => f.id === selected ? { ...f, ...patch, ...(patch.view && patch.view !== f.view ? { viewZoom: 1, panX: 0, panY: 0 } : {}), ...(patch.view && f.autoTitle ? { title: viewLabel(patch.view) } : {}) } : f) });
  const addSheet = (kind: Parameters<typeof sheet>[0]) => { onChange({ ...document, sheets: [...document.sheets, sheet(kind)] }); setIndex(document.sheets.length); setSelected(''); };
  async function refresh(all = true) {
    if (running.current) return null;
    const requested = views.filter(f => all || cache.current[f.id]?.key !== frameKey(f) || cache.current[f.id]?.scene !== scene || !images[f.id]);
    if (!requested.length) return images;
    running.current = true; setBusy(true);
    const controller = new AbortController(); capture.current = controller;
    try {
      if (session.current?.scene !== scene) { session.current?.capture.dispose(); session.current = { scene, capture: createPlotCaptureSession(scene) }; }
      const result = await session.current.capture.capture(requested, controller.signal, Object.fromEntries(source.slices.map((s, i) => [s.id, i + 1])), document.fontFamily);
      controller.signal.throwIfAborted();
      for (const f of requested) capturedFrames.current[f.id] = f;
      for (const f of requested) cache.current[f.id] = { key: frameKey(f), scene };
      const next = { ...images, ...result }; setImages(previous => ({ ...previous, ...result })); failed.current = '';
      if (all) setStatus('Scene views updated.'); return next;
    } catch (error) { if (!controller.signal.aborted) { failed.current = signature; setStatus(error instanceof Error ? error.message : 'Unable to prepare scene views.'); } return null; }
    finally { setBusy(false); running.current = false; capture.current = null; }
  }
  useEffect(() => {
    if (!active || busy || interaction || draftFrame || !stale || failed.current === signature) return;
    const timer = setTimeout(() => void refresh(false), 350);
    return () => clearTimeout(timer);
  });
  useEffect(() => { failed.current = ''; }, [scene, signature]);
  useEffect(() => {
    if (!active) { capture.current?.abort(); session.current?.capture.dispose(); session.current = null; }
  }, [active]);
  useEffect(() => {
    if (!pending && !compose) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPending(null); setGhost(null); setGuides([]); setCompose(false); setCopySource(''); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [pending, compose]);
  async function exportPages(print = false) {
    if (busy) { setStatus('Preparing scene views. Please wait a moment.'); return; }
    if (warnings.length) { setStatus(warnings[0]); return; }
    const ready = stale ? await refresh(false) : images; if (!ready) return;
    if (print) { setPrintOpen(true); return; }
    await sendPages(ready);
  }
  async function sendPages(ready: Record<string, string>, deviceName?: string, copies = 1, pageIndex?: number) {
    const bridge = desktop(); if (!bridge?.printTechnicalPlots) { setStatus('Open the local desktop version to export PDF or print.'); return false; }
    setBusy(true); setStatus(deviceName ? 'Sending A3 sheets to printer…' : 'Preparing A3 PDF…');
    try {
      const pages = printable.map((s, i) => renderToStaticMarkup(<PlotPaper document={document} sheet={s} source={source} page={i + 1} total={printable.length} images={ready}/>));
      const result = await bridge.printTechnicalPlots({ pages: pageIndex === undefined ? pages : [pages[pageIndex]], name: document.projectTitle || source.name, print: !!deviceName, deviceName, copies });
      setStatus(result.error || (result.canceled ? 'Cancelled.' : deviceName ? 'Sent to printer.' : 'PDF saved.'));
      return !result.error && !result.canceled;
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Export failed.'); return false; } finally { setBusy(false); }
  }
  useEffect(() => { if (active) exportRef.current = exportPages; return () => { if (active) exportRef.current = null; }; });
  function saveTemplate() {
    const name = templateName.trim(); if (!name) return;
    const clean = readPlotDocument({ ...document, projectTitle: '', author: '', revision: 'A', date: '', notes: '' });
    const next = [...library.filter(t => t.name !== name), { name, document: clean }].slice(-20);
    try { localStorage.setItem('opticmesh.plot-templates.v1', JSON.stringify(next)); setLibrary(next); setStatus('Template saved to your library.'); } catch { setStatus('Template library is full. Export the template to a file.'); }
  }
  async function exportTemplate() {
    const bridge = desktop(); if (!bridge?.saveExport) return setStatus('Open the desktop version to export templates.');
    try { await bridge.saveExport(`${templateName || 'Plot template'}.json`, 'application/json', new TextEncoder().encode(JSON.stringify({ ...document, projectTitle: '', author: '', revision: 'A', date: '', notes: '' }, null, 2)), 'scene3d'); setStatus('Template export finished.'); } catch { setStatus('Unable to export template.'); }
  }
  async function readTemplate(input: File) { try { if (input.size > 4000000) throw new Error('Template is too large (4 MB maximum).'); const next = readPlotDocument(JSON.parse(await input.text())); onChange(next); setIndex(0); setSelected(''); setStatus('Template applied.'); } catch (e) { setStatus(e instanceof Error ? e.message : 'Invalid template.'); } }
  async function readLogo(input: File) {
    try {
      if (!['image/png', 'image/jpeg'].includes(input.type) || input.size > 15000000) throw new Error('Choose a PNG or JPG logo, up to 15 MB.');
      const bitmap = await createImageBitmap(input); const canvas = window.document.createElement('canvas'); const factor = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.round(bitmap.width * factor); canvas.height = Math.round(bitmap.height * factor); canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const data = canvas.toDataURL('image/png'); if (data.length > 3000000) throw new Error('Choose a smaller logo.'); onChange({ ...document, logo: data });
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Unable to read logo.'); }
  }
  function commitCopy(sourceId: string, copy: PlotFrame) {
    if (images[sourceId]) {
      setImages(previous => ({ ...previous, [copy.id]: images[sourceId] }));
      if (cache.current[sourceId]) cache.current[copy.id] = cache.current[sourceId];
      if (capturedFrames.current[sourceId]) capturedFrames.current[copy.id] = capturedFrames.current[sourceId];
    }
    updateSheet({ frames: [...current.frames, copy] });
    setSelected(copy.id); setCopySource('');
  }
  function duplicateFrame() {
    if (!element || draftFrame || pending || compose || interaction) return;
    if (current.frames.length >= 24) { setStatus('A sheet can contain up to 24 frames. Add another sheet to continue.'); return; }
    const copy = { ...element, id: uid() }, position = duplicatePosition(element, current.frames, document.grid, document.snap);
    setEdit(true); setContinuation(0);
    if (position) commitCopy(element.id, { ...copy, ...position });
    else { setCopySource(element.id); setPending(copy); setGhost(null); setStatus('No clear space beside this frame. Click on the sheet to place its copy.'); }
  }
  function drag(event: React.PointerEvent<HTMLButtonElement>, f: PlotFrame, resize = false) {
    if (!edit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const copying = event.altKey && !resize;
    if (copying && current.frames.length >= 24) { setStatus('A sheet can contain up to 24 frames. Add another sheet to continue.'); return; }
    const start = copying ? { ...f, id: uid() } : f;
    setSelected(start.id); if (copying) { setCopySource(f.id); setDraftFrame(start); }
    const startX = event.clientX, startY = event.clientY, target = event.currentTarget;
    target.focus({ preventScroll: true }); target.setPointerCapture(event.pointerId); let next = start; let moved = false;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / (3.77952756 * scale), dy = (e.clientY - startY) / (3.77952756 * scale);
      moved ||= Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 3;
      const raw = resize ? { ...start, w: f.w + dx, h: f.h + dy } : { ...start, x: f.x + dx, y: f.y + dy };
      const result = snapLayout(raw, current.frames, document.grid, document.snap, 6 / (3.77952756 * scale), resize);
      next = { ...f, ...result.frame }; setDraftFrame(next); setGuides(result.guides);
    };
    const stop = (e: PointerEvent) => {
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop);
      if (e.type !== 'pointercancel' && copying && moved) commitCopy(f.id, next);
      else if (copying) setSelected(f.id);
      else if (e.type !== 'pointercancel' && moved) updateSheet({ frames: current.frames.map(item => item.id === f.id ? next : item) });
      setDraftFrame(null); setGuides([]); setCopySource('');
    };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop);
  }
  function place(event: React.PointerEvent<HTMLDivElement>) {
    if (!pending) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const result = snapLayout({ ...pending, x: (event.clientX - rect.left) / rect.width * 420, y: (event.clientY - rect.top) / rect.height * 297 }, current.frames, document.grid, document.snap, 6 / (3.77952756 * scale));
    setGhost({ x: result.frame.x, y: result.frame.y }); setGuides(result.guides);
  }
  if (!active) return null;
  const continuations = printable.filter(s => s.id.startsWith(current.id + "-"));
  const previewSheet = continuations[Math.min(continuation, continuations.length - 1)];
  const firstPrinted = printable.findIndex(s => s.id === `${current.id}-0`);
  const layoutFrames = draftFrame ? current.frames.some(f => f.id === draftFrame.id) ? current.frames.map(f => f.id === draftFrame.id ? draftFrame : f) : [...current.frames, draftFrame] : current.frames;
  const previewImages = copySource && draftFrame && images[copySource] ? { ...images, [draftFrame.id]: images[copySource] } : images;
  return <div className="technical-plots" data-focused={focused} onKeyDownCapture={event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd' || event.altKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]')) return;
    event.preventDefault(); event.stopPropagation(); if (!event.repeat) duplicateFrame();
  }}>
    <aside className="plots-tools">
      <h2>TECHNICAL PLOTS</h2><section><h3>SHEETS</h3><div className="plots-sheet-list" onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null); }}>{document.sheets.map((s, i) => <button draggable className={`${s.id === current.id ? 'active' : ''} ${dropIndex === i ? 'drop-before' : ''} ${i === document.sheets.length - 1 && dropIndex === i + 1 ? 'drop-after' : ''}`} key={s.id} onDragStart={e => { setDragSheet(s.id); e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={e => { if (!dragSheet) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropIndex(i + (e.clientY > r.top + r.height / 2 ? 1 : 0)); }} onDrop={e => { e.preventDefault(); const list = reorderSheets(document.sheets, dragSheet, dropIndex ?? i); onChange({ ...document, sheets: list }); setIndex(list.findIndex(s => s.id === current.id)); setDragSheet(''); setDropIndex(null); }} onDragEnd={() => { setDragSheet(''); setDropIndex(null); }} onClick={() => { setIndex(i); setContinuation(0); setSelected(''); setCompose(false); setPending(null); }}><UiIcon name="file"/><span>{String(i + 1).padStart(2, '0')}</span><strong>{s.title}</strong></button>)}</div>
      <select aria-label="Add sheet" value="" onChange={e => addSheet(e.target.value as Parameters<typeof sheet>[0])}><option value="" disabled>Add sheet…</option>{['input', 'output', 'views', 'pattern', 'schedule', 'notes', 'blank'].map(t => <option key={t} value={t}>{{ input: 'Input map', output: 'Output map', views: 'Stage views', view: 'Scene view', pattern: 'Screen detail', schedule: 'Screen Specifications', notes: 'Delivery notes', text: 'Text', blank: 'Blank sheet' }[t]}</option>)}</select>
      <div className="plots-row"><button onClick={() => { const copy = readPlotDocument({ ...document, sheets: [current] }).sheets[0]; onChange({ ...document, sheets: [...document.sheets, { ...copy, title: `${copy.title} copy` }] }); setIndex(document.sheets.length); }}>Duplicate</button><button disabled={document.sheets.length < 2} onClick={() => { onChange({ ...document, sheets: document.sheets.filter(s => s.id !== current.id) }); setIndex(Math.max(0, index - 1)); }}>Remove</button></div>
</section>
      <section className="plots-templates"><h3>TEMPLATES</h3><select aria-label="Apply template" value="" onChange={e => { const preset = e.target.value === 'default' ? { name: 'Pixel mapping set', document: defaultPlotDocument() } : library[Number(e.target.value)]; if (!preset) return; onChange(readPlotDocument(preset.document)); setTemplateName(preset.name); setIndex(0); setSelected(''); }}><option value="" disabled>Choose template…</option><option value="default">Pixel mapping set</option>{library.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}</select><label className="plots-template-name">Template title<input aria-label="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} maxLength={100}/></label><button onClick={saveTemplate}>Save template to library</button><div className="plots-row plots-template-files"><button onClick={() => file.current?.click()}>Import</button><button onClick={exportTemplate}>Export</button></div><input ref={file} hidden type="file" accept=".json" onChange={e => { if (e.target.files?.[0]) void readTemplate(e.target.files[0]); e.target.value = ''; }}/></section>
      <section><h3>PROJECT TITLE BLOCK</h3><label>Project title<input value={document.projectTitle} placeholder={source.name} maxLength={100} onChange={e => onChange({ ...document, projectTitle: e.target.value })}/></label>{(['company', 'author', 'revision', 'date'] as const).map(key => <label key={key}>{key}<input value={document[key]} onChange={e => onChange({ ...document, [key]: e.target.value })} maxLength={key === 'company' || key === 'author' ? 100 : 30}/></label>)}<label>Footer note<textarea rows={4} value={document.notes} maxLength={500} onChange={e => onChange({ ...document, notes: e.target.value })}/></label><button onClick={() => logo.current?.click()}>Add your logo…</button>{document.logo && <button onClick={() => onChange({ ...document, logo: '' })}>Remove logo</button>}<input ref={logo} hidden type="file" accept="image/png,image/jpeg" onChange={e => { if (e.target.files?.[0]) void readLogo(e.target.files[0]); e.target.value = ''; }}/></section>
    </aside>
    <main className="plots-main"><div className="plots-toolbar"><span>A3 Landscape</span><button className={edit ? 'active' : ''} aria-pressed={edit} onClick={() => { setEdit(!edit); setCompose(false); setPending(null); }}>{edit ? 'Finish layout' : 'Edit layout'}</button><button disabled={busy || !views.length} onClick={() => { failed.current = ''; void refresh(); }}>Refresh views</button><span className="plots-spacer"/>{continuations.length > 1 && <select aria-label="Continuation page" value={Math.min(continuation, continuations.length - 1)} onChange={e => { setContinuation(Number(e.target.value)); setEdit(false); }}>{continuations.map((_, i) => <option key={i} value={i}>Sheet {i + 1} / {continuations.length}</option>)}</select>}<select aria-label="Paper zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={0}>Fit sheet</option>{[.25, .5, .75, 1, 1.5].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></div>
      <div className="plots-viewport" ref={viewport}><div className="plots-page-space" style={{ width: 1587.402 * scale, height: 1122.52 * scale }}><div className="plots-paper" style={{ transform: `scale(${scale})` }} onPointerMove={place} onPointerLeave={() => { if (pending) { setGhost(null); setGuides([]); } }} onPointerDown={e => { if (!pending || !ghost || e.button !== 0) return; if (copySource) commitCopy(copySource, { ...pending, ...ghost }); else { updateSheet({ frames: [...current.frames, { ...pending, ...ghost }] }); setSelected(pending.id); } setPending(null); setGhost(null); setGuides([]); setEdit(true); }}>
        <PlotPaper document={document} sheet={draftFrame ? { ...previewSheet, frames: layoutFrames } : previewSheet} source={source} page={firstPrinted + Math.min(continuation, continuations.length - 1) + 1} total={printable.length} images={previewImages} previewCameras={capturedFrames.current}/>
        {edit && !pending && !compose && continuation === 0 && <div className="plots-layout-overlay" data-copying={!!copySource}>{layoutFrames.map(original => { const f = draftFrame?.id === original.id ? draftFrame : original; return <div key={f.id} className={`plots-frame-control ${selected === f.id ? 'selected' : ''}`} style={{ left: `${f.x / 420 * 100}%`, top: `${f.y / 297 * 100}%`, width: `${f.w / 420 * 100}%`, height: `${f.h / 297 * 100}%` }}><button aria-label={`Move ${f.title}`} className="plots-frame-move" title="Drag to move · Alt-drag to copy" onPointerDown={e => drag(e, original)}>{f.kind !== 'text' && <span>{f.title}</span>}</button>{selected === f.id && <button className="plots-frame-resize" aria-label={`Resize ${f.title}`} title="Resize frame" onPointerDown={e => drag(e, original, true)}/>}</div>; })}</div>}
        {(pending || draftFrame) && <svg className="plots-guides" viewBox="0 0 420 297">{guides.map((g, i) => <g key={i}><line {...{ x1: g.x1, x2: g.x2, y1: g.y1, y2: g.y2 }} strokeDasharray={g.label ? undefined : '1.5 1'}/>{g.label && <><path d={g.y1 === g.y2 ? `M${g.x1} ${g.y1 - 1.3}v2.6 M${g.x2} ${g.y2 - 1.3}v2.6` : `M${g.x1 - 1.3} ${g.y1}h2.6 M${g.x2 - 1.3} ${g.y2}h2.6`}/><text x={(g.x1 + g.x2) / 2} y={(g.y1 + g.y2) / 2 - 1.5} textAnchor="middle">{g.label}</text></>}</g>)}</svg>}
        {pending && <div className="plots-placement"/>}
        {pending && ghost && <div className="plots-ghost" style={{ left: `${ghost.x / 420 * 100}%`, top: `${ghost.y / 297 * 100}%`, width: `${pending.w / 420 * 100}%`, height: `${pending.h / 297 * 100}%` }}/>}
        {compose && element?.kind === 'view' && <PlotViewFraming key={element.id} frame={element} captured={capturedFrames.current[element.id]} image={images[element.id]} onChange={updateFrame} onInteraction={setInteraction}/>}
      </div></div></div><div className="plots-status">{pending ? 'Click to place frame · Esc to cancel' : compose ? 'Drag to frame the view · Scroll to zoom · Esc to finish' : `${printable.length} printed sheets · A3 landscape`}</div>
    </main>
    <aside className="plots-inspector"><h2>SHEET PROPERTIES</h2><section><label>Sheet title<input value={current.title} maxLength={70} onChange={e => updateSheet({ title: e.target.value })}/></label><h3>FRAMES</h3>{current.frames.map(f => <button className={selected === f.id ? 'active' : ''} key={f.id} onClick={() => { setSelected(f.id); setCompose(false); }}>{f.title}</button>)}<select aria-label="Add frame" value="" onChange={e => { setCopySource(''); const f = frame(e.target.value as PlotFrame['kind'], 12, 30, 180, 100); f.fontSize = document.fontSize; setPending(f); setGhost(null); setContinuation(0); setCompose(false); }}><option disabled value="">Add frame…</option>{['input', 'output', 'view', 'pattern', 'schedule', 'text'].map(t => <option key={t} value={t}>{{ input: 'Input map', output: 'Output map', view: 'Scene view', pattern: 'Screen detail', schedule: 'Screen Specifications', text: 'Text' }[t]}</option>)}</select></section>
      <section><h3>PAGE LAYOUT</h3><label className="plots-check"><input type="checkbox" checked={document.snap} onChange={e => onChange({ ...document, snap: e.target.checked })}/>Snap to grid</label><PlotNumberField label="Grid spacing" suffix="mm" value={document.grid} min={1} max={50} onChange={grid => onChange({ ...document, grid })}/><label>Font<select aria-label="Font" value={document.fontFamily} onChange={e => onChange({ ...document, fontFamily: e.target.value })}>{['Arial', 'Verdana', 'Georgia', 'Courier New'].map(f => <option key={f}>{f}</option>)}</select></label><PlotNumberField label="Text size" suffix="pt" value={document.fontSize} min={6} max={16} onChange={fontSize => onChange({ ...document, fontSize, sheets: document.sheets.map(s => ({ ...s, frames: s.frames.map(f => ({ ...f, fontSize })) })) })}/></section>
      {element && <section><h3>FRAME SETTINGS</h3><label>Title<input value={element.title} maxLength={70} onChange={e => updateFrame({ title: e.target.value, autoTitle: false })}/></label><div className="plots-measurements">{(['x', 'y', 'w', 'h'] as const).map(key => <PlotNumberField key={`${element.id}-${key}`} label={`${({ x: 'X', y: 'Y', w: 'Width', h: 'Height' })[key]} (mm)`} value={element[key]} min={key === 'x' ? 8 : key === 'y' ? 27 : 25} max={key === 'x' ? 412 - element.w : key === 'y' ? 257 - element.h : key === 'w' ? 412 - element.x : 257 - element.y} onChange={n => updateFrame({ [key]: n })}/>)}</div><PlotNumberField key={element.id + '-font'} label="Frame text size" value={element.fontSize} suffix="pt" min={6} max={24} onChange={fontSize => updateFrame({ fontSize })}/>
      {element.kind === 'output' && <label>Output screen<select aria-label="Output screen" value={element.screen} onChange={e => updateFrame({ screen: Number(e.target.value) })}>{source.screens.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select></label>}
      {element.kind === 'pattern' && <label>Screen slice<select aria-label="Screen slice" value={element.screen} onChange={e => updateFrame({ screen: Number(e.target.value) })}>{source.slices.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}</select></label>}
      {element.kind === 'view' && <><label>Camera view<select aria-label="Camera view" value={element.view} onChange={e => updateFrame({ view: e.target.value as PlotFrame['view'] })}>{Object.keys(VIEW_DIRECTIONS).map(v => <option key={v} value={v}>{viewLabel(v)}</option>)}</select></label><label>Render style<select aria-label="Render style" value={element.style} onChange={e => updateFrame({ style: e.target.value as PlotFrame['style'] })}><option value="shaded">Neutral shaded</option><option value="wireframe">Wireframe</option></select></label><label className="plots-check"><input type="checkbox" checked={element.stage} onChange={e => updateFrame({ stage: e.target.checked })}/>Include imported models</label><button className={compose ? 'active' : ''} onClick={() => { setCompose(!compose); setPending(null); setContinuation(0); }}>{compose ? 'Finish framing' : 'Adjust view framing'}</button><PlotNumberField label="View zoom" suffix="%" min={10} max={2000} value={Math.round(element.viewZoom * 100)} onChange={n => updateFrame({ viewZoom: n / 100 })}/><div className="plots-measurements"><PlotNumberField label="View pan X" suffix="%" value={element.panX} min={-500} max={500} onChange={panX => updateFrame({ panX })}/><PlotNumberField label="View pan Y" suffix="%" value={element.panY} min={-500} max={500} onChange={panY => updateFrame({ panY })}/></div><button onClick={() => updateFrame({ viewZoom: 1, panX: 0, panY: 0 })}>Fit view</button></>}
      {element.kind === 'text' && <div className="plots-text-formatting"><h3>TEXT FORMATTING</h3><div className="plots-text-style" role="group" aria-label="Text formatting">
        <button type="button" aria-label="Bold" title="Bold" aria-pressed={!!element.textBold} className={element.textBold ? 'active' : ''} onClick={() => updateFrame({ textBold: !element.textBold })}><strong>B</strong></button>
        <button type="button" aria-label="Italic" title="Italic" aria-pressed={!!element.textItalic} className={element.textItalic ? 'active' : ''} onClick={() => updateFrame({ textItalic: !element.textItalic })}><em>I</em></button>
        <button type="button" aria-label="Underline" title="Underline" aria-pressed={!!element.textUnderline} className={element.textUnderline ? 'active' : ''} onClick={() => updateFrame({ textUnderline: !element.textUnderline })}><u>U</u></button>
      </div><label>Text alignment<select aria-label="Text alignment" value={element.textAlign || 'left'} onChange={e => updateFrame({ textAlign: e.target.value as PlotFrame['textAlign'] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label><label>Text<textarea aria-label="Text" rows={12} value={element.text} maxLength={4000} style={{ fontWeight: element.textBold ? 700 : 400, fontStyle: element.textItalic ? 'italic' : 'normal', textDecoration: element.textUnderline ? 'underline' : 'none', textAlign: element.textAlign || 'left' }} onChange={e => updateFrame({ text: e.target.value })}/></label></div>}
      <button title="Duplicate frame (Ctrl+D)" disabled={!!pending || !!draftFrame || compose || interaction} onClick={duplicateFrame}>Duplicate frame</button><button onClick={() => { updateSheet({ frames: current.frames.filter(f => f.id !== selected) }); setSelected(''); }}>Remove frame</button></section>}
    </aside>
    {printOpen && <PlotPrintDialog busy={busy} pages={printable.map((s, i) => <PlotPaper key={s.id} document={document} sheet={s} source={source} page={i + 1} total={printable.length} images={images}/>)} onClose={() => setPrintOpen(false)} onNotice={onNotice} onPrint={async (device, copies, page) => { if (await sendPages(images, device, copies, page)) setPrintOpen(false); }} onPdf={() => sendPages(images)}/>}
  </div>;
}
