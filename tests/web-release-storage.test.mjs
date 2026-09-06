import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { storeWebRelease, verifyWebRelease } from '../scripts/web-release-storage.mjs';

const commit = 'a'.repeat(40);
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'opticmesh-web-storage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const archive = path.join(root, 'input.zip'); writeFileSync(archive, 'original web archive');
  return { root, archive, stored: path.join(root, 'releases/v0.7.0/opticmesh-web-0.7.0.zip') };
}

test('stored release verifies identity and exact archive bytes, and retries retain the original', t => {
  const f = fixture(t), manifest = storeWebRelease(f.root, 'v0.7.0', commit, f.archive);
  assert.deepEqual(verifyWebRelease(f.root, 'v0.7.0', commit), manifest);
  writeFileSync(f.archive, 'rebuilt archive with different timestamps');
  assert.deepEqual(storeWebRelease(f.root, 'v0.7.0', commit, f.archive), manifest);
  assert.equal(readFileSync(f.stored, 'utf8'), 'original web archive');
});
test('corrupt archives and changed source tags are rejected', t => {
  const f = fixture(t); storeWebRelease(f.root, 'v0.7.0', commit, f.archive);
  assert.throws(() => verifyWebRelease(f.root, 'v0.7.0', 'b'.repeat(40)), /requested release/);
  writeFileSync(f.stored, 'corrupt');
  assert.throws(() => verifyWebRelease(f.root, 'v0.7.0', commit), /checksum or size/);
  assert.throws(() => storeWebRelease(f.root, 'v0.7.0', commit, f.archive), /checksum or size/);
});
test('invalid tags and unverified commit identifiers cannot choose storage paths', t => {
  const f = fixture(t);
  assert.throws(() => storeWebRelease(f.root, '../outside', commit, f.archive), /numeric release tag/);
  assert.throws(() => storeWebRelease(f.root, 'v0.7.0', 'main', f.archive), /resolved release commit/);
});
