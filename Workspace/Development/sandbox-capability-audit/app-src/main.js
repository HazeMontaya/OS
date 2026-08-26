
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const http = require("http");
const os = require("os");
const { registerDevPipeline } = require("./dev-pipeline");
const { registerCapabilityFabric } = require("./capability-fabric");

const ROOT = process.env.OS_HOME || "S:\\OS";
const CFG = path.join(ROOT, "Config");
const VAULT = path.join(ROOT, "Vault");
const AGENTS = path.join(ROOT, "Agents");
const SKILLS = path.join(ROOT, "Skills");
const MCP = path.join(ROOT, "MCP");
const WORK = path.join(ROOT, "Workspaces");
const DATA = path.join(ROOT, "Data");
const LOGS = path.join(ROOT, "Logs");
const BACKUPS = path.join(ROOT, "Backups");
const SETTINGS = path.join(CFG, "OS.settings.json");
const AUTOS = path.join(DATA, "automations.json");
const CHATLOG = path.join(DATA, "chat-history.json");
const ACTIVITY = path.join(DATA, "activity.jsonl");

let mainWindow = null;
let automationTimer = null;

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }
function deepDefaults(current, defaults){
  if(Array.isArray(defaults)) return Array.isArray(current)?current:defaults;
  if(defaults && typeof defaults==="object"){
    const out=(current && typeof current==="object" && !Array.isArray(current))?{...current}:{};
    for(const [k,v] of Object.entries(defaults)) out[k]=deepDefaults(out[k],v);
    return out;
  }
  return current===undefined?defaults:current;
}
function ensureBase(){
  [ROOT,CFG,VAULT,AGENTS,SKILLS,MCP,WORK,DATA,LOGS,BACKUPS].forEach(ensureDir);
  if(!fs.existsSync(AUTOS)) writeJson(AUTOS,[]);
  if(!fs.existsSync(CHATLOG)) writeJson(CHATLOG,[]);
  const defaults={
    name:"OS",version:"0.6.0",language:"de",
    appearance:{theme:"dark",accent:"#b9a7ff",density:"comfortable"},
    autonomy:{preset:"balanced",fileWrite:"ask",shell:"ask",external:"ask",delete:"ask",selfImprove:"ask"},
    engines:{default:"auto",localModel:"gemma3:4b",claudeMode:"plan",codexSandbox:"workspace-write",openCodeAuto:false},
    memory:{autoDistill:true,keepHistory:true},
    automation:{enabled:true,backgroundAtLogin:false},
    ui:{showAdvanced:true}
  };
  const merged=deepDefaults(readJson(SETTINGS,{}),defaults);
  merged.version="0.4.0";
  writeJson(SETTINGS,merged);
}

function readJson(p, fallback={}){
  try { return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"")); }
  catch { return fallback; }
}
function writeJson(p,obj){
  ensureDir(path.dirname(p));
  const tmp=p+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(obj,null,2),"utf8");
  fs.renameSync(tmp,p);
}
function logActivity(type,data={}){
  ensureDir(DATA);
  fs.appendFileSync(ACTIVITY,JSON.stringify({ts:new Date().toISOString(),type,...data})+"\n","utf8");
}
function withinRoot(p){
  const resolved=path.resolve(p);
  const root=path.resolve(ROOT);
  return resolved===root || resolved.startsWith(root+path.sep);
}
function safePath(input){
  const p=path.isAbsolute(input)?path.normalize(input):path.join(ROOT,input);
  if(!withinRoot(p)) throw new Error("Pfad außerhalb von S:\\OS blockiert.");
  return p;
}
function executable(name){
  const p = {
    claude:path.join(ROOT,"Tools","npm-global","claude.cmd"),
    codex:path.join(ROOT,"Tools","npm-global","codex.cmd"),
    opencode:path.join(ROOT,"Tools","npm-global","opencode.cmd"),
    ollama:path.join(ROOT,"Apps","Ollama","ollama.exe"),
    git:path.join(ROOT,"Tools","Git","cmd","git.exe"),
    vscode:path.join(ROOT,"Apps","VSCode","Code.exe"),
    obsidian:path.join(ROOT,"Apps","Obsidian","Obsidian.exe")
  }[name];
  return p && fs.existsSync(p) ? p : null;
}
function collectProcess(file,args=[],opts={}){
  return new Promise((resolve,reject)=>{
    const child=cp.spawn(file,args,{
      cwd:opts.cwd||ROOT,
      env:{...process.env,
        OS_HOME:ROOT,AI_BRAIN_HOME:VAULT,
        CLAUDE_CONFIG_DIR:path.join(CFG,"Claude"),
        CODEX_HOME:path.join(CFG,"Codex"),
        OPENCODE_CONFIG_DIR:path.join(CFG,"OpenCode"),
        OPENCODE_CONFIG:path.join(CFG,"OpenCode","opencode.json"),
        OLLAMA_MODELS:path.join(ROOT,"Models","Ollama"),
        OLLAMA_HOST:"127.0.0.1:11434",
        TEMP:path.join(ROOT,"Temp"),TMP:path.join(ROOT,"Temp")
      },
      windowsHide:true,
      shell:file.endsWith(".cmd")
    });
    let out="",err="";
    const max=20*1024*1024;
    child.stdout?.on("data",d=>{if(out.length<max) out+=d.toString()});
    child.stderr?.on("data",d=>{if(err.length<max) err+=d.toString()});
    const timer=setTimeout(()=>{try{child.kill()}catch{}; reject(new Error("Zeitlimit überschritten"));},opts.timeout||20*60*1000);
    child.on("error",e=>{clearTimeout(timer);reject(e)});
    child.on("close",code=>{clearTimeout(timer); resolve({code,stdout:out.trim(),stderr:err.trim()})});
  });
}
function ollamaRequest(method,endpoint,body){
  return new Promise((resolve,reject)=>{
    const data=body?JSON.stringify(body):null;
    const req=http.request({
      hostname:"127.0.0.1",port:11434,path:endpoint,method,
      headers:data?{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}:{}
    },res=>{
      let raw="";
      res.on("data",c=>raw+=c);
      res.on("end",()=>{
        try{
          if(res.statusCode>=400) return reject(new Error(raw||`HTTP ${res.statusCode}`));
          resolve(raw?JSON.parse(raw):{});
        }catch(e){reject(e)}
      });
    });
    req.on("error",reject);
    req.setTimeout(30*60*1000,()=>req.destroy(new Error("Ollama timeout")));
    if(data) req.write(data);
    req.end();
  });
}
async function ensureOllama(){
  try { await ollamaRequest("GET","/api/tags"); return true; } catch {}
  const exe=executable("ollama");
  if(!exe) return false;
  try{
    const child=cp.spawn(exe,["serve"],{
      detached:true,stdio:"ignore",windowsHide:true,
      env:{...process.env,OLLAMA_MODELS:path.join(ROOT,"Models","Ollama"),OLLAMA_HOST:"127.0.0.1:11434"}
    });
    child.unref();
    await new Promise(r=>setTimeout(r,1800));
    await ollamaRequest("GET","/api/tags");
    return true;
  }catch{return false}
}
async function runEngine(engine,prompt,options={}){
  const s=readJson(SETTINGS,{});
  if(engine==="auto"){
    const p=prompt.toLowerCase();
    if(options.private || /privat|sensibel|offline|lokal/.test(p)) engine="local";
    else if(/code|programm|script|bug|git|repository|software/.test(p)) engine=executable("codex")?"codex":"opencode";
    else engine=executable("claude")?"claude":(executable("opencode")?"opencode":"local");
  }
  logActivity("engine.start",{engine,prompt:prompt.slice(0,180)});
  let result;
  if(engine==="local"){
    if(!(await ensureOllama())) throw new Error("Ollama ist nicht verfügbar.");
    const model=options.model||s.engines?.localModel||"gemma3:4b";
    const history=Array.isArray(options.messages)?options.messages:[];
    const messages=[...history,{role:"user",content:prompt}];
    const r=await ollamaRequest("POST","/api/chat",{model,messages,stream:false});
    result={engine,model,text:r.message?.content||"",meta:{eval_count:r.eval_count,total_duration:r.total_duration}};
  } else if(engine==="claude"){
    const exe=executable("claude"); if(!exe) throw new Error("Claude Code fehlt.");
    const mode=s.engines?.claudeMode||"plan";
    const r=await collectProcess(exe,["-p","--permission-mode",mode,"--max-turns","12",prompt]);
    if(r.code!==0 && !r.stdout) throw new Error(r.stderr||`Claude exit ${r.code}`);
    result={engine,text:r.stdout||r.stderr};
  } else if(engine==="codex"){
    const exe=executable("codex"); if(!exe) throw new Error("Codex fehlt.");
    const r=await collectProcess(exe,["exec",prompt],{timeout:30*60*1000});
    if(r.code!==0 && !r.stdout) throw new Error(r.stderr||`Codex exit ${r.code}`);
    result={engine,text:r.stdout||r.stderr};
  } else if(engine==="opencode"){
    const exe=executable("opencode"); if(!exe) throw new Error("OpenCode fehlt.");
    const args=["run"];
    if(s.engines?.openCodeAuto) args.push("--auto");
    args.push(prompt);
    const r=await collectProcess(exe,args,{timeout:30*60*1000});
    if(r.code!==0 && !r.stdout) throw new Error(r.stderr||`OpenCode exit ${r.code}`);
    result={engine,text:r.stdout||r.stderr};
  } else throw new Error("Unbekannte Engine.");
  logActivity("engine.end",{engine,length:result.text?.length||0});
  return result;
}
function walk(dir, base=dir, depth=0){
  if(depth>8 || !fs.existsSync(dir)) return [];
  let out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(["node_modules",".git","Models","Backups","Cache","Downloads"].includes(ent.name)) continue;
    const full=path.join(dir,ent.name);
    const rel=path.relative(ROOT,full);
    if(ent.isDirectory()){
      out.push({type:"dir",name:ent.name,path:rel});
      out=out.concat(walk(full,base,depth+1));
    } else {
      out.push({type:"file",name:ent.name,path:rel,size:fs.statSync(full).size});
    }
    if(out.length>5000) break;
  }
  return out;
}
function textSearch(query,roots=[VAULT,AGENTS,SKILLS,MCP]){
  const q=String(query||"").toLowerCase().trim();
  if(!q) return [];
  const results=[];
  for(const root of roots){
    for(const item of walk(root)){
      if(item.type!=="file") continue;
      if(!/\.(md|txt|json|js|ps1|yaml|yml)$/i.test(item.name)) continue;
      const p=path.join(ROOT,item.path);
      try{
        if(fs.statSync(p).size>2*1024*1024) continue;
        const txt=fs.readFileSync(p,"utf8");
        const idx=txt.toLowerCase().indexOf(q);
        if(idx>=0){
          results.push({path:item.path,snippet:txt.slice(Math.max(0,idx-120),Math.min(txt.length,idx+280)).replace(/\s+/g," ")});
          if(results.length>=100) return results;
        }
      }catch{}
    }
  }
  return results;
}
function getStatus(){
  const s=readJson(SETTINGS,{});
  const counts={
    agents:fs.existsSync(AGENTS)?fs.readdirSync(AGENTS).filter(x=>x.endsWith(".md")).length:0,
    skills:fs.existsSync(SKILLS)?fs.readdirSync(SKILLS,{withFileTypes:true}).filter(x=>x.isDirectory()).length:0,
    memory:fs.existsSync(path.join(VAULT,"10-Memory"))?walk(path.join(VAULT,"10-Memory")).filter(x=>x.type==="file").length:0,
    proposals:fs.existsSync(path.join(WORK,"Improvement-Queue"))?fs.readdirSync(path.join(WORK,"Improvement-Queue")).filter(x=>x.endsWith(".md")).length:0
  };
  return {
    name:s.name||"OS",version:s.version||"0.6.0",root:ROOT,platform:process.platform,arch:process.arch,
    hostname:os.hostname(),ramGB:Math.round(os.totalmem()/1024/1024/1024),
    components:{
      claude:!!executable("claude"),codex:!!executable("codex"),opencode:!!executable("opencode"),
      ollama:!!executable("ollama"),git:!!executable("git"),vscode:!!executable("vscode"),obsidian:!!executable("obsidian")
    },counts
  };
}
function snapshot(){
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const dest=path.join(BACKUPS,"snapshot-"+stamp);
  ensureDir(dest);
  const excluded=new Set(["Backups","Models","Cache","Temp","Downloads","Logs","Apps","Runtime","Tools"]);
  for(const ent of fs.readdirSync(ROOT,{withFileTypes:true})){
    if(excluded.has(ent.name)) continue;
    const src=path.join(ROOT,ent.name), dst=path.join(dest,ent.name);
    fs.cpSync(src,dst,{recursive:true,force:true});
  }
  logActivity("snapshot",{dest:path.relative(ROOT,dest)});
  return dest;
}
async function selfReview(engine="auto"){
  const outDir=path.join(WORK,"Improvement-Queue"); ensureDir(outDir);
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  snapshot();
  const prompt=`Du bist Architect und Reviewer von OS unter S:\\OS.
Analysiere ausschließlich und ändere keine produktiven Dateien.
Prüfe Core, Config, Agents, Skills, MCP, Vault-Struktur und UI.
Erstelle maximal 10 priorisierte Verbesserungen.
Für jede: Problem, Ursache, konkrete Änderung, Nutzen, Risiko, Tests, Rollback, betroffene Dateien.
Priorisiere Zuverlässigkeit, Individualisierbarkeit, Automatisierung, Sicherheit, Kosten und Geschwindigkeit.
Der geschützte Core darf nicht still verändert werden.`;
  const r=await runEngine(engine,prompt,{private:false});
  const file=path.join(outDir,`${stamp}-system-review.md`);
  fs.writeFileSync(file,`# OS System Review\n\nEngine: ${r.engine}\nDatum: ${new Date().toISOString()}\n\n${r.text}`,"utf8");
  return {file:path.relative(ROOT,file),...r};
}
function loadAutomations(){ return readJson(AUTOS,[]); }
function saveAutomations(a){ writeJson(AUTOS,a); return a; }
async function executeAutomation(a){
  try{
    const r=await runEngine(a.engine||"auto",a.prompt||"");
    a.lastRun=new Date().toISOString(); a.lastResult=(r.text||"").slice(0,2000); a.lastError=null;
    logActivity("automation.run",{id:a.id,name:a.name});
  }catch(e){
    a.lastRun=new Date().toISOString(); a.lastError=e.message;
    logActivity("automation.error",{id:a.id,error:e.message});
  }
}
async function automationTick(){
  const settings=readJson(SETTINGS,{});
  if(settings.automation?.enabled===false) return;
  const list=loadAutomations();
  let changed=false;
  const now=Date.now();
  for(const a of list){
    if(!a.enabled || !a.intervalMinutes || a.running) continue;
    const last=a.lastRun?Date.parse(a.lastRun):0;
    if(!last || now-last>=Number(a.intervalMinutes)*60000){
      a.running=true; changed=true; saveAutomations(list);
      await executeAutomation(a);
      a.running=false; changed=true;
    }
  }
  if(changed) saveAutomations(list);
}
function startAutomationWorker(){
  if(automationTimer) clearInterval(automationTimer);
  automationTimer=setInterval(automationTick,30000);
  setTimeout(automationTick,4000);
}
function createWindow(){
  mainWindow=new BrowserWindow({
    width:1480,height:920,minWidth:1050,minHeight:700,
    title:process.env.OS_CANDIDATE ? "OS — Candidate" : "OS",
    backgroundColor:"#0d0f14",
    webPreferences:{
      preload:path.join(__dirname,"preload.js"),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true
    }
  });
  mainWindow.loadFile(path.join(__dirname,"renderer","index.html"));
  mainWindow.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:"deny"}});
}
function applyLoginSetting(){
  const s=readJson(SETTINGS,{});
  try{
    app.setLoginItemSettings({
      openAtLogin:!!s.automation?.backgroundAtLogin,
      path:process.execPath,
      args:["--background"]
    });
  }catch{}
}

app.whenReady().then(()=>{
  ensureBase();
  registerDevPipeline();
  registerCapabilityFabric();
  applyLoginSetting();
  startAutomationWorker();
  if(!process.argv.includes("--background")) createWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0) createWindow()});
});
app.on("window-all-closed",()=>{ if(process.platform!=="darwin" && !process.argv.includes("--background")) app.quit(); });

ipcMain.handle("status:get",()=>getStatus());
ipcMain.handle("settings:get",()=>readJson(SETTINGS,{}));
ipcMain.handle("settings:save",(_e,s)=>{writeJson(SETTINGS,s);applyLoginSetting();logActivity("settings.save");return s});
ipcMain.handle("tree:list",(_e,rel="")=>walk(safePath(rel)));
ipcMain.handle("file:read",(_e,rel)=>fs.readFileSync(safePath(rel),"utf8"));
ipcMain.handle("file:write",(_e,{path:rel,content,confirmed=false})=>{
  const s=readJson(SETTINGS,{});
  const perm=s.autonomy?.fileWrite||"ask";
  if(perm==="deny") throw new Error("Dateischreiben ist in den Einstellungen gesperrt.");
  if(perm==="ask"&&!confirmed) throw new Error("CONFIRM_REQUIRED");
  const p=safePath(rel); ensureDir(path.dirname(p)); fs.writeFileSync(p,String(content),"utf8");
  logActivity("file.write",{path:rel}); return true;
});
ipcMain.handle("file:create",(_e,{dir,name,content="",confirmed=false})=>{
  const rel=path.join(dir||"",name||"new.md");
  return ipcMain.emit ? (()=>{
    const s=readJson(SETTINGS,{});
    if(s.autonomy?.fileWrite==="deny") throw new Error("Dateischreiben gesperrt.");
    if((s.autonomy?.fileWrite||"ask")==="ask"&&!confirmed) throw new Error("CONFIRM_REQUIRED");
    const p=safePath(rel); ensureDir(path.dirname(p)); if(fs.existsSync(p)) throw new Error("Datei existiert bereits.");
    fs.writeFileSync(p,String(content),"utf8"); return rel;
  })() : null;
});
ipcMain.handle("file:delete",(_e,{path:rel,confirmed=false})=>{
  const s=readJson(SETTINGS,{});
  const perm=s.autonomy?.delete||"ask";
  if(perm==="deny") throw new Error("Löschen gesperrt.");
  if(!confirmed) throw new Error("CONFIRM_REQUIRED");
  const p=safePath(rel); fs.rmSync(p,{recursive:true,force:true});logActivity("file.delete",{path:rel});return true;
});
ipcMain.handle("search:text",(_e,q)=>textSearch(q));
ipcMain.handle("engine:run",(_e,p)=>runEngine(p.engine||"auto",p.prompt||"",p.options||{}));
ipcMain.handle("models:list",async()=>{if(!(await ensureOllama()))return[];return (await ollamaRequest("GET","/api/tags")).models||[]});
ipcMain.handle("models:pull",async(_e,model)=>{
  if(!(await ensureOllama()))throw new Error("Ollama nicht verfügbar.");
  const exe=executable("ollama"); const r=await collectProcess(exe,["pull",model],{timeout:2*60*60*1000});
  if(r.code!==0)throw new Error(r.stderr||"Model Pull fehlgeschlagen");return r.stdout;
});
ipcMain.handle("snapshot:create",()=>snapshot());
ipcMain.handle("improve:review",(_e,engine)=>selfReview(engine||"auto"));
ipcMain.handle("automations:list",()=>loadAutomations());
ipcMain.handle("automations:save",(_e,list)=>saveAutomations(list));
ipcMain.handle("automations:run",async(_e,id)=>{
  const list=loadAutomations(); const a=list.find(x=>x.id===id); if(!a)throw new Error("Automation nicht gefunden.");
  await executeAutomation(a); saveAutomations(list); return a;
});
ipcMain.handle("shell:openPath",(_e,rel)=>shell.openPath(safePath(rel)));
ipcMain.handle("shell:external",(_e,url)=>shell.openExternal(url));
ipcMain.handle("shell:command",async(_e,{command,confirmed=false})=>{
  const s=readJson(SETTINGS,{});
  const perm=s.autonomy?.shell||"ask";
  if(perm==="deny")throw new Error("Shell ist gesperrt.");
  if(perm==="ask"&&!confirmed)throw new Error("CONFIRM_REQUIRED");
  const r=await collectProcess("powershell.exe",["-NoProfile","-Command",command],{timeout:30*60*1000});
  logActivity("shell.command",{command:command.slice(0,300),code:r.code});
  return r;
});
ipcMain.handle("dialog:open",async()=>{
  const r=await dialog.showOpenDialog(mainWindow,{properties:["openFile","openDirectory","multiSelections"]});
  return r.canceled?[]:r.filePaths;
});
ipcMain.handle("activity:get",()=>{
  if(!fs.existsSync(ACTIVITY))return[];
  return fs.readFileSync(ACTIVITY,"utf8").trim().split(/\r?\n/).filter(Boolean).slice(-300).map(x=>{try{return JSON.parse(x)}catch{return null}}).filter(Boolean).reverse();
});
