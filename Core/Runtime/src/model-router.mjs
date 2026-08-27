import { emit } from './events.mjs';
import { listModels } from './model-catalog.mjs';

const TASK_MODEL_MAP = {
  'coding': ['openrouter:meta-llama/llama-3.3-70b-instruct', 'openrouter:deepseek/deepseek-chat-v3-0324', 'mistral:codestral-latest'],
  'reasoning': ['openrouter:google/gemini-2.5-flash', 'openrouter:meta-llama/llama-3.3-70b-instruct'],
  'general': ['openrouter:google/gemini-2.5-flash', 'mistral:mistral-small-latest'],
  'planning': ['openrouter:google/gemini-2.5-flash', 'openrouter:meta-llama/llama-3.3-70b-instruct'],
  'research': ['openrouter:google/gemini-2.5-flash', 'openrouter:deepseek/deepseek-chat-v3-0324'],
  'analysis': ['openrouter:google/gemini-2.5-flash', 'mistral:mistral-small-latest'],
  'quick': ['openrouter:google/gemini-2.5-flash', 'mistral:mistral-small-latest'],
  'creative': ['openrouter:meta-llama/llama-3.3-70b-instruct', 'openrouter:deepseek/deepseek-chat-v3-0324'],
};

const MODEL_CAPABILITIES = {
  'google/gemini-2.5-flash': { coding: 7, reasoning: 8, speed: 9, context: 9, cost: 9, vision: 8 },
  'meta-llama/llama-3.3-70b-instruct': { coding: 8, reasoning: 7, speed: 6, context: 7, cost: 8, vision: 0 },
  'deepseek/deepseek-chat-v3-0324': { coding: 9, reasoning: 7, speed: 7, context: 8, cost: 9, vision: 0 },
  'mistral-small-latest': { coding: 7, reasoning: 6, speed: 8, context: 7, cost: 9, vision: 5 },
  'codestral-latest': { coding: 9, reasoning: 5, speed: 7, context: 7, cost: 9, vision: 0 },
};

export function selectModel(taskType = 'general', requirements = {}) {
  const candidates = TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP.general;
  const scored = candidates.map((ref) => {
    const [provider, ...modelParts] = ref.split(':');
    const model = modelParts.join(':');
    const caps = MODEL_CAPABILITIES[model] || {};
    let score = 0;
    let factors = 0;
    if (requirements.coding) { score += (caps.coding || 0) * requirements.coding; factors += requirements.coding; }
    if (requirements.reasoning) { score += (caps.reasoning || 0) * requirements.reasoning; factors += requirements.reasoning; }
    if (requirements.speed) { score += (caps.speed || 0) * requirements.speed; factors += requirements.speed; }
    if (requirements.context) { score += (caps.context || 0) * requirements.context; factors += requirements.context; }
    if (requirements.cost) { score += (caps.cost || 0) * requirements.cost; factors += requirements.cost; }
    if (requirements.vision) { score += (caps.vision || 0) * requirements.vision; factors += requirements.vision; }
    if (factors === 0) { score = Object.values(caps).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(caps).length); }
    else { score = score / factors; }
    return { provider, model, ref, score, capabilities: caps };
  });
  scored.sort((a, b) => b.score - a.score);
  emit('model.selected', { taskType, selected: scored[0]?.ref, alternatives: scored.slice(1, 3).map((s) => s.ref) });
  return scored[0] || { provider: 'openrouter', model: 'google/gemini-2.5-flash', ref: 'openrouter:google/gemini-2.5-flash', score: 0 };
}

export function getModelInfo(modelRef) {
  const [provider, ...modelParts] = modelRef.split(':');
  const model = modelParts.join(':');
  return { provider, model, capabilities: MODEL_CAPABILITIES[model] || {} };
}

export function rankModelsForTask(taskType, limit = 5) {
  const allModels = Object.entries(MODEL_CAPABILITIES).map(([model, caps]) => {
    const taskScore = caps[taskType] || 0;
    const overallScore = Object.values(caps).reduce((s, v) => s + v, 0) / Object.keys(caps).length;
    return { model, taskScore, overallScore, capabilities: caps };
  });
  allModels.sort((a, b) => b.taskScore - a.taskScore || b.overallScore - a.overallScore);
  return allModels.slice(0, limit);
}

export function getTaskTypes() { return Object.keys(TASK_MODEL_MAP); }

export function getModelCapabilities() { return MODEL_CAPABILITIES; }

export function addModelCapability(model, capabilities) {
  MODEL_CAPABILITIES[model] = { ...(MODEL_CAPABILITIES[model] || {}), ...capabilities };
  emit('model.updated', { model, capabilities: MODEL_CAPABILITIES[model] });
  return MODEL_CAPABILITIES[model];
}
