export type RenderWork = { width: number; height: number; calls?: number; triangles?: number; textures?: number; geometries?: number };
export type FrameSample = RenderWork & { time: number; cpuMs: number };
export type GpuStatus = "unsupported" | "pending" | "available" | "disjoint" | "lost";

// Measurements are outside React state: observing them must never invalidate a scene.
export class RenderPerformance {
  private frames: FrameSample[] = [];
  private last: FrameSample | null = null;
  private gpu: { time: number; ms: number } | null = null;
  private gpuStatus: GpuStatus = "unsupported";
  private started = 0;
  private sceneTriangles: number | null = null;
  setSceneTriangles(value: number) { this.sceneTriangles = value; }

  reset(now = performance.now()) {
    this.frames = []; this.last = null; this.gpu = null;
    this.gpuStatus = "unsupported"; this.started = now;
  }
  record(cpuMs: number, work: RenderWork, now = performance.now()) {
    if (!Number.isFinite(cpuMs) || cpuMs < 0) return;
    this.last = { ...work, cpuMs, time: now };
    this.frames.push(this.last);
    this.prune(now);
  }
  private prune(now: number) {
    this.frames = this.frames.filter(frame => now - frame.time < 1000);
  }
  setGpuStatus(status: GpuStatus) {
    this.gpuStatus = status;
    if (status !== "available" && status !== "pending") this.gpu = null;
  }
  recordGpu(ms: number, now = performance.now()) {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.gpu = { ms, time: now }; this.gpuStatus = "available";
  }
  snapshot(now = performance.now()) {
    this.prune(now);
    const count = this.frames.length;
    const elapsed = Math.min(1000, Math.max(1, now - this.started));
    return {
      sceneTriangles: this.sceneTriangles,
      fps: count * 1000 / elapsed,
      frames: count,
      cpuMs: count ? this.frames.reduce((sum, frame) => sum + frame.cpuMs, 0) / count : null,
      maxCpuMs: count ? Math.max(...this.frames.map(frame => frame.cpuMs)) : null,
      last: this.last,
      gpu: this.gpu,
      gpuStatus: this.gpuStatus,
    };
  }
}

type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

// One non-blocking query at a time. Results are read only after availability;
// invalid/disjoint samples and context-loss results must never reach the panel.
export function createGpuTimer(gl: WebGL2RenderingContext, metrics: RenderPerformance) {
  let extension: TimerExtension | null = null;
  let query: WebGLQuery | null = null;
  let active = false;
  let queriedAt = 0;
  const clear = () => {
    if (query) gl.deleteQuery(query);
    query = null; active = false;
  };
  const restore = () => {
    clear();
    extension = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
    metrics.setGpuStatus(extension ? "pending" : "unsupported");
  };
  restore();
  return {
    poll(now = performance.now()) {
      if (gl.isContextLost()) { clear(); metrics.setGpuStatus("lost"); return; }
      if (!extension || active || !query) return;
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        clear(); metrics.setGpuStatus("disjoint"); return;
      }
      if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        metrics.recordGpu(Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6, now);
        clear();
      } else if (query && now - queriedAt > 2000) {
        clear(); metrics.setGpuStatus("pending");
      }
    },
    begin(now = performance.now()) {
      if (!extension || query || gl.isContextLost()) return;
      if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      query = gl.createQuery();
      if (!query) return;
      queriedAt = now;
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query); active = true;
    },
    end() {
      if (active && extension && !gl.isContextLost()) gl.endQuery(extension.TIME_ELAPSED_EXT);
      active = false;
    },
    restore,
    dispose: clear,
  };
}
