import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR } from './paths.mjs';
import { addMemory } from './memory.mjs';

const dir = path.join(WORKSPACE_DIR, 'Workflows');

function readJsonFiles() {
  fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
    return { file: name, ...data };
  });
}

function interpolate(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(context[key.trim()] ?? ''));
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, context)]));
  return value;
}

export function createWorkflowEngine({ tools, providers }) {
  return {
    list: () => readJsonFiles(),
    run: async (id, input = {}) => {
      const workflow = readJsonFiles().find((x) => x.id === id || x.file === id);
      if (!workflow) throw new Error(`Workflow not found: ${id}`);
      const context = { ...input };
      const results = [];
      for (const step of workflow.steps || []) {
        let result;
        if (step.type === 'tool') result = await tools.execute(step.tool, interpolate(step.args || {}, context));
        else if (step.type === 'memory') result = addMemory(interpolate(step.memory || {}, context));
        else if (step.type === 'agent') {
          const prompt = interpolate(step.prompt || '', context);
          result = await providers.generate(prompt, step.provider);
        } else throw new Error(`Unsupported workflow step type: ${step.type}`);
        results.push({ id: step.id || `step-${results.length + 1}`, type: step.type, result });
        if (step.saveAs) context[step.saveAs] = typeof result === 'string' ? result : JSON.stringify(result);
      }
      return { workflow: workflow.id, context, results };
    }
  };
}
