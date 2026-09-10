import { useState } from 'react';
import NumericInput from './numeric-input';
import FieldStepper from './field-stepper';
import UiIcon from './ui-icon';
import { evaluateExpression } from './expression';

export default function PlotNumberField({ label, value, onChange, min = -10000, max = 10000, suffix = '' }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  const [draft, setDraft] = useState(String(value)), [invalid, setInvalid] = useState(false);
  const [previous, setPrevious] = useState(value);
  if (previous !== value) { setPrevious(value); setDraft(String(value)); setInvalid(false); }
  const apply = (n: number) => { const next = Math.round(Math.max(min, Math.min(max, n)) * 10000) / 10000; setDraft(String(next)); setInvalid(false); if (next !== value) onChange(next); };
  const commit = () => { const n = evaluateExpression(draft, true); if (n === null) { setInvalid(true); return; } apply(n); };
  const adjust = (direction: number, shift: boolean) => apply((evaluateExpression(draft, true) ?? value) + direction * (shift ? 10 : 1));
  return <label className={`number-field ${invalid ? 'invalid' : ''}`}><span>{label}</span><span className="number-control">
    <NumericInput aria-label={label} aria-invalid={invalid} value={draft} inputMode="decimal" title={`${label} · arithmetic expressions supported`} onChange={e => setDraft(e.target.value)} onBlur={commit} onValueWheel={e => adjust(e.deltaY < 0 ? 1 : -1, e.shiftKey)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(String(value)); setInvalid(false); } if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); adjust(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey); } }}/>
    <em>{suffix}</em><FieldStepper label={label}><button aria-label={`Increase ${label}`} onPointerDown={e => e.preventDefault()} onClick={e => adjust(1, e.shiftKey)}><UiIcon name="up"/></button><button aria-label={`Decrease ${label}`} onPointerDown={e => e.preventDefault()} onClick={e => adjust(-1, e.shiftKey)}><UiIcon name="down"/></button></FieldStepper>
  </span></label>;
}
