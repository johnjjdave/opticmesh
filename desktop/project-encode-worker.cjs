const { parentPort } = require('node:worker_threads');
const { projectMiB } = require('./project-limits.json');
let project, simulation;
function apply(target, delta) {
  if (!delta || !Array.isArray(delta.remove) || !delta.set || typeof delta.set !== 'object' || Array.isArray(delta.set)) throw new Error('Invalid project update.');
  for (const key of delta.remove) {
    if (typeof key !== 'string') throw new Error('Invalid project field.');
    delete target[key];
  }
  Object.assign(target, delta.set);
}
parentPort.on('message', patch => {
  try {
    if (patch?.reset === true) { project = Object.create(null); simulation = Object.create(null); }
    if (!project) throw new Error('A complete project snapshot is required.');
    apply(project, patch.project); apply(simulation, patch.simulation);
    project.simulation = simulation;
    if (project.format !== 'opticmesh-project') throw new Error('The project data is not a LO2S - OpticMesh project.');
    if (Number(project.version || 1) > 4) throw new Error(`This project uses unsupported schema ${project.version}.`);
    const json = JSON.stringify(project, null, 2);
    if (Buffer.byteLength(json, 'utf8') > projectMiB * 1024 * 1024) throw new Error(`The project exceeds the ${projectMiB} MiB safety limit.`);
    const bytes = new TextEncoder().encode(json).buffer;
    parentPort.postMessage({ bytes }, [bytes]);
  } catch (error) {
    project = simulation = undefined;
    parentPort.postMessage({ error: error.message });
  }
});
