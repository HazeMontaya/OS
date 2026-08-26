import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './paths.mjs';
import { findModel, firstModelForProvider } from './model-catalog.mjs';

function joinUrl(base, suffix) {
  return `${String(base || '').replace(/\/$/, '')}/${String(suffix).replace(/^\//, '')}`;
}

function textFrom(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((part) => part?.text || part?.content || '').filter(Boolean).join('\n');
  return value == null ? '' : JSON.stringify(value);
}

async function requestJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Provider returned invalid JSON (${response.status})`); }
    if (!response.ok) throw new Error(data?.error?.message || data?.message || `Provider HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Provider request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function commandAvailable(command) {
  if (!command) return false;
  const extensions = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
  const separator = process.platform === 'win32' ? ';' : ':';
  return (process.env.PATH || '').split(separator).some((dir) =>
    extensions.some((extension) => fs.existsSync(path.join(dir, `${command}${extension}`)))
  );
}

function runCli(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, shell: false, windowsHide: true, env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function modelFor(provider, preferredModel) {
  if (preferredModel) return preferredModel;
  return provider.defaultModel || provider.models?.[0] || firstModelForProvider(provider.id)?.id || null;
}

export function createProviders(config, { audit, events } = {}) {
  const providers = (config.providers || []).filter((provider) => provider?.id && provider.enabled !== false);
  const timeoutMs = Number(config.providerTimeoutMs || 120_000);

  async function statusFor(provider) {
    const transport = provider.transport || 'openai';
    const keyPresent = !provider.apiKeyEnv || Boolean(process.env[provider.apiKeyEnv]);
    const available = transport === 'cli' ? commandAvailable(provider.command) : Boolean(provider.baseUrl) && keyPresent;
    return {
      id: provider.id,
      transport,
      available,
      keyRequired: Boolean(provider.apiKeyEnv),
      defaultModel: modelFor(provider),
      configuredModels: provider.models || []
    };
  }

  async function generateWith(provider, prompt, preferredModel) {
    const model = modelFor(provider, preferredModel);
    if (!model) throw new Error(`${provider.id}: no model configured or selected`);
    const transport = provider.transport || 'openai';

    if (transport === 'openai') {
      const headers = { 'content-type': 'application/json' };
      if (provider.apiKeyEnv) headers.authorization = `Bearer ${process.env[provider.apiKeyEnv] || ''}`;
      const data = await requestJson(joinUrl(provider.baseUrl, provider.path || 'chat/completions'), {
        method: 'POST', headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], ...(provider.extraBody || {}) })
      }, timeoutMs);
      return { provider: provider.id, model, text: textFrom(data?.choices?.[0]?.message?.content) };
    }

    if (transport === 'anthropic') {
      const data = await requestJson(joinUrl(provider.baseUrl, provider.path || 'messages'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env[provider.apiKeyEnv] || '', 'anthropic-version': provider.anthropicVersion || '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: provider.maxTokens || 8192, messages: [{ role: 'user', content: prompt }] })
      }, timeoutMs);
      return { provider: provider.id, model, text: textFrom(data?.content) };
    }

    if (transport === 'cli') {
      const args = (provider.args || []).map((value) => String(value).replaceAll('{prompt}', prompt).replaceAll('{model}', model));
      return { provider: provider.id, model, text: await runCli(provider.command, args, timeoutMs) };
    }
    throw new Error(`Unsupported provider transport: ${transport}`);
  }

  return {
    status: () => Promise.all(providers.map(statusFor)),
    generate: async (prompt, preferredProvider, preferredModel) => {
      const catalogProvider = preferredModel ? findModel(preferredModel)?.provider : null;
      const target = preferredProvider || catalogProvider || null;
      const ordered = target ? [...providers.filter((provider) => provider.id === target), ...providers.filter((provider) => provider.id !== target)] : providers;
      const errors = [];
      for (const provider of ordered) {
        const status = await statusFor(provider);
        if (!status.available) { errors.push(`${provider.id}: unavailable`); continue; }
        try {
          events?.publish('provider.request', { provider: provider.id, model: preferredModel || status.defaultModel });
          const result = await generateWith(provider, prompt, provider.id === target ? preferredModel : undefined);
          audit?.append('provider.generate', { provider: result.provider, model: result.model });
          events?.publish('provider.response', { provider: result.provider, model: result.model });
          return result;
        } catch (error) { errors.push(`${provider.id}: ${error.message}`); }
      }
      throw new Error(`No provider completed the request${errors.length ? `. ${errors.join(' | ')}` : ': no providers configured'}`);
    }
  };
}
