
const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.env.OS_HOME || "S:\\OS";
const DEVROOT = path.join(ROOT,"Workspaces","Development");
const SETTINGS = path.join(ROOT,"Config","OS.settings.json");
const SOURCE = path.join(ROOT,"Source","Desktop");
const LIVEAPP = path.join(ROOT,"Apps","OS","resources","app");

function ensureDir(p){fs.mkdirSync(p,{recursive:true})}
function readJson(p,f={}){try{return JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""))}catch{return f}}
function writeJson(p,o){ensureDir(path.dirname(p));const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(o,null,2),"utf8");fs.renameSync(t,p)}
function readText(p,max=500000){try{return fs.readFileSync(p,"utf8").slice(0,max)}catch{return""}}
function slug(s){return String(s||"feature").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42)||"feature"}
function projectDir(id){return path.join(DEVROOT,id)}
function metaPath(id){return path.join(projectDir(id),"project.json")}
function loadProject(id){const p=readJson(metaPath(id),null);if(!p)throw new Error("Development-Projekt nicht gefunden.");return p}
function saveProject(p){p.updatedAt=new Date().toISOString();writeJson(metaPath(p.id),p);return p}
function exe(name){
  const map={
    claude:path.join(ROOT,"Tools","npm-global","claude.cmd"),
    codex:path.join(ROOT,"Tools","npm-global","codex.cmd"),
    opencode:path.join(ROOT,"Tools","npm-global","opencode.cmd"),
    git:path.join(ROOT,"Tools","Git","cmd","git.exe"),
    node:path.join(ROOT,"Runtime","Node","node.exe"),
    powershell:"powershell.exe"
  };
  const p=map[name]; if(name==="powershell")return p;
  return p&&fs.existsSync(p)?p:null;
}
function env(){
  return {...process.env,
    OS_HOME:ROOT,AI_BRAIN_HOME:path.join(ROOT,"Vault"),
    CLAUDE_CONFIG_DIR:path.join(ROOT,"Config","Claude"),
    CODEX_HOME:path.join(ROOT,"Config","Codex"),
    OPENCODE_CONFIG_DIR:path.join(ROOT,"Config","OpenCode"),
    OPENCODE_CONFIG:path.join(ROOT,"Config","OpenCode","opencode.json"),
    OLLAMA_MODELS:path.join(ROOT,"Models","Ollama"),
    OLLAMA_HOST:"127.0.0.1:11434",
    TEMP:path.join(ROOT,"Temp"),TMP:path.join(ROOT,"Temp")
  };
}
function run(file,args=[],cwd=ROOT,timeout=45*60*1000){
  return new Promise((resolve,reject)=>{
    const child=cp.spawn(file,args,{cwd,env:env(),windowsHide:true,shell:String(file).toLowerCase().endsWith(".cmd")});
    let out="",err=""; const max=25*1024*1024;
    child.stdout?.on("data",d=>{if(out.length<max)out+=d.toString()});
    child.stderr?.on("data",d=>{if(err.length<max)err+=d.toString()});
    const timer=setTimeout(()=>{try{child.kill()}catch{};reject(new Error("Agent-Zeitlimit überschritten."))},timeout);
    child.on("error",e=>{clearTimeout(timer);reject(e)});
    child.on("close",code=>{clearTimeout(timer);resolve({code,stdout:out.trim(),stderr:err.trim()})});
  });
}
async function git(args,cwd=ROOT){
  const g=exe("git");if(!g)throw new Error("Git fehlt.");
  const r=await run(g,args,cwd,10*60*1000);
  if(r.code!==0)throw new Error(r.stderr||r.stdout||`git ${args.join(" ")} fehlgeschlagen`);
  return r.stdout;
}
function chooseEngine(preferred,exclude=[]){
  if(preferred && preferred!=="auto" && !exclude.includes(preferred) && exe(preferred)) return preferred;
  for(const e of ["claude","codex","opencode"]) if(!exclude.includes(e)&&exe(e)) return e;
  throw new Error("Keine Cloud-Development-Engine verfügbar. Claude/Codex/OpenCode zuerst anmelden/installieren.");
}
async function agent(engine,prompt,cwd,phase){
  engine=chooseEngine(engine);
  let r;
  if(engine==="claude"){
    const mode=phase==="plan"||phase==="review"?"plan":"acceptEdits";
    const turns=phase==="build"?"32":"14";
    r=await run(exe("claude"),["-p","--permission-mode",mode,"--max-turns",turns,prompt],cwd,60*60*1000);
  }else if(engine==="codex"){
    // Codex exec is intended for non-interactive workflows. The project cwd is the isolated worktree.
    r=await run(exe("codex"),["exec",prompt],cwd,60*60*1000);
  }else{
    const args=["run"];
    if(phase==="build")args.push("--auto");
    args.push(prompt);
    r=await run(exe("opencode"),args,cwd,60*60*1000);
  }
  if(r.code!==0 && !r.stdout)throw new Error(r.stderr||`${engine} exit ${r.code}`);
  return {engine,text:r.stdout||r.stderr||""};
}
function stageStatus(p,stage,state,extra={}){
  p.stages=p.stages||{};
  p.stages[stage]={state,at:new Date().toISOString(),...extra};
  return saveProject(p);
}
function listProjects(){
  ensureDir(DEVROOT);
  return fs.readdirSync(DEVROOT,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>{
    const p=readJson(path.join(DEVROOT,x.name,"project.json"),null);return p;
  }).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function createProject(input){
  ensureDir(DEVROOT);
  const now=new Date();
  const id=now.toISOString().replace(/[-:TZ.]/g,"").slice(0,14)+"-"+slug(input.goal);
  const dir=projectDir(id);ensureDir(dir);
  const p={
    id,goal:String(input.goal||"").trim(),
    engines:{plan:input.planEngine||"auto",build:input.buildEngine||"auto",review:input.reviewEngine||"auto"},
    status:"created",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    worktree:path.join(dir,"worktree"),branch:"os-dev/"+id,stages:{}
  };
  if(!p.goal)throw new Error("Entwicklungsziel fehlt.");
  writeJson(metaPath(id),p);
  fs.writeFileSync(path.join(dir,"GOAL.md"),`# Entwicklungsziel\n\n${p.goal}\n`,"utf8");
  return p;
}
async function planProject(id){
  let p=loadProject(id);stageStatus(p,"plan","running");
  const prompt=`Du bist der OS Architect.
ZIEL DES NUTZERS:
${p.goal}

Analysiere das vorhandene OS unter ${ROOT}. ÄNDERE KEINE DATEIEN.
Lies besonders:
- ${path.join(ROOT,"Core")}
- ${path.join(ROOT,"Config","OS.settings.json")}
- ${path.join(ROOT,"Source","Desktop")}
- ${path.join(ROOT,"Agents")}
- ${path.join(ROOT,"Skills")}

Erstelle einen implementierbaren Entwicklungsplan.
Pflichtstruktur:
1. Ziel / Erfolgskriterien
2. betroffene Module/Dateien
3. Architekturentscheidung
4. konkrete Implementierungsschritte
5. Tests
6. Risiken
7. Rollback
8. Definition of Done

Vermeide unnötige Abhängigkeiten. Behalte vollständige Individualisierbarkeit und bestehende Datenkompatibilität.`;
  try{
    const r=await agent(p.engines.plan,prompt,ROOT,"plan");
    const f=path.join(projectDir(id),"PLAN.md");fs.writeFileSync(f,`# PLAN\n\nEngine: ${r.engine}\n\n${r.text}`,"utf8");
    p=loadProject(id);p.engines.planUsed=r.engine;p.status="planned";stageStatus(p,"plan","passed",{file:"PLAN.md",engine:r.engine});
    return loadProject(id);
  }catch(e){p=loadProject(id);p.status="failed";stageStatus(p,"plan","failed",{error:e.message});throw e}
}
async function ensureWorktree(p){
  if(fs.existsSync(p.worktree))return;
  const dirty=(await git(["status","--porcelain"],ROOT)).trim();
  if(dirty)fs.writeFileSync(path.join(projectDir(p.id),"ROOT_DIRTY_STATUS.txt"),dirty,"utf8");
  try{await git(["worktree","add","-b",p.branch,p.worktree,"HEAD"],ROOT)}
  catch(e){
    // If branch exists from a previous interrupted attempt, retry using the branch.
    await git(["worktree","add",p.worktree,p.branch],ROOT);
  }
}
async function buildProject(id){
  let p=loadProject(id);
  if(!fs.existsSync(path.join(projectDir(id),"PLAN.md")))throw new Error("Zuerst PLAN ausführen.");
  stageStatus(p,"sandbox","running");
  await ensureWorktree(p);
  p=loadProject(id);stageStatus(p,"sandbox","passed",{path:p.worktree,branch:p.branch});
  stageStatus(p,"build","running");
  const plan=readText(path.join(projectDir(id),"PLAN.md"),350000);
  const prompt=`Du bist der OS Builder und arbeitest in einem ISOLIERTEN GIT-WORKTREE:
${p.worktree}

NUTZERZIEL:
${p.goal}

ARCHITEKTURPLAN:
${plan}

IMPLEMENTIERE die geforderte Funktion jetzt vollständig.

HARTE REGELN:
- Änderungen ausschließlich im aktuellen Worktree vornehmen.
- Niemals S:\\OS\\Apps, Runtime, Tools, Models, Backups oder Secrets verändern.
- Bestehende Nutzerkonfiguration und Daten kompatibel halten.
- Keine Zugangsdaten erzeugen oder hardcoden.
- Vorhandene Architektur weiterverwenden, unnötige Dependencies vermeiden.
- Wenn UI verändert wird, Source\\Desktop aktualisieren.
- Wenn Core/Agents/Skills verändert werden, nur die entsprechenden versionierten Dateien im Worktree ändern.
- Keine Veröffentlichung, kein git push, keine externen Aktionen.
- Führe sinnvolle lokale, nicht-destruktive Checks aus.
- Am Ende kurz auflisten: geänderte Dateien, Tests, offene Risiken.`;
  try{
    const r=await agent(p.engines.build,prompt,p.worktree,"build");
    fs.writeFileSync(path.join(projectDir(id),"BUILD.md"),`# BUILD\n\nEngine: ${r.engine}\n\n${r.text}`,"utf8");
    const stat=await git(["diff","--stat","HEAD"],p.worktree);
    const diff=await git(["diff","--no-ext-diff","HEAD"],p.worktree);
    const untracked=await git(["ls-files","--others","--exclude-standard"],p.worktree);
    fs.writeFileSync(path.join(projectDir(id),"DIFF.stat.txt"),stat,"utf8");
    fs.writeFileSync(path.join(projectDir(id),"DIFF.patch"),diff.slice(0,8*1024*1024),"utf8");
    fs.writeFileSync(path.join(projectDir(id),"UNTRACKED.txt"),untracked,"utf8");
    let untrackedContent="";
    for(const rel of untracked.split(/\r?\n/).filter(Boolean).slice(0,120)){
      const f=path.join(p.worktree,rel);
      try{
        if(fs.statSync(f).isFile() && fs.statSync(f).size<512*1024){
          untrackedContent+=`\n\n===== NEW FILE: ${rel} =====\n${readText(f,512*1024)}`;
        }
      }catch{}
      if(untrackedContent.length>2*1024*1024)break;
    }
    fs.writeFileSync(path.join(projectDir(id),"UNTRACKED_CONTENT.txt"),untrackedContent,"utf8");
    p=loadProject(id);p.engines.buildUsed=r.engine;p.status="built";stageStatus(p,"build","passed",{engine:r.engine,stat});
    return loadProject(id);
  }catch(e){p=loadProject(id);p.status="failed";stageStatus(p,"build","failed",{error:e.message});throw e}
}
function recursiveFiles(dir,filter,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(["node_modules",".git","Apps","Runtime","Tools","Models","Backups","Downloads","Cache"].includes(ent.name))continue;
    const f=path.join(dir,ent.name);
    if(ent.isDirectory())recursiveFiles(f,filter,out);else if(filter(f))out.push(f);
    if(out.length>4000)break;
  }
  return out;
}
async function testProject(id){
  let p=loadProject(id);if(!fs.existsSync(p.worktree))throw new Error("Sandbox fehlt.");
  stageStatus(p,"test","running");
  const results=[];let passed=true;
  function add(name,ok,details=""){results.push({name,ok,details:String(details).slice(0,12000)});if(!ok)passed=false}
  const node=exe("node");
  // Required app files
  for(const rel of ["Source\\Desktop\\package.json","Source\\Desktop\\main.js","Source\\Desktop\\preload.js","Source\\Desktop\\renderer\\index.html","Source\\Desktop\\renderer\\app.js","Source\\Desktop\\renderer\\styles.css"]){
    add("required:"+rel,fs.existsSync(path.join(p.worktree,rel)),fs.existsSync(path.join(p.worktree,rel))?"OK":"fehlt");
  }
  // JS syntax
  if(node){
    const js=recursiveFiles(path.join(p.worktree,"Source","Desktop"),f=>f.endsWith(".js"));
    for(const f of js){
      const r=await run(node,["--check",f],p.worktree,120000);
      add("node --check "+path.relative(p.worktree,f),r.code===0,r.stderr||r.stdout);
    }
  }else add("Node runtime",false,"Node fehlt");
  // JSON parse
  for(const f of recursiveFiles(p.worktree,f=>f.endsWith(".json"))){
    if(f.includes(path.sep+"Config"+path.sep+"Claude"+path.sep)||f.includes(path.sep+"Config"+path.sep+"Codex"+path.sep))continue;
    try{JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));add("json "+path.relative(p.worktree,f),true)}
    catch(e){add("json "+path.relative(p.worktree,f),false,e.message)}
  }
  // PowerShell syntax parse
  const ps=recursiveFiles(p.worktree,f=>f.endsWith(".ps1"));
  for(const f of ps.slice(0,150)){
    const cmd=`$e=$null;$t=$null;[System.Management.Automation.Language.Parser]::ParseFile('${f.replace(/'/g,"''")}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e|ForEach-Object{$_.Message};exit 1}`;
    const r=await run("powershell.exe",["-NoProfile","-Command",cmd],p.worktree,120000);
    add("ps syntax "+path.relative(p.worktree,f),r.code===0,r.stdout||r.stderr);
  }
  // Guardrails
  const changed=(await git(["diff","--name-only","HEAD"],p.worktree)).split(/\r?\n/).filter(Boolean);
  const untracked=(await git(["ls-files","--others","--exclude-standard"],p.worktree)).split(/\r?\n/).filter(Boolean);
  const all=[...new Set([...changed,...untracked])];
  const forbidden=all.filter(x=>/^(Apps|Runtime|Tools|Models|Backups|Downloads|Cache)[\\/]/i.test(x));
  add("keine Runtime/Tool-Modifikation",forbidden.length===0,forbidden.join("\n"));
  const secretPatterns=[/AKIA[0-9A-Z]{16}/,/sk-[A-Za-z0-9_-]{20,}/,/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/];
  let secrets=[];
  for(const rel of all.slice(0,500)){
    const f=path.join(p.worktree,rel);if(!fs.existsSync(f)||fs.statSync(f).size>1024*1024)continue;
    const txt=readText(f,1024*1024);if(secretPatterns.some(rx=>rx.test(txt)))secrets.push(rel);
  }
  add("keine offensichtlichen Secrets",secrets.length===0,secrets.join("\n"));
  const out={passed,at:new Date().toISOString(),changedFiles:all,results};
  writeJson(path.join(projectDir(id),"TESTS.json"),out);
  p=loadProject(id);p.status=passed?"tested":"test-failed";stageStatus(p,"test",passed?"passed":"failed",{file:"TESTS.json",checks:results.length});
  return out;
}
async function reviewProject(id){
  let p=loadProject(id);const tests=readJson(path.join(projectDir(id),"TESTS.json"),null);
  if(!tests)throw new Error("Zuerst Tests ausführen.");
  stageStatus(p,"review","running");
  const plan=readText(path.join(projectDir(id),"PLAN.md"),180000);
  const diff=readText(path.join(projectDir(id),"DIFF.patch"),300000);
  const untrackedContent=readText(path.join(projectDir(id),"UNTRACKED_CONTENT.txt"),180000);
  const build=readText(path.join(projectDir(id),"BUILD.md"),100000);
  const requested=p.engines.review;
  let reviewEngine;
  try{reviewEngine=chooseEngine(requested,[p.engines.buildUsed].filter(Boolean))}
  catch{reviewEngine=chooseEngine(requested,[])}
  const prompt=`Du bist der unabhängige OS Reviewer. NICHTS ändern.

NUTZERZIEL:
${p.goal}

PLAN:
${plan}

BUILDER-BERICHT:
${build}

TESTS:
${JSON.stringify(tests,null,2).slice(0,100000)}

GIT DIFF:
${diff}

NEUE UNGETRACKTE DATEIEN:
${untrackedContent}

Prüfe Funktionalität, Regressionen, Sicherheit, Datenkompatibilität, UI/UX und Wartbarkeit.
ERSTE ZEILE MUSS EXAKT sein:
DECISION: APPROVE
oder
DECISION: REJECT

Danach:
- Begründung
- Blocker
- wichtige Hinweise
- empfohlene zusätzliche Tests
- Einschätzung Rollback.`;
  try{
    const r=await agent(reviewEngine,prompt,p.worktree,"review");
    const decision=/DECISION:\s*APPROVE/i.test(r.text)?"APPROVE":"REJECT";
    fs.writeFileSync(path.join(projectDir(id),"REVIEW.md"),`# REVIEW\n\nEngine: ${r.engine}\n\n${r.text}`,"utf8");
    p=loadProject(id);p.engines.reviewUsed=r.engine;p.reviewDecision=decision;p.status=decision==="APPROVE"?"approved":"rejected";stageStatus(p,"review",decision==="APPROVE"?"passed":"failed",{engine:r.engine,decision,file:"REVIEW.md"});
    return loadProject(id);
  }catch(e){p=loadProject(id);stageStatus(p,"review","failed",{error:e.message});throw e}
}
async function buildCandidate(id){
  let p=loadProject(id);if(!fs.existsSync(p.worktree))throw new Error("Worktree fehlt.");
  if(!readJson(path.join(projectDir(id),"TESTS.json"),{}).passed)throw new Error("Tests sind nicht bestanden.");
  stageStatus(p,"candidate","running");
  const currentApp=path.join(ROOT,"Apps","OS");
  if(!fs.existsSync(currentApp))throw new Error("Installierte OS-App fehlt.");
  const candidate=path.join(projectDir(id),"candidate","OS");
  if(fs.existsSync(candidate))fs.rmSync(candidate,{recursive:true,force:true});
  ensureDir(path.dirname(candidate));
  fs.cpSync(currentApp,candidate,{recursive:true,force:true});
  const candSource=path.join(p.worktree,"Source","Desktop");
  if(!fs.existsSync(candSource))throw new Error("Source\\Desktop fehlt im Worktree.");
  const candRes=path.join(candidate,"resources","app");
  if(fs.existsSync(candRes))fs.rmSync(candRes,{recursive:true,force:true});
  fs.cpSync(candSource,candRes,{recursive:true,force:true});
  p=loadProject(id);p.candidateExe=path.join(candidate,"OS.exe");p.status="candidate";stageStatus(p,"candidate","passed",{exe:p.candidateExe});
  return p;
}
function changedEntries(worktree){
  const g=exe("git");
  const out=cp.execFileSync(g,["status","--porcelain=v1"],{cwd:worktree,encoding:"utf8",env:env()});
  return out.split(/\r?\n/).filter(Boolean).map(line=>{
    const status=line.slice(0,2),raw=line.slice(3);
    if(status.startsWith("R")){
      const [oldp,newp]=raw.split(" -> ");return{status,old:oldp,path:newp};
    }
    return{status,path:raw};
  });
}
function promotionBackup(p,entries){
  const dir=path.join(projectDir(p.id),"promotion-backup");if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true,force:true});ensureDir(dir);
  const manifest=[];
  for(const e of entries){
    const target=path.join(ROOT,e.path);const item={path:e.path,status:e.status,existed:fs.existsSync(target)};
    if(item.existed){
      const backup=path.join(dir,"files",e.path);ensureDir(path.dirname(backup));fs.cpSync(target,backup,{recursive:true,force:true});item.backup=path.relative(dir,backup);
    }
    if(e.old){
      const oldT=path.join(ROOT,e.old);item.old=e.old;item.oldExisted=fs.existsSync(oldT);
      if(item.oldExisted){const oldB=path.join(dir,"files",e.old);ensureDir(path.dirname(oldB));fs.cpSync(oldT,oldB,{recursive:true,force:true});item.oldBackup=path.relative(dir,oldB)}
    }
    manifest.push(item);
  }
  writeJson(path.join(dir,"manifest.json"),manifest);return dir;
}
async function promoteProject(id,force=false){
  let p=loadProject(id);const tests=readJson(path.join(projectDir(id),"TESTS.json"),{});
  if(!tests.passed)throw new Error("Promotion blockiert: Tests nicht bestanden.");
  if(p.reviewDecision!=="APPROVE"&&!force)throw new Error("Promotion blockiert: Review nicht APPROVE.");
  const entries=changedEntries(p.worktree);
  if(!entries.length)throw new Error("Keine Änderungen zu übernehmen.");
  stageStatus(p,"promote","running");
  const backup=promotionBackup(p,entries);
  for(const e of entries){
    const src=path.join(p.worktree,e.path),dst=path.join(ROOT,e.path);
    if(e.old && e.old!==e.path){const oldDst=path.join(ROOT,e.old);if(fs.existsSync(oldDst))fs.rmSync(oldDst,{recursive:true,force:true})}
    if(e.status.includes("D")){if(fs.existsSync(dst))fs.rmSync(dst,{recursive:true,force:true});continue}
    if(fs.existsSync(src)){ensureDir(path.dirname(dst));fs.cpSync(src,dst,{recursive:true,force:true})}
  }
  // Commit only promoted changes.
  const g=exe("git");await run(g,["add","-A"],ROOT,10*60*1000);
  const commit=await run(g,["-c","user.name=OS","-c","user.email=os@local.invalid","commit","-m",`OS develop: ${p.goal.slice(0,72)}`],ROOT,10*60*1000);
  let hash="";try{hash=(await git(["rev-parse","HEAD"],ROOT)).trim()}catch{}
  p=loadProject(id);p.prePromotionBackup=backup;p.promotedCommit=hash;p.status="promoted";stageStatus(p,"promote","passed",{commit:hash,backup});
  // If desktop source changed, stage hot update and restart outside current process.
  const desktopChanged=entries.some(e=>e.path.replace(/\//g,"\\").toLowerCase().startsWith("source\\desktop\\"));
  if(desktopChanged){
    const helper=path.join(projectDir(id),"APPLY_DESKTOP_UPDATE.ps1");
    const script=`param([int]$PidToWait)\n$ErrorActionPreference='Stop'\nwhile(Get-Process -Id $PidToWait -ErrorAction SilentlyContinue){Start-Sleep -Milliseconds 400}\n$src='S:\\\\OS\\\\Source\\\\Desktop'\n$dst='S:\\\\OS\\\\Apps\\\\OS\\\\resources\\\\app'\nif(Test-Path $dst){Remove-Item $dst -Recurse -Force}\nCopy-Item $src $dst -Recurse -Force\nStart-Process 'S:\\\\OS\\\\Apps\\\\OS\\\\OS.exe'\n`;
    fs.writeFileSync(helper,script,"utf8");
    const child=cp.spawn("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",helper,"-PidToWait",String(process.pid)],{detached:true,stdio:"ignore",windowsHide:true});
    child.unref();
    setTimeout(()=>app.quit(),300);
  }
  return loadProject(id);
}
async function rollbackProject(id){
  let p=loadProject(id);if(!p.prePromotionBackup)throw new Error("Kein Promotion-Backup vorhanden.");
  const dir=p.prePromotionBackup;const manifest=readJson(path.join(dir,"manifest.json"),null);if(!manifest)throw new Error("Rollback-Manifest fehlt.");
  for(const item of manifest){
    const dst=path.join(ROOT,item.path);
    if(item.existed && item.backup){
      if(fs.existsSync(dst))fs.rmSync(dst,{recursive:true,force:true});
      ensureDir(path.dirname(dst));fs.cpSync(path.join(dir,item.backup),dst,{recursive:true,force:true});
    }else if(fs.existsSync(dst)){fs.rmSync(dst,{recursive:true,force:true})}
    if(item.old){
      const oldDst=path.join(ROOT,item.old);
      if(item.oldExisted && item.oldBackup){
        if(fs.existsSync(oldDst))fs.rmSync(oldDst,{recursive:true,force:true});
        ensureDir(path.dirname(oldDst));fs.cpSync(path.join(dir,item.oldBackup),oldDst,{recursive:true,force:true});
      }
    }
  }
  const g=exe("git");await run(g,["add","-A"],ROOT,10*60*1000);
  await run(g,["-c","user.name=OS","-c","user.email=os@local.invalid","commit","-m",`Rollback OS develop: ${p.goal.slice(0,70)}`],ROOT,10*60*1000);
  p=loadProject(id);p.status="rolled-back";stageStatus(p,"rollback","passed");
  const desktopAffected=manifest.some(x=>x.path.replace(/\//g,"\\").toLowerCase().startsWith("source\\desktop\\"));
  if(desktopAffected){
    const helper=path.join(projectDir(id),"APPLY_ROLLBACK.ps1");
    fs.writeFileSync(helper,`param([int]$PidToWait)\nwhile(Get-Process -Id $PidToWait -ErrorAction SilentlyContinue){Start-Sleep -Milliseconds 400}\n$src='S:\\\\OS\\\\Source\\\\Desktop';$dst='S:\\\\OS\\\\Apps\\\\OS\\\\resources\\\\app';if(Test-Path $dst){Remove-Item $dst -Recurse -Force};Copy-Item $src $dst -Recurse -Force;Start-Process 'S:\\\\OS\\\\Apps\\\\OS\\\\OS.exe'\n`,"utf8");
    const child=cp.spawn("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",helper,"-PidToWait",String(process.pid)],{detached:true,stdio:"ignore",windowsHide:true});child.unref();setTimeout(()=>app.quit(),300);
  }
  return loadProject(id);
}
async function launchCandidate(id){
  const p=loadProject(id);if(!p.candidateExe||!fs.existsSync(p.candidateExe))throw new Error("Candidate noch nicht gebaut.");
  const child=cp.spawn(p.candidateExe,["--candidate",id],{detached:true,stdio:"ignore",env:{...env(),OS_CANDIDATE:"1"}});child.unref();return true;
}
async function cleanupProject(id){
  const p=loadProject(id);
  if(fs.existsSync(p.worktree)){
    try{await git(["worktree","remove","--force",p.worktree],ROOT)}catch{}
  }
  try{await git(["branch","-D",p.branch],ROOT)}catch{}
  p.status="closed";stageStatus(p,"cleanup","passed");return loadProject(id);
}


async function autoEvolve(input={}){
  const ref=path.join(ROOT,"Reference","PersonalJarvis");
  if(!fs.existsSync(ref))throw new Error("PersonalJarvis Referenz fehlt.");
  const s=readJson(SETTINGS,{});
  const readme=readText(path.join(ref,"README.md"),80000);
  const ctxt=readText(path.join(ref,"docs","LLM-CONTEXT.md"),120000);
  const prompt=`Du bist OS Evolution Architect.
Vergleiche OS mit der PersonalJarvis-Referenz. OS bleibt eigenständig und heißt OS.
Wähle GENAU EINE nächste Verbesserung, die maximalen Nutzen hat und in einem isolierten Development-Projekt realistisch implementierbar ist.
Berücksichtige besonders: Capability Discovery, provider-neutrale Plugins, Computer Use, Voice, Memory, Mission Isolation, Tool Registry, Self-Healing, UI.
OS hat bereits Desktop UI, Vault, Agents, Skills, MCP, Develop-Pipeline und Capability Fabric.
Referenz README:
${readme}
Engineering Context:
${ctxt}
Antworte nur:
GOAL: <konkretes Entwicklungsziel>`;
  const a=await agent(input.engine||"auto",prompt,ROOT,"plan");
  const m=a.text.match(/GOAL:\s*(.+)/i);if(!m)throw new Error("Evolution Architect lieferte kein GOAL.");
  const p=await createProject({goal:m[1].trim(),planEngine:input.engine||"auto",buildEngine:input.buildEngine||"auto",reviewEngine:input.reviewEngine||"auto"});
  await planProject(p.id);await buildProject(p.id);const tests=await testProject(p.id);
  if(!tests.passed)return loadProject(p.id);
  const reviewed=await reviewProject(p.id);
  if(reviewed.reviewDecision!=="APPROVE")return reviewed;
  await buildCandidate(p.id);
  const latest=loadProject(p.id);
  if(s.autonomy?.preset==="full" && s.autonomy?.selfImprove==="allow" && input.autoPromote===true){
    return promoteProject(p.id,false);
  }
  return latest;
}

function registerDevPipeline(){
  ensureDir(DEVROOT);
  ipcMain.handle("dev:list",()=>listProjects());
  ipcMain.handle("dev:create",(_e,input)=>createProject(input));
  ipcMain.handle("dev:get",(_e,id)=>loadProject(id));
  ipcMain.handle("dev:plan",(_e,id)=>planProject(id));
  ipcMain.handle("dev:build",(_e,id)=>buildProject(id));
  ipcMain.handle("dev:test",(_e,id)=>testProject(id));
  ipcMain.handle("dev:review",(_e,id)=>reviewProject(id));
  ipcMain.handle("dev:candidate",(_e,id)=>buildCandidate(id));
  ipcMain.handle("dev:launchCandidate",(_e,id)=>launchCandidate(id));
  ipcMain.handle("dev:promote",(_e,{id,force=false})=>promoteProject(id,force));
  ipcMain.handle("dev:rollback",(_e,id)=>rollbackProject(id));
  ipcMain.handle("dev:cleanup",(_e,id)=>cleanupProject(id));
  ipcMain.handle("dev:autoEvolve",(_e,input)=>autoEvolve(input||{}));
}
module.exports={registerDevPipeline};
