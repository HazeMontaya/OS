const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const api = async (url, options = {}) => {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

function addChatMsg(text, role = 'ai') {
  const log = $('#chatLog');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `<div class="label">${role === 'user' ? 'Du' : 'OS'}</div><pre>${esc(text)}</pre>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function showThinking() {
  const log = $('#chatLog');
  const div = document.createElement('div');
  div.className = 'thinking';
  div.id = 'thinkingIndicator';
  div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div> Neural activity…';
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function hideThinking() {
  const el = $('#thinkingIndicator');
  if (el) el.remove();
}

async function refresh() {
  const [health, models] = await Promise.all([api('/api/health'), api('/api/models')]);

  const statusEl = $('#status');
  statusEl.textContent = health.ok ? 'ONLINE' : 'OFFLINE';
  statusEl.setAttribute('data-ok', health.ok);

  $('#stats').innerHTML = [['Version', health.version], ['Modelle', health.models], ['Tools', health.tools], ['Workflows', health.workflows], ['Automationen', health.automations], ['MCP', health.mcp]]
    .map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  $('#provider').innerHTML = '<option value="">Provider auto</option>' + health.providers.map((p) => `<option value="${esc(p.id)}" ${p.available ? '' : 'disabled'}>${esc(p.id)}${p.available ? '' : ' — Key fehlt'}</option>`).join('');
  $('#model').innerHTML = '<option value="">Modell auto</option>' + models.filter((m) => m.selectable !== false).map((m) => `<option value="${esc(m.id)}">${esc(m.name)} · ${esc(m.provider)}</option>`).join('');

  const memory = await api('/api/memory?limit=20');
  $('#memory').innerHTML = memory.length ? memory.map((m) => `<div class="item"><div>${esc(m.text)}</div><small>${esc(m.type)} · ${new Date(m.ts).toLocaleString()}</small></div>`).join('') : '<p class="muted">Noch kein Runtime-Memory.</p>';

  const workflows = await api('/api/workflows');
  $('#workflows').innerHTML = workflows.length ? workflows.map((w) => `<div class="item"><b>${esc(w.name || w.id)}</b><div><small>${esc(w.description || '')}</small></div><button data-workflow="${esc(w.id)}">Start</button></div>`).join('') : '<p class="muted">Keine Workflows.</p>';

  const tools = await api('/api/tools');
  $('#tools').innerHTML = tools.map((t) => `<div class="item"><b>${esc(t.name)}</b><div><small>${esc(t.description || '')}${t.mutating ? ' · mutierend' : ''}</small></div></div>`).join('');

  const [mcp, automations] = await Promise.all([api('/api/mcp'), api('/api/automations')]);
  $('#runtimeMeta').textContent = JSON.stringify({ providers: health.providers, mcp, automations }, null, 2);
}

$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = $('#prompt').value.trim();
  if (!prompt) return;

  addChatMsg(prompt, 'user');
  $('#prompt').value = '';

  const thinking = showThinking();
  if (window.setAIActivity) window.setAIActivity(0.8);

  try {
    const result = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        provider: $('#provider').value || undefined,
        model: $('#model').value || undefined,
        remember: $('#remember').checked
      })
    });
    hideThinking();
    addChatMsg(result.answer || JSON.stringify(result, null, 2), 'ai');
    await refresh();
  } catch (error) {
    hideThinking();
    addChatMsg(`FEHLER: ${error.message}`, 'ai');
  }

  if (window.setAIActivity) window.setAIActivity(0);
});

$('#memoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#memoryText');
  await api('/api/memory', { method: 'POST', body: JSON.stringify({ text: input.value, type: 'semantic', source: 'ui' }) });
  input.value = '';
  await refresh();
});

document.addEventListener('click', async (e) => {
  const id = e.target?.dataset?.workflow;
  if (!id) return;
  e.target.disabled = true;
  try {
    const result = await api('/api/workflows/run', { method: 'POST', body: JSON.stringify({ id, input: {} }) });
    addChatMsg(JSON.stringify(result, null, 2), 'ai');
  } catch (error) {
    addChatMsg(`FEHLER: ${error.message}`, 'ai');
  } finally {
    e.target.disabled = false;
  }
});

refresh().catch((error) => {
  $('#status').textContent = 'OFFLINE';
  $('#status').setAttribute('data-ok', 'false');
  addChatMsg(error.message, 'ai');
});
