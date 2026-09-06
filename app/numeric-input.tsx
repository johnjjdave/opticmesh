"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { bindNumericWheel } from "./numeric-wheel";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onWheel" | "onWheelCapture"> & {
  onValueWheel?: (event: WheelEvent) => void;
};

/** Shared numeric input: wheel adjustment never also scrolls its panel. */
export default function NumericInput({ onValueWheel, ...props }: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (input) return bindNumericWheel(input, onValueWheel);
  }, [onValueWheel, props.disabled, props.readOnly]);

  return <input {...props} ref={inputRef} />;
}
