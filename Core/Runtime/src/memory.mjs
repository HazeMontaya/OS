import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './paths.mjs';

const dir = path.join(DATA_DIR, 'Memory');
const file = path.join(dir, 'memory.jsonl');

function ensure() {
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '', 'utf8');
}

export function addMemory({ text, type = 'semantic', tags = [], source = 'user', metadata = {} }) {
  if (!text || typeof text !== 'string') throw new Error('Memory text is required');
  ensure();
  const normalized = text.trim();
  const existing = searchMemory(normalized, 100).find((x) => x.text.toLowerCase() === normalized.toLowerCase());
  if (existing) return { ...existing, deduplicated: true };
  const item = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    tags: Array.isArray(tags) ? tags : [],
    source,
    text: normalized,
    metadata
  };
  fs.appendFileSync(file, `${JSON.stringify(item)}\n`, 'utf8');
  return item;
}

export function listMemory(limit = 100) {
  ensure();
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-Math.max(1, Math.min(Number(limit) || 100, 1000))).map((line) => JSON.parse(line)).reverse();
}

export function searchMemory(query = '', limit = 50) {
  const q = String(query).trim().toLowerCase();
  const items = listMemory(1000);
  if (!q) return items.slice(0, limit);
  return items.filter((item) => {
    const hay = `${item.text} ${(item.tags || []).join(' ')} ${item.type}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}
