const $ = (s) => document.querySelector(s);
const api = async (url, options = {}) => {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

async function refresh() {
  const health = await api('/api/health');
  $('#status').textContent = health.ok ? 'ONLINE' : 'FEHLER';
  $('#status').classList.toggle('ok', health.ok);
  $('#stats').innerHTML = [
    ['Version', health.version], ['Tools', health.tools], ['Workflows', health.workflows], ['Automationen', health.automations], ['MCP', health.mcp]
  ].map(([k,v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#provider').innerHTML = '<option value="">Provider automatisch</option>' + health.providers.map((p) => `<option value="${p.id}" ${p.available?'':'disabled'}>${p.id}${p.available?'':' — nicht verfügbar'}</option>`).join('');

  const memory = await api('/api/memory?limit=20');
  $('#memory').innerHTML = memory.length ? memory.map((m) => `<div class="item"><div>${escapeHtml(m.text)}</div><small>${m.type} · ${new Date(m.ts).toLocaleString()}</small></div>`).join('') : '<p class="muted">Noch kein Runtime-Memory.</p>';

  const workflows = await api('/api/workflows');
  $('#workflows').innerHTML = workflows.length ? workflows.map((w) => `<div class="item"><b>${escapeHtml(w.name || w.id)}</b><div><small>${escapeHtml(w.description || '')}</small></div><button data-workflow="${w.id}">Start</button></div>`).join('') : '<p class="muted">Keine Workflows.</p>';

  const tools = await api('/api/tools');
  $('#tools').innerHTML = tools.map((t) => `<div class="item"><b>${t.name}</b><div><small>${escapeHtml(t.description || '')}${t.mutating?' · mutierend':''}</small></div></div>`).join('');

  const [mcp, automations] = await Promise.all([api('/api/mcp'), api('/api/automations')]);
  $('#runtimeMeta').textContent = JSON.stringify({ providers: health.providers, mcp, automations }, null, 2);
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#answer').textContent = 'Arbeite…';
  try {
    const result = await api('/api/chat', { method:'POST', body: JSON.stringify({ prompt: $('#prompt').value, provider: $('#provider').value || undefined, remember: $('#remember').checked }) });
    $('#answer').textContent = result.answer || JSON.stringify(result, null, 2);
    await refresh();
  } catch (error) { $('#answer').textContent = `FEHLER: ${error.message}`; }
});

$('#memoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('/api/memory', { method:'POST', body: JSON.stringify({ text: $('#memoryText').value, type:'semantic', source:'ui' }) });
  $('#memoryText').value = '';
  await refresh();
});

document.addEventListener('click', async (e) => {
  const id = e.target?.dataset?.workflow;
  if (!id) return;
  e.target.disabled = true;
  try { $('#answer').textContent = JSON.stringify(await api('/api/workflows/run', { method:'POST', body:JSON.stringify({ id, input:{} }) }), null, 2); }
  catch (error) { $('#answer').textContent = `FEHLER: ${error.message}`; }
  finally { e.target.disabled = false; }
});

refresh().catch((error) => { $('#status').textContent = 'OFFLINE'; $('#answer').textContent = error.message; });
