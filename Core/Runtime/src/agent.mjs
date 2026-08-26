import { addMemory, searchMemory } from './memory.mjs';
import { log } from './logger.mjs';

export function createAgent({ tools, providers, config }) {
  async function runToolLoop(prompt, preferredProvider) {
    const memory = searchMemory(prompt, 8);
    const toolCatalog = tools.list();
    const system = [
      'You are the local OS agent. Return only valid JSON.',
      'Choose one of two forms:',
      '{"action":"answer","answer":"..."}',
      '{"action":"tool","tool":"tool.name","args":{},"reason":"..."}',
      `Available tools: ${JSON.stringify(toolCatalog)}`,
      `Relevant memory: ${JSON.stringify(memory)}`,
      `User request: ${prompt}`
    ].join('\n');

    let transcript = system;
    for (let i = 0; i < config.autonomy.maxToolIterations; i++) {
      const generated = await providers.generate(transcript, preferredProvider);
      let parsed;
      try { parsed = JSON.parse(generated.text); }
      catch {
        return { provider: generated.provider, answer: generated.text, iterations: i + 1, toolResults: [] };
      }
      if (parsed.action === 'answer') {
        return { provider: generated.provider, answer: String(parsed.answer || ''), iterations: i + 1 };
      }
      if (parsed.action !== 'tool' || !tools.has(parsed.tool)) {
        return { provider: generated.provider, answer: generated.text, iterations: i + 1 };
      }
      const result = await tools.execute(parsed.tool, parsed.args || {});
      log('info', 'agent.tool', { tool: parsed.tool });
      transcript += `\nTool result for ${parsed.tool}: ${JSON.stringify(result)}\nContinue. Return JSON only.`;
    }
    throw new Error('Agent reached maximum tool iterations');
  }

  return {
    run: async ({ prompt, provider, remember = false }) => {
      if (!prompt) throw new Error('prompt is required');
      const result = await runToolLoop(String(prompt), provider);
      if (remember && result.answer) addMemory({ text: result.answer, type: 'episodic', source: 'agent', tags: ['agent-output'] });
      return result;
    }
  };
}
