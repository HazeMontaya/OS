import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..');
export const UI_DIR = path.join(ROOT, 'Core', 'UI');
export const CONFIG_DIR = path.join(ROOT, 'Config', 'OS');
export const WORKSPACE_DIR = path.join(ROOT, 'Workspace');
export const DATA_DIR = path.join(ROOT, 'Data');
export const LOG_DIR = path.join(ROOT, 'Logs');
export const RUNTIME_DIR = path.join(DATA_DIR, 'Runtime');
export const MEMORY_FILE = path.join(RUNTIME_DIR, 'memory.jsonl');
export const AUDIT_FILE = path.join(RUNTIME_DIR, 'audit.jsonl');

for (const dir of [LOG_DIR, RUNTIME_DIR]) fs.mkdirSync(dir, { recursive: true });

export function resolveInsideRoot(input = '.') {
  const target = path.resolve(ROOT, String(input));
  const relative = path.relative(ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes OS root');
  }
  return target;
}

export function relativeToRoot(input) {
  return path.relative(ROOT, input).replaceAll('\\', '/');
}
