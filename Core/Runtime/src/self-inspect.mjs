import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

const RUNTIME_SRC = path.join(ROOT, 'Core', 'Runtime', 'src');
const UI_DIR = path.join(ROOT, 'Core', 'UI');
const CONFIG_DIR = path.join(ROOT, 'Config', 'OS');

export function inspectRuntime() {
  const files = fs.readdirSync(RUNTIME_SRC).filter((f) => f.endsWith('.mjs'));
  const modules = [];
  let totalLines = 0, totalExports = 0, totalImports = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(RUNTIME_SRC, file), 'utf8');
    const lines = content.split('\n').length;
    const exports = (content.match(/export\s/g) || []).length;
    const imports = (content.match(/import\s/g) || []).length;
    const todos = (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
    const errors = (content.match(/throw\s+new\s+Error/g) || []).length;
    const hasJSDoc = content.includes('/**');
    modules.push({ name: file.replace('.mjs', ''), lines, exports, imports, todos, errors, hasJSDoc, size: content.length });
    totalLines += lines;
    totalExports += exports;
    totalImports += imports;
  }
  return { modules, summary: { files: files.length, totalLines, totalExports, totalImports, avgLinesPerFile: Math.round(totalLines / files.length) } };
}

export function inspectUI() {
  const files = fs.readdirSync(UI_DIR);
  const ui = [];
  for (const file of files) {
    const fp = path.join(UI_DIR, file);
    if (!fs.statSync(fp).isFile()) continue;
    const content = fs.readFileSync(fp, 'utf8');
    ui.push({ name: file, size: content.length, lines: content.split('\n').length, type: file.endsWith('.js') ? 'javascript' : file.endsWith('.css') ? 'css' : file.endsWith('.html') ? 'html' : 'other' });
  }
  return ui;
}

export function inspectConfig() {
  const configs = [];
  for (const file of fs.readdirSync(CONFIG_DIR)) {
    const fp = path.join(CONFIG_DIR, file);
    if (!fs.statSync(fp).isFile()) continue;
    try {
      const content = JSON.parse(fs.readFileSync(fp, 'utf8'));
      configs.push({ name: file, valid: true, keys: Object.keys(content).length });
    } catch (e) { configs.push({ name: file, valid: false, error: e.message }); }
  }
  return configs;
}

export function securityAudit() {
  const findings = [];
  const sensitivePatterns = [
    { pattern: /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi, type: 'hardcoded-key', severity: 'high' },
    { pattern: /password\s*[=:]\s*['"][^'"]+['"]/gi, type: 'hardcoded-password', severity: 'high' },
    { pattern: /secret\s*[=:]\s*['"][^'"]+['"]/gi, type: 'hardcoded-secret', severity: 'high' },
    { pattern: /token\s*[=:]\s*['"][^'"]+['"]/gi, type: 'hardcoded-token', severity: 'medium' },
    { pattern: /eval\s*\(/gi, type: 'eval-usage', severity: 'medium' },
    { pattern: /exec\s*\(/gi, type: 'exec-usage', severity: 'low' },
  ];
  const allFiles = [...fs.readdirSync(RUNTIME_SRC).filter((f) => f.endsWith('.mjs')).map((f) => path.join(RUNTIME_SRC, f)), ...fs.readdirSync(UI_DIR).filter((f) => f.endsWith('.js')).map((f) => path.join(UI_DIR, f))];
  for (const fp of allFiles) {
    const content = fs.readFileSync(fp, 'utf8');
    const file = path.basename(fp);
    for (const { pattern, type, severity } of sensitivePatterns) {
      const matches = content.match(pattern) || [];
      if (matches.length > 0) findings.push({ file, type, severity, count: matches.length });
    }
  }
  return findings;
}

export function dependencyCheck() {
  const pkgPath = path.join(ROOT, 'Core', 'Runtime', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { total: Object.keys(deps).length, dependencies: deps, hasLockfile: fs.existsSync(path.join(ROOT, 'Core', 'Runtime', 'package-lock.json')) };
}

export function fullInspection() {
  return {
    runtime: inspectRuntime(),
    ui: inspectUI(),
    config: inspectConfig(),
    security: securityAudit(),
    dependencies: dependencyCheck(),
    timestamp: new Date().toISOString()
  };
}
