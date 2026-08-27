import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { VAULT_DIR } from './paths.mjs';

const MEMORY_DIR = '10-MEMORY';
const INBOX_DIR = '00-INBOX';
const DECISIONS_DIR = '50-DECISIONS';
const SOPS_DIR = '60-SOPS';

function ensureVault() {
  if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
}

function vaultPath(relative = '.') {
  ensureVault();
  const target = path.resolve(VAULT_DIR, relative);
  const rel = path.relative(VAULT_DIR, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path escapes vault: ${relative}`);
  return target;
}

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const raw = match[1];
  const frontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null' || val === '') val = null;
    frontmatter[key] = val;
  }
  return { frontmatter, body: content.slice(match[0].length).trim() };
}

export function buildFrontmatter(meta) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(meta)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) lines.push(`${key}: [${val.join(', ')}]`);
    else if (typeof val === 'boolean') lines.push(`${key}: ${val}`);
    else lines.push(`${key}: "${String(val).replace(/"/g, '\\"')}"`);
  }
  lines.push('---');
  return lines.join('\n');
}

export function vaultRead(relative) {
  const target = vaultPath(relative);
  if (!fs.existsSync(target)) return null;
  const raw = fs.readFileSync(target, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  return { path: relative, frontmatter, body, raw };
}

export function vaultWrite(relative, content, frontmatter = {}) {
  const target = vaultPath(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let full;
  if (Object.keys(frontmatter).length > 0) {
    full = buildFrontmatter(frontmatter) + '\n\n' + content;
  } else {
    full = content;
  }
  fs.writeFileSync(target, full, 'utf8');
  return { path: relative, bytes: Buffer.byteLength(full) };
}

export function vaultList(relative = '.') {
  const target = vaultPath(relative);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? 'dir' : 'file',
    path: path.join(relative, entry.name).replace(/\\/g, '/')
  }));
}

export function vaultSearch(query = '', folder = '.', limit = 20) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];
  const target = vaultPath(folder);
  if (!fs.existsSync(target)) return [];
  const results = [];
  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.join(relBase, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(full, 'utf8').toLowerCase();
        if (raw.includes(q)) {
          const { frontmatter, body } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
          const idx = raw.indexOf(q);
          const excerpt = fs.readFileSync(full, 'utf8').substring(Math.max(0, idx - 80), idx + q.length + 80);
          results.push({ path: rel, title: frontmatter.title || entry.name.replace('.md', ''), excerpt: '...' + excerpt + '...', score: (raw.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length });
        }
      }
    }
  };
  walk(target, folder === '.' ? '' : folder);
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function vaultLinks(relative) {
  const note = vaultRead(relative);
  if (!note) return [];
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(note.body)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

export function vaultBacklinks(relative) {
  const noteName = path.basename(relative, '.md');
  const results = [];
  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.join(relBase, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith('.md') && rel !== relative) {
        const raw = fs.readFileSync(full, 'utf8');
        if (raw.includes(`[[${noteName}]]`) || raw.includes(`[[${noteName}|`)) {
          const { frontmatter } = parseFrontmatter(raw);
          results.push({ path: rel, title: frontmatter.title || entry.name.replace('.md', '') });
        }
      }
    }
  };
  walk(VAULT_DIR, '');
  return results;
}

export function vaultSyncToMemory({ text, type = 'semantic', tags = [], source = 'user', metadata = {} }) {
  const ts = new Date().toISOString().split('T')[0];
  const safeName = text.substring(0, 60).replace(/[^a-zA-Z0-9äöüÄÖÜß\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const filename = `${ts}-${safeName}.md`;
  const target = path.join(MEMORY_DIR, filename);
  const frontmatter = {
    type,
    tags: Array.isArray(tags) ? tags : [],
    source,
    ts: new Date().toISOString(),
    id: crypto.randomUUID(),
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata: JSON.stringify(metadata) } : {})
  };
  return vaultWrite(target, text, frontmatter);
}

export function vaultReadAll(limit = 50) {
  const notes = [];
  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (notes.length >= limit) return;
      const full = path.join(dir, entry.name);
      const rel = path.join(relBase, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith('.md') && entry.name !== 'VAULT-INDEX.md') {
        const { frontmatter, body } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
        notes.push({ path: rel, title: frontmatter.title || entry.name.replace('.md', ''), body: body.substring(0, 500), frontmatter });
      }
    }
  };
  walk(VAULT_DIR, '');
  return notes;
}

export function vaultUpdateIndex() {
  const sections = [];
  const categories = [
    { dir: INBOX_DIR, label: '00-INBOX (Eingang)' },
    { dir: MEMORY_DIR, label: '10-MEMORY (Erinnerung)' },
    { dir: '20-PROJECTS', label: '20-PROJECTS (Projekte)' },
    { dir: '30-AREAS', label: '30-AREAS (Bereiche)' },
    { dir: '40-KNOWLEDGE', label: '40-KNOWLEDGE (Wissen)' },
    { dir: DECISIONS_DIR, label: '50-DECISIONS (Entscheidungen)' },
    { dir: SOPS_DIR, label: '60-SOPS (Abläufe)' },
    { dir: '70-AGENTS', label: '70-AGENTS (Agenten)' },
    { dir: '80-AUTOMATIONS', label: '80-AUTOMATIONS' },
    { dir: '90-ARCHIVE', label: '90-ARCHIV' }
  ];
  sections.push('# VAULT INDEX');
  sections.push('');
  sections.push(`Aktualisiert: ${new Date().toISOString()}`);
  sections.push('');
  sections.push('## Navigation');
  sections.push('- [[SYSTEM]] — Kernel-Regeln');
  sections.push('- [[AGENTS]] — Agent-Instruktionen');
  sections.push('- [[MEMORY]] — Memory-Schema');
  sections.push('');
  for (const cat of categories) {
    const catPath = vaultPath(cat.dir);
    if (!fs.existsSync(catPath)) continue;
    const files = fs.readdirSync(catPath).filter((f) => f.endsWith('.md'));
    if (files.length === 0) continue;
    sections.push(`## ${cat.label}`);
    for (const file of files) {
      const name = file.replace('.md', '');
      sections.push(`- [[${name}]]`);
    }
    sections.push('');
  }
  const indexContent = sections.join('\n');
  fs.writeFileSync(path.join(VAULT_DIR, 'VAULT-INDEX.md'), indexContent, 'utf8');
  return { updated: true, sections: sections.length };
}
