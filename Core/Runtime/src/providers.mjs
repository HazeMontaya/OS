import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './paths.mjs';
import { findModel } from './model-catalog.mjs';

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Provider request timed out')), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
function joinUrl(base, suffix) { return `${String(base).replace(/\/$/, '')}/${String(suffix).replace(/^\//, '')}`; }
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n');
  return content == null ? '' : JSON.stringify(content);
}
async function requestJson(url, options, timeoutMs) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Provider returned invalid JSON (${response.status})`); }
    if (!response.ok) throw new Error(data?.error?.message || data?.message || `Provider HTTP ${response.status}`);
    return data;
  } finally { timeout.clear(); }
}
function runCli(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true, shell: false, env: process.env });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(stderr.trim() || `${command} exited with ${code}`));
      else resolve(stdout.trim());
    });
  });
}
function cliAvailable(command) {
  const extensions = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
  const pathItems = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  return pathItems.some((dir) => extensions.some((ext) => fs.existsSync(path.join(dir, `${command}${ext}`))));
}
function modelFor(provider, preferredModel) {
  if (preferredModel && (!provider.models || provider.models.includes(preferredModel))) return preferredModel;
  return provider.defaultModel || provider.models?.[0];
}
export function createProviders(config) {
  const providers = (config.providers || []).filter((provider) => provider.enabled !== false);
  const timeoutMs = config.autonomy?.commandTimeoutMs || 120000;
  async function probe(provider) {
    const transport = provider.transport || 'cli';
    const keyPresent = !provider.apiKeyEnv || Boolean(process.env[provider.apiKeyEnv]);
    const available = transport === 'cli' ? cliAvailable(provider.command) : keyPresent;
    return { id: provider.id, transport, available, keyRequired: Boolean(provider.apiKeyEnv), models: provider.models || [], defaultModel: provider.defaultModel || null };
  }
  async function generateWith(provider, prompt, preferredModel) {
    const model = modelFor(provider, preferredModel);
    const transport = provider.transport || 'cli';
    if (transport === 'openai') {
      if (!model) throw new Error(`${provider.id}: no model configured`);
      const headers = { 'content-type': 'application/json' };
      if (provider.apiKeyEnv) headers.authorization = `Bearer ${process.env[provider.apiKeyEnv] || ''}`;
      const payload = { model, messages: [{ role: 'user', content: prompt }], ...(provider.extraBody || {}) };
      const data = await requestJson(joinUrl(provider.baseUrl, 'chat/completions'), { method: 'POST', headers, body: JSON.stringify(payload) }, timeoutMs);
      return { provider: provider.id, model, text: extractText(data?.choices?.[0]?.message?.content) };
    }
    if (transport === 'anthropic') {
      if (!model) throw new Error(`${provider.id}: no model configured`);
      const data = await requestJson(joinUrl(provider.baseUrl, 'messages'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env[provider.apiKeyEnv] || '', 'anthropic-version': provider.anthropicVersion || '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: provider.maxTokens || 16384, messages: [{ role: 'user', content: prompt }] })
      }, timeoutMs);
      return { provider: provider.id, model, text: extractText(data?.content) };
    }
    if (transport === 'cli') {
      const args = (provider.args || []).map((arg) => String(arg).replaceAll('{prompt}', prompt).replaceAll('{model}', preferredModel || provider.defaultModel || ''));
      return { provider: provider.id, model: preferredModel || provider.defaultModel || null, text: await runCli(provider.command, args, timeoutMs) };
    }
    throw new Error(`Unsupported provider transport: ${transport}`);
  }
  return {
    status: async () => Promise.all(providers.map(probe)),
    generate: async (prompt, preferredProvider, preferredModel) => {
      const catalogModel = preferredModel ? findModel(preferredModel) : null;
      const targetProvider = preferredProvider || catalogModel?.provider || null;
      const ordered = targetProvider ? [...providers.filter((p) => p.id === targetProvider), ...providers.filter((p) => p.id !== targetProvider)] : providers;
      const errors = [];
      for (const provider of ordered) {
        const status = await probe(provider);
        const requestedModel = provider.id === targetProvider ? preferredModel : undefined;
        if (!status.available) { errors.push(`${provider.id}: unavailable${provider.apiKeyEnv ? ` (${provider.apiKeyEnv} missing)` : ''}`); continue; }
        try { return await generateWith(provider, prompt, requestedModel); }
        catch (error) { errors.push(`${provider.id}: ${error.message}`); }
      }
      throw new Error(`No AI provider completed the request. ${errors.join(' | ')}`);
    }
  };
}
