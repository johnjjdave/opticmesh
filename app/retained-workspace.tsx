import { useState, type ReactNode } from "react";

/** Allocate a workspace on its first visit and retain it until the project changes. */
export function RetainedWorkspace({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <div style={{ display: active ? "contents" : "none" }} aria-hidden={!active || undefined} inert={!active || undefined}>
    {(active || visited) && children}
  </div>;
}
