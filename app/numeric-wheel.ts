/** Keep wheel edits separate from scrolling the inspector that owns the field. */
export function bindNumericWheel(input: HTMLInputElement, adjust?: (event: WheelEvent) => void) {
  const document = input.ownerDocument;
  const captureOptions = { passive: false, capture: true };
  const editable = () => !input.disabled && !input.readOnly;
  const control = input.parentElement || input;
  const panel = () => {
    for (let ancestor = input.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = document.defaultView?.getComputedStyle(ancestor);
      if (style && /auto|scroll|overlay/.test(`${style.overflowY} ${style.overflowX}`)) return ancestor;
    }
    return document.scrollingElement || document.documentElement;
  };
  const editWheel = (event: WheelEvent) => {
    if (!editable() || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY !== 0) adjust?.(event);
  };
  const holdPanel = (event: WheelEvent) => {
    if (!editable() || document.activeElement !== input || event.ctrlKey) return;
    const target = event.target as Node | null;
    if (!target || !panel().contains(target)) return;
    // Stop panel scroll and scroll chaining even when the pointer leaves the
    // focused field. Only the selected field's own control adjusts its value.
    event.preventDefault();
    event.stopPropagation();
    if (control.contains(target) && event.deltaY !== 0) adjust?.(event);
  };
  const focus = () => {
    if (editable()) document.addEventListener("wheel", holdPanel, captureOptions);
  };
  const blur = () => document.removeEventListener("wheel", holdPanel, captureOptions);

  input.addEventListener("wheel", editWheel, { passive: false });
  input.addEventListener("focus", focus);
  input.addEventListener("blur", blur);
  if (document.activeElement === input) focus();

  return () => {
    blur();
    input.removeEventListener("wheel", editWheel);
    input.removeEventListener("focus", focus);
    input.removeEventListener("blur", blur);
  };
}
