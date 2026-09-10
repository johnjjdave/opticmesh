import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPlotDocument, readPlotDocument, printSheets, scheduleCapacity, frame, ratio, VIEW_DIRECTIONS, plotWarnings, placeFrame, reorderSheets, viewSignature } from '../app/technical-plots-data.ts';

test('plot templates round-trip without embedding scene assets or imposing branding', () => {
  const original = defaultPlotDocument(); original.company = 'Example Studio'; original.projectTitle = 'Sample show';
  const decoded = readPlotDocument(JSON.parse(JSON.stringify(original)));
  assert.equal(decoded.company, 'Example Studio'); assert.equal(decoded.projectTitle, 'Sample show'); assert.equal(decoded.logo, '');
  assert.deepEqual(decoded.sheets.map(s => s.frames.map(f => [f.kind, f.x, f.y, f.w, f.h])), original.sheets.map(s => s.frames.map(f => [f.kind, f.x, f.y, f.w, f.h])));
  assert.equal('models' in decoded, false); assert.notEqual(decoded.sheets[0].id, original.sheets[0].id);
});
test('all specification rows appear exactly once across A3 continuation pages', () => {
  const document = defaultPlotDocument(); const f = frame('schedule'); document.sheets = [{ id: 'specs', title: 'Specifications', frames: [f] }];
  const source = { slices: Array.from({ length: 137 }, (_, i) => ({ id: String(i) })) };
  const sheets = printSheets(document, source), rows = sheets.flatMap(s => { const f = s.frames[0]; return source.slices.slice(f.offset, f.offset + scheduleCapacity(f)); });
  assert.deepEqual(rows, source.slices); assert.equal(sheets.length, Math.ceil(137 / scheduleCapacity(f))); assert.ok(sheets.every(s => s.frames[0].w === 396 && s.frames[0].h === 222));
});
test('template imports reject incompatible data and remove unsafe logos', () => {
  assert.throws(() => readPlotDocument({ format: 'other', version: 1, sheets: [] }));
  assert.throws(() => readPlotDocument({ ...defaultPlotDocument(), version: 99 }));
  const d = defaultPlotDocument(); d.logo = 'https://example.com/tracking.png'; d.sheets[0].frames[0].w = Infinity; d.sheets[0].frames[0].view = '__proto__';
  const clean = readPlotDocument(d); assert.equal(clean.logo, ''); assert.ok(Number.isFinite(clean.sheets[0].frames[0].w)); assert.equal(clean.sheets[0].frames[0].view, 'front');
});
test('parallel isometric presets have equal magnitudes on all three axes', () => {
  const iso = Object.entries(VIEW_DIRECTIONS).filter(([name]) => name.startsWith('Upper') || name.startsWith('Lower'));
  assert.equal(iso.length, 8); for (const [, direction] of iso) assert.deepEqual(direction.map(Math.abs), [1, 1, 1]);
  assert.equal(ratio(1920, 1080), '1.778:1'); assert.equal(ratio(100, 0), '—');
});
test('invalid frame bounds and missing map data are reported before export', () => {
  const d = defaultPlotDocument(); d.sheets[0].frames[0].x = 100;
  const warnings = plotWarnings(d, { slices: [], screens: [] });
  assert.ok(warnings.some(w => w.includes('margin'))); assert.ok(warnings.some(w => w.includes('no pixel map'))); assert.ok(warnings.some(w => w.includes('available output')));
});


test('frame placement snaps and stays within A3 content bounds', () => {
  const f = frame('view', 12, 30, 180, 100);
  assert.deepEqual(placeFrame(f, 62, 93, 5, true), { x: 60, y: 95 });
  assert.deepEqual(placeFrame(f, -100, 500, 5, true), { x: 8, y: 157 });
  assert.deepEqual(placeFrame(f, 62.3, 93.1, 5, false), { x: 62.3, y: 93.1 });
});
test('sheet drag insertion works before, between, after and within the same row', () => {
  const sheets = ['a','b','c','d'].map(id => ({ id }));
  assert.deepEqual(reorderSheets(sheets, 'a', 4).map(s => s.id), ['b','c','d','a']);
  assert.deepEqual(reorderSheets(sheets, 'd', 1).map(s => s.id), ['a','d','b','c']);
  assert.deepEqual(reorderSheets(sheets, 'b', 2), sheets);
  assert.deepEqual(sheets.map(s => s.id), ['a','b','c','d']);
});
test('view cache depends on camera and render settings, never the frame location or title', () => {
  const f = frame('view'); const key = viewSignature(f);
  assert.equal(viewSignature({ ...f, x: 30, title: 'Custom' }), key);
  for (const patch of [{ view: 'left' }, { viewZoom: 2 }, { panX: 20 }, { style: 'wireframe' }, { stage: false }]) assert.notEqual(viewSignature({ ...f, ...patch }), key);
});
test('template settings preserve typography, snapping, camera framing and custom titles', () => {
  const d = defaultPlotDocument(); d.fontFamily = 'Verdana'; d.grid = 10; d.snap = false; d.notes = 'A long note\nwith multiple lines';
  Object.assign(d.sheets[2].frames[0], { autoTitle: false, title: 'My view', viewZoom: 2.4, panX: 12, panY: -4, fontSize: 12 });
  const restored = readPlotDocument(d); assert.equal(restored.fontFamily, 'Verdana'); assert.equal(restored.snap, false); assert.equal(restored.notes, d.notes);
  const f = restored.sheets[2].frames[0]; assert.equal(f.viewZoom, 2.4); assert.equal(f.autoTitle, false); assert.equal(f.fontSize, 12);
});


const { snapLayout, framingTransform } = await import('../app/plot-layout.ts');
const { mapSliceLabel, mapLabelLayout } = await import('../app/plot-map-labels.ts');
test('smart guides snap edges, centres and equal spacing in millimetres', () => {
  const a = frame('text', 20, 40, 40, 40), b = frame('text', 80, 40, 40, 40), moving = frame('text', 139, 41, 40, 40);
  const result = snapLayout(moving, [a, b], 5, true, 2);
  assert.equal(result.frame.x, 140); assert.equal(result.frame.y, 40);
  assert.ok(result.guides.some(g => g.label === '20 mm'));
  const middle = snapLayout({ ...moving, x: 69, w: 10 }, [a, b], 5, true, 2);
  assert.equal(middle.frame.x, 70); // Grid wins when no smart target is within tolerance.
  const aligned = snapLayout({ ...moving, x: 21 }, [a], 5, true, 2);
  assert.equal(aligned.frame.x, 20); assert.ok(aligned.guides.some(g => g.x1 === 20 && g.x2 === 20));
});
test('resize snaps width/height, holds top-left, respects minimum and page boundary', () => {
  const f = frame('text', 60, 80, 117, 112);
  assert.deepEqual(snapLayout(f, [], 5, true, 2, true).frame, { ...f, w: 115, h: 110 });
  const huge = snapLayout({ ...f, w: 999, h: 999 }, [], 5, true, 2, true).frame;
  assert.equal(huge.w, 352); assert.equal(huge.h, 177);
  const small = snapLayout({ ...f, w: -20, h: 0 }, [], 5, true, 2, true).frame;
  assert.equal(small.w, 25); assert.equal(small.h, 25);
  const peer = frame('text', 200, 200, 50, 50);
  assert.equal(snapLayout({ ...f, w: 139 }, [peer], 5, true, 2, true).frame.w, 140);
});
test('camera default titles are capitalized and custom titles survive a template round-trip', () => {
  const doc = defaultPlotDocument(); const frames = doc.sheets[2].frames;
  assert.equal(frames[0].title, 'Front'); assert.equal(frames[2].title, 'Upper Front Left');
  frames[0].title = 'front'; frames[1].title = 'My angle'; frames[1].autoTitle = false;
  const restored = readPlotDocument(doc).sheets[2].frames;
  assert.equal(restored[0].title, 'Front'); assert.equal(restored[1].title, 'My angle');
});
test('bitmap framing preserves pan under zoom and remains until the sharp capture arrives', () => {
  const captured = { viewZoom: 1, panX: 10, panY: -5 };
  assert.deepEqual(framingTransform(captured, { viewZoom: 2, panX: 20, panY: -10 }), { scale: 2, x: 0, y: 0 });
  assert.deepEqual(framingTransform(captured, { ...captured, panX: 0, panY: 15 }), { scale: 1, x: 10, y: 20 });
});
test('maps label correct input/output origins, rasters and physical size even on narrow slices', () => {
  const s = { id: 'one', name: 'Stage Right Window 1', screenName: 'Stage', input: { x: 320, y: 512, width: 256, height: 768 }, output: { x: 100, y: 200, width: 128, height: 384 }, physicalWidth: 1, physicalHeight: 3 };
  assert.match(mapSliceLabel(s, false), /Input X: 320 · Y: 512 px\n256 × 768 px\n1 × 3 m/);
  assert.match(mapSliceLabel(s, true), /Output X: 100 · Y: 200 px\n128 × 384 px\n1 × 3 m/);
  const source = { width: 13824, height: 3584, slices: [s], screens: [{ name: 'Stage', width: 1920, height: 1080 }] };
  const layout = mapLabelLayout(frame('input'), source);
  assert.ok(layout.external.has(s.id)); assert.equal(layout.overflow, false);
  const many = { ...source, slices: Array.from({ length: 25 }, (_, i) => ({ ...s, id: String(i) })) };
  assert.equal(mapLabelLayout(frame('input', 12, 30, 80, 50), many).overflow, true);
});

const { duplicatePosition } = await import('../app/plot-layout.ts');
test('duplicate placement prefers a free neighbour and never resizes or overlaps it', () => {
  const f = frame('pattern', 60, 80, 115, 110);
  assert.deepEqual(duplicatePosition(f, [f], 5, true), { x: 180, y: 80 });
  const nearRight = { ...f, x: 290, w: 100, h: 60 };
  assert.deepEqual(duplicatePosition(nearRight, [nearRight], 5, true), { x: 290, y: 145 });
  assert.equal(duplicatePosition(frame('input'), [frame('input')], 5, true), undefined);
  const blocker = { ...f, id: 'block', x: 180 };
  assert.equal(duplicatePosition(f, [f, blocker], 5, true), undefined);
  assert.deepEqual(duplicatePosition({ ...f, x: 61.3 }, [], 5, false), { x: 181.3, y: 80 });
});


test('all seven labels remain inside the wide stage map, including its four narrow windows', () => {
  const source = sevenSliceMap();
  for (const kind of ['input', 'output']) {
    const layout = mapLabelLayout(frame(kind), source);
    assert.equal(layout.rows.length, 7);
    assert.equal(layout.external.size, 0, `${kind}: narrow windows have enough height for wrapped labels`);
    assert.equal(layout.legendHeight, 0);
    assert.equal(layout.overflow, false);
  }
});
function sevenSliceMap() {
  const placements = [
    ['Stage Right Window 1', 2560, 1280, 1152, 2304],
    ['Stage Right Window 3', 0, 1280, 1152, 2304],
    ['Stage Left Window 1', 10112, 1280, 1152, 2304],
    ['Stage Left Window 3', 12672, 1280, 1152, 2304],
    ['Main Stage', 3712, 0, 6400, 3584],
    ['Stage Right Window 2', 1152, 768, 1408, 2816],
    ['Stage Left Window 2', 11264, 768, 1408, 2816],
  ];
  return { name: 'Seven-slice map', width: 13824, height: 3584, screens: [{ name: 'Stage', width: 13824, height: 3584 }], slices: placements.map(([name, x, y, width, height], i) => ({ id: String(i), name, screenName: 'Stage', input: { x, y, width, height }, output: { x, y, width, height }, physicalWidth: width / 256, physicalHeight: height / 256 })) };
}

const { screenDetailLayout } = await import('../app/plot-map-labels.ts');
test('screen detail reserves horizontal and vertical dimension bands before the footer and frame border', () => {
  for (const [w, h, rasterW, rasterH, fontSize] of [[128,222,1408,2816,9], [396,130,3840,256,9], [180,100,2560,512,9], [180,210,1408,2816,14]]) {
    const f = { ...frame('pattern', 12, 30, w, h), fontSize };
    const s = { input: { width: rasterW, height: rasterH }, panelWidth:500,panelHeight:500,panelPixelsWidth:128,panelPixelsHeight:128 };
    const l = screenDetailLayout(f, s);
    assert.equal(l.fits, true);
    assert.ok(l.widthY - l.dimensionSize >= l.y + l.h + 2.9);
    assert.ok(l.widthY + l.dimensionSize * .3 + 4 <= l.noteTop + .001);
    assert.ok(l.heightX <= l.x - 3);
    assert.ok(l.heightX - l.dimensionSize >= 4);
    assert.ok(l.x + l.w <= w - 4 + .001);
    assert.ok(l.noteBaseline + (l.noteLines - 1) * l.noteSize * 1.4 + l.noteSize * .3 <= h - 4 + .001);
  }
});


test('text formatting survives project/template round trips and legacy notes stay plain', () => {
  const d = defaultPlotDocument();
  const note = { ...frame('text'), text: 'Delivery instructions', textBold: true, textItalic: true, textUnderline: true, textAlign: 'center' };
  d.sheets[0].frames = [note];
  const restored = readPlotDocument(JSON.parse(JSON.stringify(d))).sheets[0].frames[0];
  for (const key of ['text', 'textBold', 'textItalic', 'textUnderline', 'textAlign']) assert.equal(restored[key], note[key]);
  d.sheets[0].frames = [frame('text')];
  const legacy = readPlotDocument(d).sheets[0].frames[0];
  assert.equal(legacy.textBold, false); assert.equal(legacy.textItalic, false); assert.equal(legacy.textUnderline, false); assert.equal(legacy.textAlign, 'left');
  Object.assign(d.sheets[0].frames[0], { textBold: 'false', textItalic: {}, textUnderline: 1, textAlign: 'invalid' });
  const invalid = readPlotDocument(d).sheets[0].frames[0];
  assert.equal(invalid.textBold, false); assert.equal(invalid.textItalic, false); assert.equal(invalid.textUnderline, false); assert.equal(invalid.textAlign, 'left');
});
