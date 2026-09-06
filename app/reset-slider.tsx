"use client";

import { useState, type InputHTMLAttributes } from "react";

type ResetSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "onDoubleClick"> & {
  /** Built-in setting default, in the same units as the slider. */
  resetValue: number;
  /** Starts one undoable edit before the slider changes. */
  onEditStart?: () => void;
} & ({ value: number; onValueChange: (value: number) => void } | { value?: never; onValueChange?: (value: number) => void });

/** All app sliders share double-click reset without adding a layout control. */
export default function ResetSlider({ resetValue, value, onValueChange, onEditStart, disabled, onPointerDown, onMouseDown, onKeyDown, ...props }: ResetSliderProps) {
  const [localValue, setLocalValue] = useState(resetValue);
  const commit = (next: number) => {
    if (disabled) return;
    if (value === undefined) setLocalValue(next);
    onValueChange?.(next);
  };

  return <input
    {...props}
    type="range"
    disabled={disabled}
    value={value ?? localValue}
    onChange={(event) => commit(Number(event.currentTarget.value))}
    onDoubleClick={() => commit(resetValue)}
    onPointerDown={(event) => {
      if (disabled) return;
      if (event.pointerType !== "mouse") onEditStart?.();
      onPointerDown?.(event);
    }}
    onMouseDown={(event) => {
      if (disabled) return;
      // The first click already captured the state before a double-click reset.
      if (event.button === 0 && event.detail < 2) onEditStart?.();
      onMouseDown?.(event);
    }}
    onKeyDown={(event) => {
      if (disabled) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) onEditStart?.();
      onKeyDown?.(event);
    }}
  />;
}
