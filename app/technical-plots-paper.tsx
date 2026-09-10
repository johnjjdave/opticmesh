import { type PlotDocument, type PlotFrame, type PlotSheet, type PlotSource, ratio, value, scheduleCapacity, specificationRowHeight, viewLabel } from './technical-plots-data';

import { framingTransform } from './plot-layout';
import { wrapPlotText as lines, mapSliceLabel, mapLabelLayout, screenDetailLayout } from './plot-map-labels';

function Text({ text, x, y, width, size = 3, max = 5, align = 'left' }: { text: string; x: number; y: number; width: number; size?: number; max?: number; align?: PlotFrame['textAlign'] }) {
  const all = lines(text, width, size);
  const anchorX = x + (align === 'center' ? width / 2 : align === 'right' ? width : 0);
  return <text x={anchorX} y={y} fontSize={size} textAnchor={align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}>{all.slice(0, max).map((line, i) => <tspan key={i} x={anchorX} dy={i ? size * 1.4 : 0}>{line}{i === max - 1 && all.length > max ? '…' : ''}</tspan>)}</text>;
}
function MapFrame({ f, source }: { f: PlotFrame; source: PlotSource }) {
  const output = f.kind === 'output', screen = source.screens[f.screen];
  const layout = mapLabelLayout(f, source), { rows, external, size, columns, cardWidth, cardHeight, legendHeight, scale, width, height } = layout;
  const x = (f.w - width * scale) / 2, y = 19 + Math.max(0, (f.h - 38 - legendHeight - height * scale) / 2);
  const legend = rows.filter(s => external.has(s.id));
  return <>
    <text x={4} y={13} fontSize={size} fill="#596165">{output ? screen?.name : 'Composition'} · {width} × {height} px · {ratio(width, height)} · Origin: top left</text>
    <rect x={x} y={y} width={width * scale} height={height * scale} fill="#f4f6f5" stroke="#737e80" strokeWidth={.25}/>
    {rows.map(s => { const r = output ? s.output : s.input, rx = x + r.x * scale, ry = y + r.y * scale, rw = r.width * scale, rh = r.height * scale; const id = source.slices.indexOf(s) + 1;
      return <g key={s.id} data-map-slice={s.id}>
        {r.points && r.points.length > 2 ? <polygon points={r.points.map(p => `${x + p.x * scale},${y + p.y * scale}`).join(' ')} fill="#d4dcd6" fillOpacity={.65} stroke="#34484c" strokeWidth={.35}/> : <rect x={rx} y={ry} width={rw} height={rh} fill="#d4dcd6" fillOpacity={.65} stroke="#34484c" strokeWidth={.35}/>}
        <g><rect x={rx + .6} y={ry + .6} width={7} height={4.5} fill="#263336"/><text x={rx + 4} y={ry + 3.8} textAnchor="middle" fill="white" fontSize={2.8}>{String(id).padStart(2, '0')}</text></g>
        {!external.has(s.id) && <Text text={mapSliceLabel(s, output)} x={rx + 2} y={ry + Math.max(10, (rh - lines(mapSliceLabel(s, output), rw - 4, size).length * size * 1.4) / 2)} width={rw - 4} size={size} max={100}/>}
      </g>;
    })}
    <text x={x + width * scale / 2} y={y + height * scale + 5} textAnchor="middle" fontSize={size}>{width} px</text>
    <text transform={`translate(${x - 5} ${y + height * scale / 2}) rotate(-90)`} textAnchor="middle" fontSize={size}>{height} px</text>
    {legend.map((s, i) => {
      const rx = 4 + i % columns * cardWidth, ry = f.h - legendHeight + Math.floor(i / columns) * cardHeight;
      return <g key={s.id} data-map-callout={s.id}><line x1={rx} x2={rx + cardWidth - 4} y1={ry - 2} y2={ry - 2} stroke="#9aa8a5" strokeWidth={.25}/><Text text={`${String(source.slices.indexOf(s) + 1).padStart(2, '0')} · ${mapSliceLabel(s, output)}`} x={rx} y={ry + 2} width={cardWidth - 5} size={size} max={100}/></g>;
    })}
    <text x={4} y={f.h - 3} fontSize={2.6 * f.fontSize / 9} fill="#596165">{output ? 'Output' : 'Input'} coordinates: top-left origin · IDs match screen specifications · Physical size in metres</text>
  </>;
}
function PatternDetail({ f, source }: { f: PlotFrame; source: PlotSource }) {
  const fs = f.fontSize / 9;
  const s = source.slices[f.screen]; if (!s) return <text x={4} y={15} fontSize={3 * fs}>Choose a screen slice.</text>;
  const layout = screenDetailLayout(f, s), { x, y, w, h, scale } = layout;
  if (!layout.fits) return <Text text="Enlarge this frame or reduce its text size to fit the screen and dimension labels." x={4} y={16} width={f.w - 8} size={3} max={4}/>;
  return <>
    <text x={4} y={16} fontSize={4 * fs} fontWeight={700}>{String(source.slices.indexOf(s) + 1).padStart(2, '0')} · {s.name}</text>
    <text x={4} y={23} fontSize={3 * fs}>Raster: {s.input.width} × {s.input.height} px · {ratio(s.input.width, s.input.height)}</text>
    <text x={4} y={29} fontSize={3 * fs}>Pixel pitch: {value(s.nominalPitch)} mm nominal / {value(s.effectivePitch)} mm effective</text>
    <text x={4} y={35} fontSize={3 * fs}>Surface size: {value(s.physicalWidth)} × {value(s.physicalHeight)} m · {ratio(s.physicalWidth, s.physicalHeight)}</text>
    <rect x={x} y={y} width={w} height={h} fill="#253639"/>
    <defs><pattern id={`panels-${f.id}`} width={Math.max(1, s.panelPixelsWidth) * scale * 2} height={Math.max(1, s.panelPixelsHeight) * scale * 2} patternUnits="userSpaceOnUse" x={x} y={y}><rect width={s.panelPixelsWidth * scale * 2} height={s.panelPixelsHeight * scale * 2} fill="#506e75"/><path d={`M0 0h${s.panelPixelsWidth * scale}v${s.panelPixelsHeight * scale}H0z M${s.panelPixelsWidth * scale} ${s.panelPixelsHeight * scale}h${s.panelPixelsWidth * scale}v${s.panelPixelsHeight * scale}h-${s.panelPixelsWidth * scale}z`} fill="#d4dcd6"/></pattern></defs>
    <rect data-detail-grid="true" x={x} y={y} width={w} height={h} fill={`url(#panels-${f.id})`}/>
    <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + h} stroke="white" strokeWidth={.4}/><line x1={x} x2={x + w} y1={y + h / 2} y2={y + h / 2} stroke="white" strokeWidth={.4}/>
    <text data-detail-width="true" x={x + w / 2} y={layout.widthY} textAnchor="middle" fontSize={layout.dimensionSize}>{s.input.width} px</text><text data-detail-height="true" transform={`translate(${layout.heightX} ${y + h / 2}) rotate(-90)`} textAnchor="middle" fontSize={layout.dimensionSize}>{s.input.height} px</text>
    <g data-detail-note="true"><Text x={4} y={layout.noteBaseline} width={f.w - 8} size={layout.noteSize} max={layout.noteLines} text={layout.note}/></g>
  </>;
}
function Schedule({ f, source }: { f: PlotFrame; source: PlotSource }) {
  if (f.w < 300) return <>{source.slices.slice(f.offset, f.offset + scheduleCapacity(f)).map((s, i) => {
    const size = 2.8 * f.fontSize / 9, y = 15 + i * specificationRowHeight(f);
    const cells = [`${String(f.offset + i + 1).padStart(2, '0')} · ${s.name}`, `Output: ${s.screenName}`, `Raster: ${s.input.width} × ${s.input.height} px · ${ratio(s.input.width, s.input.height)}`, `Pitch: ${value(s.nominalPitch)} / ${value(s.effectivePitch)} mm`, `Size: ${value(s.physicalWidth)} × ${value(s.physicalHeight)} m`, `Panel: ${value(s.panelWidth)} × ${value(s.panelHeight)} mm · ${s.panelPixelsWidth} × ${s.panelPixelsHeight} px`, `Input: ${value(s.input.x)}, ${value(s.input.y)} px`, `Output: ${value(s.output.x)}, ${value(s.output.y)} px · ${value(s.output.width)} × ${value(s.output.height)} px`];
    return <g key={s.id}>{cells.map((t, j) => <Text key={j} text={t} x={4 + j % 2 * (f.w - 8) / 2} y={y + Math.floor(j / 2) * size * 3.1} width={(f.w - 16) / 2} max={2} size={size}/>)}<line x1={0} x2={f.w} y1={y + specificationRowHeight(f) - 6} y2={y + specificationRowHeight(f) - 6} stroke="#d0d6d3" strokeWidth={.2}/></g>;
  })}</>;
  const columns = [4, 17, 79, 124, 170, 219, 274, 329].map(n => n * f.w / 396);
  const labels = ['ID', 'SCREEN / OUTPUT', 'RASTER / RATIO', 'PITCH (mm)', 'SIZE / RATIO', 'PANEL / PIXELS', 'INPUT ORIGIN (px)', 'OUTPUT (px)'];
  return <>
    <rect x={0} y={9} width={f.w} height={8} fill="#e7ebe9"/>
    {labels.map((l, i) => <text key={l} x={columns[i]} y={14} fontWeight={700} fontSize={2.5 * f.fontSize / 9}>{l}</text>)}
    {source.slices.slice(f.offset, f.offset + scheduleCapacity(f)).map((s, i) => {
      const y = 22 + i * specificationRowHeight(f);
      const cells = [String(f.offset + i + 1).padStart(2, '0'), `${s.name}\n${s.screenName}`, `${s.input.width} × ${s.input.height}\n${ratio(s.input.width, s.input.height)}`, `${value(s.nominalPitch)} nominal\n${value(s.effectivePitch)} effective`, `${value(s.physicalWidth)} × ${value(s.physicalHeight)} m\n${ratio(s.physicalWidth, s.physicalHeight)}`, `${value(s.panelWidth)} × ${value(s.panelHeight)} mm\n${s.panelPixelsWidth} × ${s.panelPixelsHeight} px`, `${value(s.input.x)} , ${value(s.input.y)}\n${s.warped ? 'Warped surface' : 'Rectangular surface'}`, `${value(s.output.x)} , ${value(s.output.y)}\n${value(s.output.width)} × ${value(s.output.height)}`];
      return <g key={s.id}>{cells.map((t, j) => <Text key={j} text={t} x={columns[j]} y={y} width={(columns[j + 1] || f.w - 3) - columns[j] - 2} max={3} size={2.8 * f.fontSize / 9}/>)}<line x1={0} x2={f.w} y1={y + specificationRowHeight(f) - 5} y2={y + specificationRowHeight(f) - 5} stroke="#d0d6d3" strokeWidth={.2}/></g>;
    })}
  </>;
}
export function PlotPaper({ document, sheet, source, page, total, images = {}, previewCameras = {} }: { document: PlotDocument; sheet: PlotSheet; source: PlotSource; page: number; total: number; images?: Record<string, string>; previewCameras?: Record<string, PlotFrame> }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297" role="img" aria-label={`${sheet.title}, A3 landscape`} style={{ display: 'block', background: '#fff', color: '#20282b', fontFamily: `${document.fontFamily}, sans-serif` }} fill="#20282b">
    <rect width={420} height={297} fill="white"/>
    <line x1={12} y1={24} x2={408} y2={24} stroke="#20282b" strokeWidth={.45}/>
    <text x={12} y={19} fontSize={6 * document.fontSize / 9} fontWeight={700}>{sheet.title}</text>
    <text x={408} y={18} textAnchor="end" fontSize={3}>TECHNICAL PLOT / {String(page).padStart(2, '0')}</text>
    {sheet.frames.map(f => <g key={f.id} transform={`translate(${f.x} ${f.y})`}>
      <defs><clipPath id={`clip-${f.id}`}><rect width={f.w} height={f.h}/></clipPath></defs>
      <g clipPath={`url(#clip-${f.id})`}>
        <rect width={f.w} height={f.h} fill="white" stroke="#c4ccca" strokeWidth={.25}/>
        <text x={4} y={6} fontSize={f.fontSize * 25.4 / 72} fontWeight={700}>{f.title}</text>
        {(f.kind === 'input' || f.kind === 'output') && <MapFrame f={f} source={source}/>}
        {f.kind === 'pattern' && <PatternDetail f={f} source={source}/>}
        {f.kind === 'schedule' && <Schedule f={f} source={source}/>}
        {f.kind === 'text' && <g data-note-body={f.id} fontWeight={f.textBold ? 700 : 400} fontStyle={f.textItalic ? 'italic' : 'normal'} textDecoration={f.textUnderline ? 'underline' : 'none'}><Text text={f.text} x={4} y={15} width={f.w - 8} size={f.fontSize * 25.4 / 72} align={f.textAlign} max={Math.floor((f.h - 18) / (f.fontSize * 25.4 / 72 * 1.4))}/></g>}
        {f.kind === 'view' && <>{images[f.id] ? <svg x={2} y={10} width={f.w - 4} height={f.h - 19} viewBox={`0 0 ${f.w - 4} ${f.h - 19}`} overflow="hidden">{(() => {
          const captured = previewCameras[f.id], t = captured && captured.view === f.view ? framingTransform(captured, f) : { x: 0, y: 0, scale: 1 };
          const w = f.w - 4, h = f.h - 19;
          return <image data-view-id={f.id} href={images[f.id]} width={w} height={h} preserveAspectRatio="none" transform={`translate(${w / 2 + t.x / 100 * w} ${h / 2 + t.y / 100 * h}) scale(${t.scale}) translate(${-w / 2} ${-h / 2})`}/>;
        })()}</svg> : <text x={f.w / 2} y={f.h / 2} fontSize={3} textAnchor="middle" fill="#667175">{source.slices.length ? 'Refresh scene views' : 'Load a scene, then refresh views'}</text>}<text x={4} y={f.h - 3} fontSize={2.6} fill="#596165">{viewLabel(f.view)} · {f.style} · Parallel projection · Not to scale</text></>}
      </g>
    </g>)}
    <line x1={12} y1={263} x2={408} y2={263} stroke="#20282b" strokeWidth={.45}/>
    {document.logo && <image href={document.logo} x={12} y={267} width={49} height={19} preserveAspectRatio="xMinYMid meet"/>}
    {!document.logo && <Text text={document.company} x={12} y={274} width={49} size={4} max={2}/>}
    <line x1={68} y1={267} x2={68} y2={287} stroke="#b8c1bd" strokeWidth={.25}/>
    <text x={74} y={270} fontSize={2.5} fill="#596165">PROJECT</text><Text text={document.projectTitle || source.name} x={74} y={276} width={166} size={4} max={1}/>
    <Text text={document.notes} x={74} y={281} width={250} size={2.6 * document.fontSize / 9} max={Math.floor(13 / (2.6 * document.fontSize / 9 * 1.4))}/>
    <text x={248} y={270} fontSize={2.5} fill="#596165">DRAWN BY / ISSUE DATE</text><Text text={`${document.author}\n${document.date}`} x={248} y={276} width={79} max={2}/>
    <text x={335} y={270} fontSize={2.5} fill="#596165">REVISION</text><text x={335} y={278} fontSize={4}>{document.revision}</text>
    <text x={408} y={270} textAnchor="end" fontSize={2.5}>A3 · 420 × 297 mm</text><text x={408} y={279} textAnchor="end" fontSize={4}>{page} / {total}</text>
  </svg>;
}
