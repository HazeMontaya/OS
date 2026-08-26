process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  while (true) {
    const nl = buffer.indexOf('\n');
    if (nl < 0) break;
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id === undefined) continue;
    let result = {};
    if (msg.method === 'initialize') result = { protocolVersion:'2025-06-18', capabilities:{ tools:{} }, serverInfo:{ name:'fake', version:'1' } };
    if (msg.method === 'tools/list') result = { tools:[{ name:'echo', description:'Echo input', inputSchema:{ type:'object' } }] };
    if (msg.method === 'tools/call') result = { content:[{ type:'text', text:JSON.stringify(msg.params.arguments || {}) }] };
    process.stdout.write(`${JSON.stringify({ jsonrpc:'2.0', id:msg.id, result })}\n`);
  }
});
