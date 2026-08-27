import { addMemory, searchMemory, getVaultContext } from './memory.mjs';
import { vaultWrite, vaultUpdateIndex } from './vault.mjs';
import { log } from './logger.mjs';
import { createEvolutionEngine, recordInteraction } from './evolution.mjs';
import { addEntity, addRelation, addConcept, searchEntities, searchConcepts, getKnowledgeStats } from './knowledge-graph.mjs';
import { fullInspection, securityAudit, inspectRuntime } from './self-inspect.mjs';

export function createAgent({ tools, providers, config }) {
  const evolution = createEvolutionEngine({ tools, providers });

  async function runToolLoop(prompt, preferredProvider, preferredModel, remember) {
    const memory = searchMemory(prompt, 8);
    const vaultContext = getVaultContext(prompt, 3);
    const toolCatalog = tools.list();
    const evoState = evolution.state();
    const kgStats = getKnowledgeStats();

    const systemParts = [
      'You are the local OS agent. Return only valid JSON.',
      'Choose one of two forms:',
      '{"action":"answer","answer":"..."}',
      '{"action":"tool","tool":"tool.name","args":{},"reason":"..."}',
      `Available tools: ${JSON.stringify(toolCatalog)}`,
      `Relevant memory: ${JSON.stringify(memory)}`,
      `OS knowledge: ${kgStats.entities} entities, ${kgStats.concepts} concepts, version ${evoState.version}`,
    ];
    if (vaultContext.length > 0) systemParts.push(`Relevant vault notes: ${JSON.stringify(vaultContext)}`);
    systemParts.push(`User request: ${prompt}`);
    const system = systemParts.join('\n');
    let transcript = system;
    const toolCalls = [];
    for (let i = 0; i < config.autonomy.maxToolIterations; i++) {
      const generated = await providers.generate(transcript, preferredProvider, preferredModel);
      let parsed;
      try { parsed = JSON.parse(generated.text); }
      catch {
        recordInteraction(prompt, generated, toolCalls);
        return { provider: generated.provider, model: generated.model, answer: generated.text, iterations: i + 1, toolResults: [] };
      }
      if (parsed.action === 'answer') {
        recordInteraction(prompt, generated, toolCalls);
        return { provider: generated.provider, model: generated.model, answer: String(parsed.answer || ''), iterations: i + 1 };
      }
      if (parsed.action !== 'tool' || !tools.has(parsed.tool)) {
        recordInteraction(prompt, generated, toolCalls);
        return { provider: generated.provider, model: generated.model, answer: generated.text, iterations: i + 1 };
      }
      const result = await tools.execute(parsed.tool, parsed.args || {});
      toolCalls.push({ tool: parsed.tool, args: parsed.args, result: typeof result === 'string' ? result.substring(0, 200) : 'ok' });
      log('info', 'agent.tool', { tool: parsed.tool, provider: generated.provider, model: generated.model });
      transcript += `\nTool result for ${parsed.tool}: ${JSON.stringify(result)}\nContinue. Return JSON only.`;
    }
    throw new Error('Agent reached maximum tool iterations');
  }
  return {
    run: async ({ prompt, provider, model, remember = false }) => {
      if (!prompt) throw new Error('prompt is required');
      const result = await runToolLoop(String(prompt), provider, model, remember);
      if (remember && result.answer) {
        addMemory({ text: result.answer, type: 'episodic', source: 'agent', tags: ['agent-output'], metadata: { provider: result.provider, model: result.model } });
        addConcept(prompt.substring(0, 100), result.answer.substring(0, 500), ['agent-interaction']);
      }
      return result;
    },
    evolution,
    inspect: fullInspection,
    securityAudit,
    knowledge: { addEntity, addRelation, addConcept, searchEntities, searchConcepts, stats: getKnowledgeStats },
    selfReport: () => ({ evolution: evolution.report(), knowledge: getKnowledgeStats(), inspection: fullInspection() })
  };
}
