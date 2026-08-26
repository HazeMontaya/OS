import test from 'node:test'; import assert from 'node:assert/strict'; import http from 'node:http'; import { createProviders } from '../src/providers.mjs';
test('OpenAI-compatible provider transport routes model and response', async () => {
  const server = http.createServer((req,res) => { let body=''; req.on('data',d=>body+=d); req.on('end',()=>{ const input=JSON.parse(body); assert.equal(input.model,'test-model'); res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({choices:[{message:{content:'ok'}}]})); }); });
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;
  process.env.OS_TEST_KEY='x';
  try { const providers=createProviders({autonomy:{commandTimeoutMs:3000},providers:[{id:'test',transport:'openai',baseUrl:`http://127.0.0.1:${port}/v1`,apiKeyEnv:'OS_TEST_KEY',models:['test-model'],defaultModel:'test-model'}]}); const result=await providers.generate('hello','test','test-model'); assert.equal(result.text,'ok'); assert.equal(result.model,'test-model'); }
  finally { delete process.env.OS_TEST_KEY; await new Promise((resolve)=>server.close(resolve)); }
});
