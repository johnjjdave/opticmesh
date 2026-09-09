"use client";

import { useEffect, useState } from "react";
import { RenderPerformance } from "./render-performance";
import { UiCadence, type SystemPerformanceSample } from "./system-performance";
import {usageLevel,memoryPercent,fpsLevel,levelLabel,type PerformanceLevel} from "./performance-status";
import styles from "./v070/v070.module.css";

export default function PerformancePanel({ metrics, three, paused = false }: { metrics: RenderPerformance; three: boolean; paused?: boolean }) {
  const [sample, setSample] = useState(() => metrics.snapshot());
  const [hidden, setHidden] = useState(false);
  const [ui, setUi] = useState<{ fps: number | null; peakMs: number | null }>({ fps: null, peakMs: null });
  const [hardware, setHardware] = useState<SystemPerformanceSample | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [sampledAt, setSampledAt] = useState(0);
  useEffect(() => {
    const cadence = new UiCadence();
    let frame = 0, stopped = false, timer = 0;
    const tick = (now: number) => { if (stopped) return; cadence.record(now); frame = requestAnimationFrame(tick); };
    const visibility = () => {
      cancelAnimationFrame(frame); cadence.reset(); setUi({ fps: null, peakMs: null });
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    const read = (window as Window & { lo2sDesktop?: { getSystemPerformance?: () => Promise<SystemPerformanceSample> } }).lo2sDesktop?.getSystemPerformance;
    const poll = async () => {
      if (stopped) return;
      if (!document.hidden && read) {
        try { const next = await read(); if (!stopped) setHardware(next); }
        catch { if (!stopped) setHardware(null); }
      }
      if (!stopped) timer = window.setTimeout(poll, 1000);
    };
    const uiTimer = window.setInterval(() => { if (!document.hidden) setUi(cadence.snapshot()); }, 500);
    visibility(); timer = window.setTimeout(() => { setDesktop(Boolean(read)); void poll(); }, 0); document.addEventListener("visibilitychange", visibility);
    return () => { stopped = true; cancelAnimationFrame(frame); clearInterval(uiTimer); clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    const update = () => { setSampledAt(Date.now()); setHidden(document.hidden); setSample(metrics.snapshot()); };
    update();
    const timer = window.setInterval(update, 500);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [metrics]);
  const ms = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(2)} ms`;
  const last = sample.last;
  const currentHardware = !hidden && hardware && sampledAt - hardware.sampledAt < 5000 ? hardware : null;
  const unavailable = hidden ? "Paused" : desktop ? "Unavailable" : "Desktop only";
  const percent = (value: number | null | undefined) => value == null || !Number.isFinite(value) || value<0 ? unavailable : `${value.toFixed(1)}%`;
  const bytes = (value: number | null | undefined) => value == null || !Number.isFinite(value) || value<0 ? unavailable : value >= 1073741824 ? `${(value / 1073741824).toFixed(2)} GiB` : `${(value / 1048576).toFixed(0)} MiB`;
  const gpu = !three ? "Not available for 2D" : sample.gpuStatus === "unsupported" ? "Not supported" : sample.gpuStatus === "lost" ? "Context lost" : sample.gpuStatus === "disjoint" ? "Sample invalidated" : sample.gpu ? ms(sample.gpu.ms) : "Waiting for sample";
  const ramPercent=memoryPercent(currentHardware?.systemMemoryUsedBytes,currentHardware?.systemMemoryTotalBytes);
  const memoryValue=(used:number|null|undefined,total:number|null|undefined)=>{const value=memoryPercent(used,total);return `${value==null?"":percent(value)+" · "}${bytes(used)} / ${bytes(total)}`;};
  const reading=(value:string,level:PerformanceLevel|null=null,Tag:"dd"|"span"="dd")=><Tag className={styles.performanceReading} data-performance-state={level||"unrated"}><span>{value}</span>{level&&<small>{levelLabel[level]}</small>}</Tag>;
  const item = (label: string, value: string, tip: string,level:PerformanceLevel|null=null) => <div title={tip} data-metric={label}><dt>{label}</dt>{reading(value,level)}</div>;
  return <div className={styles.performancePanel} role="region" aria-label="Render performance">
    <dl>
      {item("UI FPS", hidden ? "Paused" : ui.fps == null ? "Measuring…" : ui.fps.toFixed(1), "Animation callback cadence while this panel is visible. Tracks UI scheduling even when the scene is idle; not scene-render FPS, video FPS or a guaranteed GPU frame rate. Limited by display/browser scheduling. Attention below 45 FPS; high pressure below 25 FPS. Fixed responsiveness guidance, not a detected monitor target.",fpsLevel(hidden?null:ui.fps))}
      {item("UI frame · peak", hidden ? "—" : ms(ui.peakMs), "Longest interval between UI animation callbacks in the last second. Spikes can indicate a busy main thread or browser/OS scheduling delays.")}
      {item("CPU · app", percent(currentHardware?.cpuPercent), "Combined Electron-process CPU usage, normalized across all logical processors (100% = whole machine). Excludes external NDI/Spout helper processes; system CPU includes them. First sample needs a baseline. Attention at 80%; high pressure at 95%.",usageLevel(currentHardware?.cpuPercent))}
      {item("CPU · system", percent(currentHardware?.systemCpuPercent), "Whole-system CPU utilization over the sampling interval, including other applications. Attention at 80%; high pressure at 95%.",usageLevel(currentHardware?.systemCpuPercent))}
      {item("App memory · private", bytes(currentHardware?.appMemoryBytes), "Sum of Electron-process private memory on Windows. Includes committed allocations that may be paged out; not VRAM or exclusively resident RAM. External helper processes are excluded.")}
      {item("RAM · system", currentHardware ? memoryValue(currentHardware.systemMemoryUsedBytes,currentHardware.systemMemoryTotalBytes) : unavailable, "Physical RAM used / installed for the whole machine, including other applications and the operating system. Attention at 80%; high pressure at 95%.",usageLevel(ramPercent))}
      {currentHardware?.gpus?.length ? currentHardware.gpus.map(device => <div className={styles.gpuMetrics} key={device.index ?? device.name}>
        <dt title={device.name}>GPU {device.index ?? ""} · {device.name}</dt>
        <dd className={styles.gpuReadings}><div data-metric={`GPU ${device.index ?? ""} usage`} title="Whole-device GPU utilization. Attention at 90%; high pressure at 98%. High utilization indicates GPU load, not an imminent crash."><span>Usage</span>{reading(percent(device.utilizationPercent),usageLevel(device.utilizationPercent,90,98),"span")}</div>
        <div data-metric={`GPU ${device.index ?? ""} VRAM`} title="Whole-device dedicated GPU memory, including other applications. Attention at 80%; high pressure at 95%."><span>VRAM</span>{reading(memoryValue(device.memoryUsedBytes,device.memoryTotalBytes),usageLevel(memoryPercent(device.memoryUsedBytes,device.memoryTotalBytes)),"span")}</div></dd>
        <small>Whole GPU · all applications</small>
      </div>) : item("GPU usage / VRAM", unavailable, "Whole-device utilization and dedicated memory used/total from NVIDIA driver telemetry where available. Includes other applications. Browser access and other GPU vendors are currently unavailable.")}
      {item("Viewport redraws / s", hidden || paused ? "Paused" : !last ? "Waiting" : sample.frames ? sample.fps.toFixed(1) : "Idle", "Actual viewport redraws per second over the last second. Idle means no redraw was needed; this is not monitor refresh rate or source-video FPS.")}
      {item("CPU render · avg", hidden ? "—" : ms(sample.cpuMs), "Mean JavaScript time drawing the viewport over the last second. Includes WebGL submission, not waiting for GPU completion or all application work.")}
      {item("CPU render · peak", hidden ? "—" : ms(sample.maxCpuMs), "Slowest viewport draw in the last second.")}
      {item("Last CPU draw", ms(last?.cpuMs), "Duration of the most recent viewport draw; retained while idle.")}
      {item("Last GPU draw", gpu, "Asynchronous GPU time for one complete 3D viewport draw, including every visible pane. Last valid sample is retained while idle. This is not system-wide GPU usage.")}
      {item("Render size", last ? `${last.width.toLocaleString()} × ${last.height.toLocaleString()} px` : "—", "Actual viewport drawing buffer or 2D preview raster, including any working-resolution reduction.")}
      {three && item("Draw calls", last?.calls?.toLocaleString() ?? "—", "Render calls in the last complete viewport draw, summed across all visible panes and editor helpers. Excludes output capture.")}
      {three && item("Scene triangles", sample.sceneTriangles?.toLocaleString() ?? "—", "Total LED and imported mesh triangles, including hidden objects. Updated when scene geometry changes; excludes floor, grid, gizmos and outline passes.")}
      {three && item("Drawn triangles", last?.triangles?.toLocaleString() ?? "—", "Triangles submitted in the last viewport frame, including visible panes, floor, gizmos and selection-outline passes. Changes with camera culling; this is not the scene geometry total.")}
      {three && item("Textures / geometries", last ? `${last.textures ?? 0} / ${last.geometries ?? 0}` : "—", "Renderer-tracked allocated resource counts, not VRAM bytes.")}
    </dl>
  </div>;
}
