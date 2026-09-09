const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const percent = value => Math.max(0, Math.min(100, value));

function parseGpuCsv(text) {
  const number = value => /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  return text.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const fields = line.split(',').map(value => value.trim());
    if (fields.length !== 5) throw new Error('Unexpected GPU telemetry');
    const [index, name, usage, used, total] = fields;
    return { index: number(index), name, utilizationPercent: number(usage), memoryUsedBytes: number(used) == null ? null : number(used) * 1048576, memoryTotalBytes: number(total) == null ? null : number(total) * 1048576 };
  });
}
async function readNvidiaGpu() {
  const systemTool = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe');
  const executable = process.platform === 'win32' ? systemTool : 'nvidia-smi';
  if (process.platform === 'win32' && !fs.existsSync(executable)) throw new Error('Driver telemetry unavailable');
  const { stdout } = await run(executable, ['--query-gpu=index,name,utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 2000, maxBuffer: 65536 });
  return parseGpuCsv(stdout);
}
function cpuTimes(cpus) {
  return cpus.reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
}
function createSystemPerformance(getMetrics, readGpu = readNvidiaGpu) {
  let previous = null, cached = null, pending = null, gpus = null, nextGpuAt = 0;
  return async function snapshot() {
    const now = Date.now();
    if (pending) return pending;
    if (cached && now - cached.sampledAt < 950) return cached;
    pending = (async () => {
      const metrics = getMetrics(), cpus = os.cpus(), system = cpuTimes(cpus);
      const elapsed = previous ? (now - previous.time) / 1000 : 0;
      let cpuPercent = null, systemCpuPercent = null;
      if (previous && elapsed > 0 && elapsed < 5) {
        let seconds = 0, valid = true;
        for (const process of metrics) {
          const key = `${process.pid}:${process.creationTime}`, old = previous.processes.get(key);
          if (finite(process.cpu?.cumulativeCPUUsage) && old != null) seconds += Math.max(0, process.cpu.cumulativeCPUUsage - old);
          else if (finite(process.cpu?.percentCPUUsage)) seconds += process.cpu.percentCPUUsage / 100 * elapsed;
          else valid = false;
        }
        if (valid && metrics.length) cpuPercent = percent(seconds / elapsed / Math.max(1, cpus.length) * 100);
        const total = system.total - previous.system.total;
        if (total > 0) systemCpuPercent = percent((1 - (system.idle - previous.system.idle) / total) * 100);
      }
      previous = { time: now, system, processes: new Map(metrics.map(p => [`${p.pid}:${p.creationTime}`, p.cpu?.cumulativeCPUUsage])) };
      const memory = metrics.map(p => p.memory?.privateBytes);
      const appMemoryBytes = memory.length && memory.every(finite) ? memory.reduce((a, b) => a + b, 0) * 1024 : null;
      if (now >= nextGpuAt) {
        try { gpus = await readGpu(); nextGpuAt = Date.now() + 2000; }
        catch { gpus = null; nextGpuAt = Date.now() + 30000; }
      }
      const systemMemoryTotalBytes = os.totalmem();
      cached = { sampledAt: now, cpuPercent, systemCpuPercent, appMemoryBytes, systemMemoryTotalBytes, systemMemoryUsedBytes: systemMemoryTotalBytes - os.freemem(), gpus };
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
module.exports = { createSystemPerformance, parseGpuCsv };
