/// <reference lib="webworker" />
export {};
type Delta = { set: Record<string, unknown>; remove: string[] };
const project: Record<string, unknown> = {}, simulation: Record<string, unknown> = {};
const apply = (target: Record<string, unknown>, delta: Delta) => { for (const key of delta.remove) delete target[key]; Object.assign(target, delta.set); };
self.onmessage = (event: MessageEvent<{project: Delta; simulation: Delta}>) => {
  try {
    apply(project, event.data.project); apply(simulation, event.data.simulation); project.simulation = simulation;
    const bytes = new TextEncoder().encode(JSON.stringify(project, null, 2)).buffer;
    self.postMessage({ bytes }, [bytes]);
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Unable to encode project." }); }
};
