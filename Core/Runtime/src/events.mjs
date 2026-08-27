import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

const HISTORY_DIR = path.join(ROOT, 'Data', 'Events');
const HISTORY_FILE = path.join(HISTORY_DIR, 'events.jsonl');
const SUBSCRIBERS = new Map();
const HISTORY = [];
const MAX_HISTORY = 5000;

const EVENT_TYPES = [
  'system.started', 'system.stopped', 'system.error',
  'agent.created', 'agent.started', 'agent.completed', 'agent.failed', 'agent.tool Called',
  'memory.read', 'memory.created', 'memory.searched', 'memory.synced',
  'tool.called', 'tool.completed', 'tool.failed',
  'model.selected', 'model.generated', 'model.stream.token',
  'workflow.started', 'workflow.step.completed', 'workflow.completed', 'workflow.failed',
  'graph.node.created', 'graph.node.updated', 'graph.node.removed',
  'graph.edge.created', 'graph.edge.updated', 'graph.edge.removed',
  'capability.registered', 'capability.called', 'capability.completed',
  'permission.requested', 'permission.granted', 'permission.denied',
  'vault.read', 'vault.write', 'vault.searched',
  'evolution.interaction', 'evolution.modification', 'evolution.skill',
  'void.transition', 'void.node.focus', 'void.camera.move',
  'input.received', 'output.generated', 'output.streaming',
  'git.status', 'git.commit', 'git.branch',
  'develop.analyzed', 'develop.planned', 'develop.implemented',
  'settings.changed',
];

function ensure() { fs.mkdirSync(HISTORY_DIR, { recursive: true }); }

function loadHistory() {
  ensure();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-MAX_HISTORY).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function appendHistory(entry) {
  ensure();
  fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

export function emit(type, data = {}) {
  if (!EVENT_TYPES.includes(type)) {
    console.warn(`[EventBus] Unknown event type: ${type}`);
  }
  const event = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    ts: new Date().toISOString(),
    data,
  };
  HISTORY.push(event);
  if (HISTORY.length > MAX_HISTORY) HISTORY.splice(0, HISTORY.length - MAX_HISTORY);
  appendHistory(event);
  const subs = SUBSCRIBERS.get(type) || [];
  const wildcardSubs = SUBSCRIBERS.get('*') || [];
  for (const fn of [...subs, ...wildcardSubs]) {
    try { fn(event); } catch (e) { console.error(`[EventBus] Subscriber error for ${type}:`, e.message); }
  }
  return event;
}

export function on(type, fn) {
  if (!SUBSCRIBERS.has(type)) SUBSCRIBERS.set(type, []);
  SUBSCRIBERS.get(type).push(fn);
  return () => {
    const list = SUBSCRIBERS.get(type);
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  };
}

export function once(type, fn) {
  const unsub = on(type, (event) => { unsub(); fn(event); });
  return unsub;
}

export function off(type, fn) {
  const list = SUBSCRIBERS.get(type);
  if (!list) return;
  const idx = list.indexOf(fn);
  if (idx >= 0) list.splice(idx, 1);
}

export function getHistory(type, limit = 100) {
  const all = HISTORY.length > 0 ? HISTORY : loadHistory();
  const filtered = type ? all.filter((e) => e.type === type) : all;
  return filtered.slice(-limit).reverse();
}

export function getStats() {
  const all = HISTORY.length > 0 ? HISTORY : loadHistory();
  const byType = {};
  for (const e of all) { byType[e.type] = (byType[e.type] || 0) + 1; }
  return { total: all.length, byType, subscriberCount: SUBSCRIBERS.size, eventTypes: EVENT_TYPES.length };
}

export function createEventBridge() {
  const sseClients = new Set();
  const unsub = on('*', (event) => {
    const msg = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of sseClients) {
      try { res.write(msg); } catch { sseClients.delete(res); }
    }
  });
  return {
    addClient: (res) => { sseClients.add(res); return () => sseClients.delete(res); },
    clientCount: () => sseClients.size,
    stop: unsub,
  };
}

export function clearHistory() {
  HISTORY.length = 0;
  ensure();
  if (fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '', 'utf8');
}

export const eventTypes = EVENT_TYPES;
