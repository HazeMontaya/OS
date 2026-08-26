import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR } from './paths.mjs';

const DIR = path.join(WORKSPACE_DIR, 'Workflows');
function loadDefinitions() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((name) => name.endsWith('.json')).flatMap((name) => {
    try { const value = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')); return value?.id ? [{ ...value, file: name }] : []; } catch { return []; }
  });
}
function interpolate(value, context) {
  if (typeof value === 'string') return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const parts = key.trim().split('.'); let current = context; for (const part of parts) current = current?.[part];
    return current == null ? '' : typeof current === 'string' ? current : JSON.stringify(current);
  });
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, context)]));
  return value;
}
export function createWorkflowEngine({ tools, providers, audit, events }) {
  function list() { return loadDefinitions().map(({ steps = [], ...workflow }) => ({ ...workflow, stepCount: steps.length })); }
  async function run(id, input = {}, context = {}) {
    const workflow = loadDefinitions().find((item) => item.id === id);
    if (!workflow) throw new Error(`Unknown workflow: ${id}`);
    const state = { input, steps: {}, startedAt: new Date().toISOString() };
    events?.publish('workflow.started', { id });
    for (const [index, step] of (workflow.steps || []).entries()) {
      const stepId = step.saveAs || step.id || `step-${index + 1}`;
      const expanded = interpolate(step, state);
      if (step.type === 'tool') state.steps[stepId] = await tools.execute(expanded.tool, expanded.args || {}, context);
      else if (step.type === 'prompt') state.steps[stepId] = await providers.generate(expanded.prompt || '', expanded.provider, expanded.model);
      else throw new Error(`Unsupported workflow step type: ${step.type}`);
      events?.publish('workflow.step', { id, stepId });
    }
    state.completedAt = new Date().toISOString();
    audit?.append('workflow.run', { workflow: id, steps: Object.keys(state.steps).length });
    events?.publish('workflow.completed', { id });
    return state;
  }
  return { list, run };
}
