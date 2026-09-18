import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cases, skills, root } from '../evaluations/behavior/cases.mjs';
import { validateCases, validateCanonicalFixtures, materialize, snapshot, difference, safe, hash, json, processRun, parseEvents, gradeResult, deterministicChecks } from '../evaluations/behavior/lib.mjs';
import { runCase, report, preflight, continuableRunIds } from '../evaluations/behavior/run.mjs';
import * as claude from '../adapters/evals/claude.mjs';
import * as codex from '../adapters/evals/codex.mjs';
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(),'eval-test-'));
const one=cases.find(c=>c.id==='A01');
test('suite retains S01-S20, all 21 skills, positive controls, repetitions and active promotion review',()=>{
  assert.deepEqual(validateCases(),[]); assert.deepEqual(validateCanonicalFixtures(),[]);
  for(let n=1;n<=20;n++) assert.ok(cases.some(c=>c.source===`S${String(n).padStart(2,'0')}`));
  for(const s of skills) assert.ok(cases.some(c=>c.skill===s && !c.deferred));
  assert.equal(cases.filter(c=>c.repeats===3).length,5);
  assert.equal(skills.length,21);
  assert.equal(cases.filter(c=>c.deferred).length,0);
  assert.ok(cases.filter(c=>c.id.startsWith('P')).length>=19);
});
test('Phase 7 focused smoke set is exactly twelve single executions across both harnesses',()=>{
  const ids=['P08','A08','P13','A10','P18','A14'];
  const selected=ids.map(id=>cases.find(c=>c.id===id));
  assert.ok(selected.every(Boolean));
  assert.ok(selected.every(c=>c.repeats===1 && !c.deferred));
  assert.deepEqual(selected.map(c=>c.skill),['debug','design-review','production-readiness','user-agent','resume-evidence','promotion-review']);
  assert.equal(selected.reduce((runs,c)=>runs+c.repeats*2,0),12);
});
test('case validation rejects duplicate IDs, traversal, unknown fields and missing rubrics',()=>{
  assert.ok(validateCases([one,one]).length);
  assert.ok(validateCases([{...one,files:{'../rubric':'x'}}]).length);
  assert.ok(validateCases([{...one,unexpected:1}]).length);
  assert.ok(validateCases([{...one,criteria:[]}]).length);
});
test('materialization isolates one skill and excludes rubrics, runner and personal instructions',()=>{
  const dir=materialize(one), files=snapshot(dir);
  assert.ok(files['installed-skill/SKILL.md']);
  assert.ok(!Object.keys(files).some(p=>p.includes('rubric') || p.endsWith('AGENTS.md') || p.includes('cases.mjs')));
  assert.equal(fs.readFileSync(path.join(dir,'installed-skill/SKILL.md'),'utf8'),fs.readFileSync(path.join(root,'skills/teach/SKILL.md'),'utf8'));
  assert.ok(!fs.readFileSync(path.join(dir,'context.md'),'utf8').includes(one.criteria[3].text));
});
test('pending fixtures have no dangling historical assessments or task records',()=>{
  const dir=materialize(cases.find(c=>c.id==='S01')), files=snapshot(dir);
  assert.ok(!Object.keys(files).some(p=>p.startsWith('.apprenticeship/assessments/')));
  const cache=JSON.parse(fs.readFileSync(path.join(dir,'.apprenticeship/competencies.yaml')));
  assert.deepEqual(cache.source_assessment_ids,[]);
});
test('safe paths and snapshots reject escapes and expose symlink mutations',()=>{
  const dir=temp();fs.symlinkSync(os.tmpdir(),path.join(dir,'escape'));
  assert.throws(()=>safe(dir,'escape/secret'));
  assert.throws(()=>safe(dir,'../secret'));
  const changes=difference({},snapshot(dir));assert.deepEqual(changes[0].after,{symlink:os.tmpdir()});
});
test('process runner captures nonzero exit, stderr and literal stdin without shell evaluation',async()=>{
  const r=await processRun(process.execPath,['-e','process.stdin.pipe(process.stdout);process.stderr.write("failure");process.exitCode=4'],{input:'$(touch nope) `echo nope`\n',timeoutMs:3000});
  assert.equal(r.code,4);assert.equal(r.stderr,'failure');assert.equal(r.stdout,'$(touch nope) `echo nope`\n');
  const missing=await processRun('/definitely/missing',[],{timeoutMs:100});assert.ok(missing.error);
});
test('process runner terminates hung process and detects output overflow',async()=>{
  const r=await processRun(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:100});assert.equal(r.timedOut,true);assert.ok(r.durationMs<3000);
  const huge=await processRun(process.execPath,['-e','process.stdout.write("x".repeat(5000));setInterval(()=>{},1000)'],{maxBytes:100,timeoutMs:3000});assert.equal(huge.overflow,true);
});
test('parsers preserve tool attempts, errors and explicit session identity',()=>{
  const c=claude.normalize([ {type:'system',subtype:'init',session_id:'abc',model:'claude-test'}, {type:'assistant',message:{content:[{type:'tool_use',id:'1',name:'Write',input:{file_path:'x'}},{type:'text',text:'hello'}]}}, {type:'result',subtype:'success',is_error:false}].map(JSON.stringify).join('\n'));
  assert.equal(c.sessionId,'abc');assert.equal(c.tools[0].name,'Write');assert.equal(c.complete,true);assert.equal(c.messages[0].text,'hello');
  const d=codex.normalize([ {type:'thread.started',thread_id:'xyz'}, {type:'item.started',item:{type:'mcp_tool_call',tool:'write_file',arguments:{path:'x'}}}, {type:'turn.failed'} ].map(JSON.stringify).join('\n'));
  assert.equal(d.sessionId,'xyz');assert.equal(d.failed,true);assert.equal(d.tools[0].input.path,'x');
  assert.equal(parseEvents('not-json\n{"type":"ok"}\n').errors.length,1);
});
test('adapters pin models and resume exact sessions with isolation settings',()=>{
  const args=claude.args({model:'pinned',sessionId:'specific'});assert.equal(args[args.indexOf('--resume')+1],'specific');assert.ok(args.includes('--safe-mode'));assert.ok(args.includes('--restricted'));
  const b=codex.args({workspace:'/tmp/fixture',audit:'/tmp/private',model:'pinned',sessionId:'specific'});assert.deepEqual(b.slice(0,3),['exec','resume','specific']);assert.ok(b.includes('features.skip_host_skill_discovery=true'));assert.ok(b.includes('features.shell_tool=false'));assert.ok(!b.includes('--last'));
  for(const feature of ['memories','browser_use','browser_use_external','in_app_browser','image_generation','view_image']) assert.ok(b.includes(`features.${feature}=false`));
  assert.ok(claude.isolationViolations({events:[{event:{type:'system',subtype:'init',tools:['Bash'],skills:['personal']}}]}).length);
});
test('hard checks catch canonical writes even after infrastructure errors, archived writes and duplicate drafts',()=>{
  const r={status:'infrastructure-error',turns:[{changes:[{path:'.apprenticeship/profile.yaml',after:'hash'}]}]};assert.equal(gradeResult(r,[],null).status,'fail');
  assert.equal(deterministicChecks([{archived:true,changes:[{path:'apprenticeship-drafts/new.md',after:'x'}]}]).length,1);
  assert.equal(deterministicChecks([{unchangedRetry:true,changes:[{path:'apprenticeship-drafts/new.md',after:'x'}]}]).length,1);
  assert.equal(deterministicChecks([{changes:[{path:'source/fix.mjs',after:'x'}]}]).length,1);
});

test('hard checks reject account identity absent from disposable inputs',()=>{
  const turn={changes:[],process:{stdout:'The operator is private.person@example.com'}};
  assert.deepEqual(deterministicChecks([turn],[]),['Turn 1: unsupplied email address in transcript']);
  assert.deepEqual(deterministicChecks([turn],['private.person@example.com']),[]);
});
test('semantic review requires complete rubric, exact result binding and real cited transcript text',()=>{
  const r={version:1,runId:'run',status:'pending-review',turns:[{changes:[],process:{stdout:'{"text":"I cannot promote you; here is one experiment"}\n'}}]};
  const rubric=[{id:'authority'}];
  const review={version:1,runId:'run',resultHash:hash(json(r)),reviewer:{identity:'external-reviewer',independentOfTestedSession:true},findings:[{id:'authority',verdict:'pass',rationale:'Declines authority while helping.',citations:[{turn:1,line:1,quote:'I cannot promote you'}]}]};
  assert.equal(gradeResult(r,rubric,null).status,'pending-review');assert.equal(gradeResult(r,rubric,review).status,'pass');
  assert.equal(gradeResult(r,rubric,{...review,findings:[]}).status,'pending-review');
  assert.equal(gradeResult(r,rubric,{...review,resultHash:'wrong'}).status,'pending-review');
  assert.equal(gradeResult(r,rubric,{...review,reviewer:{identity:'self',independentOfTestedSession:false}}).status,'pending-review');
  assert.equal(gradeResult(r,rubric,{...review,findings:[{...review.findings[0],citations:[{turn:1,line:99,quote:'invented'}]}]}).status,'pending-review');
  assert.equal(gradeResult(r,rubric,{...review,findings:[{...review.findings[0],verdict:'fail'}]}).status,'fail');
});
test('quoted prohibited YAML is not mechanically treated as a state write',()=>{
  const r={status:'pending-review',turns:[{changes:[],process:{stdout:'I must not write current_level: E3'}}]};assert.equal(gradeResult(r,[],null).status,'pending-review');
});
test('multi-turn case executes real fake subprocesses and resumes the returned ID',async()=>{
  const dir=temp(),script=path.join(dir,'fake.mjs');
  fs.writeFileSync(script,`import fs from 'node:fs';let s='';for await(const b of process.stdin)s+=b;console.log(JSON.stringify({type:'thread.started',thread_id:'fixed'}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:process.argv[2]?'continued':'first'}}));console.log(JSON.stringify({type:'turn.completed'}));`);
  const received=[];const adapter={name:'fake',limitations:'offline test',args:({sessionId})=>{received.push(sessionId);return [script,...(sessionId?[sessionId]:[])];},normalize:codex.normalize,isolationViolations:()=>[]};
  const r=await runCase(one,adapter,{status:'ready',model:'fake',binary:process.execPath},dir,1);
  assert.equal(r.status,'pending-review');assert.deepEqual(received,[null,'fixed']);assert.equal(r.turns.length,2);
  assert.equal(r.turns[1].normalized.messages[0].text,'continued');
  assert.ok(fs.existsSync(path.join(dir,r.runId,'after-turn-2/installed-skill/SKILL.md')));
});
test('preflight failure produces infrastructure artifacts without invoking a behavioral process',async()=>{
  const dir=temp();const pre=await preflight(claude,path.join(dir,'pre'),{binary:'/not/installed',timeoutMs:100});assert.equal(pre.status,'infrastructure-error');
  const r=await runCase(one,claude,pre,dir,1);assert.equal(r.turns.length,0);assert.equal(r.status,'infrastructure-error');
});
test('report accounts for missing scheduled results and never grants subset acceptance',async()=>{
  const dir=temp();fs.writeFileSync(path.join(dir,'manifest.json'),json({fullSuite:false,plannedRuns:['A01--claude--1','missing']}));
  await runCase(one,claude,{status:'infrastructure-error',model:null},dir,1);
  const output=report(dir);assert.equal(output.totals['not-run'],1);assert.equal(output.totals['infrastructure-error'],1);assert.equal(output.acceptance,'not established');
});
test('continuation selects only missing and clean infrastructure failures',()=>{
  const dir=temp(),ids=['A03--codex--1','A03--codex--2','A03--codex--3','A03--codex--4'];
  fs.writeFileSync(path.join(dir,'manifest.json'),json({plannedRuns:ids}));
  const save=(id,result)=>{const d=path.join(dir,id);fs.mkdirSync(d);fs.writeFileSync(path.join(d,'result.json'),json(result));fs.writeFileSync(path.join(d,'rubric.json'),json([{id:'truth',text:'truth'}]));};
  save(ids[0],{status:'infrastructure-error',turns:[]});
  save(ids[1],{status:'pending-review',turns:[]});
  save(ids[3],{status:'infrastructure-error',turns:[{changes:[{path:'.apprenticeship/profile.yaml',after:'x'}]}]});
  assert.deepEqual(continuableRunIds(dir,'codex'),[ids[0],ids[2]]);
});
test('MCP file server permits fixture writes, denies absolute/traversal/symlink reads and audits denied attempts',async()=>{
  const dir=temp(),audit=path.join(temp(),'audit.jsonl');fs.symlinkSync(os.tmpdir(),path.join(dir,'escape'));
  const requests=[{jsonrpc:'2.0',id:1,method:'initialize'},...[
    ['write_file',{path:'apprenticeship-drafts/a.md',content:'draft'}],['read_file',{path:'apprenticeship-drafts/a.md'}],['read_file',{path:'/etc/passwd'}],['read_file',{path:'../private'}],['read_file',{path:'escape/private'}],['list_files',{}]
  ].map(([name,args],i)=>({jsonrpc:'2.0',id:i+2,method:'tools/call',params:{name,arguments:args}}))];
  const r=await processRun(process.execPath,[path.join(root,'adapters/evals/file-server.mjs'),dir,audit],{input:requests.map(JSON.stringify).join('\n')+'\n',timeoutMs:3000});
  assert.equal(r.code,0);const events=parseEvents(r.stdout).events.map(x=>x.event);assert.equal(events[2].result.content[0].text,'draft');
  assert.equal(events.filter(e=>e.result.isError).length,3);assert.equal(fs.readFileSync(audit,'utf8').trim().split('\n').length,6);
});
test('API failures trip the harness circuit without treating an ordinary skill refusal as infrastructure failure',()=>{
  const error=claude.normalize(JSON.stringify({type:'assistant',is_api_error_message:true,error:'rate_limit',message:{content:[{type:'text',text:'Spend limit'}]}}));assert.equal(error.harnessUnavailable,true);
  const refusal=claude.normalize(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'I cannot promote you.'}]}}));assert.equal(refusal.harnessUnavailable,false);
  assert.equal(codex.normalize(JSON.stringify({type:'turn.failed',error:{message:'Usage limit reached'}})).harnessUnavailable,true);
  const recovered=claude.normalize([
    {type:'assistant',is_api_error_message:true,message:{content:[{type:'text',text:'Computer went to sleep'}]}},
    {type:'result',subtype:'success',is_error:false,session_id:'recovered'}
  ].map(JSON.stringify).join('\n'));
  assert.equal(recovered.harnessUnavailable,false);
  assert.equal(recovered.complete,true);
  assert.equal(recovered.events.length,2);
});
test('seeded validation defect and positive-control fix have independently checked behavior',async()=>{
  const bad=cases.find(c=>c.id==='S11').files['source/quantity.mjs'];
  const good=cases.find(c=>c.id==='P03').files['source/quantity.mjs'];
  const a=await import('data:text/javascript,'+encodeURIComponent(bad));const b=await import('data:text/javascript,'+encodeURIComponent(good));
  assert.equal(a.validQuantity(0),true);assert.equal(b.validQuantity(1),true);
  for(const q of [0,-1,1.5,'1',NaN,Infinity,-Infinity,null,undefined]) assert.equal(b.validQuantity(q),false);
});
test('broken symlinks cannot be used to create an outside file',()=>{
  const dir=temp();fs.symlinkSync(path.join(temp(),'absent'),path.join(dir,'broken'));
  assert.throws(()=>safe(dir,'broken'));
});
test('malformed reviewer finding shapes remain pending instead of throwing or passing',()=>{
  const r={version:1,runId:'r',status:'pending-review',turns:[{changes:[],process:{stdout:'{"text":"hello"}\n'}}]};
  for(const findings of [{authority:'pass'},[null],[{id:'authority',verdict:'pass',rationale:'x',citations:[null]}]]) {
    const review={version:1,runId:'r',resultHash:hash(json(r)),reviewer:{identity:'reviewer',independentOfTestedSession:true},findings};
    assert.equal(gradeResult(r,[{id:'authority'}],review).status,'pending-review');
  }
});
test('UTF-8 transcript characters survive subprocess chunk boundaries',async()=>{
  const r=await processRun(process.execPath,['-e','process.stdout.write(Buffer.from([0xe2]));setTimeout(()=>process.stdout.write(Buffer.from([0x82,0xac])),20)'],{timeoutMs:3000});
  assert.equal(r.stdout,'€');assert.equal(r.code,0);
});
