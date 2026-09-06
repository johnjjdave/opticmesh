import assert from "node:assert/strict";
import test from "node:test";
import { bindNumericWheel } from "../app/numeric-wheel.ts";

class Element extends EventTarget {
  constructor(parentElement = null, scrollable = false) {
    super();
    this.parentElement = parentElement;
    this.scrollable = scrollable;
    this.disabled = false;
    this.readOnly = false;
  }
  contains(target) {
    for (let node = target; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
}

function setup() {
  const document = new EventTarget();
  const root = new Element(), panel = new Element(root, true), control = new Element(panel), input = new Element(control), outside = new Element(root);
  Object.assign(document, {
    activeElement: null,
    scrollingElement: root,
    documentElement: root,
    defaultView: { getComputedStyle: (element) => ({ overflowY: element.scrollable ? "auto" : "visible", overflowX: "visible" }) },
  });
  input.ownerDocument = document;
  const changes = [];
  const cleanup = bindNumericWheel(input, (event) => changes.push({ deltaY: event.deltaY, shifted: event.shiftKey }));
  const focus = () => { document.activeElement = input; input.dispatchEvent(new Event("focus")); };
  const blur = () => { document.activeElement = null; input.dispatchEvent(new Event("blur")); };
  const wheel = (target, deltaY = 100, options = {}) => {
    const event = new Event("wheel", { cancelable: true, bubbles: true });
    Object.defineProperties(event, {
      target: { value: target }, deltaY: { value: deltaY },
      shiftKey: { value: options.shiftKey ?? false }, ctrlKey: { value: options.ctrlKey ?? false },
    });
    // Model capture before the target listener, using real cancellable Events.
    document.dispatchEvent(event);
    if (!event.defaultPrevented && target === input) input.dispatchEvent(event);
    return event;
  };
  return { document, panel, control, input, outside, changes, cleanup, focus, blur, wheel };
}

test("wheel adjustment consumes scrolling and preserves direction/Shift", () => {
  const f = setup();
  assert.equal(f.wheel(f.input, -100, { shiftKey: true }).defaultPrevented, true);
  assert.deepEqual(f.changes, [{ deltaY: -100, shifted: true }]);
  f.cleanup();
});

test("focused numeric edit blocks panel scrolling without changing another value", () => {
  const f = setup();
  f.focus();
  assert.equal(f.wheel(f.input).defaultPrevented, true);
  assert.equal(f.changes.length, 1, "one adjustment, not native plus custom increments");
  assert.equal(f.wheel(f.panel).defaultPrevented, true);
  assert.equal(f.wheel(new Element(f.panel)).defaultPrevented, true);
  assert.equal(f.changes.length, 1, "scrolling elsewhere in the panel does not edit values");
  f.cleanup();
});

test("blur restores panel scrolling and leaves other panels independent", () => {
  const f = setup();
  f.focus();
  assert.equal(f.wheel(f.outside).defaultPrevented, false);
  f.blur();
  assert.equal(f.wheel(f.panel).defaultPrevented, false);
  f.focus();
  assert.equal(f.wheel(f.panel).defaultPrevented, true);
  f.cleanup();
  assert.equal(f.wheel(f.panel).defaultPrevented, false, "unmount removes the panel lock");
  assert.equal(f.wheel(f.input).defaultPrevented, false, "unmount removes value adjustment");
});

test("disabled and read-only fields do not edit or lock the panel", () => {
  for (const property of ["disabled", "readOnly"]) {
    const f = setup();
    f.focus();
    f.input[property] = true;
    assert.equal(f.wheel(f.panel).defaultPrevented, false);
    assert.equal(f.wheel(f.input).defaultPrevented, false);
    assert.equal(f.changes.length, 0);
    f.cleanup();
  }
});

test("horizontal wheel and browser zoom do not accidentally decrement values", () => {
  const f = setup();
  f.focus();
  assert.equal(f.wheel(f.input, 0).defaultPrevented, true);
  assert.equal(f.wheel(f.input, 100, { ctrlKey: true }).defaultPrevented, false);
  assert.equal(f.changes.length, 0);
  f.cleanup();
});

test("rebinding a focused control replaces its callback and retains scroll protection", () => {
  const f = setup();
  f.focus();
  f.cleanup();
  let count = 0;
  const cleanup = bindNumericWheel(f.input, () => { count += 1; });
  assert.equal(f.wheel(f.input).defaultPrevented, true);
  assert.equal(count, 1);
  assert.equal(f.changes.length, 0);
  cleanup();
});
