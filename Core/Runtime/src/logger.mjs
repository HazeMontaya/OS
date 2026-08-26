import fs from 'node:fs';
import path from 'node:path';
import { LOG_DIR } from './paths.mjs';

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = String(process.env.OS_LOG_LEVEL || 'info').toLowerCase();
const threshold = levels[configured] ?? levels.info;

function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = /token|secret|password|api.?key|authorization/i.test(key) ? '[REDACTED]' : redact(item);
  }
  return out;
}

export function log(level, event, data = {}) {
  if ((levels[level] ?? 100) < threshold) return;
  const record = { ts: new Date().toISOString(), level, event, ...redact(data) };
  const line = JSON.stringify(record);
  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  try { fs.appendFileSync(file, `${line}\n`, 'utf8'); } catch {}
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
