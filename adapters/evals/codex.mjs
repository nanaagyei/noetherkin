import fs from 'node:fs';
import path from 'node:path';
import { parseEvents } from '../../tests/behavior/lib.mjs';
import { root } from '../../tests/behavior/cases.mjs';
export const name = 'codex';
export const defaultBinary = fs.existsSync('/Applications/ChatGPT.app/Contents/Resources/codex') ? '/Applications/ChatGPT.app/Contents/Resources/codex' : 'codex';
export const requiredFlags = ['--ignore-user-config','--ignore-rules','--json','--model'];
export const features = ['shell_tool','hooks','multi_agent','plugins','skill_search','skip_host_skill_discovery','memories','browser_use','browser_use_external','in_app_browser','image_generation','view_image'];
export function args({workspace, model, sessionId, audit}) {
  const config = {
    approval_policy:'never', sandbox_mode:'workspace-write', project_doc_max_bytes:0,
    web_search:'disabled', 'features.shell_tool':false, 'features.hooks':false,
    'features.multi_agent':false, 'features.multi_agent_v2':false, 'features.plugins':false,
    'features.remote_plugin':false, 'features.skill_search':false, 'features.skip_host_skill_discovery':true,
    'features.external_agent_memory_import':false,
    'features.memories':false, 'features.browser_use':false, 'features.browser_use_external':false,
    'features.in_app_browser':false, 'features.image_generation':false, 'features.view_image':false,
    'apps._default.enabled':false,
    'mcp_servers.eval_files.command':process.execPath,
    'mcp_servers.eval_files.args':[path.join(root,'adapters/evals/file-server.mjs'),workspace,audit],
    'mcp_servers.eval_files.required':true,
    'mcp_servers.eval_files.tools.read_file.approval_mode':'approve',
    'mcp_servers.eval_files.tools.list_files.approval_mode':'approve',
    'mcp_servers.eval_files.tools.write_file.approval_mode':'approve',
    'sandbox_workspace_write.network_access':false,
    'sandbox_workspace_write.exclude_slash_tmp':true,
    'sandbox_workspace_write.exclude_tmpdir_env_var':true,
  };
  const overrides=Object.entries(config).flatMap(([k,v])=>['-c',`${k}=${JSON.stringify(v)}`]);
  return ['exec', ...(sessionId ? ['resume',sessionId] : []),'--ignore-user-config','--ignore-rules','--skip-git-repo-check','--json', ...overrides, ...(model ? ['--model',model] : []), '-'];
}
export function normalize(raw) {
  const parsed=parseEvents(raw); let sessionId=null, model=null, complete=false, failed=false, harnessUnavailable=false;
  const messages=[], tools=[];
  for (const {event:e,line} of parsed.events) {
    if (e.type==='thread.started') {sessionId=e.thread_id; model=e.model ?? null;}
    if (e.type==='turn.completed') complete=true;
    if (e.type==='turn.failed' || e.type==='error') {
      failed=true;
      if (/rate.?limit|usage.?limit|quota|authentication|not logged in|model.*unavailable/i.test(JSON.stringify(e))) harnessUnavailable=true;
    }
    const i=e.item;
    if (i?.type==='agent_message' && e.type==='item.completed') messages.push({line,text:i.text});
    if (i && ['mcp_tool_call','command_execution','file_change','web_search'].includes(i.type) && e.type==='item.started') tools.push({line,id:i.id,name:i.tool ?? i.type,input:i.arguments ?? i.command ?? i.changes});
  }
  return {...parsed,sessionId,model,complete,failed,harnessUnavailable,messages,tools};
}
export function isolationViolations(normalized) {
  return normalized.tools.filter(t=>['command_execution','web_search'].includes(t.name)).map(t=>`Unexpected tool ${t.name}`);
}
export const limitations = 'Shell, web search, browser/image tools, memories, hooks, apps/plugins, host skill discovery and delegation disabled. File reads use a workspace-confined MCP server. Native patch attempts remain subject to workspace-write sandbox. Skill loaded explicitly; native discovery is not evaluated.';
