"use client";
import { useRef, useState } from "react";
import { PIVOT_LABELS, PIVOT_PRESETS, snapPivot, type PivotPreset } from "./slice-pivot";

export default function PivotPad({ point, disabled, onCommit }: { point: [number, number] | null; disabled?: boolean; onCommit: (preset: PivotPreset) => void }) {
  const [preview, setPreview] = useState<PivotPreset | null>(null);
  const drag = useRef<{ id: number; preset: PivotPreset } | null>(null);
  const previewIndex = preview ? PIVOT_PRESETS.indexOf(preview) : -1;
  const xy = previewIndex >= 0 ? [previewIndex % 3 / 2, Math.floor(previewIndex / 3) / 2] : point;
  const locate = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapPivot(((event.clientX - rect.left) / rect.width - 0.1) / 0.8, ((event.clientY - rect.top) / rect.height - 10 / 64) / (44 / 64));
  };
  return <div className="pivot-pad" role="group" aria-label="XY pivot pad" aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
    title="XY pivot · snap to one of nine anchors"
    onPointerDown={(event) => { if (disabled || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); const preset = locate(event); drag.current = { id: event.pointerId, preset }; setPreview(preset); event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={(event) => { if (disabled || !drag.current || drag.current.id !== event.pointerId) return; const preset = locate(event); drag.current.preset = preset; setPreview(preset); }}
    onPointerUp={(event) => { if (!drag.current || drag.current.id !== event.pointerId) return; const preset = drag.current.preset; drag.current = null; setPreview(null); event.currentTarget.releasePointerCapture(event.pointerId); if (!disabled) onCommit(preset); }}
    onPointerCancel={() => { drag.current = null; setPreview(null); }}
    onLostPointerCapture={() => { drag.current = null; setPreview(null); }}
    onKeyDown={(event) => {
      if (disabled) return;
      if (event.key === "Escape" && drag.current) { event.stopPropagation(); drag.current = null; setPreview(null); return; }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const x = xy?.[0] ?? 0.5, y = xy?.[1] ?? 0.5;
      onCommit(event.key === "Home" ? "center" : snapPivot(x + (event.key === "ArrowLeft" ? -0.5 : event.key === "ArrowRight" ? 0.5 : 0), y + (event.key === "ArrowUp" ? -0.5 : event.key === "ArrowDown" ? 0.5 : 0)));
    }}>
    <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
      <path d="M10 10H90V54H10Z M50 10V54 M10 32H90" />
      {PIVOT_PRESETS.map((preset, index) => <circle key={preset} cx={10 + index % 3 * 40} cy={10 + Math.floor(index / 3) * 22} r="2"><title>{PIVOT_LABELS[preset]}</title></circle>)}
      {xy && <circle className="pivot-pad-handle" cx={10 + Math.max(0, Math.min(1, xy[0])) * 80} cy={10 + Math.max(0, Math.min(1, xy[1])) * 44} r="4" />}
    </svg>
  </div>;
}
