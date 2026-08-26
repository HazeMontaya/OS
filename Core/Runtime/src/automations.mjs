import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR } from './paths.mjs';
const DIR = path.join(WORKSPACE_DIR, 'Automations');
function loadAutomations() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((name) => name.endsWith('.json')).flatMap((name) => {
    try { const value = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')); return value?.id ? [{ ...value, file: name }] : []; } catch { return []; }
  });
}
export function createAutomationEngine({ workflows, audit, events }) {
  const timers = new Map();
  async function run(id, context = {}) {
    const automation = loadAutomations().find((item) => item.id === id);
    if (!automation) throw new Error(`Unknown automation: ${id}`);
    if (!automation.workflow) throw new Error(`Automation ${id} has no workflow`);
    events?.publish('automation.started', { id });
    const result = await workflows.run(automation.workflow, automation.input || {}, context);
    audit?.append('automation.run', { automation: id, workflow: automation.workflow });
    events?.publish('automation.completed', { id });
    return result;
  }
  function start() {
    stop();
    for (const automation of loadAutomations()) {
      const everyMs = Number(automation.everyMs || (automation.everySeconds ? Number(automation.everySeconds) * 1000 : 0));
      if (automation.enabled !== true || everyMs < 60_000) continue;
      const timer = setInterval(() => run(automation.id).catch((error) => events?.publish('automation.failed', { id: automation.id, error: error.message })), everyMs);
      timer.unref?.(); timers.set(automation.id, timer);
    }
    return timers.size;
  }
  function stop() { for (const timer of timers.values()) clearInterval(timer); timers.clear(); }
  return { list: () => loadAutomations().map((item) => ({ ...item, scheduled: timers.has(item.id) })), run, start, stop };
}
