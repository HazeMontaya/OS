
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let settings={}, status={}, currentFile=null, chatHistory=[];
const titles={
 dashboard:["Dashboard","Dein gesamtes OS auf einen Blick."],
 chat:["Chat","Ein Interface für lokale KI, Claude, Codex und OpenCode."],
 vault:["Vault & Dateien","Wissen und Dateien direkt in OS verwalten."],
 memory:["Memory","Durchsuchen, ergänzen und konsolidieren."],
 agents:["Agenten","Rollen, Zuständigkeiten und Berechtigungen."],
 skills:["Skills","Wiederverwendbare Fähigkeiten von OS."],
 models:["Modelle","Lokale und Cloud-Engines verwalten."],
 mcp:["MCP & Tools","Externe Systeme und Werkzeuge anbinden."],
 automations:["Automationen","Wiederkehrende Aufgaben ausführen."],
 visual:["Visualisierung","Live-Ansicht deiner OS-Architektur."],
 improve:["OS verbessern","Systemanalyse, Snapshots und Improvement Queue."],
 develop:["Develop","OS plant, entwickelt, testet und reviewt sich in isolierten Sandboxes."],
 capabilities:["Capabilities","OS entdeckt, bewertet, erschließt und erzeugt Fähigkeiten dynamisch."],
 reference:["Reference Lab","PersonalJarvis als MIT-Referenz analysieren und gezielt in OS überführen."],
 settings:["Einstellungen","OS vollständig individualisieren."],
 system:["System","Status, Logs, Entwicklerkonsole und Wartung."]
};
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function toast(msg,bad=false){const t=$("#toast");t.textContent=msg;t.style.borderColor=bad?"var(--bad)":"var(--line)";t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function fmtBytes(n){if(!n)return"0 B";const u=["B","KB","MB","GB","TB"];let i=0;while(n>1024&&i<u.length-1){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}
function setTheme(){
 const a=settings.appearance||{};
 document.documentElement.style.setProperty("--accent",a.accent||"#b9a7ff");
 document.body.dataset.theme=a.theme||"dark";
}
async function refreshAll(){status=await osAPI.status();settings=await osAPI.getSettings();setTheme();$("#version").textContent="v"+status.version;$("#healthDot").style.background=Object.values(status.components).some(Boolean)?"var(--good)":"var(--warn)"}
function nav(page){
 $$("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 $("#pageTitle").textContent=titles[page][0];$("#pageSub").textContent=titles[page][1];
 render(page);
}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("button[data-page]");if(b)nav(b.dataset.page)});
$("#refreshBtn").onclick=async()=>{await refreshAll();const p=$("#nav button.active").dataset.page;render(p);toast("Aktualisiert")};

async function render(page){
 const c=$("#content");c.innerHTML='<div class="card"><span class="loader"></span> Wird geladen…</div>';
 try{
  if(page==="dashboard") return renderDashboard();
  if(page==="chat") return renderChat();
  if(page==="vault") return renderVault("Vault");
  if(page==="memory") return renderMemory();
  if(page==="agents") return renderCollection("Agents","Agenten");
  if(page==="skills") return renderCollection("Skills","Skills");
  if(page==="models") return renderModels();
  if(page==="mcp") return renderMCP();
  if(page==="automations") return renderAutomations();
  if(page==="visual") return renderVisual();
  if(page==="improve") return renderImprove();
  if(page==="develop") return renderDevelop();
  if(page==="capabilities") return renderCapabilities();
  if(page==="reference") return renderReference();
  if(page==="settings") return renderSettings();
  if(page==="system") return renderSystem();
 }catch(e){c.innerHTML=`<div class="card"><b>Fehler</b><pre class="log">${esc(e.message)}</pre></div>`}
}
function compRows(){
 return Object.entries(status.components).map(([k,v])=>`<div class="status"><span>${esc(k)}</span><i class="dot ${v?"ok":"bad"}"></i></div>`).join("");
}
function renderDashboard(){
 $("#content").innerHTML=`
 <div class="grid">
  <div class="card metric"><div class="n">${status.counts?.agents||0}</div><div class="label">Agenten</div></div>
  <div class="card metric"><div class="n">${status.counts?.skills||0}</div><div class="label">Skills</div></div>
  <div class="card metric"><div class="n">${status.counts?.memory||0}</div><div class="label">Memory-Dateien</div></div>
  <div class="card metric"><div class="n">${status.counts?.proposals||0}</div><div class="label">Verbesserungen</div></div>
  <div class="card span6"><h3>Komponenten</h3><div class="status-list">${compRows()}</div></div>
  <div class="card span6"><h3>Schnellaktionen</h3><div class="quick">
   <button class="ghost" onclick="go('chat')">✦ OS fragen</button>
   <button class="ghost" onclick="go('vault')">⌘ Vault öffnen</button>
   <button class="ghost" onclick="snap()">◫ Snapshot</button>
   <button class="ghost" onclick="go('improve')">↗ OS analysieren</button>
  </div></div>
  <div class="card span8"><h3>OS Status</h3>
    <div class="row wrap small"><span class="badge">Root ${esc(status.root)}</span><span class="badge">${esc(status.hostname)}</span><span class="badge">${status.ramGB} GB RAM</span><span class="badge">${esc(status.platform)} / ${esc(status.arch)}</span></div>
    <p class="muted small">OS ist provider-neutral. Daten, Agents und Skills bleiben unter S:\\OS; Engines können ausgetauscht werden.</p>
  </div>
  <div class="card span4"><h3>Autonomie</h3><div class="n" style="font-size:24px">${esc(settings.autonomy?.preset||"balanced")}</div><p class="muted small">Unter Einstellungen jederzeit änderbar.</p></div>
 </div>`;
}
window.go=nav;
window.snap=async()=>{try{const p=await osAPI.snapshot();toast("Snapshot: "+p)}catch(e){toast(e.message,true)}};

function renderChat(){
 $("#content").innerHTML=`<div class="card chat">
  <div class="messages" id="messages">${chatHistory.map(m=>bubble(m)).join("")}</div>
  <div class="composer"><textarea id="prompt" placeholder="Sag OS, was erledigt werden soll…"></textarea><button class="primary" id="send">Senden</button></div>
 </div>`;
 $("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat()}});
 $("#send").onclick=sendChat;setTimeout(()=>{$("#messages").scrollTop=$("#messages").scrollHeight},10);
}
function bubble(m){return `<div class="bubble ${m.role}"><span class="tag">${esc(m.engine||m.role)}</span>${esc(m.content)}</div>`}
async function sendChat(){
 const p=$("#prompt").value.trim();if(!p)return;const engine=$("#quickEngine").value;
 chatHistory.push({role:"user",content:p,engine:"du"});$("#messages").insertAdjacentHTML("beforeend",bubble(chatHistory.at(-1)));
 $("#prompt").value="";$("#send").disabled=true;$("#send").innerHTML='<span class="loader"></span>';
 try{
   const r=await osAPI.runEngine(engine,p,{messages:chatHistory.filter(x=>x.engine==="local").map(x=>({role:x.role==="assistant"?"assistant":"user",content:x.content}))});
   const m={role:"assistant",content:r.text||"(keine Ausgabe)",engine:r.engine};chatHistory.push(m);$("#messages").insertAdjacentHTML("beforeend",bubble(m));
 }catch(e){$("#messages").insertAdjacentHTML("beforeend",bubble({role:"assistant",content:"Fehler: "+e.message,engine:"system"}))}
 $("#send").disabled=false;$("#send").textContent="Senden";$("#messages").scrollTop=$("#messages").scrollHeight;
}

async function renderVault(root="Vault"){
 const items=(await osAPI.tree(root)).filter(x=>x.type==="file"&&/\.(md|txt|json|js|ps1|yaml|yml|css|html)$/i.test(x.name));
 $("#content").innerHTML=`<div class="split">
  <div class="list-panel"><div class="panel-head"><input id="filterFiles" placeholder="Dateien filtern…"></div><div class="file-list" id="files">${items.map(i=>`<div class="file-item" data-path="${esc(i.path)}">${esc(i.path.replace(root+"\\",""))}</div>`).join("")}</div></div>
  <div class="editor-panel"><div class="editor-title" id="editorTitle">Datei auswählen</div><textarea id="editor" disabled></textarea><div class="editor-actions"><button class="ghost" id="openFolder">Ordner öffnen</button><button class="primary" id="saveFile" disabled>Speichern</button></div></div>
 </div>`;
 $("#filterFiles").oninput=e=>{$$(".file-item").forEach(x=>x.style.display=x.textContent.toLowerCase().includes(e.target.value.toLowerCase())?"":"none")};
 $$(".file-item").forEach(el=>el.onclick=async()=>{currentFile=el.dataset.path;$$(".file-item").forEach(x=>x.classList.remove("sel"));el.classList.add("sel");$("#editor").disabled=false;$("#saveFile").disabled=false;$("#editorTitle").textContent=currentFile;$("#editor").value=await osAPI.readFile(currentFile)});
 $("#saveFile").onclick=async()=>{if(!currentFile)return;try{await writeWithConfirm(currentFile,$("#editor").value);toast("Gespeichert")}catch(e){toast(e.message,true)}};
 $("#openFolder").onclick=()=>osAPI.openPath(root);
}
async function writeWithConfirm(p,content){
 try{return await osAPI.writeFile(p,content,false)}catch(e){
  if(e.message.includes("CONFIRM_REQUIRED")&&confirm("OS möchte diese Datei ändern. Zulassen?"))return osAPI.writeFile(p,content,true);
  throw e;
 }
}

async function renderMemory(){
 $("#content").innerHTML=`<div class="grid">
  <div class="card span12"><h3>Memory durchsuchen</h3><div class="row"><input class="grow" id="memQ" placeholder="Begriff oder Information…"><button class="primary" id="memSearch">Suchen</button></div></div>
  <div class="card span7"><h3>Ergebnisse</h3><div id="memResults" class="muted small">Noch keine Suche.</div></div>
  <div class="card span5"><h3>Memory hinzufügen</h3><input id="memTitle" placeholder="Titel" style="width:100%;margin-bottom:8px"><textarea id="memText" placeholder="Information…" style="width:100%;height:180px"></textarea><button class="primary" id="memAdd" style="margin-top:8px">Speichern</button></div>
 </div>`;
 $("#memSearch").onclick=async()=>{const r=await osAPI.search($("#memQ").value);$("#memResults").innerHTML=r.length?r.map(x=>`<div class="item-card" style="margin-bottom:8px"><b>${esc(x.path)}</b><p>${esc(x.snippet)}</p></div>`).join(""):"Keine Treffer."};
 $("#memAdd").onclick=async()=>{const title=$("#memTitle").value.trim()||"Memory";const text=$("#memText").value.trim();if(!text)return;const fn=new Date().toISOString().slice(0,10)+"-"+title.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,"-")+".md";const content=`# ${title}\n\nDatum: ${new Date().toISOString()}\n\n${text}\n`;try{await writeWithConfirm("Vault\\10-Memory\\"+fn,content);toast("Memory gespeichert");$("#memText").value=""}catch(e){toast(e.message,true)}};
}

async function renderCollection(root,label){
 const items=(await osAPI.tree(root)).filter(x=>x.type==="file"&&x.name.toLowerCase().endsWith(".md"));
 $("#content").innerHTML=`<div class="row" style="margin-bottom:14px"><button class="primary" id="newItem">+ ${esc(label.slice(0,-1)||label)}</button><button class="ghost" id="openRoot">Ordner öffnen</button></div><div class="cards">${items.map(i=>`<div class="item-card"><h3>${esc(i.name.replace(".md",""))}</h3><p>${esc(i.path)}</p><button class="ghost editItem" data-path="${esc(i.path)}">Bearbeiten</button></div>`).join("")||'<div class="card">Noch keine Einträge.</div>'}</div>`;
 $("#openRoot").onclick=()=>osAPI.openPath(root);
 $("#newItem").onclick=async()=>{const name=prompt(`Name für ${label}:`);if(!name)return;const file=(root==="Skills"?`${root}\\${name}\\SKILL.md`:`${root}\\${name}.md`);const content=`# ${name}\n\n## Zweck\n\n## Regeln\n\n## Fähigkeiten\n`;try{await writeWithConfirm(file,content);toast("Erstellt");renderCollection(root,label)}catch(e){toast(e.message,true)}};
 $$(".editItem").forEach(b=>b.onclick=async()=>{nav(root==="Agents"?"agents":"skills");setTimeout(async()=>{await renderVault(root);const el=$(`.file-item[data-path="${CSS.escape(b.dataset.path)}"]`);if(el)el.click()},50)});
}

async function renderModels(){
 let models=[];try{models=await osAPI.listModels()}catch{}
 $("#content").innerHTML=`<div class="grid">
  <div class="card span5"><h3>Engines</h3><div class="status-list">${compRows()}</div><p class="muted small">Claude, Codex und OpenCode werden über ihre offiziellen CLIs innerhalb von OS angesteuert.</p></div>
  <div class="card span7"><h3>Lokale Ollama-Modelle</h3><div>${models.map(m=>`<div class="model"><div><strong>${esc(m.name)}</strong><div class="meta">${esc(m.details?.parameter_size||"")} · ${fmtBytes(m.size)}</div></div><span class="badge">${esc(m.details?.quantization_level||"lokal")}</span></div>`).join("")||'<span class="muted small">Keine Modelle gefunden / Ollama nicht aktiv.</span>'}</div>
  <div class="row" style="margin-top:12px"><input id="pullName" class="grow" placeholder="z. B. qwen3-coder"><button class="primary" id="pullBtn">Modell laden</button></div></div>
 </div>`;
 $("#pullBtn").onclick=async()=>{const m=$("#pullName").value.trim();if(!m)return;$("#pullBtn").disabled=true;$("#pullBtn").innerHTML='<span class="loader"></span>';try{await osAPI.pullModel(m);toast("Modell geladen");renderModels()}catch(e){toast(e.message,true)}};
}

async function renderMCP(){
 let reg={version:1,servers:[],policy:{default:"disabled",external_write:"ask",destructive:"ask"}};
 try{reg=JSON.parse(await osAPI.readFile("MCP\\Registry\\mcp-registry.json"))}catch{}
 $("#content").innerHTML=`<div class="grid">
 <div class="card span7"><h3>MCP Registry</h3><table class="table"><thead><tr><th>Name</th><th>Typ</th><th>Status</th><th>Adresse/Befehl</th></tr></thead><tbody>${(reg.servers||[]).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.type||"")}</td><td>${esc(s.enabled?"aktiv":"aus")}</td><td>${esc(s.url||s.command||"")}</td></tr>`).join("")||'<tr><td colspan="4" class="muted">Noch keine MCP-Server registriert.</td></tr>'}</tbody></table></div>
 <div class="card span5"><h3>Connector hinzufügen</h3><input id="mName" placeholder="Name" style="width:100%;margin-bottom:8px"><select id="mType" style="width:100%;margin-bottom:8px"><option value="http">HTTP</option><option value="stdio">stdio</option></select><input id="mAddr" placeholder="URL oder Befehl" style="width:100%;margin-bottom:8px"><button class="primary" id="mAdd">Hinzufügen</button><p class="muted small">Secrets werden hier nicht gespeichert. OAuth/API-Schlüssel gehören in sichere Credential-Stores.</p></div>
 </div>`;
 $("#mAdd").onclick=async()=>{const name=$("#mName").value.trim(),type=$("#mType").value,addr=$("#mAddr").value.trim();if(!name||!addr)return;reg.servers=reg.servers||[];reg.servers.push({name,type,enabled:false,...(type==="http"?{url:addr}:{command:addr})});try{await writeWithConfirm("MCP\\Registry\\mcp-registry.json",JSON.stringify(reg,null,2));toast("MCP registriert");renderMCP()}catch(e){toast(e.message,true)}};
}

async function renderAutomations(){
 const list=await osAPI.listAutomations();
 $("#content").innerHTML=`<div class="grid">
 <div class="card span7"><h3>Automationen</h3>${list.map(a=>`<div class="model"><div><strong>${esc(a.name)}</strong><div class="meta">${esc(a.engine||"auto")} · alle ${a.intervalMinutes||"-"} Min · ${a.enabled?"aktiv":"aus"}</div></div><div class="row"><button class="ghost runAuto" data-id="${esc(a.id)}">Jetzt</button><button class="ghost delAuto danger" data-id="${esc(a.id)}">×</button></div></div>`).join("")||'<span class="muted small">Keine Automationen.</span>'}</div>
 <div class="card span5"><h3>Neue Automation</h3><input id="aName" placeholder="Name" style="width:100%;margin-bottom:8px"><textarea id="aPrompt" placeholder="Aufgabe…" style="width:100%;height:150px"></textarea><div class="row" style="margin-top:8px"><select id="aEngine"><option>auto</option><option>local</option><option>claude</option><option>codex</option><option>opencode</option></select><input id="aMin" type="number" min="1" value="60" title="Intervall Minuten" style="width:120px"><button class="primary" id="aAdd">Speichern</button></div><p class="muted small">Automationen laufen, solange OS aktiv ist; Autostart kann in Einstellungen aktiviert werden.</p></div>
 </div>`;
 $("#aAdd").onclick=async()=>{const name=$("#aName").value.trim(),prompt=$("#aPrompt").value.trim();if(!name||!prompt)return;list.push({id:crypto.randomUUID(),name,prompt,engine:$("#aEngine").value,intervalMinutes:Number($("#aMin").value)||60,enabled:true,lastRun:null});await osAPI.saveAutomations(list);toast("Automation erstellt");renderAutomations()};
 $$(".runAuto").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await osAPI.runAutomation(b.dataset.id);toast("Automation ausgeführt");renderAutomations()}catch(e){toast(e.message,true)}});
 $$(".delAuto").forEach(b=>b.onclick=async()=>{if(!confirm("Automation löschen?"))return;await osAPI.saveAutomations(list.filter(x=>x.id!==b.dataset.id));renderAutomations()});
}

function renderVisual(){
 const comps=status.components||{}, counts=status.counts||{};
 const node=(x,y,w,h,title,sub,live=true)=>`<g class="node ${live?"live":""}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x+14}" y="${y+24}">${esc(title)}</text><text class="subt" x="${x+14}" y="${y+42}">${esc(sub)}</text></g>`;
 $("#content").innerHTML=`<div class="graph-wrap"><svg viewBox="0 0 1100 600">
 <line class="edge" x1="550" y1="105" x2="550" y2="180"/><line class="edge" x1="550" y1="235" x2="240" y2="320"/><line class="edge" x1="550" y1="235" x2="550" y2="320"/><line class="edge" x1="550" y1="235" x2="860" y2="320"/>
 <line class="edge" x1="240" y1="375" x2="340" y2="475"/><line class="edge" x1="550" y1="375" x2="550" y2="475"/><line class="edge" x1="860" y1="375" x2="760" y2="475"/>
 ${node(455,50,190,55,"OS Interface","Desktop + Settings",true)}
 ${node(455,180,190,55,"Supervisor","Routing + Permissions",true)}
 ${node(145,320,190,55,"Local AI",settings.engines?.localModel||"Ollama",comps.ollama)}
 ${node(455,320,190,55,"Cloud Engines",`Claude ${comps.claude?"●":"○"} · Codex ${comps.codex?"●":"○"}`,comps.claude||comps.codex)}
 ${node(765,320,190,55,"OpenCode","Model-neutral agent",comps.opencode)}
 ${node(245,475,190,55,"Memory / Vault",`${counts.memory||0} memories`,true)}
 ${node(455,475,190,55,"Agents + Skills",`${counts.agents||0} + ${counts.skills||0}`,true)}
 ${node(665,475,190,55,"MCP / Tools","External capabilities",true)}
 </svg></div>`;
}

async function renderImprove(){
 const items=(await osAPI.tree("Workspaces\\Improvement-Queue")).filter(x=>x.type==="file"&&x.name.endsWith(".md")).reverse().slice(0,20);
 $("#content").innerHTML=`<div class="grid">
  <div class="card span5"><h3>Self-Improvement</h3><p class="muted small">OS erstellt zuerst einen Snapshot und danach eine Analyse. Produktive Core-Dateien werden dabei nicht automatisch verändert.</p><div class="row"><select id="impEngine"><option value="auto">Auto</option><option value="claude">Claude</option><option value="codex">Codex</option><option value="opencode">OpenCode</option><option value="local">Lokal</option></select><button class="primary" id="impRun">System analysieren</button></div><button class="ghost" id="impSnap" style="margin-top:10px">Nur Snapshot erstellen</button></div>
  <div class="card span7"><h3>Improvement Queue</h3>${items.map(i=>`<div class="model"><div><strong>${esc(i.name)}</strong><div class="meta">${esc(i.path)}</div></div><button class="ghost openImp" data-path="${esc(i.path)}">Öffnen</button></div>`).join("")||'<span class="muted small">Noch keine Reviews.</span>'}</div>
 </div>`;
 $("#impRun").onclick=async()=>{$("#impRun").disabled=true;$("#impRun").innerHTML='<span class="loader"></span> Analysiert';try{const r=await osAPI.selfReview($("#impEngine").value);toast("Review erstellt: "+r.file);renderImprove()}catch(e){toast(e.message,true);$("#impRun").disabled=false;$("#impRun").textContent="System analysieren"}};
 $("#impSnap").onclick=window.snap;$$(".openImp").forEach(b=>b.onclick=()=>osAPI.openPath(b.dataset.path));
}

function permissionSelect(key,label,desc){
 const v=settings.autonomy?.[key]||"ask";
 return `<div class="setting"><div><b>${label}</b><p>${desc}</p></div><select data-set="autonomy.${key}"><option value="allow" ${v==="allow"?"selected":""}>Automatisch erlauben</option><option value="ask" ${v==="ask"?"selected":""}>Nachfragen</option><option value="deny" ${v==="deny"?"selected":""}>Blockieren</option></select></div>`;
}
function renderSettings(){
 const a=settings.appearance||{}, au=settings.autonomy||{}, en=settings.engines||{}, at=settings.automation||{};
 $("#content").innerHTML=`<div class="card">
 <h3>Individualisierung</h3>
 <div class="setting"><div><b>Akzentfarbe</b><p>Hauptfarbe der OS-Oberfläche.</p></div><input type="color" data-set="appearance.accent" value="${esc(a.accent||"#b9a7ff")}"></div>
 <div class="setting"><div><b>Standard-Engine</b><p>OS kann automatisch routen oder eine Engine bevorzugen.</p></div><select data-set="engines.default"><option ${en.default==="auto"?"selected":""}>auto</option><option ${en.default==="local"?"selected":""}>local</option><option ${en.default==="claude"?"selected":""}>claude</option><option ${en.default==="codex"?"selected":""}>codex</option><option ${en.default==="opencode"?"selected":""}>opencode</option></select></div>
 <div class="setting"><div><b>Lokales Modell</b><p>Ollama-Modell für private/offline Aufgaben.</p></div><input data-set="engines.localModel" value="${esc(en.localModel||"gemma3:4b")}"></div>
 <div class="setting"><div><b>Autonomie-Preset</b><p>Schnellprofil; Einzelrechte darunter bleiben anpassbar.</p></div><select id="preset"><option value="safe" ${au.preset==="safe"?"selected":""}>Sicher</option><option value="balanced" ${au.preset==="balanced"?"selected":""}>Ausgewogen</option><option value="full" ${au.preset==="full"?"selected":""}>Vollzugriff / Developer</option></select></div>
 ${permissionSelect("fileWrite","Dateien schreiben","Änderungen innerhalb von S:\\OS.")}
 ${permissionSelect("shell","Shell / PowerShell","Beliebige lokale Befehle aus der Developer-Konsole.")}
 ${permissionSelect("external","Externe Aktionen","Connector-/MCP-Schreibaktionen.")}
 ${permissionSelect("delete","Löschen","Dateien und Daten entfernen.")}
 ${permissionSelect("selfImprove","Self-Improvement","Eigene Systemänderungen vorbereiten.")}
 <div class="setting"><div><b>Automationen beim Login</b><p>OS im Hintergrund mit Windows starten.</p></div><select data-set="automation.backgroundAtLogin"><option value="false" ${!at.backgroundAtLogin?"selected":""}>Aus</option><option value="true" ${at.backgroundAtLogin?"selected":""}>An</option></select></div>
 <div style="margin-top:16px;text-align:right"><button class="primary" id="saveSettings">Einstellungen speichern</button></div>
 </div>`;
 $("#preset").onchange=e=>{
   settings.autonomy=settings.autonomy||{};settings.autonomy.preset=e.target.value;
   const p=e.target.value;
   const val=p==="safe"?"deny":p==="full"?"allow":"ask";
   ["fileWrite","shell","external","delete","selfImprove"].forEach(k=>settings.autonomy[k]=val);
   renderSettings();
 };
 $("#saveSettings").onclick=async()=>{
  $$("[data-set]").forEach(el=>{
    const [a,b]=el.dataset.set.split(".");settings[a]=settings[a]||{};
    let v=el.value;if(v==="true")v=true;if(v==="false")v=false;settings[a][b]=v;
  });
  await osAPI.saveSettings(settings);setTheme();toast("Einstellungen gespeichert");
 };
}

async function renderSystem(){
 const activity=await osAPI.activity();
 $("#content").innerHTML=`<div class="grid">
 <div class="card span5"><h3>Wartung</h3><div class="quick"><button class="ghost" id="sysSnap">Snapshot</button><button class="ghost" id="openLogs">Logs öffnen</button><button class="ghost" id="openRoot">S:\\OS öffnen</button><button class="ghost" id="healthRefresh">Status prüfen</button></div><h3 style="margin-top:18px">Developer-Konsole</h3><input id="cmd" placeholder="PowerShell-Befehl" style="width:100%"><button class="primary" id="cmdRun" style="margin-top:8px">Ausführen</button><pre class="log" id="cmdOut" style="margin-top:10px">Bereit.</pre></div>
 <div class="card span7"><h3>Aktivität</h3><div class="log">${activity.map(a=>`[${esc(a.ts)}] ${esc(a.type)} ${esc(a.engine||a.name||a.path||"")}`).join("\n")||"Noch keine Aktivität."}</div></div>
 </div>`;
 $("#sysSnap").onclick=window.snap;$("#openLogs").onclick=()=>osAPI.openPath("Logs");$("#openRoot").onclick=()=>osAPI.openPath("");$("#healthRefresh").onclick=async()=>{await refreshAll();toast("Status aktualisiert")};
 $("#cmdRun").onclick=async()=>{const command=$("#cmd").value.trim();if(!command)return;let confirmed=false;try{let r=await osAPI.command(command,false);$("#cmdOut").textContent=(r.stdout||"")+(r.stderr?"\n"+r.stderr:"")}catch(e){if(e.message.includes("CONFIRM_REQUIRED")&&confirm("Dieser Befehl erhält Shell-Zugriff. Wirklich ausführen?")){confirmed=true;try{let r=await osAPI.command(command,true);$("#cmdOut").textContent=(r.stdout||"")+(r.stderr?"\n"+r.stderr:"")}catch(x){$("#cmdOut").textContent=x.message}}else $("#cmdOut").textContent=e.message}};
}


function stageChip(name,s){
 const st=s?.state||"pending";const label={pending:"offen",running:"läuft",passed:"OK",failed:"FEHLER"}[st]||st;
 return `<div class="dev-stage ${st}"><b>${name}</b><span>${label}</span></div>`;
}
function devProjectCard(p){
 const stages=p.stages||{};
 return `<div class="item-card dev-project" data-id="${esc(p.id)}">
   <div class="row"><h3 class="grow">${esc(p.goal)}</h3><span class="badge">${esc(p.status||"")}</span></div>
   <p>${esc(p.id)}</p>
   <div class="dev-mini">${stageChip("Plan",stages.plan)}${stageChip("Build",stages.build)}${stageChip("Test",stages.test)}${stageChip("Review",stages.review)}</div>
   <button class="ghost openDev" data-id="${esc(p.id)}">Öffnen</button>
 </div>`;
}
async function renderDevelop(){
 const projects=await osAPI.devList();
 $("#content").innerHTML=`<div class="grid">
  <div class="card span5">
   <h3>Neues Entwicklungsziel</h3>
   <textarea id="devGoal" style="width:100%;height:155px" placeholder="z. B. Baue einen visuellen Drag-&-Drop Workflow Builder mit speicherbaren Nodes und Verbindungen."></textarea>
   <div class="row wrap" style="margin-top:9px">
    <label class="tiny muted">Plan <select id="devPlan"><option>auto</option><option>claude</option><option>codex</option><option>opencode</option></select></label>
    <label class="tiny muted">Build <select id="devBuild"><option>auto</option><option>codex</option><option>claude</option><option>opencode</option></select></label>
    <label class="tiny muted">Review <select id="devReview"><option>auto</option><option>claude</option><option>codex</option><option>opencode</option></select></label>
   </div>
   <button class="primary" id="devStart" style="margin-top:12px">Projekt anlegen + planen</button>
   <p class="muted small">Plan und Review sind read-only. Build arbeitet in einem separaten Git-Worktree.</p>
  </div>
  <div class="card span7">
   <h3>Development Pipeline</h3>
   <div class="dev-flow">
    ${stageChip("PLAN")}${stageChip("SANDBOX")}${stageChip("BUILD")}${stageChip("TEST")}${stageChip("REVIEW")}${stageChip("CANDIDATE")}${stageChip("PROMOTE")}
   </div>
   <p class="muted small">Eine Änderung erreicht das laufende OS erst über „Übernehmen & Neustarten“. Vorher bleiben alle Änderungen isoliert.</p>
  </div>
  <div class="card span12"><h3>Development-Projekte</h3><div class="cards">${projects.map(devProjectCard).join("")||'<span class="muted small">Noch kein Entwicklungsprojekt.</span>'}</div></div>
 </div>`;
 $("#devStart").onclick=async()=>{
   const goal=$("#devGoal").value.trim();if(!goal)return toast("Entwicklungsziel eingeben.",true);
   $("#devStart").disabled=true;$("#devStart").innerHTML='<span class="loader"></span> Plant…';
   try{
    const p=await osAPI.devCreate({goal,planEngine:$("#devPlan").value,buildEngine:$("#devBuild").value,reviewEngine:$("#devReview").value});
    await osAPI.devPlan(p.id);toast("Plan erstellt");await openDevProject(p.id);
   }catch(e){toast(e.message,true);renderDevelop()}
 };
 $$(".openDev").forEach(b=>b.onclick=()=>openDevProject(b.dataset.id));
}
async function openDevProject(id){
 const p=await osAPI.devGet(id),s=p.stages||{};
 $("#pageTitle").textContent="Develop · "+p.goal.slice(0,65);
 $("#pageSub").textContent=p.id;
 $("#content").innerHTML=`<div class="grid">
  <div class="card span12">
   <div class="dev-flow large">
    ${stageChip("PLAN",s.plan)}${stageChip("SANDBOX",s.sandbox)}${stageChip("BUILD",s.build)}${stageChip("TEST",s.test)}${stageChip("REVIEW",s.review)}${stageChip("CANDIDATE",s.candidate)}${stageChip("PROMOTE",s.promote)}
   </div>
  </div>
  <div class="card span4"><h3>Ziel</h3><p class="small">${esc(p.goal)}</p>
   <div class="row wrap"><span class="badge">Plan: ${esc(p.engines?.planUsed||p.engines?.plan||"auto")}</span><span class="badge">Build: ${esc(p.engines?.buildUsed||p.engines?.build||"auto")}</span><span class="badge">Review: ${esc(p.engines?.reviewUsed||p.engines?.review||"auto")}</span></div>
   <p class="muted tiny">Branch: ${esc(p.branch||"-")}</p>
  </div>
  <div class="card span8"><h3>Aktionen</h3>
   <div class="row wrap dev-actions">
    <button class="ghost" data-act="plan">1 · Plan neu</button>
    <button class="primary" data-act="build">2 · Entwickeln</button>
    <button class="ghost" data-act="test">3 · Tests</button>
    <button class="ghost" data-act="review">4 · Review</button>
    <button class="ghost" data-act="candidate">5 · Candidate bauen</button>
    <button class="ghost" data-act="launch">▶ Candidate testen</button>
    <button class="primary" data-act="promote">✓ Übernehmen & Neustarten</button>
    <button class="ghost danger" data-act="rollback">↶ Rollback</button>
   </div>
   <div id="devRunState" class="muted small" style="margin-top:12px">Bereit.</div>
  </div>
  <div class="card span6"><h3>Qualität</h3>
   <div class="status-list">
    <div class="status"><span>Tests</span><b>${s.test?.state==="passed"?"BESTANDEN":s.test?.state||"offen"}</b></div>
    <div class="status"><span>Review</span><b>${esc(p.reviewDecision||"offen")}</b></div>
    <div class="status"><span>Candidate</span><b>${s.candidate?.state==="passed"?"BEREIT":"offen"}</b></div>
    <div class="status"><span>Promotion</span><b>${s.promote?.state==="passed"?"AKTIV":"nicht übernommen"}</b></div>
   </div>
  </div>
  <div class="card span6"><h3>Projektdateien</h3>
   <div class="quick">
    <button class="ghost" id="openDevDir">Projektordner</button>
    <button class="ghost" id="openWorktree">Sandbox/Worktree</button>
   </div>
   <p class="muted tiny">${esc(p.worktree||"")}</p>
  </div>
 </div>`;
 $("#openDevDir").onclick=()=>osAPI.openPath("Workspaces\\Development\\"+p.id);
 $("#openWorktree").onclick=()=>osAPI.openPath("Workspaces\\Development\\"+p.id+"\\worktree");
 $$(".dev-actions button").forEach(b=>b.onclick=()=>runDevAction(p.id,b.dataset.act,b));
}
async function runDevAction(id,act,btn){
 const out=$("#devRunState");btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<span class="loader"></span>';
 try{
  out.textContent="OS arbeitet: "+act+" …";
  if(act==="plan")await osAPI.devPlan(id);
  if(act==="build")await osAPI.devBuild(id);
  if(act==="test"){
    const r=await osAPI.devTest(id);if(!r.passed)toast("Tests enthalten Fehler.",true);
  }
  if(act==="review")await osAPI.devReview(id);
  if(act==="candidate")await osAPI.devCandidate(id);
  if(act==="launch"){await osAPI.devLaunchCandidate(id);toast("Candidate gestartet");btn.disabled=false;btn.innerHTML=old;return}
  if(act==="promote"){
    const p=await osAPI.devGet(id);
    let force=false;
    if(p.reviewDecision!=="APPROVE"){
      if(!confirm("Review ist nicht APPROVE. Trotzdem übernehmen?")){btn.disabled=false;btn.innerHTML=old;return}
      force=true;
    }else if(!confirm("Getestete Candidate-Version in das echte OS übernehmen und OS neu starten?")){btn.disabled=false;btn.innerHTML=old;return}
    out.textContent="Promotion + Neustart …";await osAPI.devPromote(id,force);return;
  }
  if(act==="rollback"){
    if(!confirm("Die zuletzt übernommene Änderung dieses Projekts zurückrollen und OS neu starten?")){btn.disabled=false;btn.innerHTML=old;return}
    out.textContent="Rollback + Neustart …";await osAPI.devRollback(id);return;
  }
  toast("Schritt abgeschlossen");await openDevProject(id);
 }catch(e){toast(e.message,true);out.textContent="Fehler: "+e.message;btn.disabled=false;btn.innerHTML=old}
}


async function renderCapabilities(){
 const reg=await osAPI.capsProbe();
 const types={};for(const c of reg.capabilities||[])types[c.type]=(types[c.type]||0)+1;
 const tools=(reg.capabilities||[]).filter(x=>x.type==="executable").slice(0,80);
 $("#content").innerHTML=`<div class="grid">
  <div class="card metric"><div class="n">${reg.capabilities?.length||0}</div><div class="label">entdeckte Capabilities</div></div>
  <div class="card metric"><div class="n">${types.executable||0}</div><div class="label">Executables</div></div>
  <div class="card metric"><div class="n">${types.mcp||0}</div><div class="label">MCP</div></div>
  <div class="card metric"><div class="n">${reg.admin?"JA":"NEIN"}</div><div class="label">Administrator</div></div>
  <div class="card span6"><h3>Capability Architect</h3><textarea id="capGoal" style="width:100%;height:130px" placeholder="Was soll OS können? z. B. lokale Audio-/Videoanalyse, Browsersteuerung, CAD-Dateien verarbeiten…"></textarea><div class="row wrap" style="margin-top:8px"><select id="capEngine"><option>auto</option><option>claude</option><option>codex</option><option>opencode</option></select><button class="ghost" id="capPlan">Methoden analysieren</button><button class="primary" id="capAcquire">Autonom bereitstellen</button></div><pre class="log" id="capOut" style="margin-top:10px">OS entscheidet: nutzen → adaptieren → installieren → verbinden → erzeugen → kombinieren.</pre></div>
    <div class="card span6"><h3>Capability Architect</h3><textarea id="capGoal" style="width:100%;height:130px" placeholder="Was soll OS können? z. B. lokale Audio-/Videoanalyse, Browsersteuerung, CAD-Dateien verarbeiten…"></textarea><div class="row wrap" style="margin-top:8px"><select id="capEngine"><option>auto</option><option>claude</option><option>codex</option><option>opencode</option></select><button class="ghost" id="capPlan">Methoden analysieren</button><button class="primary" id="capAcquire">Autonom bereitstellen</button><button class="ghost" id="capAudit">Audit erstellen</button></div><pre class="log" id="capOut" style="margin-top:10px">OS entscheidet: nutzen → adaptieren → installieren → verbinden → erzeugen → kombinieren.</pre></div>
  <div class="card span6"><h3>Admin / Autonomie</h3><p class="small">Vollzugriff bedeutet: OS kann nach normaler Windows-UAC-Freigabe lokale Software installieren, konfigurieren und Entwicklungswerkzeuge verwenden.</p><div class="row"><span class="badge">${reg.admin?"Administrator aktiv":"normaler Benutzer"}</span><button class="primary" id="elevate" ${reg.admin?"disabled":""}>Als Administrator neu starten</button></div><div class="row" style="margin-top:12px"><select id="pkgMethod"><option>winget</option><option>npm</option><option>pip</option></select><input id="pkgName" class="grow" placeholder="Paket-ID / Paketname"><button class="ghost" id="pkgInstall">Installieren</button></div><p class="muted tiny">UAC wird nicht umgangen. Credential-Dumping, UAC-Bypass und stilles Abschalten von Sicherheitsfunktionen bleiben technisch blockiert.</p></div>
  <div class="card span12"><h3>Entdeckte Werkzeuge</h3><div class="cards">${tools.map(t=>`<div class="item-card"><h3>${esc(t.name)}</h3><p>${esc(t.kind)}<br>${esc(t.version||"")}</p><div class="row"><button class="ghost capInspect" data-id="${esc(t.id)}">Analysieren</button><button class="ghost capAdapt" data-id="${esc(t.id)}">Adapter erzeugen</button></div></div>`).join("")}</div></div>
 </div>`;
 $("#capPlan").onclick=async()=>{const goal=$("#capGoal").value.trim();if(!goal)return;$("#capPlan").disabled=true;$("#capOut").textContent="Analysiere sämtliche verfügbaren Wege…";try{const r=await osAPI.capsPlan(goal,$("#capEngine").value);$("#capOut").textContent=JSON.stringify(r.plan,null,2);toast("Capability Plan erstellt")}catch(e){$("#capOut").textContent=e.message;toast(e.message,true)}finally{$("#capPlan").disabled=false}};
 $("#capAudit").onclick=async()=>{$("#capAudit").disabled=true;$("#capOut").textContent="Erstelle lokalen Capability-Audit…";try{const r=await osAPI.capsAudit();$("#capOut").textContent=JSON.stringify(r,null,2);toast("Capability-Audit erstellt")}catch(e){$("#capOut").textContent=e.message;toast(e.message,true)}finally{$("#capAudit").disabled=false}};
 $("#capAcquire").onclick=async()=>{const goal=$("#capGoal").value.trim();if(!goal)return;$("#capAcquire").disabled=true;$("#capOut").textContent="OS entdeckt, bewertet und stellt Fähigkeiten bereit…";try{const r=await osAPI.capsAutoAcquire(goal,$("#capEngine").value);$("#capOut").textContent=JSON.stringify(r.report,null,2);toast("Capability-Beschaffung abgeschlossen");await refreshAll()}catch(e){$("#capOut").textContent=e.message;toast(e.message,true)}finally{$("#capAcquire").disabled=false}};
 $("#elevate").onclick=async()=>{if(confirm("OS als Administrator neu starten? Windows zeigt eine UAC-Abfrage."))await osAPI.adminRelaunch()};
 $("#pkgInstall").onclick=async()=>{const packageName=$("#pkgName").value.trim();if(!packageName)return;$("#pkgInstall").disabled=true;try{const r=await osAPI.capsInstall({method:$("#pkgMethod").value,package:packageName,kind:"software-install"});$("#capOut").textContent=JSON.stringify(r,null,2);toast("Paket installiert")}catch(e){toast(e.message,true);$("#capOut").textContent=e.message}finally{$("#pkgInstall").disabled=false}};
 $$(".capInspect").forEach(b=>b.onclick=async()=>{try{const r=await osAPI.capsInspect(b.dataset.id);$("#capOut").textContent=r.help}catch(e){toast(e.message,true)}});
 $$(".capAdapt").forEach(b=>b.onclick=async()=>{try{$("#capOut").textContent="Adapter wird erzeugt…";const r=await osAPI.capsAdapter(b.dataset.id);$("#capOut").textContent=JSON.stringify(r.adapter,null,2);toast("Adapter erzeugt")}catch(e){toast(e.message,true)}});
}

async function renderReference(){
 const r=await osAPI.referenceInfo();
 $("#content").innerHTML=`<div class="grid">
  <div class="card span5"><h3>PersonalJarvis Referenz</h3><div class="status-list"><div class="status"><span>Repository</span><i class="dot ${r.exists?"ok":"bad"}"></i></div><div class="status"><span>MIT-Lizenz</span><i class="dot ${r.license?"ok":"bad"}"></i></div></div><p class="muted small">Pfad: ${esc(r.path)}</p><p class="muted tiny">Commit: ${esc(r.commit||"-")}</p><button class="ghost" id="openRef" ${!r.exists?"disabled":""}>Referenz öffnen</button></div>
  <div class="card span7"><h3>Architektur-Transfer</h3><p class="small">OS bleibt OS. Die Referenz wird analysiert, um starke Mechaniken gezielt neu zu implementieren statt den fremden Namen oder starre Interna zu übernehmen.</p><div class="row"><select id="refEngine"><option>auto</option><option>claude</option><option>codex</option><option>opencode</option></select><button class="primary" id="refCompare" ${!r.exists?"disabled":""}>OS ↔ Referenz analysieren</button></div><pre id="refOut" class="log" style="margin-top:10px">Bereit.</pre></div>
  <div class="card span12"><h3>Autonome Evolution</h3><p class="small">OS wählt selbst die nächste sinnvollste fehlende Fähigkeit aus der Referenz, erstellt ein Development-Projekt und durchläuft Plan → Sandbox → Build → Test → Review → Candidate.</p><div class="row"><button class="primary" id="autoEvolve" ${!r.exists?"disabled":""}>Nächsten Schritt selbst entwickeln</button><label class="small"><input type="checkbox" id="autoPromote"> nach APPROVE automatisch übernehmen</label></div><div id="evolveState" class="muted small" style="margin-top:10px">Auto-Promotion funktioniert nur im Vollzugriff-Modus mit Self-Improvement = erlauben.</div></div>
 </div>`;
 $("#openRef").onclick=()=>osAPI.openPath("Reference\\PersonalJarvis");
 $("#refCompare").onclick=async()=>{$("#refCompare").disabled=true;$("#refOut").textContent="Analysiere Referenzarchitektur…";try{const x=await osAPI.referenceCompare($("#refEngine").value);$("#refOut").textContent=x.text;toast("Analyse erstellt")}catch(e){$("#refOut").textContent=e.message;toast(e.message,true)}finally{$("#refCompare").disabled=false}};
 $("#autoEvolve").onclick=async()=>{if(!confirm("OS soll selbst die nächste Entwicklungsaufgabe bestimmen und bis zur Candidate-Version ausarbeiten?"))return;$("#autoEvolve").disabled=true;$("#evolveState").innerHTML='<span class="loader"></span> OS analysiert, plant, entwickelt, testet und reviewt…';try{const p=await osAPI.devAutoEvolve({engine:$("#refEngine").value,autoPromote:$("#autoPromote").checked});$("#evolveState").textContent=`Status: ${p.status} · ${p.goal}`;toast("Evolution abgeschlossen: "+p.status);if(p.status!=="promoted")setTimeout(()=>openDevProject(p.id),300)}catch(e){$("#evolveState").textContent=e.message;toast(e.message,true);$("#autoEvolve").disabled=false}};
}

(async()=>{await refreshAll();nav("dashboard")})();
