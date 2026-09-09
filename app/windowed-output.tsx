"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import ThreeSimulation, { type SimulationProps } from "./three-simulation";
import UiIcon from "./ui-icon";

type Gesture = { action: "move" | "resize"; x: number; y: number; left: number; top: number; width: number; height: number };
type WindowedCommand = { action: "ready" | "begin-move" | "begin-resize" | "update" | "end"; x?: number; y?: number };
type PreviewBridge = { windowedOutputGesture?: (command: WindowedCommand) => Promise<void> };
const ignore = () => {};
const emptyIds: string[] = [];
const previewStyle = `
.windowed-output{position:fixed;box-sizing:border-box;z-index:10000;border:0;background:#090b0c;overflow:hidden;outline:none;color:#d4dcd6;touch-action:none;user-select:none;box-shadow:0 5px 30px #0008}
.windowed-output .three-view{position:absolute;inset:0;min-width:0;min-height:0;overflow:hidden;outline:none;background:#090b0c;touch-action:none}
.windowed-output .three-view>canvas{display:block;width:100%;height:100%}
.windowed-output .three-view-surface{position:absolute;z-index:2;touch-action:none;outline:none}
.windowed-output .three-empty{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:28px;font:12px Arial,sans-serif;gap:8px;pointer-events:none}
.windowed-output .three-empty span{max-width:300px;color:#98a2a6}
.windowed-output button{position:absolute;z-index:10;background:#111719bb;color:#d4dcd6;border:0;font:18px Arial,sans-serif;padding:0;min-width:0;line-height:22px;cursor:pointer}
.windowed-output button:focus-visible{outline:2px solid #d4dcd6;outline-offset:-3px}
.windowed-output-close{top:5px;right:5px;width:24px;height:24px}
.windowed-output .windowed-output-move{top:5px;left:5px;width:24px;height:24px;display:grid;place-items:center;cursor:move}
.windowed-output .windowed-output-resize{right:0;bottom:0;width:24px;height:24px;border:0;background:linear-gradient(135deg,transparent 47%,#98a2a6 49%,#98a2a6 52%,transparent 54%) 9px 9px/12px 12px no-repeat;cursor:nwse-resize}
`;

export default function WindowedOutput({ scene, onClose }: { scene: SimulationProps; onClose: () => void }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [native, setNative] = useState(false);
  const [bounds, setBounds] = useState({ left: 80, top: 110, width: 640, height: 360 });
  const [initialCamera] = useState(() => scene.cameraMemory?.current || scene.cameraState);
  const gesture = useRef<Gesture | null>(null);
  const closeRef = useRef(onClose);
  const bridgeRef = useRef<PreviewBridge | undefined>(undefined);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const bridge = (window as Window & { lo2sDesktop?: PreviewBridge }).lo2sDesktop;
    bridgeRef.current = bridge;
    let child: Window | null = null;
    let active = true;
    let closedTimer: number | null = null;
    // Defer native creation through the development Strict Mode setup/cleanup
    // cycle so a single menu action never opens and destroys a throwaway window.
    const setupTimer = window.setTimeout(() => {
      if (!active) return;
      if (bridge?.windowedOutputGesture) {
        child = window.open("about:blank", "opticmesh-windowed-output", "width=640,height=360");
        if (!child) { closeRef.current(); return; }
        child.document.title = "OpticMesh — Windowed output";
        child.document.body.style.cssText = "margin:0;background:#090b0c;overflow:hidden";
        setNative(true);
        setTarget(child.document.body);
        // about:blank can emit an initial unload during popup setup; wait for
        // actual closure instead of treating that navigation as a user close.
        closedTimer = window.setInterval(() => { if (active && child?.closed) closeRef.current(); }, 200);
      } else {
        setTarget(document.body);
        setBounds({ left: 40, top: 90, width: Math.min(640, window.innerWidth - 48), height: Math.min(360, window.innerHeight - 110) });
      }
    }, 0);
    const closeChild = () => child?.close();
    window.addEventListener("beforeunload", closeChild);
    return () => {
      active = false;
      window.clearTimeout(setupTimer);
      if (closedTimer !== null) window.clearInterval(closedTimer);
      window.removeEventListener("beforeunload", closeChild);
      child?.close();
    };
  }, []);

  // Native listeners stop shortcuts before they reach the editor's global handlers,
  // including when the browser preview is portalled into the editor document.
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    void bridgeRef.current?.windowedOutputGesture?.({ action: "ready" });
    const key = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      else if (event.key !== "Tab" && event.key !== "Enter" && event.key !== " ") event.preventDefault();
    };
    const cancel = () => { gesture.current = null; void bridgeRef.current?.windowedOutputGesture?.({ action: "end" }); };
    element.addEventListener("keydown", key);
    element.addEventListener("keyup", key);
    element.ownerDocument.defaultView?.addEventListener("blur", cancel);
    return () => {
      element.removeEventListener("keydown", key);
      element.removeEventListener("keyup", key);
      element.ownerDocument.defaultView?.removeEventListener("blur", cancel);
    };
  }, [target]);

  const start = (event: ReactPointerEvent) => {
    const element = event.target as HTMLElement;
    if (element.closest(".windowed-output-close") || event.button !== 0) return;
    const resizing = Boolean(element.closest(".windowed-output-resize"));
    if (!resizing && !element.closest(".windowed-output-move")) return;
    event.preventDefault(); event.stopPropagation();
    shell.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { action: resizing ? "resize" : "move", x: event.screenX, y: event.screenY, ...bounds };
    void bridgeRef.current?.windowedOutputGesture?.({ action: resizing ? "begin-resize" : "begin-move" });
  };
  const move = (event: ReactPointerEvent) => {
    const drag = gesture.current;
    if (!drag) return;
    event.preventDefault(); event.stopPropagation();
    const x = event.screenX - drag.x, y = event.screenY - drag.y;
    if (native) void bridgeRef.current?.windowedOutputGesture?.({ action: "update", x, y });
    else if (drag.action === "resize") setBounds({ ...bounds, width: Math.max(240, Math.min(window.innerWidth - drag.left, drag.width + x)), height: Math.max(160, Math.min(window.innerHeight - drag.top, drag.height + y)) });
    else setBounds({ ...bounds, left: Math.max(0, Math.min(window.innerWidth - drag.width, drag.left + x)), top: Math.max(0, Math.min(window.innerHeight - drag.height, drag.top + y)) });
  };
  const end = (event: ReactPointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    void bridgeRef.current?.windowedOutputGesture?.({ action: "end" });
  };
  if (!target) return null;
  return createPortal(<><style>{previewStyle}</style><div ref={shell} className="windowed-output" role="region" aria-label="Windowed output" tabIndex={0}
    title="Top-left handle move · Left-drag orbit · Right-drag pan · Wheel zoom · Bottom-right corner resize · Escape close"
    style={native ? { inset: 0, width: "100%", height: "100%", boxShadow: "none" } : bounds}
    onPointerDownCapture={start} onPointerMoveCapture={move} onPointerUpCapture={end} onPointerCancelCapture={end} onContextMenu={(event) => event.preventDefault()}>
    <ThreeSimulation {...scene} renderPaused={false} outputActive={false} previewOnly selectedIds={emptyIds} lockedIds={emptyIds} selectionTransform={undefined}
      cameraState={initialCamera} cameraMemory={undefined} viewMode="perspective" fitSignal={0} focusSignal={0}
      onSelectionChange={ignore} onTransformPreview={ignore} onTransformsChange={ignore} onCameraChange={ignore}
      onOutputCaptureReady={undefined} performanceMetrics={undefined} />
    <button className="windowed-output-move" aria-label="Move windowed output" title="Drag to move windowed output"><UiIcon name="move" style={{ width: 16, height: 16 }} /></button>
    <button className="windowed-output-close" aria-label="Close windowed output" title="Close windowed output (Escape)" onClick={onClose}>×</button>
    <button className="windowed-output-resize" aria-label="Resize windowed output" title="Drag to resize windowed output" tabIndex={-1} />
  </div></>, target);
}
