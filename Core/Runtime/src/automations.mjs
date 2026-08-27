import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR } from './paths.mjs';
import { log } from './logger.mjs';

const dir = path.join(WORKSPACE_DIR, 'Automations');

function readAutomations() {
  fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => ({
    file: name,
    ...JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, ''))
  }));
}

export function createAutomationEngine(workflows) {
  const timers = new Map();
  const runAutomation = async (automation) => {
    try {
      const result = await workflows.run(automation.workflow, automation.input || {});
      log('info', 'automation.completed', { automation: automation.id, workflow: automation.workflow });
      return result;
    } catch (error) {
      log('error', 'automation.failed', { automation: automation.id, error: error.message });
      return null;
    }
  };

  return {
    list: () => readAutomations(),
    start: () => {
      for (const automation of readAutomations()) {
        if (automation.enabled === false || !automation.everySeconds) continue;
        const ms = Math.max(60, Number(automation.everySeconds)) * 1000;
        timers.set(automation.id, setInterval(() => runAutomation(automation), ms));
      }
      return timers.size;
    },
    stop: () => { for (const timer of timers.values()) clearInterval(timer); timers.clear(); },
    run: (id) => {
      const automation = readAutomations().find((x) => x.id === id || x.file === id);
      if (!automation) throw new Error(`Automation not found: ${id}`);
      return runAutomation(automation);
    }
  };
}
