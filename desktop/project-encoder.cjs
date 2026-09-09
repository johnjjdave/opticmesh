const { Worker } = require('node:worker_threads');
const path = require('node:path');

/** Keep large project snapshots off the UI and native event loops. */
class DesktopProjectEncoder {
  constructor() { this.worker = null; this.pending = null; }
  encode(patch) {
    if (this.pending) return Promise.reject(new Error('Project encoding is already in progress.'));
    if (!this.worker) {
      const worker = this.worker = new Worker(path.join(__dirname, 'project-encode-worker.cjs'));
      worker.unref();
      worker.on('message', result => {
        const pending = this.pending;
        this.pending = null;
        if (result.error) { this.reset(); pending?.reject(new Error(result.error)); }
        else pending?.resolve(Buffer.from(result.bytes));
      });
      worker.on('error', error => { if (this.worker === worker) this.fail(error); });
      worker.on('exit', () => { if (this.worker === worker) this.fail(new Error('Project encoder stopped.')); });
    }
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      try { this.worker.postMessage(patch); } catch (error) { this.fail(error); }
    });
  }
  reset() { const worker = this.worker; this.worker = null; void worker?.terminate(); }
  fail(error) { const pending = this.pending; this.pending = null; this.reset(); pending?.reject(error); }
  dispose() { this.fail(new Error('Project encoder closed.')); }
}
module.exports = { DesktopProjectEncoder };
