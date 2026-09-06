import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function releasePaths(root, tag, sourceCommit) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('Expected a numeric release tag such as v0.7.0.');
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Expected a resolved release commit SHA.');
  const directory = path.resolve(root, 'releases', tag);
  const file = `opticmesh-web-${tag.slice(1)}.zip`;
  return { directory, file, archive: path.join(directory, file), manifest: path.join(directory, 'manifest.json') };
}

const digest = data => createHash('sha256').update(data).digest('hex');

export function verifyWebRelease(root, tag, sourceCommit) {
  const paths = releasePaths(root, tag, sourceCommit);
  const manifest = JSON.parse(readFileSync(paths.manifest, 'utf8'));
  if (manifest.tag !== tag || manifest.sourceCommit !== sourceCommit || manifest.file !== paths.file) {
    throw new Error('Stored web package does not match the requested release.');
  }
  const data = readFileSync(paths.archive);
  if (manifest.bytes !== data.length || manifest.sha256 !== digest(data)) throw new Error('Stored web package checksum or size mismatch.');
  return manifest;
}

export function storeWebRelease(root, tag, sourceCommit, archive) {
  const paths = releasePaths(root, tag, sourceCommit);
  // A retry reuses the verified archive already stored for this source commit.
  // ZIP timestamps may differ across rebuilds; never rewrite the released bytes.
  if (existsSync(paths.manifest)) return verifyWebRelease(root, tag, sourceCommit);
  if (existsSync(paths.directory)) throw new Error('Incomplete web storage directory; refusing to overwrite it.');
  const data = readFileSync(archive);
  const manifest = { tag, sourceCommit, file: paths.file, bytes: data.length, sha256: digest(data) };
  mkdirSync(paths.directory, { recursive: true });
  writeFileSync(paths.archive, data, { flag: 'wx' });
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return verifyWebRelease(root, tag, sourceCommit);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, root, tag, sourceCommit, archive] = process.argv.slice(2);
  if (!root || !tag || !sourceCommit || !['store', 'verify'].includes(command) || (command === 'store' && !archive)) {
    throw new Error('Usage: web-release-storage.mjs store|verify STORAGE TAG COMMIT [ZIP]');
  }
  console.log(JSON.stringify(command === 'store' ? storeWebRelease(root, tag, sourceCommit, archive) : verifyWebRelease(root, tag, sourceCommit)));
}
