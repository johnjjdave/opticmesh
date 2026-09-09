export type SystemPerformanceSample = {
  sampledAt: number;
  cpuPercent: number | null;
  systemCpuPercent: number | null;
  appMemoryBytes: number | null;
  systemMemoryTotalBytes: number;
  systemMemoryUsedBytes: number;
  gpus: Array<{ index: number | null; name: string; utilizationPercent: number | null; memoryUsedBytes: number | null; memoryTotalBytes: number | null }> | null;
};

/** Animation callback cadence measures UI scheduling, not rendered or presented frames. */
export class UiCadence {
  private started: number;
  private last: number | null = null;
  private frames: Array<{ time: number; interval: number }> = [];
  constructor(now = performance.now()) { this.started = now; }
  reset(now = performance.now()) { this.started = now; this.last = null; this.frames = []; }
  record(now: number) {
    if (this.last != null && now > this.last) this.frames.push({ time: now, interval: now - this.last });
    this.last = now;
    this.prune(now);
  }
  private prune(now: number) { this.frames = this.frames.filter(frame => now - frame.time < 1000); }
  snapshot(now = performance.now()) {
    this.prune(now);
    const elapsed = Math.min(1000, now - this.started);
    return { fps: elapsed >= 250 ? this.frames.length * 1000 / elapsed : null, peakMs: this.frames.length ? Math.max(...this.frames.map(frame => frame.interval)) : null };
  }
}
