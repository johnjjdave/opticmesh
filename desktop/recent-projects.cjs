const fs = require("node:fs/promises");
const path = require("node:path");

function createRecentProjects(file) {
  let queue = Promise.resolve();
  const key = value => path.resolve(value).toLowerCase();
  async function read() {
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      const seen = new Set();
      return (Array.isArray(data) ? data : []).filter(value => {
        if (typeof value !== "string" || !path.isAbsolute(value) || path.extname(value).toLowerCase() !== ".lo2s" || seen.has(key(value))) return false;
        seen.add(key(value)); return true;
      }).slice(0, 6);
    } catch { return []; }
  }
  return {
    async list() { await queue; return (await read()).map(value => ({ path: value, name: path.basename(value) })); },
    remember(value) {
      const operation = queue.then(async () => {
        const resolved = path.resolve(value);
        if (path.extname(resolved).toLowerCase() !== ".lo2s") return;
        const entries = [resolved, ...(await read()).filter(item => key(item) !== key(resolved))].slice(0, 6);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file + ".tmp", JSON.stringify(entries), "utf8");
        await fs.rename(file + ".tmp", file);
      });
      queue = operation.catch(() => {});
      return operation;
    }
  };
}
module.exports = { createRecentProjects };
