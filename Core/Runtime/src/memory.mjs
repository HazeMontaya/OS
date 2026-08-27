import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, VAULT_DIR } from './paths.mjs';
import { vaultSyncToMemory, vaultSearch, vaultReadAll, parseFrontmatter } from './vault.mjs';

const dir = path.join(DATA_DIR, 'Memory');
const file = path.join(dir, 'memory.jsonl');
const VAULT_MEMORY_DIR = path.join(VAULT_DIR, '10-MEMORY');

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
  let vaultResult = null;
  try {
    vaultResult = vaultSyncToMemory({ text: normalized, type, tags, source, metadata });
  } catch (_) { /* vault sync is best-effort */ }
  return { ...item, vault: vaultResult };
}

export function listMemory(limit = 100) {
  ensure();
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const jsonlItems = lines.slice(-Math.max(1, Math.min(Number(limit) || 100, 1000))).map((line) => JSON.parse(line)).reverse();
  let vaultItems = [];
  try {
    if (fs.existsSync(VAULT_MEMORY_DIR)) {
      vaultItems = fs.readdirSync(VAULT_MEMORY_DIR)
        .filter((f) => f.endsWith('.md'))
        .slice(-limit)
        .reverse()
        .map((f) => {
          const raw = fs.readFileSync(path.join(VAULT_MEMORY_DIR, f), 'utf8');
          const { frontmatter, body } = parseFrontmatter(raw);
          return {
            id: frontmatter.id || `vault-${f}`,
            ts: frontmatter.ts || new Date().toISOString(),
            type: frontmatter.type || 'semantic',
            tags: frontmatter.tags || [],
            source: frontmatter.source || 'vault',
            text: body || frontmatter.title || f.replace('.md', ''),
            metadata: frontmatter.metadata ? JSON.parse(frontmatter.metadata) : {},
            vault: true,
            vaultPath: `10-MEMORY/${f}`
          };
        });
    }
  } catch (_) { /* vault read is best-effort */ }
  const seen = new Set();
  const merged = [];
  for (const item of [...jsonlItems, ...vaultItems]) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, limit);
}

export function searchMemory(query = '', limit = 50) {
  const q = String(query).trim().toLowerCase();
  const items = listMemory(1000);
  if (!q) return items.slice(0, limit);
  const jsonlMatches = items.filter((item) => {
    const hay = `${item.text} ${(item.tags || []).join(' ')} ${item.type}`.toLowerCase();
    return hay.includes(q);
  });
  let vaultMatches = [];
  try {
    vaultMatches = vaultSearch(q, '10-MEMORY', limit).map((r) => ({
      id: `vault-${r.path}`,
      ts: new Date().toISOString(),
      type: 'semantic',
      tags: [],
      source: 'vault',
      text: r.excerpt,
      metadata: { title: r.title, vaultPath: r.path, score: r.score },
      vault: true
    }));
  } catch (_) { /* vault search is best-effort */ }
  const seen = new Set();
  const merged = [];
  for (const item of [...jsonlMatches, ...vaultMatches]) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, limit);
}

export function searchVault(query = '', limit = 20) {
  return vaultSearch(query, '.', limit);
}

export function getVaultContext(prompt = '', limit = 5) {
  if (!prompt) return [];
  try {
    const results = vaultSearch(prompt, '.', limit * 2);
    const notes = [];
    for (const r of results.slice(0, limit)) {
      const note = vaultSearch(prompt, '.', 1).find((x) => x.path === r.path);
      if (note) notes.push({ path: r.path, title: r.title, excerpt: r.excerpt });
    }
    return notes;
  } catch (_) {
    return [];
  }
}
