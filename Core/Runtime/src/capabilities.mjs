import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { emit } from './events.mjs';
import { insert, find, findOne, update, remove } from './persistence.mjs';

const REGISTRY_FILE = path.join(ROOT, 'Data', 'capabilities.json');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); } catch { return []; }
}

function saveRegistry(caps) {
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(caps, null, 2), 'utf8');
}

export function registerCapability(cap) {
  const caps = loadRegistry();
  const capability = {
    id: cap.id || `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cap.name,
    description: cap.description || '',
    type: cap.type || 'tool',
    inputs: cap.inputs || {},
    outputs: cap.outputs || {},
    permissions: cap.permissions || [],
    cost: cap.cost || { amount: 0, currency: 'free' },
    risk: cap.risk || 'low',
    runtime: cap.runtime || { timeout: 30000, retries: 1 },
    availability: cap.availability || 'available',
    source: cap.source || 'internal',
    credentials: cap.credentials || [],
    errorStatus: null,
    version: cap.version || '1.0.0',
    metadata: cap.metadata || {},
    registered: new Date().toISOString(),
    lastUsed: null,
    useCount: 0,
  };
  const existing = caps.findIndex((c) => c.name === cap.name);
  if (existing >= 0) { caps[existing] = { ...caps[existing], ...capability, id: caps[existing].id, registered: caps[existing].registered }; }
  else { caps.push(capability); }
  saveRegistry(caps);
  emit('capability.registered', { id: capability.id, name: capability.name, type: capability.type });
  return capability;
}

export function getCapability(nameOrId) {
  const caps = loadRegistry();
  return caps.find((c) => c.name === nameOrId || c.id === nameOrId) || null;
}

export function listCapabilities(filter = {}) {
  const caps = loadRegistry();
  if (Object.keys(filter).length === 0) return caps;
  return caps.filter((c) => {
    for (const [key, value] of Object.entries(filter)) {
      if (c[key] !== value) return false;
    }
    return true;
  });
}

export function removeCapability(nameOrId) {
  const caps = loadRegistry();
  const idx = caps.findIndex((c) => c.name === nameOrId || c.id === nameOrId);
  if (idx < 0) return false;
  const removed = caps.splice(idx, 1)[0];
  saveRegistry(caps);
  emit('capability.removed', { id: removed.id, name: removed.name });
  return true;
}

export function updateCapability(nameOrId, updates) {
  const caps = loadRegistry();
  const idx = caps.findIndex((c) => c.name === nameOrId || c.id === nameOrId);
  if (idx < 0) return null;
  caps[idx] = { ...caps[idx], ...updates };
  saveRegistry(caps);
  emit('capability.updated', { id: caps[idx].id, name: caps[idx].name });
  return caps[idx];
}

export function recordCapabilityUse(nameOrId) {
  const caps = loadRegistry();
  const cap = caps.find((c) => c.name === nameOrId || c.id === nameOrId);
  if (cap) { cap.lastUsed = new Date().toISOString(); cap.useCount++; saveRegistry(caps); }
  emit('capability.called', { name: nameOrId });
  return cap;
}

export function findCapabilitiesForTask(taskDescription) {
  const caps = loadRegistry();
  const words = taskDescription.toLowerCase().split(/\s+/);
  return caps
    .filter((c) => c.availability === 'available' && c.errorStatus !== 'critical')
    .map((c) => {
      let score = 0;
      const searchText = `${c.name} ${c.description} ${c.type}`.toLowerCase();
      for (const word of words) {
        if (searchText.includes(word)) score++;
      }
      return { ...c, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function getStats() {
  const caps = loadRegistry();
  const byType = {};
  const byAvailability = {};
  for (const c of caps) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    byAvailability[c.availability] = (byAvailability[c.availability] || 0) + 1;
  }
  return { total: caps.length, byType, byAvailability, totalUses: caps.reduce((s, c) => s + c.useCount, 0) };
}

export function exportRegistry() {
  return loadRegistry();
}

export function importRegistry(data) {
  if (!Array.isArray(data)) throw new Error('Import data must be an array');
  const caps = loadRegistry();
  for (const cap of data) {
    const existing = caps.findIndex((c) => c.name === cap.name);
    if (existing >= 0) caps[existing] = { ...caps[existing], ...cap };
    else caps.push(cap);
  }
  saveRegistry(caps);
  return { imported: data.length, total: caps.length };
}
