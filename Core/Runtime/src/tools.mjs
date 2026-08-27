import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, resolveInsideRoot } from './paths.mjs';
import { vaultRead, vaultWrite, vaultList, vaultSearch, vaultLinks, vaultBacklinks, vaultSyncToMemory, vaultReadAll, vaultUpdateIndex } from './vault.mjs';

function runProcess(command, args, { cwd = ROOT, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

export function createToolRegistry(config) {
  const tools = new Map();
  const register = (tool) => tools.set(tool.name, tool);

  register({
    name: 'system.info',
    description: 'Return OS runtime and host information.',
    mutating: false,
    execute: async () => ({
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      memoryBytes: os.totalmem(),
      root: ROOT
    })
  });

  register({
    name: 'fs.list',
    description: 'List a directory inside the OS root.',
    mutating: false,
    execute: async ({ path: input = '.' } = {}) => {
      const target = resolveInsideRoot(input);
      return fs.readdirSync(target, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : 'file'
      }));
    }
  });

  register({
    name: 'fs.read',
    description: 'Read a UTF-8 file inside the OS root.',
    mutating: false,
    execute: async ({ path: input } = {}) => {
      if (!input) throw new Error('path is required');
      return { path: input, content: fs.readFileSync(resolveInsideRoot(input), 'utf8') };
    }
  });

  register({
    name: 'fs.write',
    description: 'Write a UTF-8 file inside the OS root.',
    mutating: true,
    execute: async ({ path: input, content = '' } = {}) => {
      if (!config.autonomy.allowWriteInsideRoot) throw new Error('File writes are disabled by policy');
      if (!input) throw new Error('path is required');
      const target = resolveInsideRoot(input);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(content), 'utf8');
      return { path: input, bytes: Buffer.byteLength(String(content)) };
    }
  });

  register({
    name: 'shell.exec',
    description: 'Execute a local command with the OS root as working directory.',
    mutating: true,
    execute: async ({ command, args = [], cwd = '.' } = {}) => {
      if (!config.autonomy.allowShell) throw new Error('Shell execution is disabled by policy');
      if (!command) throw new Error('command is required');
      const safeCwd = resolveInsideRoot(cwd);
      return runProcess(command, Array.isArray(args) ? args.map(String) : [], {
        cwd: safeCwd,
        timeoutMs: config.autonomy.commandTimeoutMs
      });
    }
  });

  register({
    name: 'vault.read',
    description: 'Read a note from the Obsidian vault (AI-Brain). Returns frontmatter + body.',
    mutating: false,
    execute: async ({ path: notePath } = {}) => {
      if (!notePath) throw new Error('path is required');
      const result = vaultRead(notePath);
      if (!result) throw new Error(`Note not found: ${notePath}`);
      return result;
    }
  });

  register({
    name: 'vault.write',
    description: 'Write or update a note in the Obsidian vault. Creates frontmatter automatically.',
    mutating: true,
    execute: async ({ path: notePath, content = '', title, type, tags = [], status } = {}) => {
      if (!config.autonomy.allowWriteInsideRoot) throw new Error('File writes are disabled by policy');
      if (!notePath) throw new Error('path is required');
      const frontmatter = {};
      if (title) frontmatter.title = title;
      if (type) frontmatter.type = type;
      if (tags.length > 0) frontmatter.tags = tags;
      if (status) frontmatter.status = status;
      frontmatter.ts = new Date().toISOString();
      return vaultWrite(notePath, content, frontmatter);
    }
  });

  register({
    name: 'vault.list',
    description: 'List files and folders in the Obsidian vault.',
    mutating: false,
    execute: async ({ path: folder = '.' } = {}) => {
      return vaultList(folder);
    }
  });

  register({
    name: 'vault.search',
    description: 'Full-text search across all Obsidian vault notes. Returns matching notes with excerpts.',
    mutating: false,
    execute: async ({ query, folder = '.', limit = 20 } = {}) => {
      if (!query) throw new Error('query is required');
      return vaultSearch(query, folder, limit);
    }
  });

  register({
    name: 'vault.links',
    description: 'Get all [[wiki-links]] from a vault note.',
    mutating: false,
    execute: async ({ path: notePath } = {}) => {
      if (!notePath) throw new Error('path is required');
      return vaultLinks(notePath);
    }
  });

  register({
    name: 'vault.backlinks',
    description: 'Find all notes that link to the given note via [[wiki-links]].',
    mutating: false,
    execute: async ({ path: notePath } = {}) => {
      if (!notePath) throw new Error('path is required');
      return vaultBacklinks(notePath);
    }
  });

  register({
    name: 'vault.syncMemory',
    description: 'Write a memory entry to the vault 10-MEMORY folder as a markdown note.',
    mutating: true,
    execute: async ({ text, type = 'semantic', tags = [], source = 'agent' } = {}) => {
      if (!text) throw new Error('text is required');
      return vaultSyncToMemory({ text, type, tags, source });
    }
  });

  register({
    name: 'vault.readAll',
    description: 'Read all vault notes (limited). Returns frontmatter + body for each.',
    mutating: false,
    execute: async ({ limit = 50 } = {}) => {
      return vaultReadAll(limit);
    }
  });

  register({
    name: 'vault.updateIndex',
    description: 'Regenerate the VAULT-INDEX.md file from current vault contents.',
    mutating: true,
    execute: async () => {
      return vaultUpdateIndex();
    }
  });

  return {
    register: (tool) => { register(tool); return tool.name; },
    list: () => [...tools.values()].map(({ execute, ...meta }) => meta),
    has: (name) => tools.has(name),
    execute: async (name, args = {}) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      return tool.execute(args);
    }
  };
}
