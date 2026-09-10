type Snapshot = Record<string, unknown>;

// Compare immutable project data without serializing embedded model assets.
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Snapshot, right = b as Snapshot;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

export function hasUnsavedProjectChanges(saved: Snapshot | null, current: Snapshot): boolean {
  if (!saved) return true;
  const content = (snapshot: Snapshot) => {
    const result = { ...snapshot }, simulation = { ...(snapshot.simulation as Snapshot || {}) };
    // Navigation does not turn an otherwise untouched project into unsaved work.
    for (const key of ["workspaceMode", "mapView", "calculatorSources", "appVersion"]) delete result[key];
    for (const key of ["camera", "tool"]) delete simulation[key];
    result.simulation = simulation;
    return result;
  };
  return !equal(content(saved), content(current));
}
