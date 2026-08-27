import fs from 'node:fs';
import path from 'node:path';
import { ROOT, VAULT_DIR } from './paths.mjs';
import { log } from './logger.mjs';

const EVOLUTION_DIR = path.join(ROOT, 'Data', 'Evolution');
const EVOLUTION_LOG = path.join(EVOLUTION_DIR, 'evolution.jsonl');
const EVOLUTION_STATE = path.join(EVOLUTION_DIR, 'state.json');
const RUNTIME_SRC = path.join(ROOT, 'Core', 'Runtime', 'src');

function ensure() { fs.mkdirSync(EVOLUTION_DIR, { recursive: true }); }
function loadState() {
  ensure();
  if (!fs.existsSync(EVOLUTION_STATE)) {
    const initial = {
      version: '0.8.0',
      capabilities: [],
      learnings: [],
      refactorings: [],
      skills: [],
      metrics: { totalInteractions: 0, selfModifications: 0, skillsLearned: 0, lastEvolution: null },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(EVOLUTION_STATE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  return JSON.parse(fs.readFileSync(EVOLUTION_STATE, 'utf8'));
}
function saveState(state) {
  ensure();
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(EVOLUTION_STATE, JSON.stringify(state, null, 2), 'utf8');
}
function logEvolution(entry) {
  ensure();
  const record = { ts: new Date().toISOString(), ...entry };
  fs.appendFileSync(EVOLUTION_LOG, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export function getEvolutionState() { return loadState(); }

export function getEvolutionLog(limit = 50) {
  ensure();
  if (!fs.existsSync(EVOLUTION_LOG)) return [];
  const lines = fs.readFileSync(EVOLUTION_LOG, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l)).reverse();
}

export function analyzeCode() {
  const srcFiles = fs.readdirSync(RUNTIME_SRC).filter((f) => f.endsWith('.mjs'));
  const analysis = { files: [], totalLines: 0, totalSize: 0, lastModified: null, modules: [] };
  for (const file of srcFiles) {
    const filePath = path.join(RUNTIME_SRC, file);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    analysis.files.push({ name: file, lines, size: stat.size, modified: stat.mtime.toISOString() });
    analysis.totalLines += lines;
    analysis.totalSize += stat.size;
    if (!analysis.lastModified || stat.mtime > analysis.lastModified) analysis.lastModified = stat.mtime.toISOString();
    const exports = content.match(/export\s+(function|const|class)\s+(\w+)/g) || [];
    analysis.modules.push({ name: file.replace('.mjs', ''), exports: exports.map((e) => e.replace(/export\s+(function|const|class)\s+/, '')) });
  }
  return analysis;
}

export function findImprovements() {
  const analysis = analyzeCode();
  const state = loadState();
  const improvements = [];
  for (const file of analysis.files) {
    if (file.lines > 200) improvements.push({ type: 'refactor', file: file.name, reason: `Datei hat ${file.lines} Zeilen — sollte aufgeteilt werden`, priority: 'medium' });
    const content = fs.readFileSync(path.join(RUNTIME_SRC, file.name), 'utf8');
    if (content.includes('catch') && !content.includes('catch (') && !content.includes('catch{')) improvements.push({ type: 'error-handling', file: file.name, reason: 'Catch-Blöcke ohne Fehlerbehandlung', priority: 'high' });
    if (content.includes('TODO') || content.includes('FIXME')) improvements.push({ type: 'todo', file: file.name, reason: 'Ungelöste TODOs/FIXMEs vorhanden', priority: 'low' });
    const duplicates = content.match(/function\s+(\w+).*\n.*function\s+\1/g);
    if (duplicates) improvements.push({ type: 'duplicate', file: file.name, reason: 'Mögliche doppelte Funktionsdefinitionen', priority: 'medium' });
  }
  if (state.metrics.totalInteractions > 100 && !state.skills.includes('auto-optimize')) improvements.push({ type: 'skill', reason: 'Genug Interaktionen für Auto-Optimierung', priority: 'high' });
  return improvements;
}

export function applySelfImprovement(improvement) {
  const state = loadState();
  const result = { applied: false, improvement, timestamp: new Date().toISOString() };
  if (improvement.type === 'skill') {
    state.skills.push('auto-optimize');
    state.metrics.skillsLearned++;
    result.applied = true;
    result.action = 'skill-added';
  }
  if (improvement.type === 'todo') {
    result.applied = false;
    result.action = 'requires-manual-review';
  }
  logEvolution({ type: 'improvement', ...result });
  saveState(state);
  return result;
}

export function recordInteraction(prompt, result, toolCalls) {
  const state = loadState();
  state.metrics.totalInteractions++;
  const learning = { prompt: prompt.substring(0, 200), provider: result.provider, model: result.model, toolCalls: toolCalls || [], ts: new Date().toISOString() };
  state.learnings.push(learning);
  if (state.learnings.length > 500) state.learnings = state.learnings.slice(-500);
  saveState(state);
  logEvolution({ type: 'interaction', ...learning });
  return learning;
}

export function recordSelfModification(file, change, reason) {
  const state = loadState();
  state.metrics.selfModifications++;
  const mod = { file, change: change.substring(0, 500), reason, ts: new Date().toISOString() };
  state.refactorings.push(mod);
  if (state.refactorings.length > 100) state.refactorings = state.refactorings.slice(-100);
  saveState(state);
  logEvolution({ type: 'self-modification', ...mod });
  return mod;
}

export function generateEvolutionReport() {
  const state = loadState();
  const analysis = analyzeCode();
  const improvements = findImprovements();
  return {
    system: { version: state.version, uptime: state.metrics.totalInteractions + ' interactions', lastEvolution: state.metrics.lastEvolution },
    code: { files: analysis.files.length, totalLines: analysis.totalLines, totalSize: (analysis.totalSize / 1024).toFixed(1) + ' KB', modules: analysis.modules.length },
    metrics: state.metrics,
    capabilities: state.capabilities,
    skills: state.skills,
    recentLearnings: state.learnings.slice(-5),
    recentRefactorings: state.refactorings.slice(-3),
    pendingImprovements: improvements,
    health: { score: Math.max(0, 100 - improvements.filter((i) => i.priority === 'high').length * 10), issues: improvements.filter((i) => i.priority === 'high').length, warnings: improvements.filter((i) => i.priority === 'medium').length }
  };
}

export function createEvolutionEngine({ tools, providers }) {
  return {
    analyze: analyzeCode,
    improve: findImprovements,
    apply: applySelfImprovement,
    report: generateEvolutionReport,
    record: recordInteraction,
    modify: recordSelfModification,
    state: getEvolutionState,
    log: getEvolutionLog,
    autoImprove: async () => {
      const improvements = findImprovements();
      const applied = [];
      for (const imp of improvements) {
        if (imp.type === 'skill') { const r = applySelfImprovement(imp); applied.push(r); }
      }
      return { improvements: improvements.length, applied };
    }
  };
}
