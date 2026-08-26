"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const cp=require("child_process");

const root=path.resolve(__dirname,"..");
const jsFiles=["main.js","preload.js","dev-pipeline.js","renderer/app.js"];

for(const rel of jsFiles){
  const file=path.join(root,rel);
  assert(fs.existsSync(file),`Missing ${rel}`);
  const result=cp.spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.strictEqual(result.status,0,`${rel} syntax failed:\n${result.stderr||result.stdout}`);
}

const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
assert.strictEqual(pkg.version,"0.6.0");
assert.strictEqual(pkg.main,"main.js");

const main=fs.readFileSync(path.join(root,"main.js"),"utf8");
const preload=fs.readFileSync(path.join(root,"preload.js"),"utf8");
const capabilityFabric=fs.readFileSync(path.join(root,"capability-fabric.js"),"utf8");
const html=fs.readFileSync(path.join(root,"renderer","index.html"),"utf8");

for(const channel of ["status:get","settings:get","engine:run","dev:list"]){
  assert(main.includes(`"${channel}"`)||channel.startsWith("dev:"),`Main handler missing: ${channel}`);
  assert(preload.includes(`"${channel}"`),`Preload bridge missing: ${channel}`);
}
assert(capabilityFabric.includes('"caps:audit"'),"Capability audit handler missing");
assert(preload.includes('"caps:audit"'),"Capability audit bridge missing");

assert(main.includes("contextIsolation:true"),"contextIsolation must stay enabled");
assert(main.includes("sandbox:true"),"renderer sandbox must stay enabled");
assert(main.includes("nodeIntegration:false"),"nodeIntegration must stay disabled");
assert(html.includes("Content-Security-Policy"),"CSP meta tag missing");
assert(!/ipcRenderer\s*:\s*ipcRenderer/.test(preload),"Raw ipcRenderer must not be exposed");
assert(capabilityFabric.includes("registerCapabilityFabric,probe,audit"),"Capability audit export missing");

console.log(`OS Desktop ${pkg.version}: smoke checks passed (${jsFiles.length} JavaScript files).`);
