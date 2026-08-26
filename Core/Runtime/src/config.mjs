import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './paths.mjs';

const defaults = {
  host: '127.0.0.1', port: 43110, openBrowser: false,
  autonomy: { level: 'high', allowShell: true, allowWriteInsideRoot: true, allowNetworkTools: true, maxToolIterations: 6, commandTimeoutMs: 120000 },
  providers: []
};
function merge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(base?.[key] ?? {}, value) : value;
  return out;
}
export function loadConfig() {
  const file = path.join(CONFIG_DIR, 'OS', 'runtime.json');
  if (!fs.existsSync(file)) return structuredClone(defaults);
  return merge(defaults, JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
}
