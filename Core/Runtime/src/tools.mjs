import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, resolveInsideRoot, relativeToRoot } from './paths.mjs';

function executeProcess(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export function createToolRegistry({ config, policy, audit, events }) {
  const registry = new Map();

  function register(tool) {
    if (!tool?.name || typeof tool.execute !== 'function') throw new Error('Invalid tool registration');
    registry.set(tool.name, { capability: 'read', mutating: false, ...tool });
    return tool.name;
  }

  register({ name: 'system.info', description: 'Return host and runtime information.', capability: 'read', execute: async () => ({
    platform: process.platform, arch: process.arch, node: process.version, hostname: os.hostname(), cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), uptimeSeconds: os.uptime(), root: ROOT
  }) });

  register({ name: 'fs.list', description: 'List files and directories inside the OS root.', capability: 'read', execute: async ({ path: input = '.' } = {}) => {
    const target = resolveInsideRoot(input);
    return fs.readdirSync(target, { withFileTypes: true }).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other' }));
  } });

  register({ name: 'fs.read', description: 'Read a UTF-8 file inside the OS root.', capability: 'read', execute: async ({ path: input } = {}) => {
    if (!input) throw new Error('path is required');
    const target = resolveInsideRoot(input);
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error('path is not a file');
    if (stat.size > 2_000_000) throw new Error('file exceeds read limit');
    return { path: relativeToRoot(target), content: fs.readFileSync(target, 'utf8') };
  } });

  register({ name: 'fs.write', description: 'Write a UTF-8 file inside the OS root.', capability: 'write', mutating: true, execute: async ({ path: input, content = '' } = {}) => {
    if (!input) throw new Error('path is required');
    const target = resolveInsideRoot(input);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(content), 'utf8');
    return { path: relativeToRoot(target), bytes: Buffer.byteLength(String(content)) };
  } });

  register({ name: 'shell.exec', description: 'Execute an allowlisted local command inside the OS root.', capability: 'execute', mutating: true, execute: async ({ command, args = [], cwd = '.' } = {}) => {
    if (!command) throw new Error('command is required');
    return executeProcess(String(command), Array.isArray(args) ? args.map(String) : [], { cwd: resolveInsideRoot(cwd), timeoutMs: Number(config.autonomy?.commandTimeoutMs || 120_000) });
  } });

  async function execute(name, args = {}, context = {}) {
    const tool = registry.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    policy.enforce(tool.capability, { ...context, command: args.command, subject: `tool:${name}` });
    const started = Date.now();
    events?.publish('tool.started', { name, mutating: tool.mutating });
    try {
      const result = await tool.execute(args);
      audit?.append('tool.execute', { tool: name, capability: tool.capability, durationMs: Date.now() - started, ok: true });
      events?.publish('tool.completed', { name, durationMs: Date.now() - started });
      return result;
    } catch (error) {
      audit?.append('tool.execute', { tool: name, capability: tool.capability, durationMs: Date.now() - started, ok: false, error: error.message });
      events?.publish('tool.failed', { name, error: error.message });
      throw error;
    }
  }

  return { register, has: (name) => registry.has(name), get: (name) => registry.get(name) || null, list: () => [...registry.values()].map(({ execute, ...metadata }) => metadata), execute };
}
