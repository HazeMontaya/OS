const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const state = {
  health: null,
  models: [],
  tools: [],
  workflows: [],
  automations: [],
  mcp: { servers: [] },
  events: [],
  audit: [],
  pendingAction: null
};

const views = {
  command: ['Command Center', 'Chat, tools, approvals and execution state'],
  overview: ['System Overview', 'Runtime state, providers and live topology'],
  agents: ['Agent Center', 'Reasoning, orchestration and execution boundaries'],
  workflows: ['Workflow Builder', 'Declarative tasks and scheduled automation'],
  memory: ['Memory Explorer', 'Local semantic and episodic memory'],
  tools: ['Tools & MCP', 'Capabilities, integrations and external servers'],
  security: ['Security Center', 'Policy decisions, permissions and audit records']
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.payload = data;
    throw error;
  }
  return data;
}

function timeAgo(ts) {
  const delta = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(delta)) return '';
  if (delta < 60_000) return `${Math.max(0, Math.round(delta / 1000))}s`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
}

function renderStats() {
  const h = state.health;
  if (!h) return;
  const stats = [
    ['Models', h.models, 'catalog'],
    ['Tools', h.tools, 'registry'],
    ['Workflows', h.workflows, 'definitions'],
    ['Automations', h.automations, 'triggers'],
    ['MCP', h.mcp, 'servers'],
    ['Memory', h.memory, 'records']
  ];
  const html = stats.map(([label, value, note]) =>
    `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`
  ).join('');
  $('#overviewStats').innerHTML = html;
  $('#quickStats').innerHTML = stats.slice(0, 4).map(([label, value]) =>
    `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
  ).join('');
}

function renderProviders() {
  const providers = state.health?.providers || [];
  $('#providersList').innerHTML = providers.length
    ? providers.map((provider) => `
      <div class="card">
        <div>
          <strong>${esc(provider.id)}</strong>
          <p>${esc(provider.transport)} · ${esc(provider.defaultModel || 'model not selected')}</p>
        </div>
        <span class="badge ${provider.available ? 'good' : ''}">${provider.available ? 'ready' : 'offline'}</span>
      </div>`).join('')
    : '<div class="card"><div><strong>No providers configured</strong><p>Add provider transports in Config/OS/runtime.json.</p></div></div>';

  $('#provider').innerHTML =
    '<option value="">Provider automatisch</option>' +
    providers.map((provider) =>
      `<option value="${esc(provider.id)}" ${provider.available ? '' : 'disabled'}>${esc(provider.id)}${provider.available ? '' : ' · unavailable'}</option>`
    ).join('');

  const available = providers.filter((provider) => provider.available).length;
  $('#providerStatus').textContent = `${available}/${providers.length} provider ready`;
}

function renderModels() {
  $('#model').innerHTML =
    '<option value="">Modell automatisch</option>' +
    state.models.filter((model) => model.selectable !== false).map((model) =>
      `<option value="${esc(model.id)}">${esc(model.name)} · ${esc(model.provider)}</option>`
    ).join('');
}

function renderTools() {
  $('#toolsList').innerHTML = state.tools.length
    ? state.tools.map((tool) => `
      <div class="card">
        <div>
          <strong>${esc(tool.name)}</strong>
          <p>${esc(tool.description || '')}</p>
        </div>
        <span class="badge ${tool.mutating ? '' : 'good'}">${esc(tool.capability || 'read')}</span>
      </div>`).join('')
    : '<div class="card"><div><strong>No tools registered</strong></div></div>';
}

function workflowCard(item, automation = false) {
  const id = esc(item.id);
  const description = automation
    ? `${item.workflow || 'no workflow'}${item.everyMs ? ` · every ${Math.round(item.everyMs / 60000)} min` : ''}`
    : `${item.description || ''}${item.stepCount != null ? ` · ${item.stepCount} steps` : ''}`;
  return `
    <div class="card">
      <div><strong>${esc(item.name || item.id)}</strong><p>${esc(description)}</p></div>
      <div class="card-actions">
        <button class="ghost" data-${automation ? 'automation' : 'workflow'}="${id}">Run</button>
      </div>
    </div>`;
}

function renderWorkflows() {
  $('#workflowsList').innerHTML = state.workflows.length
    ? state.workflows.map((item) => workflowCard(item, false)).join('')
    : '<div class="card"><div><strong>No workflows</strong><p>Add JSON definitions under Workspace/Workflows.</p></div></div>';
  $('#automationsList').innerHTML = state.automations.length
    ? state.automations.map((item) => workflowCard(item, true)).join('')
    : '<div class="card"><div><strong>No automations</strong><p>Add JSON definitions under Workspace/Automations.</p></div></div>';
}

function renderMcp() {
  const servers = state.mcp?.servers || [];
  $('#mcpList').innerHTML = servers.length
    ? servers.map((server) => `
      <div class="card">
        <div><strong>${esc(server.id)}</strong><p>${esc(server.command || 'command missing')}</p></div>
        <span class="badge ${server.running ? 'good' : ''}">${server.running ? 'running' : server.enabled ? 'configured' : 'disabled'}</span>
      </div>`).join('')
    : '<div class="card"><div><strong>No MCP servers</strong><p>Register servers in Workspace/MCP/servers.json.</p></div></div>';
}

function eventHtml(event) {
  const payload = event.payload && Object.keys(event.payload).length ? JSON.stringify(event.payload) : '';
  return `
    <div class="activity">
      <span class="pulse"></span>
      <div><strong>${esc(event.type || event.action || 'event')}</strong><p>${esc(payload || event.error || '')}</p></div>
      <time>${esc(timeAgo(event.ts))}</time>
    </div>`;
}

function renderActivity() {
  const content = state.events.length
    ? state.events.map(eventHtml).join('')
    : '<div class="card"><div><strong>No runtime events yet</strong></div></div>';
  $('#activityMini').innerHTML = state.events.slice(0, 7).map(eventHtml).join('') || content;
  $('#activityFull').innerHTML = content;
  $('#auditList').innerHTML = state.audit.length
    ? state.audit.map((record) => eventHtml({ type: record.action, payload: record, ts: record.ts })).join('')
    : '<div class="card"><div><strong>No audit records yet</strong></div></div>';
}

function renderPolicy() {
  const policy = state.health?.policy || {};
  const rows = [
    ['Mode', state.health?.mode || 'unknown'],
    ['File writes', policy.allowWriteInsideRoot ? 'allowed' : 'blocked'],
    ['Shell', policy.allowShell ? 'allowed' : 'blocked'],
    ['Network tools', policy.allowNetworkTools ? 'allowed' : 'blocked'],
    ['Mutation approval', policy.requireApprovalForMutations ? 'required' : 'not required'],
    ['Shell allowlist', policy.allowedShellCommands?.length ? policy.allowedShellCommands.join(', ') : 'empty']
  ];
  $('#policyList').innerHTML = rows.map(([label, value]) =>
    `<div class="detail"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
  ).join('');
}

function renderAgent() {
  const h = state.health;
  const rows = [
    ['Mode', h?.mode || 'unknown'],
    ['Tool iterations', '8 max'],
    ['Tools', h?.tools ?? 0],
    ['Memory records', h?.memory ?? 0],
    ['Approval gate', h?.policy?.requireApprovalForMutations ? 'on' : 'off'],
    ['Provider routing', 'fallback enabled']
  ];
  $('#agentDetails').innerHTML = rows.map(([label, value]) =>
    `<div class="detail"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
  ).join('');
}

function renderTopology() {
  const host = $('#topology');
  if (!host || !state.health) return;
  host.innerHTML = '';
  const nodes = [
    { name: 'OS Core', meta: state.health.mode, x: 50, y: 50, core: true },
    { name: 'Models', meta: `${state.health.models} cataloged`, x: 14, y: 19 },
    { name: 'Memory', meta: `${state.health.memory} records`, x: 76, y: 18 },
    { name: 'Tools', meta: `${state.health.tools} registered`, x: 13, y: 72 },
    { name: 'Workflows', meta: `${state.health.workflows} definitions`, x: 74, y: 73 },
    { name: 'MCP', meta: `${state.health.mcp} servers`, x: 44, y: 83 }
  ];

  const width = host.clientWidth || 600;
  const height = host.clientHeight || 330;
  const points = [];
  for (const node of nodes) {
    const element = document.createElement('div');
    element.className = `topology-node${node.core ? ' core' : ''}`;
    element.innerHTML = `<strong>${esc(node.name)}</strong><span>${esc(node.meta)}</span>`;
    element.style.left = `calc(${node.x}% - 53px)`;
    element.style.top = `calc(${node.y}% - 27px)`;
    host.appendChild(element);
    points.push({ x: width * node.x / 100, y: height * node.y / 100 });
  }
  const core = points[0];
  for (const target of points.slice(1)) {
    const dx = target.x - core.x;
    const dy = target.y - core.y;
    const line = document.createElement('div');
    line.className = 'topology-line';
    line.style.left = `${core.x}px`;
    line.style.top = `${core.y}px`;
    line.style.width = `${Math.hypot(dx, dy)}px`;
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    host.insertBefore(line, host.firstChild);
  }
}

async function loadMemory(query = '') {
  const items = await api(`/api/memory?limit=100&q=${encodeURIComponent(query)}`);
  $('#memoryList').innerHTML = items.length
    ? items.map((item) => `
      <div class="memory-item">
        <p>${esc(item.text)}</p>
        <small>${esc(item.type)} · ${esc(item.source)} · ${esc(new Date(item.ts).toLocaleString())}</small>
      </div>`).join('')
    : '<div class="card"><div><strong>No matching memory</strong></div></div>';
}

async function refresh() {
  const [health, models, tools, workflows, automations, mcp, events, audit] = await Promise.all([
    api('/api/health'),
    api('/api/models'),
    api('/api/tools'),
    api('/api/workflows'),
    api('/api/automations'),
    api('/api/mcp'),
    api('/api/events?limit=100'),
    api('/api/audit?limit=100')
  ]);
  Object.assign(state, { health, models, tools, workflows, automations, mcp, events, audit });
  $('#connectionDot').classList.add('online');
  $('#connectionLabel').textContent = 'Online';
  $('#versionLabel').textContent = `OS ${health.version}`;
  $('#modeBadge').textContent = health.mode;
  renderStats();
  renderProviders();
  renderModels();
  renderTools();
  renderWorkflows();
  renderMcp();
  renderActivity();
  renderPolicy();
  renderAgent();
  renderTopology();
}

function showError(error) {
  $('#answer').textContent = `FEHLER: ${error.message}`;
  $('#answerMeta').textContent = error.code || `HTTP ${error.status || '?'}`;
}

function showView(name) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  $$('.view').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === name));
  const [title, subtitle] = views[name] || views.command;
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle;
  if (name === 'overview') requestAnimationFrame(renderTopology);
}

async function runWithApproval(url, payload, description) {
  try {
    return await api(url, { method: 'POST', body: JSON.stringify(payload) });
  } catch (error) {
    if (error.status !== 409 || error.code !== 'APPROVAL_REQUIRED') throw error;
    if (!window.confirm(`${description}\n\nDiese Aktion benötigt eine explizite Freigabe. Ausführen?`)) {
      throw new Error('Aktion nicht freigegeben');
    }
    return api(url, { method: 'POST', body: JSON.stringify({ ...payload, approved: true }) });
  }
}

$('#nav').addEventListener('click', (event) => {
  const item = event.target.closest('[data-view]');
  if (item) showView(item.dataset.view);
});

$('#refreshButton').addEventListener('click', async () => {
  const button = $('#refreshButton');
  button.disabled = true;
  try { await refresh(); } catch (error) { showError(error); }
  finally { button.disabled = false; }
});

$('#chatForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  state.pendingAction = null;
  $('#approvalCard').classList.add('hidden');
  $('#answer').textContent = 'OS arbeitet…';
  $('#answerMeta').textContent = 'running';
  try {
    const result = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: $('#prompt').value,
        provider: $('#provider').value || undefined,
        model: $('#model').value || undefined,
        remember: $('#remember').checked
      })
    });
    $('#answer').textContent = result.answer || JSON.stringify(result, null, 2);
    $('#answerMeta').textContent = [result.provider, result.model].filter(Boolean).join(' · ') || 'completed';
    if (result.pendingAction) {
      state.pendingAction = result.pendingAction;
      $('#approvalReason').textContent = `${result.pendingAction.reason || 'Mutating action'} · ${result.pendingAction.tool}`;
      $('#approvalCard').classList.remove('hidden');
    }
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
});

$('#approveButton').addEventListener('click', async () => {
  if (!state.pendingAction) return;
  const button = $('#approveButton');
  button.disabled = true;
  try {
    const result = await api('/api/tool', {
      method: 'POST',
      body: JSON.stringify({
        tool: state.pendingAction.tool,
        args: state.pendingAction.args || {},
        approved: true
      })
    });
    $('#answer').textContent = JSON.stringify(result.result, null, 2);
    $('#answerMeta').textContent = `${state.pendingAction.tool} approved`;
    state.pendingAction = null;
    $('#approvalCard').classList.add('hidden');
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
});

$('#memoryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = $('#memoryText').value.trim();
  if (!text) return;
  try {
    await api('/api/memory', {
      method: 'POST',
      body: JSON.stringify({ text, type: 'semantic', source: 'ui' })
    });
    $('#memoryText').value = '';
    await loadMemory($('#memorySearch').value);
    await refresh();
  } catch (error) {
    showError(error);
  }
});

let searchTimer;
$('#memorySearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadMemory($('#memorySearch').value).catch(showError), 180);
});

document.addEventListener('click', async (event) => {
  const workflow = event.target.closest('[data-workflow]');
  const automation = event.target.closest('[data-automation]');
  if (!workflow && !automation) return;
  const button = workflow || automation;
  button.disabled = true;
  try {
    const result = workflow
      ? await runWithApproval('/api/workflows/run', { id: workflow.dataset.workflow, input: {} }, `Workflow ${workflow.dataset.workflow}`)
      : await runWithApproval('/api/automations/run', { id: automation.dataset.automation }, `Automation ${automation.dataset.automation}`);
    $('#answer').textContent = JSON.stringify(result, null, 2);
    $('#answerMeta').textContent = 'completed';
    showView('command');
    await refresh();
  } catch (error) {
    showError(error);
    showView('command');
  } finally {
    button.disabled = false;
  }
});

$('#discoverMcp').addEventListener('click', async () => {
  const button = $('#discoverMcp');
  if (!window.confirm('MCP-Server starten und Tools entdecken? Dies kann lokale Prozesse ausführen.')) return;
  button.disabled = true;
  try {
    const result = await api('/api/mcp/discover', {
      method: 'POST',
      body: JSON.stringify({ approved: true })
    });
    $('#answer').textContent = JSON.stringify(result, null, 2);
    $('#answerMeta').textContent = 'MCP discovery';
    await refresh();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
});

window.addEventListener('resize', () => {
  if ($('[data-view-panel="overview"]').classList.contains('active')) renderTopology();
});

Promise.all([refresh(), loadMemory()])
  .catch((error) => {
    $('#connectionDot').classList.remove('online');
    $('#connectionLabel').textContent = 'Offline';
    showError(error);
  });

setInterval(() => refresh().catch(() => {}), 15_000);
