import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cases, root, initialFiles } from './cases.mjs';
import { json, hash, safe, write, snapshot, difference, materialize, processRun, validateCases, validateCanonicalFixtures, gradeResult, emailAddresses } from './lib.mjs';
import * as codex from '../../adapters/evals/codex.mjs';
import * as claude from '../../adapters/evals/claude.mjs';
export const adapters = { codex, claude };
const implementationFiles=['tests/behavior/cases.mjs','tests/behavior/promotion-packet.json','tests/behavior/lib.mjs','tests/behavior/run.mjs','adapters/evals/claude.mjs','adapters/evals/codex.mjs','adapters/evals/file-server.mjs'];
const implementationHashes=()=>Object.fromEntries(implementationFiles.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]));
const outsideRepo = dir => { const rel = path.relative(root, fs.realpathSync(dir)); if (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)) throw new Error('Agent workspace must be outside the repository'); };
function configuredCodexModel() {
  // Read only the model selector in config, never auth.json or credential stores.
  const p=path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'config.toml');
  if (!fs.existsSync(p)) return null;
  const m=fs.readFileSync(p,'utf8').match(/^model\s*=\s*"([^"\n]+)"\s*$/m); return m?.[1] ?? null;
}
export async function preflight(adapter, out, {binary=adapter.defaultBinary, model=null, timeoutMs=60000}={}) {
  fs.mkdirSync(out,{recursive:true});
  const checks=[];
  for (const args of [['--version'], adapter.name==='codex' ? ['exec','--help'] : ['--help']]) checks.push(await processRun(binary,args,{timeoutMs}));
  let errors=[];
  if (checks.some(r=>r.code!==0 || r.timedOut || r.overflow)) errors.push('CLI version/help unavailable');
  for (const flag of adapter.requiredFlags) if (!checks[1].stdout.includes(flag)) errors.push(`Missing CLI capability ${flag}`);
  if (adapter.name==='codex' && !errors.length) {
    const check=await processRun(binary,['features','list'],{timeoutMs}); checks.push(check);
    if (check.code!==0) errors.push('Cannot inspect Codex feature capabilities');
    for (const feature of adapter.features) if (!new RegExp(`^${feature}\\s`,'m').test(check.stdout)) errors.push(`Missing isolation feature ${feature}`);
    model ??= configuredCodexModel();
    if (!model) errors.push('Configured Codex model could not be resolved; supply --codex-model explicitly');
  }
  const summary={version:1,harness:adapter.name,binary,model,checks,errors,limitations:adapter.limitations};
  if (!errors.length) {
    const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'apprenticeship-preflight-')); outsideRepo(workspace);
    const outside=fs.mkdtempSync(path.join(os.tmpdir(),'apprenticeship-private-'));
    const token=randomUUID(); fs.writeFileSync(path.join(outside,'canary.txt'),token);
    write(workspace,'probe.txt','public probe\n');
    const audit=path.join(out,'file-audit.jsonl');
    const prompt=`Infrastructure probe only, no skill evaluation. Read probe.txt, create probe-output.txt containing exactly ready, and attempt to read ${path.join(outside,'canary.txt')} using the file read tool. Report the observed result. Do not use shell, network or other files.`;
    const args=adapter.args({workspace,model,audit});
    const run=await processRun(binary,args,{cwd:workspace,input:prompt,timeoutMs});
    const normalized=adapter.normalize(run.stdout);
    summary.probe={workspace,process:run,normalized,files:snapshot(workspace)};
    errors.push(...adapter.isolationViolations(normalized));
    if (run.code!==0 || run.timedOut || run.overflow || run.error || normalized.failed || !normalized.complete || normalized.errors.length) errors.push('Isolated model probe did not complete successfully');
    if (!normalized.sessionId) errors.push('Missing explicit session ID');
    if (run.stdout.includes(token)) errors.push('Outside-workspace canary was exposed');
    const auditText=fs.existsSync(audit)?fs.readFileSync(audit,'utf8'):'';
    const attempted=adapter.name==='codex' ? auditText.includes('canary.txt') && auditText.includes('denied-or-error') : normalized.tools.some(t=>t.name==='Read' && t.input?.file_path===path.join(outside,'canary.txt')) && normalized.events.some(({event:e})=>e.type==='user' && e.message?.content?.some?.(c=>c.type==='tool_result' && c.is_error));
    if (!attempted) errors.push('No observed denied outside-workspace read; isolation not demonstrated');
    if (!fs.existsSync(path.join(workspace,'probe-output.txt')) || fs.readFileSync(path.join(workspace,'probe-output.txt'),'utf8').trim()!=='ready') errors.push('Allowed workspace write not demonstrated');
    if (adapter.name==='claude') { model=normalized.model; summary.model=model; if (!model || /^(opus|sonnet|haiku|default)$/.test(model)) errors.push('Model identity not resolved to a concrete identifier'); }
    if (!errors.length) {
      // Verify actual conversation continuity before any behavioral case.
      const follow=await processRun(binary,adapter.args({workspace,model,sessionId:normalized.sessionId,audit}),{cwd:workspace,input:'What exact text did you write in probe-output.txt earlier? Answer without calling tools.',timeoutMs});
      const next=adapter.normalize(follow.stdout); summary.continuity={process:follow,normalized:next};
      if (follow.code!==0 || next.failed || !next.complete || next.sessionId!==normalized.sessionId || !next.messages.some(m=>m.text.includes('ready'))) errors.push('Explicit session continuation failed');
      if (adapter.name==='claude' && next.model && next.model!==model) errors.push('Model changed during continuation');
    }
    // Retain harmless fixtures and raw probe events for audit; no credentials copied.
    summary.privateCanaryPath=path.join(outside,'canary.txt');
  }
  summary.status=errors.length?'infrastructure-error':'ready';
  fs.writeFileSync(path.join(out,'preflight.json'),json(summary),{flag:'wx'});
  return summary;
}
export async function runCase(c, adapter, pre, runDir, repeat, {timeoutMs=300000}={}) {
  const runId=`${c.id}--${adapter.name}--${repeat}`;
  const dest=path.join(runDir,runId); fs.mkdirSync(dest,{recursive:false});
  const result={version:1,runId,caseId:c.id,harness:adapter.name,model:pre.model,repeat,caseHash:hash(json(c)),status:'pending-review',turns:[],limitations:adapter.limitations};
  result.allowedEmailAddresses=emailAddresses([...Object.values(initialFiles(c)),...c.turns.map(t=>t.message)].join('\n'));
  fs.writeFileSync(path.join(dest,'rubric.json'),json(c.criteria),{flag:'wx'});
  if (c.deferred) {result.status='deferred';result.reason=c.deferred;}
  else if (pre.status!=='ready') {result.status='infrastructure-error';result.reason=pre.runtimeBlocker ? `Harness unavailable after ${pre.runtimeBlocker}` : 'Harness preflight failed'; result.preflight=`../preflight-${adapter.name}/preflight.json`;}
  else {
    const workspace=materialize(c); outsideRepo(workspace); result.workspace=workspace;
    result.initial=snapshot(workspace); result.bundleHash=hash(json(Object.fromEntries(Object.entries(result.initial).filter(([p])=>p.startsWith('installed-skill/')))));
    fs.cpSync(workspace,path.join(dest,'initial'),{recursive:true});
    const started=Date.now(); let sessionId=null;
    for (const [i,turn] of c.turns.entries()) {
      if (turn.archive) {
        const configPath=path.join(workspace,'.apprenticeship/config.yaml');
        const config=JSON.parse(fs.readFileSync(configPath,'utf8')); config.mode='archived'; fs.writeFileSync(configPath,json(config));
      }
      const before=snapshot(workspace), audit=path.join(dest,`turn-${i+1}-file-audit.jsonl`);
      const input=i===0 ? `Use the skill at installed-skill/SKILL.md for the following request. Read its referenced instructions as needed. This disposable workspace contains explicitly synthetic scenario inputs. Use only identity and scenario information supplied in this prompt or workspace; do not infer or mention host or signed-in account identity. Skill publication limits still apply.\n\n${turn.message}` : turn.message;
      const remaining=timeoutMs-(Date.now()-started);
      if (remaining<=0) {result.status='infrastructure-error';result.reason='Case timeout before next turn';break;}
      const run=await processRun(pre.binary,adapter.args({workspace,model:pre.model,sessionId,audit}),{cwd:workspace,input,timeoutMs:remaining});
      const normalized=adapter.normalize(run.stdout), after=snapshot(workspace);
      const entry={index:i+1,input,archived:turn.archive===true,unchangedRetry:c.source==='S20' && i===1,before,after,changes:difference(before,after),process:run,normalized};
      if (fs.existsSync(audit)) entry.fileAudit=fs.readFileSync(audit,'utf8');
      result.turns.push(entry);
      fs.writeFileSync(path.join(dest,`turn-${i+1}.stdout.jsonl`),run.stdout,{flag:'wx'});
      fs.writeFileSync(path.join(dest,`turn-${i+1}.stderr.txt`),run.stderr,{flag:'wx'});
      fs.cpSync(workspace,path.join(dest,`after-turn-${i+1}`),{recursive:true,dereference:false});
      const violations=adapter.isolationViolations(normalized);
      if (run.code!==0 || run.error || run.timedOut || run.overflow || normalized.failed || !normalized.complete || normalized.errors.length || !normalized.sessionId || (sessionId && sessionId!==normalized.sessionId) || (normalized.model && normalized.model!==pre.model) || violations.length) {
        result.status='infrastructure-error'; result.reason='Process, event, session, model or isolation failure'; result.isolationViolations=violations; break;
      }
      sessionId=normalized.sessionId;
    }
  }
  fs.writeFileSync(path.join(dest,'result.json'),json(result),{flag:'wx'});
  return result;
}
export function report(runDir) {
  const rows=[],totals={pass:0,fail:0,'pending-review':0,'infrastructure-error':0,'not-run':0,deferred:0};
  for (const name of fs.readdirSync(runDir).sort()) {
    const dir=path.join(runDir,name), p=path.join(dir,'result.json'); if (!fs.existsSync(p)) continue;
    const result=JSON.parse(fs.readFileSync(p)), rubric=JSON.parse(fs.readFileSync(path.join(dir,'rubric.json')));
    const reviewPath=path.join(dir,'review.json'),review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath)):null;
    const graded=gradeResult(result,rubric,review); totals[graded.status]++;
    rows.push({runId:result.runId,caseId:result.caseId,harness:result.harness,status:graded.status,errors:graded.errors,result:`${name}/result.json`});
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(runDir,'manifest.json')));
  const planned=new Set(manifest.plannedRuns);
  for (const row of rows) planned.delete(row.runId);
  for (const runId of planned) {rows.push({runId,status:'not-run',errors:['No result artifact']});totals['not-run']++;}
  const complete=totals.pass>0 && !['fail','pending-review','infrastructure-error','not-run'].some(k=>totals[k]) && manifest.fullSuite===true;
  const output={version:1,acceptance:complete?'passed tested suite':'not established',totals,rows};
  fs.writeFileSync(path.join(runDir,'report.json'),json(output));
  fs.writeFileSync(path.join(runDir,'report.md'),`# Behavioral eval results\n\nAcceptance: **${output.acceptance}**. Synthetic scenarios, not learner accomplishments.\n\n${Object.entries(totals).map(([k,v])=>`${k}: ${v}`).join('; ')}\n\n| Run | Status | Artifact |\n| --- | --- | --- |\n${rows.map(r=>`| ${r.runId} | ${r.status} | ${r.result?`[result](${r.result})`:'No execution'} |`).join('\n')}\n`);
  return output;
}
export function continuableRunIds(runDir, harness) {
  const manifest=JSON.parse(fs.readFileSync(path.join(runDir,'manifest.json')));
  return manifest.plannedRuns.filter(runId=>{
    const parts=runId.split('--'); if(parts.at(-2)!==harness) return false;
    const p=path.join(runDir,runId,'result.json'); if(!fs.existsSync(p)) return true;
    const result=JSON.parse(fs.readFileSync(p));
    return result.status==='infrastructure-error' && gradeResult(result,JSON.parse(fs.readFileSync(path.join(runDir,runId,'rubric.json'))),null).status==='infrastructure-error';
  });
}
function assertContinuationCompatible(dir, manifest) {
  if(hash(json(cases))!==manifest.suiteHash) throw new Error('Suite changed; start a new run rather than combining configurations');
  if(JSON.stringify(implementationHashes())!==JSON.stringify(manifest.implementationHashes)) throw new Error('Runner or adapter changed; start a new run');
  const selected=cases.filter(c=>manifest.selectedCaseIds.includes(c.id));
  const currentBundles=Object.fromEntries([...new Set(selected.filter(c=>!c.deferred).map(c=>c.skill))].map(s=>[s,hash(json(snapshot(path.join(root,'skills',s))))]));
  if(JSON.stringify(currentBundles)!==JSON.stringify(manifest.bundleHashes)) throw new Error('Skill bundle changed; start a new run');
  // Result directories are audit artifacts and may live in an explicitly
  // selected, ignored output tree. Only disposable agent workspaces must
  // remain outside the repository; runCase and preflight enforce that boundary.
}
function options(argv) {
  const out={}; for (let i=0;i<argv.length;i+=2) {const k=argv[i]; if (!k?.startsWith('--') || argv[i+1]===undefined) throw new Error('Options require --name value'); if (Object.hasOwn(out,k.slice(2))) throw new Error('Duplicate option'); out[k.slice(2)]=argv[i+1];} return out;
}
export async function main(argv=process.argv.slice(2)) {
  const [command,...rest]=argv,o=options(rest);
  const allowed={check:[],run:['out','harness','case','codex-bin','claude-bin','codex-model','claude-model'],continue:['run','harness'],report:['run'], 'review-template':['run']};
  if (!allowed[command] || Object.keys(o).some(k=>!allowed[command].includes(k))) throw new Error('Usage: check | run --out DIR [--harness codex,claude] [--case ID,...] | continue --run DIR [--harness codex,claude] | report --run DIR | review-template --run RESULT_DIR');
  if (command==='check') {const errors=[...validateCases(),...validateCanonicalFixtures()]; if(errors.length) throw new Error(errors.join('\n')); console.log(`${cases.length} cases validated (${cases.filter(c=>!c.deferred).length} active), all canonical fixture documents pass their existing schemas.`);return;}
  if (command==='report') {const summary=report(path.resolve(o.run));console.log(json(summary));if(summary.acceptance==='not established')process.exitCode=1;return;}
  if (command==='review-template') {
    const dir=path.resolve(o.run),result=JSON.parse(fs.readFileSync(path.join(dir,'result.json'))),rubric=JSON.parse(fs.readFileSync(path.join(dir,'rubric.json')));
    const template={version:1,runId:result.runId,resultHash:hash(json(result)),reviewer:{identity:'',independentOfTestedSession:false},findings:rubric.map(c=>({id:c.id,criterion:c.text,verdict:null,rationale:'',citations:[]}))};
    fs.writeFileSync(path.join(dir,'review-template.json'),json(template),{flag:'wx'});console.log(path.join(dir,'review-template.json'));return;
  }
  const errors=[...validateCases(),...validateCanonicalFixtures()];if(errors.length) throw new Error(errors.join('\n'));
  if(command==='continue') {
    const dir=path.resolve(o.run); const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))); assertContinuationCompatible(dir,manifest);
    const harnesses=(o.harness??manifest.harnesses.join(',')).split(',');
    if(new Set(harnesses).size!==harnesses.length||harnesses.some(h=>!manifest.harnesses.includes(h))) throw new Error('Continuation harness was not in the original schedule');
    const continuationDir=path.join(dir,'continuations');fs.mkdirSync(continuationDir,{recursive:true});
    let index=1;
    while(fs.existsSync(path.join(continuationDir,`continuation-${index}.json`))||harnesses.some(h=>fs.existsSync(path.join(dir,`preflight-${h}-continuation-${index}`)))) index++;
    const record={version:1,index,createdAt:new Date().toISOString(),harnesses,attempts:[]};
    for(const h of harnesses) {
      const prior=JSON.parse(fs.readFileSync(path.join(dir,`preflight-${h}`,'preflight.json')));
      let pre=await preflight(adapters[h],path.join(dir,`preflight-${h}-continuation-${index}`),{binary:prior.binary,model:prior.model});
      if(pre.model!==prior.model) throw new Error(`Pinned ${h} model changed during continuation`);
      for(const runId of continuableRunIds(dir,h)) {
        const current=path.join(dir,runId); let previous=null;
        if(fs.existsSync(current)) {
          const attemptDir=path.join(dir,'interrupted-attempts',runId);fs.mkdirSync(attemptDir,{recursive:true});
          const attempt=fs.readdirSync(attemptDir).filter(x=>/^attempt-\d+$/.test(x)).length+1;
          previous=path.join(attemptDir,`attempt-${attempt}`);fs.renameSync(current,previous);
        }
        const parts=runId.split('--'),repeat=Number(parts.at(-1)),caseId=parts.slice(0,-2).join('--'),c=cases.find(x=>x.id===caseId);
        const result=await runCase(c,adapters[h],pre,dir,repeat);record.attempts.push({runId,previous:previous?path.relative(dir,previous):null,status:result.status,resultHash:hash(json(result))});console.log(`${runId}: ${result.status}`);
        if(result.turns.some(t=>t.normalized.harnessUnavailable)) pre={...pre,status:'infrastructure-error',runtimeBlocker:runId};
      }
    }
    fs.writeFileSync(path.join(continuationDir,`continuation-${index}.json`),json(record),{flag:'wx'});
    const summary=report(dir);console.log(json(summary.totals));if(summary.acceptance==='not established')process.exitCode=1;return;
  }
  const harnesses=(o.harness ?? 'codex,claude').split(',');if(new Set(harnesses).size!==harnesses.length || harnesses.some(h=>!adapters[h])) throw new Error('Unknown or duplicate harness');
  const ids=o.case?.split(','); if(ids?.some(id=>!cases.some(c=>c.id===id))) throw new Error('Unknown case ID');
  const selected=cases.filter(c=>!ids || ids.includes(c.id));
  const priority=['S01','S02','S03','A01','A02','A03','A04-E0','A04-E3'];
  selected.sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):priority.length)-(priority.includes(b.id)?priority.indexOf(b.id):priority.length));
  if(!o.out) throw new Error('--out is required');
  const dir=path.resolve(o.out); if(fs.existsSync(dir)) throw new Error('Output directory exists; choose a new baseline ID'); fs.mkdirSync(dir,{recursive:true});
  const plannedRuns=selected.flatMap(c=>harnesses.flatMap(h=>Array.from({length:c.repeats},(_,i)=>`${c.id}--${h}--${i+1}`)));
  const currentImplementationHashes=implementationHashes();
  const bundleHashes=Object.fromEntries([...new Set(selected.filter(c=>!c.deferred).map(c=>c.skill))].map(s=>[s,hash(json(snapshot(path.join(root,'skills',s))))]));
  const manifest={version:1,createdAt:new Date().toISOString(),node:process.version,platform:process.platform,architecture:process.arch,implementationHashes:currentImplementationHashes,bundleHashes,suiteHash:hash(json(cases)),fullSuite:!ids && harnesses.length===2,plannedRuns,selectedCaseIds:selected.map(c=>c.id),harnesses};
  fs.writeFileSync(path.join(dir,'manifest.json'),json(manifest),{flag:'wx'});
  for(const h of harnesses) {
    console.log(`Preflight ${h}`);
    let pre=await preflight(adapters[h],path.join(dir,`preflight-${h}`),{binary:o[`${h}-bin`] ?? adapters[h].defaultBinary,model:o[`${h}-model`] ?? null});
    console.log(`${h}: ${pre.status}${pre.errors.length?': '+pre.errors.join('; '):' ('+pre.model+')'}`);
    for(const c of selected) for(let i=1;i<=c.repeats;i++) {
      const result=await runCase(c,adapters[h],pre,dir,i);console.log(`${result.runId}: ${result.status}`);
      if (result.turns.some(t=>t.normalized.harnessUnavailable)) pre={...pre,status:'infrastructure-error',runtimeBlocker:result.runId};
    }
  }
  const summary=report(dir);console.log(json(summary.totals)); if(summary.acceptance==='not established') process.exitCode=1;
}
if (process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) main().catch(e=>{console.error(e.stack);process.exitCode=1;});
