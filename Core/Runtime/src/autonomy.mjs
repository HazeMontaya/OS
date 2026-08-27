import { emit } from './events.mjs';
import { insert, find, findOne, update } from './persistence.mjs';
import { createAgent, executeAgentTask, addAgentLog, spawnChildAgent, findActiveAgents } from './agent-runtime.mjs';
import { log } from './logger.mjs';

const TASKS_COLLECTION = 'tasks';
const STATUSES = ['pending', 'planning', 'running', 'waiting', 'completed', 'failed', 'cancelled'];

function createTaskId() { return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function createTask({ goal, parent = null, priority = 'normal', input = {}, context = {} }) {
  const task = {
    id: createTaskId(),
    goal,
    parent,
    priority,
    input,
    context,
    status: 'pending',
    plan: null,
    steps: [],
    currentStep: 0,
    subtasks: [],
    result: null,
    agentId: null,
    error: null,
    retryCount: 0,
    maxRetries: 3,
    created: new Date().toISOString(),
    started: null,
    completed: null,
    duration: null,
  };
  insert(TASKS_COLLECTION, task);
  return task;
}

export function getTask(id) { return findOne(TASKS_COLLECTION, { id }); }

export function listTasks(query = {}) { return find(TASKS_COLLECTION, query); }

export function updateTask(id, updates) {
  const task = findOne(TASKS_COLLECTION, { id });
  if (!task) return null;
  const oldStatus = task.status;
  update(TASKS_COLLECTION, { id }, updates);
  if (updates.status && updates.status !== oldStatus) {
    emit(`workflow.${updates.status === 'running' ? 'started' : updates.status === 'completed' ? 'completed' : updates.status === 'failed' ? 'failed' : 'step.completed'}`, { taskId: id, status: updates.status });
  }
  return findOne(TASKS_COLLECTION, { id });
}

export function decomposeGoal(goal, model) {
  const planner = createAgent({
    role: 'planner',
    goal: `Decompose this goal into actionable steps: ${goal}`,
    model,
    tools: [],
  });
  return { plannerId: planner.id, goal };
}

export async function executeTask(taskId, providers, config = {}) {
  const task = getTask(taskId);
  if (!task) throw new Error('Task not found');
  if (task.status === 'running') throw new Error('Task already running');
  updateTask(taskId, { status: 'running', started: new Date().toISOString() });
  emit('workflow.started', { taskId, goal: task.goal });
  try {
    if (!task.plan || task.steps.length === 0) {
      updateTask(taskId, { status: 'planning' });
      const planResult = await planTask(task, providers, config);
      updateTask(taskId, { plan: planResult.plan, steps: planResult.steps, status: 'running' });
    }
    const results = [];
    for (let i = task.currentStep; i < task.steps.length; i++) {
      const step = task.steps[i];
      updateTask(taskId, { currentStep: i });
      emit('workflow.step.completed', { taskId, step: i, total: task.steps.length, description: step.description });
      const stepResult = await executeStep(task, step, i, providers, config);
      results.push(stepResult);
      if (stepResult.error) {
        if (task.retryCount < task.maxRetries) {
          updateTask(taskId, { retryCount: task.retryCount + 1, status: 'running' });
          i--;
          continue;
        }
        updateTask(taskId, { status: 'failed', error: stepResult.error, completed: new Date().toISOString() });
        emit('workflow.failed', { taskId, error: stepResult.error });
        return { taskId, status: 'failed', error: stepResult.error, results };
      }
    }
    const finalResult = results.map((r) => r.answer || r.result || '').join('\n');
    updateTask(taskId, { status: 'completed', result: finalResult, completed: new Date().toISOString(), duration: Date.now() - new Date(task.started).getTime() });
    emit('workflow.completed', { taskId, result: finalResult.substring(0, 500) });
    return { taskId, status: 'completed', result: finalResult, steps: task.steps.length, results };
  } catch (error) {
    updateTask(taskId, { status: 'failed', error: error.message, completed: new Date().toISOString() });
    emit('workflow.failed', { taskId, error: error.message });
    throw error;
  }
}

async function planTask(task, providers, config) {
  const system = [
    'You are a task planner. Break the goal into concrete steps.',
    'Return JSON: {"plan":"description","steps":[{"description":"...","tool":"optional-tool","input":"..."}]}',
    `Goal: ${task.goal}`,
    task.input ? `Input: ${JSON.stringify(task.input)}` : '',
    task.context ? `Context: ${JSON.stringify(task.context)}` : '',
  ].filter(Boolean).join('\n');
  const generated = await providers.generate(system, config.plannerModel?.provider, config.plannerModel?.model);
  try {
    const parsed = JSON.parse(generated.text);
    return { plan: parsed.plan || task.goal, steps: parsed.steps || [{ description: task.goal }] };
  } catch {
    return { plan: task.goal, steps: [{ description: task.goal }] };
  }
}

async function executeStep(task, step, index, providers, config) {
  const agent = createAgent({
    role: step.role || 'general',
    goal: step.description,
    model: step.model || config.executorModel,
    tools: step.tools || [],
  });
  updateTask(task.id, { agentId: agent.id });
  addAgentLog(agent.id, 'info', `Executing step ${index + 1}/${task.steps.length}: ${step.description}`);
  try {
    const result = await executeAgentTask(agent.id, step.input || step.description, providers);
    return { step: index, answer: result.answer, provider: result.provider, model: result.model };
  } catch (error) {
    return { step: index, error: error.message };
  }
}

export function cancelTask(taskId) {
  const task = getTask(taskId);
  if (!task) return null;
  updateTask(taskId, { status: 'cancelled', completed: new Date().toISOString() });
  emit('workflow.failed', { taskId, status: 'cancelled' });
  return task;
}

export function getTaskStats() {
  const tasks = listTasks();
  const byStatus = {};
  for (const t of tasks) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; }
  return { total: tasks.length, byStatus, active: findActiveAgents().length };
}

export function createExecutionGraph(taskId) {
  const task = getTask(taskId);
  if (!task) return null;
  const nodes = task.steps.map((step, i) => ({
    id: `${taskId}-step-${i}`,
    type: 'step',
    description: step.description,
    status: i < task.currentStep ? 'completed' : i === task.currentStep ? 'running' : 'pending',
    agentId: task.agentId,
    index: i,
  }));
  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push({ from: nodes[i - 1].id, to: nodes[i].id, type: 'depends-on' });
  }
  return { taskId, goal: task.goal, status: task.status, nodes, edges };
}
