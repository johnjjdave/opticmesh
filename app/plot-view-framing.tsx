import { useEffect, useRef, useState } from 'react';
import type { PlotFrame } from './technical-plots-data';
import { framingTransform } from './plot-layout';

type Camera = Pick<PlotFrame, 'viewZoom' | 'panX' | 'panY'>;
export default function PlotViewFraming({ frame, captured, image, onChange, onInteraction }: { frame: PlotFrame; captured?: PlotFrame; image?: string; onChange: (camera: Camera) => void; onInteraction: (active: boolean) => void }) {
  const surface = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [draft, setDraft] = useState<Camera | null>(null);
  const latest = useRef({ frame, onChange, onInteraction });
  useEffect(() => { latest.current = { frame, onChange, onInteraction }; });
  const camera = useRef<Camera>(frame), interacting = useRef(false), previousView = useRef(frame.view);
  useEffect(() => {
    if (previousView.current !== frame.view) {
      previousView.current = frame.view; clearTimeout(timer.current);
      interacting.current = false; latest.current.onInteraction(false);
    }
    if (!interacting.current) { camera.current = frame; setDraft(null); }
  }, [frame]);
  const finish = () => {
    clearTimeout(timer.current);
    if (!interacting.current) return;
    interacting.current = false; latest.current.onChange({ ...camera.current, panX: Number(camera.current.panX.toFixed(4)), panY: Number(camera.current.panY.toFixed(4)) }); latest.current.onInteraction(false);
  };
  useEffect(() => {
    const target = surface.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      interacting.current = true; latest.current.onInteraction(true);
      const old = camera.current, zoom = Math.max(.1, Math.min(20, old.viewZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))), ratio = zoom / old.viewZoom;
      camera.current = { viewZoom: zoom, panX: Math.max(-500, Math.min(500, old.panX * ratio)), panY: Math.max(-500, Math.min(500, old.panY * ratio)) };
      setDraft(camera.current); clearTimeout(timer.current); timer.current = setTimeout(finish, 250);
    };
    target.addEventListener('wheel', wheel, { passive: false });
    return () => { target.removeEventListener('wheel', wheel); finish(); };
  }, []);
  const transform = framingTransform(captured || frame, draft || frame);
  return <div ref={surface} className="plots-compose" aria-label="Frame camera controls" style={{ left: `${(frame.x + 2) / 420 * 100}%`, top: `${(frame.y + 10) / 297 * 100}%`, width: `${(frame.w - 4) / 420 * 100}%`, height: `${(frame.h - 19) / 297 * 100}%` }} onPointerDown={event => {
    if (event.button !== 0) return;
    event.preventDefault(); clearTimeout(timer.current);
    const target = event.currentTarget, rect = target.getBoundingClientRect(), start = { ...camera.current }, x = event.clientX, y = event.clientY;
    target.setPointerCapture(event.pointerId); interacting.current = true; latest.current.onInteraction(true);
    const move = (e: PointerEvent) => {
      camera.current = { ...start, panX: Math.max(-500, Math.min(500, start.panX - (e.clientX - x) / rect.width * 100)), panY: Math.max(-500, Math.min(500, start.panY + (e.clientY - y) / rect.height * 100)) };
      setDraft(camera.current);
    };
    const stop = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop); finish(); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop);
  }}>
    {/* This is an in-memory capture, not a network image. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image && <img alt="" draggable={false} src={image} style={{ width: '100%', height: '100%', objectFit: 'fill', transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`, transformOrigin: 'center', pointerEvents: 'none' }}/>}
  </div>;
}
