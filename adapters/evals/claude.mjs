import { parseEvents } from '../../tests/behavior/lib.mjs';
export const name = 'claude';
export const defaultBinary = 'claude';
export const requiredFlags = ['--safe-mode','--restricted','--strict-mcp-config','--tools','--resume','--model','--disable-slash-commands'];
export function args({workspace, model, sessionId}) {
  return ['--print','--output-format','stream-json','--verbose','--safe-mode','--restricted','--disable-slash-commands',
    '--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--no-chrome',
    '--tools','Read,Glob,Grep,Write,Edit','--allowedTools','Read,Glob,Grep,Write,Edit',
    '--permission-mode','dontAsk', ...(model ? ['--model',model] : []), ...(sessionId ? ['--resume',sessionId] : [])];
}
export function normalize(raw) {
  const parsed = parseEvents(raw); let sessionId = null, model = null, complete = false, failed = false, harnessUnavailable = false;
  const messages = [], tools = [];
  for (const {event:e,line} of parsed.events) {
    if (e.type === 'system' && e.subtype === 'init') { sessionId=e.session_id; model=e.model; }
    if (e.type === 'assistant') {
      if (e.is_api_error_message === true) harnessUnavailable = true;
      model ??= e.message?.model;
      for (const content of e.message?.content ?? []) {
        if (content.type === 'text') messages.push({line,text:content.text});
        if (content.type === 'tool_use') tools.push({line,id:content.id,name:content.name,input:content.input});
      }
    }
    if (e.type === 'result') {
      complete=true; failed=e.is_error === true || e.subtype !== 'success'; sessionId ??= e.session_id;
      // A successful terminal result supersedes a recovered transport interruption.
      // Retain the interruption in raw events without skipping the remaining suite.
      if (!failed) harnessUnavailable=false;
    }
  }
  return {...parsed,sessionId,model,complete,failed,harnessUnavailable,messages,tools};
}
const builtinPlugins=new Set(['agents-md@builtin','telemetry@builtin']);
export function isolationViolations(normalized) {
  const errors=[];
  for (const {event:e} of normalized.events) if (e.type==='system' && e.subtype==='init') {
    // Claude Code 2.1.280 reports two built-in plugins even in safe mode. A canary run on 2026-09-23 found that neither
    // loads workspace, parent or user AGENTS.md/CLAUDE.md content under these flags, so exactly these two are allowed.
    // Any other plugin, or these names from a non-builtin source, still fails isolation.
    const unexpectedPlugins=(e.plugins ?? []).filter(p=>!(p?.path==='builtin' && builtinPlugins.has(p?.source)));
    if ((e.mcp_servers ?? []).length || (e.skills ?? []).length || unexpectedPlugins.length) errors.push('Unexpected skills/plugins/MCP servers in isolated Claude context');
    const allowed=new Set(['Read','Glob','Grep','Write','Edit','ToolSearch']);
    if ((e.tools ?? []).some(t=>!allowed.has(t))) errors.push('Unexpected native tool in isolated Claude context');
  }
  return errors;
}
export const limitations = 'Native Read/Glob/Grep/Write/Edit only, restricted to working directories; shell, terminal, network and canonical publisher tools unavailable. Skill loaded explicitly from its isolated bundle; native skill discovery is not evaluated. The host still injects the signed-in account email as system context; it carries no instructions.';
