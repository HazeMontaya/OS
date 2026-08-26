import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..', '..', '..');
export const ROOT = path.resolve(process.env.OS_ROOT || sourceRoot);
export const RUNTIME_DIR = path.join(ROOT, 'Core', 'Runtime');
export const UI_DIR = path.join(ROOT, 'Core', 'UI');
export const DATA_DIR = path.join(ROOT, 'Data');
export const LOG_DIR = path.join(ROOT, 'Logs');
export const CONFIG_DIR = path.join(ROOT, 'Config');
export const WORKSPACE_DIR = path.join(ROOT, 'Workspace');
export const MODELS_DIR = path.join(ROOT, 'Models');

export function resolveInsideRoot(input = '.') {
  const target = path.resolve(ROOT, input);
  const rel = path.relative(ROOT, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path escapes OS root: ${input}`);
  return target;
}
