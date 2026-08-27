import { emit, on } from './events.mjs';
import { insert, find, findOne, update } from './persistence.mjs';
import { requestPermission } from './permissions.mjs';
import { getCapability, recordCapabilityUse, findCapabilitiesForTask } from './capabilities.mjs';
import { log } from './logger.mjs';

const AGENTS_COLLECTION = 'agents';
const AGENT_ROLES = [
  'general', 'coder', 'researcher', 'planner', 'tester',
  'debugger', 'data', 'system', 'memory', 'ui', 'security',
];

function createAgentId() { return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function createAgent({ role = 'general', goal, model, systemPrompt, tools = [], memoryAccess = true, budget = {}, parent = null, config = {} }) {
  const agent = {
    id: createAgentId(),
    role,
    goal: goal || '',
    model: model || null,
    systemPrompt: systemPrompt || getDefaultPrompt(role),
    tools,
    memoryAccess,
    budget: { maxTokens: budget.maxTokens || 10000, maxCost: budget.maxCost || 0, spent: 0 },
    status: 'pending',
    currentTask: null,
    parent,
    children: [],
    result: null,
    logs: [],
    context: {},
    created: new Date().toISOString(),
    started: null,
    completed: null,
  };
  insert(AGENTS_COLLECTION, agent);
  emit('agent.created', { id: agent.id, role: agent.role, goal: agent.goal });
  if (parent) {
    const parentAgent = findOne(AGENTS_COLLECTION, { id: parent });
    if (parentAgent) {
      parentAgent.children = [...(parentAgent.children || []), agent.id];
      update(AGENTS_COLLECTION, { id: parent }, { children: parentAgent.children });
    }
  }
  return agent;
}

export function getAgent(id) { return findOne(AGENTS_COLLECTION, { id }); }

export function listAgents(query = {}) { return find(AGENTS_COLLECTION, query); }

export function updateAgent(id, updates) {
  const agent = findOne(AGENTS_COLLECTION, { id });
  if (!agent) return null;
  const oldStatus = agent.status;
  update(AGENTS_COLLECTION, { id }, updates);
  const updated = findOne(AGENTS_COLLECTION, { id });
  if (updates.status && updates.status !== oldStatus) {
    emit(`agent.${updates.status}`, { id, role: updated.role, status: updates.status });
  }
  return updated;
}

export function addAgentLog(id, level, message, data = {}) {
  const agent = findOne(AGENTS_COLLECTION, { id });
  if (!agent) return null;
  const logEntry = { ts: new Date().toISOString(), level, message, ...data };
  agent.logs = [...(agent.logs || []), logEntry];
  if (agent.logs.length > 200) agent.logs = agent.logs.slice(-200);
  update(AGENTS_COLLECTION, { id }, { logs: agent.logs });
  return logEntry;
}

export function spawnChildAgent(parentId, childConfig) {
  const parent = getAgent(parentId);
  if (!parent) throw new Error('Parent agent not found');
  const child = createAgent({ ...childConfig, parent: parentId });
  addAgentLog(parentId, 'info', `Spawned child agent ${child.id} (${child.role})`);
  return child;
}

export function findAgentsByRole(role) { return find(AGENTS_COLLECTION, { role }); }

export function findActiveAgents() {
  return find(AGENTS_COLLECTION, {}).filter((a) => ['running', 'planning', 'waiting'].includes(a.status));
}

export async function executeAgentTask(id, taskInput, providers) {
  const agent = getAgent(id);
  if (!agent) throw new Error('Agent not found');
  if (agent.status === 'running') throw new Error('Agent is already running');
  updateAgent(id, { status: 'running', currentTask: taskInput, started: new Date().toISOString() });
  addAgentLog(id, 'info', 'Task started', { task: typeof taskInput === 'string' ? taskInput.substring(0, 200) : 'complex' });
  emit('agent.started', { id, role: agent.role, task: taskInput });
  try {
    const toolCatalog = agent.tools.map((t) => getCapability(t)).filter(Boolean);
    const system = [
      agent.systemPrompt,
      `Role: ${agent.role}`,
      `Goal: ${agent.goal}`,
      `Available tools: ${JSON.stringify(toolCatalog.map((t) => ({ name: t.name, description: t.description })))}`,
      `Return JSON: {"action":"answer","answer":"..."} or {"action":"tool","tool":"name","args":{}}`,
    ].join('\n');
    let transcript = system + `\nTask: ${typeof taskInput === 'string' ? taskInput : JSON.stringify(taskInput)}`;
    let iterations = 0;
    const maxIterations = config?.maxToolIterations || 5;
    while (iterations < maxIterations) {
      const generated = await providers.generate(transcript, agent.model?.provider, agent.model?.model);
      let parsed;
      try { parsed = JSON.parse(generated.text); } catch {
        updateAgent(id, { status: 'completed', result: generated.text, completed: new Date().toISOString() });
        addAgentLog(id, 'info', 'Task completed (raw response)');
        emit('agent.completed', { id, role: agent.role, result: generated.text.substring(0, 500) });
        return { agent: id, answer: generated.text, iterations, provider: generated.provider, model: generated.model };
      }
      if (parsed.action === 'answer') {
        updateAgent(id, { status: 'completed', result: parsed.answer, completed: new Date().toISOString() });
        addAgentLog(id, 'info', 'Task completed', { answer: String(parsed.answer).substring(0, 200) });
        emit('agent.completed', { id, role: agent.role, result: String(parsed.answer).substring(0, 500) });
        return { agent: id, answer: String(parsed.answer || ''), iterations, provider: generated.provider, model: generated.model };
      }
      if (parsed.action === 'tool' && parsed.tool) {
        const perm = requestPermission('tool.execute', { tool: parsed.tool, agent: id });
        if (perm.granted === false) { addAgentLog(id, 'warn', `Permission denied for tool: ${parsed.tool}`); transcript += `\nTool ${parsed.tool} denied. Try another approach.`; iterations++; continue; }
        const cap = getCapability(parsed.tool);
        if (!cap) { transcript += `\nTool ${parsed.tool} not found. Available: ${toolCatalog.map((t) => t.name).join(', ')}`; iterations++; continue; }
        recordCapabilityUse(parsed.tool);
        addAgentLog(id, 'info', `Calling tool: ${parsed.tool}`, { args: parsed.args });
        emit('agent.toolCalled', { agentId: id, tool: parsed.tool, args: parsed.args });
        transcript += `\nTool result for ${parsed.tool}: [tool execution placeholder]\nContinue.`;
      }
      iterations++;
    }
    updateAgent(id, { status: 'completed', result: 'Max iterations reached', completed: new Date().toISOString() });
    emit('agent.completed', { id, role: agent.role, result: 'Max iterations reached' });
    return { agent: id, answer: 'Max iterations reached', iterations };
  } catch (error) {
    updateAgent(id, { status: 'failed', result: error.message, completed: new Date().toISOString() });
    addAgentLog(id, 'error', `Task failed: ${error.message}`);
    emit('agent.failed', { id, role: agent.role, error: error.message });
    throw error;
  }
}

export function getAgentStats() {
  const agents = listAgents();
  const byStatus = {};
  const byRole = {};
  for (const a of agents) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    byRole[a.role] = (byRole[a.role] || 0) + 1;
  }
  return { total: agents.length, byStatus, byRole, active: findActiveAgents().length };
}

function getDefaultPrompt(role) {
  const prompts = {
    general: 'You are a helpful AI assistant. Return valid JSON responses.',
    coder: 'You are an expert software developer. Analyze code, write solutions, and debug issues. Return valid JSON.',
    researcher: 'You are a research specialist. Find information, analyze data, and provide insights. Return valid JSON.',
    planner: 'You are a task planner. Break down goals into steps, identify dependencies, and create execution plans. Return valid JSON.',
    tester: 'You are a QA specialist. Write tests, verify functionality, and report issues. Return valid JSON.',
    debugger: 'You are a debugging specialist. Analyze errors, find root causes, and suggest fixes. Return valid JSON.',
    data: 'You are a data specialist. Process, analyze, and transform data. Return valid JSON.',
    system: 'You are a system administrator. Manage processes, files, and system resources. Return valid JSON.',
    memory: 'You are a memory specialist. Manage knowledge, relationships, and information retrieval. Return valid JSON.',
    ui: 'You are a UI specialist. Design interfaces, analyze layouts, and improve user experience. Return valid JSON.',
    security: 'You are a security specialist. Audit code, identify vulnerabilities, and ensure safety. Return valid JSON.',
  };
  return prompts[role] || prompts.general;
}

export function cleanupOldAgents(maxAge = 86400000) {
  const agents = listAgents();
  const cutoff = Date.now() - maxAge;
  let removed = 0;
  for (const a of agents) {
    if (['completed', 'failed', 'cancelled'].includes(a.status) && new Date(a.completed || a.created).getTime() < cutoff) {
      remove(AGENTS_COLLECTION, { id: a.id });
      removed++;
    }
  }
  return removed;
}

export const agentRoles = AGENT_ROLES;
