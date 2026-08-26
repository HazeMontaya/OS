function extractJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const first = raw.indexOf('{'); const last = raw.lastIndexOf('}'); if (first >= 0 && last > first) { try { return JSON.parse(raw.slice(first, last + 1)); } catch {} }
  return null;
}
export function createAgent({ tools, providers, memory, config, audit, events }) {
  async function run({ prompt, provider, model, remember = false, approved = false }) {
    if (!String(prompt || '').trim()) throw new Error('prompt is required');
    const relevantMemory = memory.search(prompt, 8); const catalog = tools.list(); const toolResults = [];
    let transcript = ['You are OS, a local-first AI operating environment.','Respond with exactly one JSON object and no markdown.','Allowed forms:','{"action":"answer","answer":"..."}','{"action":"tool","tool":"tool.name","args":{},"reason":"..."}','Use a tool only when it materially improves the result.',`Tools: ${JSON.stringify(catalog)}`,`Relevant memory: ${JSON.stringify(relevantMemory)}`,`User request: ${String(prompt)}`].join('\n');
    for (let iteration = 1; iteration <= Number(config.autonomy?.maxToolIterations || 8); iteration++) {
      const generated = await providers.generate(transcript, provider, model); const decision = extractJson(generated.text);
      if (!decision) return { answer: generated.text, provider: generated.provider, model: generated.model, iterations: iteration, toolResults };
      if (decision.action === 'answer') {
        const answer = String(decision.answer || '');
        if (remember && answer) memory.add({ text: answer, type: 'episodic', source: 'agent', tags: ['agent-output'], metadata: { provider: generated.provider, model: generated.model } });
        audit?.append('agent.completed', { provider: generated.provider, model: generated.model, iterations: iteration, toolCalls: toolResults.length }); events?.publish('agent.completed', { iterations: iteration, toolCalls: toolResults.length });
        return { answer, provider: generated.provider, model: generated.model, iterations: iteration, toolResults };
      }
      if (decision.action !== 'tool' || !tools.has(decision.tool)) return { answer: generated.text, provider: generated.provider, model: generated.model, iterations: iteration, toolResults };
      const tool = tools.get(decision.tool);
      if (tool.mutating && config.policy?.requireApprovalForMutations && approved !== true) {
        audit?.append('agent.approval_required', { tool: decision.tool, reason: decision.reason || null }); events?.publish('approval.required', { tool: decision.tool, args: decision.args || {}, reason: decision.reason || '' });
        return { answer: decision.reason || `Approval required for ${decision.tool}`, provider: generated.provider, model: generated.model, iterations: iteration, toolResults, pendingAction: { tool: decision.tool, args: decision.args || {}, reason: decision.reason || '', capability: tool.capability } };
      }
      const result = await tools.execute(decision.tool, decision.args || {}, { approved: approved === true, subject: 'agent' });
      toolResults.push({ tool: decision.tool, result }); transcript += `\nTool result (${decision.tool}): ${JSON.stringify(result)}\nContinue with one JSON object.`;
    }
    throw new Error('Agent reached maximum tool iterations');
  }
  return { run };
}
