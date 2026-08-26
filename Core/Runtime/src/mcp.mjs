import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WORKSPACE_DIR, ROOT, resolveInsideRoot } from './paths.mjs';

const configFile = path.join(WORKSPACE_DIR, 'MCP', 'servers.json');

export function loadMcpConfig() {
  if (!fs.existsSync(configFile)) return { servers: [] };
  return JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
}

class StdioMcpClient {
  constructor(server) {
    this.server = server;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
  }

  async start() {
    if (this.child) return;
    const cwd = this.server.cwd ? resolveInsideRoot(this.server.cwd) : ROOT;
    this.child = spawn(this.server.command, this.server.args || [], {
      cwd,
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...(this.server.env || {}) }
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.#onData(chunk));
    this.child.stderr?.on('data', () => {});
    this.child.on('exit', (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`MCP server ${this.server.id} exited (${code})`));
      this.pending.clear();
      this.child = null;
    });
    this.child.on('error', (error) => {
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
    });
    await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'OS', version: '0.7.0' }
    });
    this.notify('notifications/initialized', {});
  }

  #onData(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else pending.resolve(message.result);
      }
    }
  }

  request(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async listTools() {
    await this.start();
    const result = await this.request('tools/list', {});
    return result.tools || [];
  }

  async callTool(name, args = {}) {
    await this.start();
    return this.request('tools/call', { name, arguments: args });
  }

  stop() {
    if (this.child) this.child.kill();
    this.child = null;
  }
}

export function createMcpManager(config = loadMcpConfig()) {
  const servers = (config.servers || []).filter((s) => s.enabled !== false);
  const clients = new Map();
  const getClient = (id) => {
    const server = servers.find((s) => s.id === id);
    if (!server) throw new Error(`MCP server not found: ${id}`);
    if ((server.transport || 'stdio') !== 'stdio') throw new Error(`Unsupported MCP transport for ${id}: ${server.transport}`);
    if (!server.command) throw new Error(`MCP stdio server ${id} has no command`);
    if (!clients.has(id)) clients.set(id, new StdioMcpClient(server));
    return clients.get(id);
  };

  return {
    registry: () => ({
      servers: servers.map((s) => ({ id: s.id, transport: s.transport || 'stdio', command: s.command || null, url: s.url || null, enabled: s.enabled !== false }))
    }),
    discoverTools: async () => {
      const output = [];
      for (const server of servers) {
        try {
          const tools = await getClient(server.id).listTools();
          output.push(...tools.map((tool) => ({ server: server.id, ...tool })));
        } catch (error) {
          output.push({ server: server.id, error: error.message });
        }
      }
      return output;
    },
    callTool: (serverId, name, args) => getClient(serverId).callTool(name, args),
    stop: () => { for (const client of clients.values()) client.stop(); clients.clear(); }
  };
}
