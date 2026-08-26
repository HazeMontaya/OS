import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WORKSPACE_DIR, ROOT } from './paths.mjs';
const registryFile = path.join(WORKSPACE_DIR, 'MCP', 'servers.json');
function loadServers() {
  if (!fs.existsSync(registryFile)) return [];
  try { const raw = JSON.parse(fs.readFileSync(registryFile, 'utf8')); return Array.isArray(raw) ? raw : Array.isArray(raw.servers) ? raw.servers : []; } catch { return []; }
}
function createConnection(server) {
  const child = spawn(server.command, Array.isArray(server.args) ? server.args.map(String) : [], { cwd: server.cwd ? path.resolve(ROOT, server.cwd) : ROOT, env: { ...process.env, ...(server.env || {}) }, shell: false, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  let buffer = ''; let sequence = 0; const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { buffer += chunk; for (;;) {
    const newline = buffer.indexOf('\n'); if (newline < 0) break; const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1); if (!line) continue;
    let message; try { message = JSON.parse(line); } catch { continue; }
    if (message.id != null && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message || 'MCP error')); else item.resolve(message.result); }
  }});
  child.on('exit', () => { for (const item of pending.values()) item.reject(new Error(`MCP server ${server.id} exited`)); pending.clear(); });
  function request(method, params = {}, timeoutMs = 30_000) { return new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, timeoutMs);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  }); }
  return { child, request, stop: () => child.kill() };
}
export function createMcpManager({ audit, events } = {}) {
  const connections = new Map();
  function registry() { return { servers: loadServers().map((server) => ({ id: server.id, command: server.command, args: server.args || [], enabled: server.enabled !== false, running: connections.has(server.id) })) }; }
  async function ensure(serverId) {
    if (connections.has(serverId)) return connections.get(serverId);
    const server = loadServers().find((item) => item.id === serverId && item.enabled !== false);
    if (!server) throw new Error(`Unknown or disabled MCP server: ${serverId}`); if (!server.command) throw new Error(`MCP server ${serverId} has no command`);
    const connection = createConnection(server); connections.set(serverId, connection);
    try {
      await connection.request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'Haze OS', version: '1.0.0' } });
      connection.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
      audit?.append('mcp.started', { server: serverId }); events?.publish('mcp.started', { server: serverId }); return connection;
    } catch (error) { connection.stop(); connections.delete(serverId); throw error; }
  }
  async function discoverTools() {
    const result = [];
    for (const server of loadServers().filter((item) => item.enabled !== false)) {
      try { const connection = await ensure(server.id); const response = await connection.request('tools/list', {}); for (const tool of response?.tools || []) result.push({ server: server.id, name: tool.name, description: tool.description || '', inputSchema: tool.inputSchema || {} }); }
      catch (error) { result.push({ server: server.id, error: error.message }); }
    }
    return result;
  }
  async function callTool(serverId, toolName, args = {}) { const connection = await ensure(serverId); const result = await connection.request('tools/call', { name: toolName, arguments: args }); audit?.append('mcp.call', { server: serverId, tool: toolName }); events?.publish('mcp.call', { server: serverId, tool: toolName }); return result; }
  function stop() { for (const connection of connections.values()) connection.stop(); connections.clear(); }
  return { registry, discoverTools, callTool, stop };
}
