import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveInsideRoot, ROOT } from '../src/paths.mjs';
import { loadConfig } from '../src/config.mjs';
import { createToolRegistry } from '../src/tools.mjs';
import { addMemory, searchMemory } from '../src/memory.mjs';
import { createWorkflowEngine } from '../src/workflows.mjs';
import { createMcpManager } from '../src/mcp.mjs';

test('root path guard blocks traversal', () => {
  assert.equal(resolveInsideRoot('.'), ROOT);
  assert.throws(() => resolveInsideRoot('../escape'), /escapes OS root/);
});

test('memory writes and deduplicates', () => {
  const text = `runtime-test-${Date.now()}`;
  const first = addMemory({ text, tags: ['test'] });
  const second = addMemory({ text, tags: ['test'] });
  assert.equal(first.text, text);
  assert.equal(second.deduplicated, true);
  assert.ok(searchMemory(text, 5).length >= 1);
});

test('tool registry performs safe root I/O', async () => {
  const tools = createToolRegistry(loadConfig());
  const rel = `Temp/runtime-test-${Date.now()}.txt`;
  const written = await tools.execute('fs.write', { path: rel, content: 'ok' });
  assert.equal(written.bytes, 2);
  const read = await tools.execute('fs.read', { path: rel });
  assert.equal(read.content, 'ok');
  fs.rmSync(path.join(ROOT, rel), { force: true });
});

test('system-health workflow runs without AI provider', async () => {
  const tools = createToolRegistry(loadConfig());
  const providers = { generate: async () => { throw new Error('provider should not be used'); } };
  const workflows = createWorkflowEngine({ tools, providers });
  const result = await workflows.run('system-health');
  assert.equal(result.workflow, 'system-health');
  assert.equal(result.results.length, 2);
});

test('MCP stdio discovery and tool call work', async () => {
  const manager = createMcpManager({ servers:[{
    id:'fake', transport:'stdio', command:process.execPath,
    args:[path.join(ROOT, 'Core', 'Runtime', 'fixtures', 'fake-mcp-server.mjs')]
  }] });
  try {
    const found = await manager.discoverTools();
    assert.equal(found[0].name, 'echo');
    const result = await manager.callTool('fake', 'echo', { value:42 });
    assert.match(result.content[0].text, /42/);
  } finally { manager.stop(); }
});
