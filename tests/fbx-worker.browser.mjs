import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { FBXLoader } from '../app/vendor/FBXLoader.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Small binary FBX with a mesh, camera and embedded image. No external files.
const i32 = value => { const b = Buffer.alloc(4); b.writeInt32LE(value); return b; };
const property = value => {
  if (typeof value === 'string') { const b = Buffer.from(value); return Buffer.concat([Buffer.from('S'), i32(b.length), b]); }
  if (typeof value === 'number') return Buffer.concat([Buffer.from('I'), i32(value)]);
  if (Buffer.isBuffer(value)) return Buffer.concat([Buffer.from('R'), i32(value.length), value]);
  const array = value.type === 'i' ? new Int32Array(value.values) : new Float64Array(value.values);
  return Buffer.concat([Buffer.from(value.type), i32(array.length), i32(0), i32(array.byteLength), Buffer.from(array.buffer)]);
};
const n = (name, props = [], children = []) => ({ name, props, children });
function encode(node, offset) {
  const name = Buffer.from(node.name), props = Buffer.concat(node.props.map(property));
  let next = offset + 13 + name.length + props.length;
  const children = node.children.map(child => { const b = encode(child, next); next += b.length; return b; });
  const end = Buffer.alloc(node.children.length ? 13 : 0); next += end.length;
  const header = Buffer.alloc(13); header.writeUInt32LE(next); header.writeUInt32LE(node.props.length, 4); header.writeUInt32LE(props.length, 8); header[12] = name.length;
  return Buffer.concat([header, name, props, ...children, end]);
}
function fixture(explicitAspect) {
  const nodes = [n('Objects', [], [
    n('Geometry', [1, 'Geometry::Panel', 'Mesh'], [n('Vertices', [{type:'d', values:[0,0,0,2,0,0,0,3,0]}]), n('PolygonVertexIndex', [{type:'i', values:[0,1,-3]}])]),
    n('Model', [2, 'Model::Panel', 'Mesh'], [n('Properties70', [], [n('P', ['Lcl Translation','Lcl Translation','','A', 5,6,7])])]),
    n('Model', [3, 'Model::Source camera', 'Camera']),
    n('NodeAttribute', [4, 'NodeAttribute::Camera', 'Camera'], [n('Properties70', [], [n('P', ['CameraProjectionType','enum','','',0]), ...(explicitAspect ? [n('P', ['AspectWidth','double','Number','',1600]), n('P', ['AspectHeight','double','Number','',900])] : [])])]),
    n('Video', [5, 'Video::Embedded image', 'Clip'], [n('RelativeFilename', ['image.png']), n('Content', [Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU3sAAAAASUVORK5CYII=', 'base64')])]),
  ]), n('Connections', [], [n('C',['OO',1,2]), n('C',['OO',2,0]), n('C',['OO',3,0]), n('C',['OO',4,3])])];
  const header = Buffer.concat([Buffer.from('Kaydara FBX Binary  \0\x1a\0'), i32(7400)]);
  let offset = header.length;
  return Buffer.concat([header, ...nodes.map(node => { const b = encode(node, offset); offset += b.length; return b; }), Buffer.alloc(176)]);
}
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  const page = await browser.newPage(); await page.goto('http://localhost:3000/');
  for (const explicitAspect of [false, true]) {
    const bytes = fixture(explicitAspect), urls = [], originalCreate = URL.createObjectURL;
    URL.createObjectURL = blob => { const url = originalCreate(blob); urls.push(url); return url; };
    try {
      assert.equal(typeof globalThis.window, 'undefined');
      const scene = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
      assert.equal(scene.children.find(node => node.isCamera).aspect, explicitAspect ? 1600/900 : 1);
      assert.equal(urls.length, 1, 'Binary image parsed without window');
    } finally { URL.createObjectURL = originalCreate; urls.forEach(url => URL.revokeObjectURL(url)); }
    const result = await page.evaluate(data => new Promise((resolve, reject) => {
      const worker = new Worker('/app/model-import.worker.ts?worker_file&type=module', {type:'module'});
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timed out')); }, 30000);
      worker.onmessage = event => { if (!event.data.model && !event.data.error) return; clearTimeout(timer); worker.terminate(); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
      const bytes = new Uint8Array(data).buffer;
      worker.postMessage({name:'stage.fbx',files:[{name:'stage.fbx',bytes}]}, [bytes]);
    }), Array.from(bytes));
    assert(!result.error, result.error);
    assert.equal(result.model.triangles, 1);
    assert(!result.model.nodes.some(node => /camera/i.test(node.name)), 'Source camera is excluded');
    const panel = result.model.nodes.find(node => node.geometry);
    assert.deepEqual(panel.matrix.slice(12,15), [5,6,7], 'Mesh placement preserved');
    console.log(`FBX worker: binary image, camera ${explicitAspect ? 'file aspect' : 'fallback aspect'}, mesh and transform passed`);
  }
} finally { await browser.close(); }
