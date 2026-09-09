export type ProjectDelta = { set: Record<string, unknown>; remove: string[] };
export type ProjectPatch = { reset: boolean; project: ProjectDelta; simulation: ProjectDelta };

/** Retain immutable snapshot references so unchanged model assets never cross
 * the desktop bridge again when only the camera or another small field changes. */
export class ProjectSnapshotTracker {
  private previous: Record<string, unknown> = {};
  private previousSimulation: Record<string, unknown> = {};
  private first = true;
  patch(snapshot: Record<string, unknown>): ProjectPatch {
    const simulation = (snapshot.simulation || {}) as Record<string, unknown>;
    const delta = (next: Record<string, unknown>, previous: Record<string, unknown>, omit?: string): ProjectDelta => ({
      set: Object.fromEntries(Object.entries(next).filter(([key,value]) => key !== omit && (!Object.hasOwn(previous,key) || value !== previous[key]))),
      remove: Object.keys(previous).filter(key => key !== omit && !Object.hasOwn(next,key)),
    });
    const patch = { reset: this.first, project: delta(snapshot, this.previous, "simulation"), simulation: delta(simulation, this.previousSimulation) };
    this.previous = snapshot; this.previousSimulation = simulation; this.first = false;
    return patch;
  }
  reset() { this.previous = {}; this.previousSimulation = {}; this.first = true; }
}

/** Autosave keeps its snapshot in a worker. Camera updates send only small deltas,
 * never another copy of unchanged embedded geometry. Only one encode may run. */
export class ProjectEncoder {
  private worker: Worker | null = null;
  private tracker = new ProjectSnapshotTracker();
  private pending: { resolve: (bytes: ArrayBuffer) => void; reject: (error: Error) => void } | null = null;
  encode(snapshot: Record<string, unknown>): Promise<ArrayBuffer> {
    if (this.pending) return Promise.reject(new Error("Project encoding is already in progress."));
    if (!this.worker) {
      this.worker = new Worker(new URL("./project-encode.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = event => {
        const pending = this.pending;
        // Vite workers can also send development protocol messages.
        if (!event.data?.bytes && !event.data?.error) return;
        this.pending = null;
        if (event.data.error) { this.reset(); pending?.reject(new Error(event.data.error)); }
        else pending?.resolve(event.data.bytes);
      };
      this.worker.onerror = event => { const pending = this.pending; this.pending = null; this.reset(); pending?.reject(new Error(event.message || "Unable to encode project.")); };
    }
    const patch = this.tracker.patch(snapshot);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      try {
        this.worker!.postMessage(patch);
      } catch (error) { this.pending = null; this.reset(); reject(error); }
    });
  }
  private reset() { this.worker?.terminate(); this.worker = null; this.tracker.reset(); }
  dispose() { const pending = this.pending; this.pending = null; this.reset(); pending?.reject(new Error("Project encoder closed.")); }
}
