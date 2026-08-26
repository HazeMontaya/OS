
const { ipcMain, shell, app } = require("electron");
const fs=require("fs");
const path=require("path");
const cp=require("child_process");
const os=require("os");

const ROOT=process.env.OS_HOME||"S:\\OS";
const CFG=path.join(ROOT,"Config");
const DATA=path.join(ROOT,"Data");
const CAPDIR=path.join(ROOT,"Capabilities");
const REG=path.join(CAPDIR,"registry.json");
const ADAPTERS=path.join(CAPDIR,"Adapters");
const GENERATED=path.join(CAPDIR,"Generated");
const REF=path.join(ROOT,"Reference","PersonalJarvis");

function ensure(p){fs.mkdirSync(p,{recursive:true})}
function readJson(p,f={}){try{return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""))}catch{return f}}
function writeJson(p,o){ensure(path.dirname(p));const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(o,null,2),"utf8");fs.renameSync(t,p)}
function runSync(file,args=[],timeout=120000){
 try{
  const r=cp.spawnSync(file,args,{encoding:"utf8",windowsHide:true,timeout,shell:String(file).toLowerCase().endsWith(".cmd")});
  return{ok:r.status===0,code:r.status,stdout:(r.stdout||"").trim(),stderr:(r.stderr||"").trim()}
 }catch(e){return{ok:false,code:-1,stdout:"",stderr:e.message}}
}
function where(cmd){
 const r=runSync("where.exe",[cmd],30000);
 return r.ok?r.stdout.split(/\r?\n/).filter(Boolean):[];
}
function localOrPath(localPath,name){
 return localPath&&fs.existsSync(localPath)?localPath:(name?where(name)[0]||null:null);
}
function adminStatus(){
 const r=runSync("powershell.exe",["-NoProfile","-Command","$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent());$p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"],30000);
 return /true/i.test(r.stdout);
}
function versionOf(file,args=["--version"]){
 const r=runSync(file,args,30000);return(r.stdout||r.stderr).split(/\r?\n/)[0].slice(0,180);
}
function detectKnown(){
 const defs=[
  ["claude","AI harness",path.join(ROOT,"Tools","npm-global","claude.cmd"),"claude"],
  ["codex","AI harness",path.join(ROOT,"Tools","npm-global","codex.cmd"),"codex"],
  ["opencode","AI harness",path.join(ROOT,"Tools","npm-global","opencode.cmd"),"opencode"],
  ["ollama","local model runtime",path.join(ROOT,"Apps","Ollama","ollama.exe"),"ollama"],
  ["git","version control",path.join(ROOT,"Tools","Git","cmd","git.exe"),"git"],
  ["node","runtime",path.join(ROOT,"Runtime","Node","node.exe"),"node"],
  ["npm","package manager",path.join(ROOT,"Runtime","Node","npm.cmd"),"npm"],
  ["python","runtime",where("python.exe")[0]||where("python")[0]],
  ["pip","package manager",where("pip.exe")[0]||where("pip")[0]],
  ["winget","package manager",where("winget.exe")[0]],
  ["pwsh","shell",where("pwsh.exe")[0]],
  ["powershell","shell",where("powershell.exe")[0]],
  ["docker","container runtime",where("docker.exe")[0]],
  ["wsl","linux subsystem",where("wsl.exe")[0]],
  ["ffmpeg","media tool",where("ffmpeg.exe")[0]],
  ["curl","network tool",where("curl.exe")[0]],
  ["ssh","remote shell",where("ssh.exe")[0]],
  ["code","editor",path.join(ROOT,"Apps","VSCode","bin","code.cmd"),"code"],
  ["obsidian","knowledge app",path.join(ROOT,"Apps","Obsidian","Obsidian.exe"),"obsidian"]
 ];
 return defs.map(([name,kind,localPath,pathName])=>({name,kind,file:localOrPath(localPath,pathName),localPath})).filter(x=>x.file).map(({name,kind,file,localPath})=>({
   id:"exe:"+name,name,kind,type:"executable",path:file,available:true,version:versionOf(file),
   trust:file===localPath||name==="powershell"||name==="winget"||name==="git"?"local":"detected"
 }));
}
function discoverStartApps(){
 const r=runSync("powershell.exe",["-NoProfile","-Command","Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress"],90000);
 if(!r.ok||!r.stdout)return[];
 try{let x=JSON.parse(r.stdout);if(!Array.isArray(x))x=[x];return x.slice(0,600).map(a=>({id:"app:"+a.AppID,name:a.Name,kind:"windows app",type:"startapp",appId:a.AppID,available:true,trust:"installed"}))}
 catch{return[]}
}
function discoverMCP(){
 const p=path.join(ROOT,"MCP","Registry","mcp-registry.json"),r=readJson(p,{servers:[]});
 return(r.servers||[]).map(s=>({id:"mcp:"+s.name,name:s.name,kind:"MCP tool server",type:"mcp",available:!!s.enabled,details:s,trust:"configured"}))
}
function discoverSkills(){
 const dir=path.join(ROOT,"Skills");if(!fs.existsSync(dir))return[];
 return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>({id:"skill:"+x.name,name:x.name,kind:"OS skill",type:"skill",path:path.join(dir,x.name),available:true,trust:"local"}))
}
function discoverAgents(){
 const dir=path.join(ROOT,"Agents");if(!fs.existsSync(dir))return[];
 return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(".md")).map(x=>({id:"agent:"+x.name,name:x.name.replace(/\.md$/,""),kind:"OS agent",type:"agent",path:path.join(dir,x.name),available:true,trust:"local"}))
}
function probe(){
 ensure(CAPDIR);ensure(ADAPTERS);ensure(GENERATED);
 const all=[...detectKnown(),...discoverMCP(),...discoverSkills(),...discoverAgents(),...discoverStartApps()];
 const dedup=[...new Map(all.map(x=>[x.id,x])).values()];
 const reg={version:2,updatedAt:new Date().toISOString(),admin:adminStatus(),referenceAvailable:fs.existsSync(REF),capabilities:dedup};
 writeJson(REG,reg);return reg;
}
function audit(){
 const reg=probe();
 const roots=["Agents","AI-Brain","Capabilities","Config","Core","MCP","Models","Reference","Runtime","Skills","Source","Tools","Vault","Workspaces"];
 const structure=Object.fromEntries(roots.map(name=>[name,fs.existsSync(path.join(ROOT,name))]));
 const files=recursiveFiles(ROOT,()=>true,[]);
 const byType={};for(const cap of reg.capabilities)byType[cap.type]=(byType[cap.type]||0)+1;
 const report={version:1, auditedAt:new Date().toISOString(), root:ROOT, structure,
  reference:{available:fs.existsSync(REF),readme:fs.existsSync(path.join(REF,"README.md")),context:fs.existsSync(path.join(REF,"docs","LLM-CONTEXT.md"))},
  filesScanned:files.length, capabilities:reg.capabilities.length, byType, admin:reg.admin};
 writeJson(path.join(DATA,"capability-audit.json"),report);return report;
}
function settings(){return readJson(path.join(CFG,"OS.settings.json"),{})}
function requireAdmin(){
 if(adminStatus())return true;
 throw new Error("ADMIN_REQUIRED");
}
function allowedAdminAction(kind){
 // Non-bypassable local boundaries. They prevent silent credential theft/security disablement,
 // while still allowing normal software/tool installation and OS development.
 const blocked=new Set(["credential-dump","disable-security","bypass-uac","create-remote-access","steal-secret"]);
 return !blocked.has(kind);
}
function runCollected(file,args=[],cwd=ROOT,timeout=45*60*1000){
 return new Promise((resolve,reject)=>{
  const c=cp.spawn(file,args,{cwd,env:{...process.env,OS_HOME:ROOT},windowsHide:true,shell:String(file).toLowerCase().endsWith(".cmd")});
  let out="",err="";c.stdout?.on("data",d=>out+=d);c.stderr?.on("data",d=>err+=d);
  const t=setTimeout(()=>{try{c.kill()}catch{};reject(new Error("Zeitlimit"))},timeout);
  c.on("error",e=>{clearTimeout(t);reject(e)});c.on("close",code=>{clearTimeout(t);resolve({code,stdout:out.trim(),stderr:err.trim()})})
 })
}
function enginePath(e){
 const m={claude:path.join(ROOT,"Tools","npm-global","claude.cmd"),codex:path.join(ROOT,"Tools","npm-global","codex.cmd"),opencode:path.join(ROOT,"Tools","npm-global","opencode.cmd")};
 return m[e]&&fs.existsSync(m[e])?m[e]:null;
}
async function askArchitect(prompt,preferred="auto"){
 let e=preferred;
 if(e==="auto")e=enginePath("claude")?"claude":enginePath("codex")?"codex":"opencode";
 const file=enginePath(e);if(!file)throw new Error("Keine Development-Engine verfügbar.");
 let r;
 if(e==="claude")r=await runCollected(file,["-p","--permission-mode","plan","--max-turns","14",prompt],ROOT);
 else if(e==="codex")r=await runCollected(file,["exec",prompt],ROOT);
 else r=await runCollected(file,["run",prompt],ROOT);
 if(r.code!==0&&!r.stdout)throw new Error(r.stderr||`${e} fehlgeschlagen`);
 return{engine:e,text:r.stdout||r.stderr}
}
async function analyzeNeed(goal,preferred="auto"){
 const reg=probe();
 const inventory=reg.capabilities.filter(x=>["executable","mcp","skill","agent"].includes(x.type)).slice(0,300).map(x=>`${x.type}: ${x.name} — ${x.kind} — ${x.available?"available":"disabled"}`).join("\n");
 const prompt=`Du bist der Capability Architect von OS.
OS soll NICHT von einer festen Agenten- oder Toolliste abhängig sein.
NUTZERZIEL:
${goal}

AKTUELLE CAPABILITY-INVENTUR:
${inventory}

PERSONALJARVIS-REFERENZ VORHANDEN: ${reg.referenceAvailable}

Entscheide provider-neutral, welche Fähigkeiten nötig sind.
Prüfreihenfolge:
1. vorhandene Capability direkt verwenden
2. vorhandenes Tool über Adapter erschließen
3. vertrauenswürdiges Tool/Paket installieren
4. MCP/Plugin verbinden
5. eigenen Adapter/Skill/Tool erzeugen
6. mehrere Methoden kombinieren

Antworte als JSON ohne Markdown:
{
 "summary":"...",
 "requirements":[
  {"capability":"...","strategy":"use|adapt|install|connect|generate|combine","candidate":"...","method":"winget|npm|pip|null","package":"...|null","reason":"...","risk":"low|medium|high","admin":false}
 ],
 "recommendedEngine":"...",
 "notes":["..."]
}
Keine Zugangsdaten anfordern. Keine UAC-Umgehung. Keine Sicherheitssoftware deaktivieren.`;
 const r=await askArchitect(prompt,preferred);
 let plan;
 try{const m=r.text.match(/\{[\s\S]*\}/);plan=JSON.parse(m?m[0]:r.text)}
 catch{plan={summary:r.text,requirements:[],notes:["Antwort war kein parsebares JSON."]}}
 plan.engine=r.engine;plan.goal=goal;plan.createdAt=new Date().toISOString();
 const out=path.join(DATA,"capability-plans");ensure(out);
 const file=path.join(out,new Date().toISOString().replace(/[:.]/g,"-")+".json");writeJson(file,plan);
 return{plan,file:path.relative(ROOT,file)}
}
async function inspectCLI(target){
 const reg=probe();const cap=reg.capabilities.find(x=>x.id===target||x.name===target);
 if(!cap||cap.type!=="executable")throw new Error("Executable nicht gefunden.");
 const attempts=[["--help"],["-h"],["help"]];let txt="";
 for(const a of attempts){const r=runSync(cap.path,a,60000);txt+=(r.stdout||r.stderr)+"\n";if(txt.trim().length>100)break}
 const out={id:cap.id,name:cap.name,path:cap.path,help:txt.slice(0,120000),inspectedAt:new Date().toISOString()};
 writeJson(path.join(ADAPTERS,cap.name+".inspection.json"),out);return out;
}
async function generateAdapter(target,preferred="auto"){
 const info=await inspectCLI(target);
 const prompt=`Du bist OS Tool Adapter Builder.
Erzeuge einen sicheren, generischen Adapter-Entwurf für dieses lokale CLI.

NAME: ${info.name}
PATH: ${info.path}
HELP:
${info.help.slice(0,50000)}

Ziel:
- Fähigkeiten semantisch beschreiben
- read-only vs write/destructive unterscheiden
- Argumente strukturiert dokumentieren
- keine Secrets hardcoden
- unbekannte/destruktive Befehle als ask markieren

Antworte als JSON:
{
 "name":"...",
 "description":"...",
 "commands":[{"name":"...","description":"...","argsExample":[],"risk":"safe|monitor|ask|block"}]
}`;
 const r=await askArchitect(prompt,preferred);let adapter;
 try{const m=r.text.match(/\{[\s\S]*\}/);adapter=JSON.parse(m?m[0]:r.text)}
 catch{adapter={name:info.name,description:r.text,commands:[]}}
 adapter.generatedAt=new Date().toISOString();adapter.sourcePath=info.path;adapter.engine=r.engine;
 const file=path.join(ADAPTERS,info.name+".adapter.json");writeJson(file,adapter);return{adapter,file:path.relative(ROOT,file)}
}
async function installCapability(req){
 const s=settings();
 if(s.autonomy?.preset!=="full"&&s.autonomy?.shell!=="allow")throw new Error("FULL_AUTONOMY_REQUIRED");
 requireAdmin();
 if(!allowedAdminAction(req.kind||"software-install"))throw new Error("Diese Admin-Aktion ist als harte Sicherheitsgrenze blockiert.");
 const method=req.method;
 let file,args;
 if(method==="winget"){
   file=where("winget.exe")[0];if(!file)throw new Error("winget fehlt.");
   args=["install","--id",req.package,"--exact","--accept-package-agreements","--accept-source-agreements","--disable-interactivity"];
 }else if(method==="npm"){
   file=path.join(ROOT,"Runtime","Node","npm.cmd");args=["install","-g",req.package];
 }else if(method==="pip"){
   file=where("python.exe")[0]||where("python")[0];if(!file)throw new Error("Python fehlt.");
   args=["-m","pip","install",req.package];
 }else throw new Error("Unterstützte Installationsmethode: winget/npm/pip.");
 const r=await runCollected(file,args,ROOT,60*60*1000);
 if(r.code!==0)throw new Error(r.stderr||r.stdout||"Installation fehlgeschlagen");
 return{ok:true,method,package:req.package,output:(r.stdout||r.stderr).slice(-12000),registry:probe()}
}
function relaunchAdmin(){
 if(adminStatus())return{already:true};
 const exe=process.execPath;
 const arg=`Start-Process -FilePath '${exe.replace(/'/g,"''")}' -Verb RunAs`;
 cp.spawn("powershell.exe",["-NoProfile","-Command",arg],{detached:true,stdio:"ignore",windowsHide:true}).unref();
 setTimeout(()=>app.quit(),250);
 return{started:true}
}
function referenceInfo(){
 const exists=fs.existsSync(REF);
 let commit=null,license=null;
 if(exists){
   const g=path.join(ROOT,"Tools","Git","cmd","git.exe");
   if(fs.existsSync(g)){const r=runSync(g,["-C",REF,"rev-parse","HEAD"]);if(r.ok)commit=r.stdout}
   const lp=path.join(REF,"LICENSE");if(fs.existsSync(lp))license=fs.readFileSync(lp,"utf8").slice(0,5000);
 }
 return{path:REF,exists,commit,license}
}
async function compareReference(preferred="auto"){
 const reg=probe();
 if(!reg.referenceAvailable)throw new Error("PersonalJarvis Referenz fehlt.");
 const readme=fs.existsSync(path.join(REF,"README.md"))?fs.readFileSync(path.join(REF,"README.md"),"utf8").slice(0,90000):"";
 const context=fs.existsSync(path.join(REF,"docs","LLM-CONTEXT.md"))?fs.readFileSync(path.join(REF,"docs","LLM-CONTEXT.md"),"utf8").slice(0,150000):"";
 const prompt=`Du bist OS Chief Architect.
Vergleiche OS unter S:\\OS mit der MIT-lizenzierten Referenz PersonalJarvis unter:
${REF}

OS MUSS OS heißen und eigenständig bleiben.
Ziel ist KEINE starre Kopie, sondern die stärksten Architekturmuster zu übernehmen:
Capability discovery, protocol/plugin seams, mission isolation, provider routing, memory,
computer-use, voice, tool registry, self-healing/self-development, UI/UX.

REFERENZ README:
${readme}

REFERENZ ENGINEERING CONTEXT:
${context}

Erstelle eine priorisierte Portierungs-Roadmap. Markiere:
- übernehmen
- besser neu implementieren
- nicht übernehmen
- bereits in OS vorhanden
- Abhängigkeiten
- Tests
- Lizenz-/Attributionshinweise
- nächste EINZIGE beste Entwicklungsaufgabe für OS.

Am Ende exakt:
NEXT_GOAL: <eine konkrete implementierbare Aufgabe>`;
 const r=await askArchitect(prompt,preferred);
 const m=r.text.match(/NEXT_GOAL:\s*(.+)/i);
 const result={engine:r.engine,text:r.text,nextGoal:m?m[1].trim():null,at:new Date().toISOString()};
 const out=path.join(DATA,"reference-analysis");ensure(out);const file=path.join(out,new Date().toISOString().replace(/[:.]/g,"-")+".md");
 fs.writeFileSync(file,"# OS ↔ PersonalJarvis Architecture Analysis\n\n"+r.text,"utf8");
 return{...result,file:path.relative(ROOT,file)}
}

async function generateCapabilitySpec(req,preferred="auto"){
 const prompt=`Du bist OS Capability Builder.
Erzeuge eine provider-neutrale Capability-Spezifikation für:
${JSON.stringify(req,null,2)}

Die Fähigkeit existiert noch nicht zuverlässig als vorhandenes Tool.
Entwirf, wie OS sie selbst bereitstellen kann.
Antworte als Markdown mit:
- Zweck
- Inputs/Outputs
- mögliche Implementierungsmethoden
- bevorzugte Methode
- benötigte Abhängigkeiten
- Tool-/API-Schnittstelle
- Risiken
- Tests
- Fallbacks
- Adapter-/Skill-Struktur
Keine Secrets hardcoden.`;
 const r=await askArchitect(prompt,preferred);
 const name=String(req.capability||"generated-capability").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
 const file=path.join(GENERATED,(name||"capability")+".md");
 fs.writeFileSync(file,"# Generated Capability\n\n"+r.text,"utf8");
 return{engine:r.engine,file:path.relative(ROOT,file)}
}
async function autoAcquire(goal,preferred="auto"){
 const {plan}=await analyzeNeed(goal,preferred);
 const report={goal,startedAt:new Date().toISOString(),steps:[],pending:[]};
 for(const req of plan.requirements||[]){
   try{
     if(req.strategy==="use"){
       report.steps.push({capability:req.capability,status:"ready",action:"use",candidate:req.candidate||null});
     }else if(req.strategy==="adapt"){
       const reg=probe();
       const cap=reg.capabilities.find(x=>x.id===req.candidate||x.name===req.candidate);
       if(cap&&cap.type==="executable"){
         const a=await generateAdapter(cap.id,preferred);
         report.steps.push({capability:req.capability,status:"ready",action:"adapter",file:a.file});
       }else{
         const g=await generateCapabilitySpec(req,preferred);
         report.steps.push({capability:req.capability,status:"generated-spec",action:"generate",file:g.file});
       }
     }else if(req.strategy==="install"){
       if(req.risk==="high"){report.pending.push({...req,status:"manual-review-high-risk"});continue}
       if(!req.method||!req.package){report.pending.push({...req,status:"missing-package-metadata"});continue}
       const x=await installCapability({method:req.method,package:req.package,kind:"software-install"});
       report.steps.push({capability:req.capability,status:"installed",action:req.method,package:req.package});
     }else if(req.strategy==="generate"){
       const g=await generateCapabilitySpec(req,preferred);
       report.steps.push({capability:req.capability,status:"generated-spec",action:"generate",file:g.file});
     }else if(req.strategy==="connect"){
       report.pending.push({...req,status:"authorization-or-connector-required"});
     }else if(req.strategy==="combine"){
       const g=await generateCapabilitySpec(req,preferred);
       report.steps.push({capability:req.capability,status:"combination-spec",action:"combine",file:g.file});
     }else{
       report.pending.push({...req,status:"unknown-strategy"});
     }
   }catch(e){report.steps.push({capability:req.capability,status:"failed",error:e.message})}
 }
 report.finishedAt=new Date().toISOString();report.registry=probe();
 const out=path.join(DATA,"capability-acquisition");ensure(out);
 const file=path.join(out,new Date().toISOString().replace(/[:.]/g,"-")+".json");writeJson(file,report);
 return{report,file:path.relative(ROOT,file)}
}

function registerCapabilityFabric(){
 ensure(CAPDIR);ensure(ADAPTERS);ensure(GENERATED);
 ipcMain.handle("caps:probe",()=>probe());
 ipcMain.handle("caps:audit",()=>audit());
 ipcMain.handle("caps:plan",(_e,{goal,engine})=>analyzeNeed(goal,engine||"auto"));
 ipcMain.handle("caps:inspect",(_e,id)=>inspectCLI(id));
 ipcMain.handle("caps:adapter",(_e,{id,engine})=>generateAdapter(id,engine||"auto"));
 ipcMain.handle("caps:install",(_e,req)=>installCapability(req));
 ipcMain.handle("admin:status",()=>({isAdmin:adminStatus()}));
 ipcMain.handle("admin:relaunch",()=>relaunchAdmin());
 ipcMain.handle("reference:info",()=>referenceInfo());
 ipcMain.handle("reference:compare",(_e,engine)=>compareReference(engine||"auto"));
}
module.exports={registerCapabilityFabric,probe,audit,analyzeNeed,compareReference};
