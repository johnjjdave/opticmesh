const fs = require("node:fs/promises");
const path = require("node:path");
const projectLimits = require("./project-limits.json");

function validateName(name) {
  if (!name || name.length > 120 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) || name === "." || name === "..") throw new Error("Choose a valid project folder name (up to 120 characters).");
  return name;
}

async function writeCompiledProject(folder, payload) {
  const target = path.resolve(folder), name = validateName(path.basename(target));
  if (typeof payload?.project !== "string" || Buffer.byteLength(payload.project, "utf8") > projectLimits.projectMiB * 1024 * 1024) throw new Error("Invalid or oversized project data.");
  const project = JSON.parse(payload.project);
  if (project.format !== "opticmesh-project" || !project.rawXml || Number(project.version) > 4) throw new Error("A supported project with a Resolume XML is required.");
  const maps = payload.files;
  if (!Array.isArray(maps) || !maps.length || maps.length > 1000) throw new Error("No maps available to compile.");
  const names = new Set();
  const files = maps.map(file => {
    const filename = String(file.filename);
    if (path.basename(filename) !== filename || /[<>:"/\\|?*\x00-\x1f]/.test(filename) || !filename.endsWith(".png") || names.has(filename.toLowerCase())) throw new Error("Invalid or duplicate map filename.");
    names.add(filename.toLowerCase());
    const data = Buffer.from(file.data);
    if (data.length < 8 || data.length > 512 * 1024 * 1024 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Invalid PNG map data.");
    return { filename, data };
  });
  project.config = { ...project.config, project: name };
  project.xmlName = `${name}.xml`;
  files.push({ filename: `${name}.xml`, data: Buffer.from(project.rawXml, "utf8") }, { filename: `${name}.lo2s`, data: Buffer.from(JSON.stringify(project, null, 2), "utf8") });
  // Exclusive directory creation: never merge into or overwrite an existing job.
  await fs.mkdir(target);
  const created = [];
  try {
    for (const file of files) {
      const destination = path.join(target, file.filename);
      const handle = await fs.open(destination, "wx");
      created.push(destination);
      try { await handle.writeFile(file.data); } finally { await handle.close(); }
    }
    return { ok: true, path: target, count: files.length };
  } catch (error) {
    // Only remove files this operation created; rmdir refuses a nonempty folder.
    for (const destination of created) await fs.unlink(destination).catch(() => {});
    await fs.rmdir(target).catch(() => {});
    throw error;
  }
}
module.exports = { writeCompiledProject, validateName };
