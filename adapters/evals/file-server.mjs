// Minimal, local MCP file surface. No shell, network, canonical publisher or role tools.
// The audit destination belongs to the controller and is never exposed as a tool argument.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const [workspace, audit] = process.argv.slice(2);
if (!workspace || !audit) process.exit(2);
const root = fs.realpathSync(workspace);
function resolve(relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => p === '..' || p === '' || p === '.')) throw new Error('Only workspace-relative file paths are allowed');
  let target = root;
  for (const p of relative.split('/')) {
    target = path.join(target, p);
    try { if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Symlinks are unavailable'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
const schemas = {
  read_file: { type:'object', properties:{ path:{type:'string'} }, required:['path'], additionalProperties:false },
  write_file: { type:'object', properties:{ path:{type:'string'}, content:{type:'string'} }, required:['path','content'], additionalProperties:false },
  list_files: { type:'object', properties:{}, additionalProperties:false },
};
function call(name, args) {
  if (!schemas[name]) throw new Error('Unknown tool');
  const expected = Object.keys(schemas[name].properties);
  if (!args || Object.keys(args).some(k => !expected.includes(k)) || expected.some(k => typeof args[k] !== 'string')) throw new Error('Invalid arguments');
  if (name === 'list_files') {
    const files = [];
    const visit = (dir, pre = '') => { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const rel = pre + e.name; if (e.isSymbolicLink()) files.push(rel + ' [symlink unavailable]'); else if (e.isDirectory()) visit(path.join(dir,e.name),rel+'/'); else files.push(rel); } };
    visit(root); return files.sort().join('\n');
  }
  const file = resolve(args.path);
  if (name === 'read_file') { if (fs.statSync(file).size > 1024*1024) throw new Error('File exceeds 1 MiB'); return fs.readFileSync(file,'utf8'); }
  if (Buffer.byteLength(args.content) > 1024*1024) throw new Error('Write exceeds 1 MiB');
  fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file,args.content); return `Wrote ${args.path}`;
}
function respond(request) {
  if (request.id === undefined) return;
  let result;
  if (request.method === 'initialize') result = {protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'eval-files',version:'1.0.0'}};
  else if (request.method === 'ping') result = {};
  else if (request.method === 'tools/list') result = {tools:Object.entries(schemas).map(([name,inputSchema])=>({name,description:name === 'write_file' ? 'Write a UTF-8 file inside the disposable workspace. Writes are audited; skill permissions still apply.' : name === 'read_file' ? 'Read a UTF-8 file inside the disposable workspace.' : 'List disposable workspace files.',inputSchema}))};
  else if (request.method === 'tools/call') {
    const entry = {at:new Date().toISOString(),name:request.params?.name,arguments:request.params?.arguments};
    try { const text = call(entry.name,entry.arguments); result={content:[{type:'text',text}]}; entry.outcome='ok'; }
    catch(e) { result={isError:true,content:[{type:'text',text:e.message}]}; entry.outcome='denied-or-error'; entry.error=e.message; }
    fs.appendFileSync(audit,JSON.stringify(entry)+'\n');
  } else { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Method not found'}})+'\n'); return; }
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n');
}
readline.createInterface({input:process.stdin}).on('line',line=> { try {respond(JSON.parse(line));} catch { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n'); } });
