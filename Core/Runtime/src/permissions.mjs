import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { emit } from './events.mjs';

const PERMISSIONS_FILE = path.join(ROOT, 'Data', 'permissions.json');

const DEFAULT_PERMISSIONS = {
  'files.read': { level: 'allow', scope: 'workspace' },
  'files.write': { level: 'ask', scope: 'workspace' },
  'files.delete': { level: 'deny', scope: 'global' },
  'commands.execute': { level: 'ask', scope: 'workspace' },
  'network.http': { level: 'allow', scope: 'global' },
  'network.api': { level: 'allow', scope: 'global' },
  'git.read': { level: 'allow', scope: 'workspace' },
  'git.write': { level: 'ask', scope: 'workspace' },
  'memory.read': { level: 'allow', scope: 'global' },
  'memory.write': { level: 'allow', scope: 'global' },
  'agent.create': { level: 'allow', scope: 'global' },
  'agent.execute': { level: 'allow', scope: 'global' },
  'tool.execute': { level: 'allow', scope: 'global' },
  'mcp.call': { level: 'allow', scope: 'global' },
  'settings.read': { level: 'allow', scope: 'global' },
  'settings.write': { level: 'ask', scope: 'global' },
  'credentials.read': { level: 'deny', scope: 'global' },
  'credentials.write': { level: 'deny', scope: 'global' },
  'system.info': { level: 'allow', scope: 'global' },
  'system.execute': { level: 'ask', scope: 'workspace' },
};

const LEVELS = ['allow', 'ask', 'session', 'deny'];
const SCOPES = ['global', 'workspace', 'session'];

function loadPermissions() {
  if (!fs.existsSync(PERMISSIONS_FILE)) return { ...DEFAULT_PERMISSIONS };
  try { return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8')); } catch { return { ...DEFAULT_PERMISSIONS }; }
}

function savePermissions(perms) {
  fs.mkdirSync(path.dirname(PERMISSIONS_FILE), { recursive: true });
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2), 'utf8');
}

export function getPermission(action) {
  const perms = loadPermissions();
  return perms[action] || { level: 'ask', scope: 'global' };
}

export function setPermission(action, level, scope = 'global') {
  if (!LEVELS.includes(level)) throw new Error(`Invalid level: ${level}. Use: ${LEVELS.join(', ')}`);
  if (!SCOPES.includes(scope)) throw new Error(`Invalid scope: ${scope}. Use: ${SCOPES.join(', ')}`);
  const perms = loadPermissions();
  perms[action] = { level, scope, updated: new Date().toISOString() };
  savePermissions(perms);
  emit('permission.updated', { action, level, scope });
  return perms[action];
}

export function checkPermission(action) {
  const perm = getPermission(action);
  const allowed = perm.level === 'allow' || perm.level === 'session';
  emit('permission.checked', { action, allowed, level: perm.level });
  return { allowed, level: perm.level, scope: perm.scope, action };
}

export function requestPermission(action, context = {}) {
  const perm = getPermission(action);
  if (perm.level === 'allow') {
    emit('permission.granted', { action, level: 'allow', context });
    return { granted: true, level: 'allow', action };
  }
  if (perm.level === 'deny') {
    emit('permission.denied', { action, level: 'deny', context });
    return { granted: false, level: 'deny', action };
  }
  if (perm.level === 'session') {
    emit('permission.granted', { action, level: 'session', context });
    return { granted: true, level: 'session', action };
  }
  emit('permission.requested', { action, level: 'ask', context });
  return { granted: null, level: 'ask', action, requiresApproval: true };
}

export function listPermissions() {
  const perms = loadPermissions();
  return Object.entries(perms).map(([action, config]) => ({ action, ...config }));
}

export function resetPermissions() {
  savePermissions({ ...DEFAULT_PERMISSIONS });
  emit('permission.reset', {});
  return DEFAULT_PERMISSIONS;
}

export function getStats() {
  const perms = loadPermissions();
  const byLevel = {};
  for (const [, config] of Object.entries(perms)) {
    byLevel[config.level] = (byLevel[config.level] || 0) + 1;
  }
  return { total: Object.keys(perms).length, byLevel };
}

export function exportPermissions() {
  return loadPermissions();
}

export function importPermissions(data) {
  const current = loadPermissions();
  const merged = { ...current, ...data };
  savePermissions(merged);
  emit('permission.imported', { count: Object.keys(data).length });
  return merged;
}
