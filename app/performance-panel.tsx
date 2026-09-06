"use client";

import { useEffect, useState } from "react";
import { RenderPerformance } from "./render-performance";
import styles from "./v070/v070.module.css";

export default function PerformancePanel({ metrics, three }: { metrics: RenderPerformance; three: boolean }) {
  const [sample, setSample] = useState(() => metrics.snapshot());
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => { setHidden(document.hidden); setSample(metrics.snapshot()); };
    update();
    const timer = window.setInterval(update, 500);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [metrics]);
  const ms = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(2)} ms`;
  const last = sample.last;
  const gpu = !three ? "Not available for 2D" : sample.gpuStatus === "unsupported" ? "Not supported" : sample.gpuStatus === "lost" ? "Context lost" : sample.gpuStatus === "disjoint" ? "Sample invalidated" : sample.gpu ? ms(sample.gpu.ms) : "Waiting for sample";
  const item = (label: string, value: string, tip: string) => <div title={tip}><dt>{label}</dt><dd>{value}</dd></div>;
  return <div className={styles.performancePanel} role="region" aria-label="Render performance">
    <dl>
      {item("Render FPS", hidden ? "Paused" : !last ? "Waiting" : sample.frames ? sample.fps.toFixed(1) : "Idle", "Actual viewport redraws per second over the last second. Idle means no redraw was needed; this is not monitor refresh rate or source-video FPS.")}
      {item("CPU render · avg", hidden ? "—" : ms(sample.cpuMs), "Mean JavaScript time drawing the viewport over the last second. Includes WebGL submission, not waiting for GPU completion or all application work.")}
      {item("CPU render · peak", hidden ? "—" : ms(sample.maxCpuMs), "Slowest viewport draw in the last second.")}
      {item("Last CPU draw", ms(last?.cpuMs), "Duration of the most recent viewport draw; retained while idle.")}
      {item("Last GPU draw", gpu, "Asynchronous GPU time for one complete 3D viewport draw, including every visible pane. Last valid sample is retained while idle. This is not system-wide GPU usage.")}
      {item("Render size", last ? `${last.width.toLocaleString()} × ${last.height.toLocaleString()} px` : "—", "Actual viewport drawing buffer or 2D preview raster, including any working-resolution reduction.")}
      {three && item("Draw calls", last?.calls?.toLocaleString() ?? "—", "Render calls in the last complete viewport draw, summed across all visible panes and editor helpers. Excludes output capture.")}
      {three && item("Triangles", last?.triangles?.toLocaleString() ?? "—", "Triangles submitted in the last complete viewport draw, summed across all visible panes.")}
      {three && item("Textures / geometries", last ? `${last.textures ?? 0} / ${last.geometries ?? 0}` : "—", "Renderer-tracked allocated resource counts, not VRAM bytes.")}
    </dl>
    <p>Measured viewport rendering · refreshes twice per second · idle views save work.{three ? " GPU usage % is unavailable; GPU draw time is shown when supported." : " 2D GPU timing is unavailable."}</p>
  </div>;
}
