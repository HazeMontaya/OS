import { createAuditLog } from './audit.mjs';
import { createEventBus } from './events.mjs';
import { createPolicy } from './policy.mjs';
import { createMemoryStore } from './memory.mjs';
import { createProviders } from './providers.mjs';
import { createToolRegistry } from './tools.mjs';
import { createWorkflowEngine } from './workflows.mjs';
import { createAutomationEngine } from './automations.mjs';
import { createMcpManager } from './mcp.mjs';
import { createAgent } from './agent.mjs';
import { listModels } from './model-catalog.mjs';

export function createKernel(config) {
  const audit = createAuditLog();
  const events = createEventBus();
  const policy = createPolicy(config, audit);
  const memory = createMemoryStore();
  const providers = createProviders(config, { audit, events });
  const tools = createToolRegistry({ config, policy, audit, events });
  const mcp = createMcpManager({ audit, events });
  const workflows = createWorkflowEngine({ tools, providers, audit, events });
  const automations = createAutomationEngine({ workflows, audit, events });
  const agent = createAgent({ tools, providers, memory, config, audit, events });

  async function health() {
    return {
      ok: true,
      version: '1.0.0',
      mode: config.autonomy?.mode || 'supervised',
      providers: await providers.status(),
      models: listModels().length,
      tools: tools.list().length,
      workflows: workflows.list().length,
      automations: automations.list().length,
      mcp: mcp.registry().servers.length,
      memory: memory.count(),
      policy: policy.snapshot()
    };
  }

  return {
    config,
    audit,
    events,
    policy,
    memory,
    providers,
    tools,
    mcp,
    workflows,
    automations,
    agent,
    models: { list: listModels },
    health,
    start: () => automations.start(),
    stop: () => {
      automations.stop();
      mcp.stop();
    }
  };
}
