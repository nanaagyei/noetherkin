"""Read-only checks of specification artifacts; not a simulator/runtime validator.
Run from any directory with Python, PyYAML and jsonschema installed.
"""
from pathlib import Path
from copy import deepcopy
import json
import re
from urllib.parse import urlparse, unquote
import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / 'examples/spring-petclinic'
STATE = EXAMPLE / '.apprenticeship'

class UniqueLoader(yaml.SafeLoader):
    pass

def unique_mapping(loader, node, deep=False):
    result = {}
    for key, value in node.value:
        name = loader.construct_object(key, deep=deep)
        if name in result:
            raise ValueError(f'Duplicate YAML key: {name}')
        result[name] = loader.construct_object(value, deep=deep)
    return result

UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)

def read_yaml(path):
    raw = path.read_text()
    assert not any(isinstance(token, (yaml.tokens.AliasToken, yaml.tokens.AnchorToken, yaml.tokens.TagToken))
                   for token in yaml.scan(raw)), f'Nonportable YAML: {path}'
    value = yaml.load(raw, Loader=UniqueLoader)
    json.dumps(value, allow_nan=False)  # Reject implicit timestamp objects and non-JSON values.
    return value

schemas = {}
for path in sorted((ROOT / 'schemas').glob('*.schema.json')):
    schema = json.loads(path.read_text())
    Draft202012Validator.check_schema(schema)
    schemas[path.name.removesuffix('.schema.json')] = Draft202012Validator(schema, format_checker=FormatChecker())
assert len(schemas) == 13

def schema_for(path):
    if path.parent.name == 'work': return 'task'
    if path.parent.name == 'evidence': return 'evidence'
    if path.parent.name == 'assessments': return 'assessment'
    if 'reviews' in path.parts: return 'review'
    if path.parent.name == 'projects': return 'project'
    if path.parent.name == 'tracks': return 'track'
    if path.parent.name == 'forge': return 'forge'
    if path.parent.name == 'advisory': return 'attention-advisory'
    return {'config.yaml':'apprenticeship-config', 'profile.yaml':'learner-profile',
            'current-project.yaml':'current-project', 'current-track.yaml':'current-track',
            'competencies.yaml':'competency-state'}[path.name]

records = {}
validated = []
for path in (sorted(STATE.rglob('*.yaml')) + sorted((ROOT/'catalog/projects').glob('*.yaml'))
             + sorted((ROOT/'catalog/tracks').glob('*.yaml')) + sorted((ROOT/'catalog/forge').glob('*.yaml'))):
    value = read_yaml(path)
    name = schema_for(path)
    schemas[name].validate(value)
    validated.append((path, name, value))
    if STATE in path.parents and 'id' in value:
        assert value['id'] not in records, f'Duplicate record ID: {value["id"]}'
        assert path.stem == value['id']
        records[value['id']] = value
assert {name for _, name, _ in validated} == set(schemas)
config = read_yaml(STATE/'config.yaml')
profile = read_yaml(STATE/'profile.yaml')
principals = {actor['id']:actor['role'] for actor in config['principals']}
assert len(principals) == len(config['principals'])
competencies = read_yaml(ROOT/'catalog/competencies.yaml')
levels = read_yaml(ROOT/'catalog/levels.yaml')
ids = {c['id'] for c in competencies['competencies']}
assert len(ids) == len(competencies['competencies'])
assert competencies['catalog_version'] == '4.0'
assert levels['catalog_version'] == '2.0'
assert all({'id','domain','name','observable_behavior','required_core'} <= set(c) <= {'id','domain','name','observable_behavior','required_core','prerequisites','encompasses'} and c['observable_behavior'] for c in competencies['competencies'])
# ACP-013: edges reference known IDs, never the source itself, core depends only on core, and the union is acyclic.
core_ids = {c['id'] for c in competencies['competencies'] if c['required_core']}
edges = {c['id']: c.get('prerequisites', []) + c.get('encompasses', []) for c in competencies['competencies']}
assert all(target in ids and target != source for source, targets in edges.items() for target in targets)
assert all(set(c.get('prerequisites', [])) <= core_ids for c in competencies['competencies'] if c['required_core'])
def acyclic(graph):
    state = {}
    def visit(node):
        if state.get(node) == 'done': return True
        if state.get(node) == 'visiting': return False
        state[node] = 'visiting'
        ok = all(visit(target) for target in graph[node])
        state[node] = 'done'
        return ok
    return all(visit(node) for node in graph)
assert acyclic(edges)
assert not acyclic({**edges, 'core.codebase-navigation': ['core.debugging']}), 'cycle detection must reject a seeded cycle'
assert len([c for c in competencies['competencies'] if c['required_core']]) == 7
assert [level['id'] for level in levels['levels']] == ['E'+str(i) for i in range(6)]
assert len(levels['dimensions']) == 13
assert all(set(level['expectations']) == set(levels['dimensions']) and all(level['expectations'].values()) for level in levels['levels'])
projects = [value for path, name, value in validated if name == 'project' and ROOT/'catalog/projects' in path.parents]
project_ids = {project['id'] for project in projects}
assert len(project_ids) == len(projects)
assert all(project['schema_version'] == '3.0' and isinstance(project['metadata_gaps'], list)
           and isinstance(project['support']['attachable'], bool)
           and project['difficulty'] is not None and project['onboarding_cost'] is not None
           and project['feedback_loop'] is not None
           and project['recommended_minimum_level'] is not None and project['ideal_level'] is not None
           and project['contribution_readiness']['status'] in ('verified','conditional','unverified') for project in projects)
assert all(project['status'] != 'supported' or (not project['metadata_gaps'] and all(project[field] is not None for field in
           ('recommended_minimum_level','ideal_level','difficulty','deployment','contribution'))) for project in projects)
tracks = [value for path, name, value in validated if name == 'track']
core_ids = {c['id'] for c in competencies['competencies'] if c['required_core']}
assert len(tracks) == 34
for track in tracks:
    assert track['catalog_version'] == '1.1'
    assert all(competency in ids - core_ids for competency in track['required_competencies'])
    assert all(len(track['recommended_projects'][stage]) == 2 for stage in ('early','intermediate','advanced'))
    assert all(project in project_ids for stage in track['recommended_projects'].values() for project in stage)

def inspect(value):
    if isinstance(value, list):
        for item in value: inspect(item)
    if not isinstance(value, dict): return
    if 'data_class' in value:
        assert (value['data_class'] == 'fixture'
                or (value['data_class'] == 'live' and value.get('status') in ('candidate','supported')))
    if 'role' in value and 'id' in value: assert principals.get(value['id']) == value['role']
    for key, item in value.items():
        if key in ('competency_id',): assert item in ids
        if key in ('competencies','primary_competencies','secondary_competencies','specialization_competencies') and isinstance(item,list):
            assert all(c in ids for c in item)
        if key in ('evidence_ids','completion_evidence_ids'):
            assert all(ref in records and 'fact' in records[ref] for ref in item)
        if key in ('assessment_ids','source_assessment_ids'):
            assert all(ref in records and 'learner_id' in records[ref] for ref in item)
        if key == 'source_review_ids': assert all(ref in records and 'outcome' in records[ref] for ref in item)
        if key == 'baseline_assessment_id' and item: assert records[item]['kind'] == 'baseline'
        if key == 'task_id' and item: assert 'acceptance_criteria' in records[item]
        if key == 'project_id' and item: assert 'repository_url' in records[item]
        if key == 'uri' and item.startswith('workspace:'):
            parsed = urlparse(item)
            target = (EXAMPLE / unquote(parsed.path).lstrip('/')).resolve()
            assert target.is_relative_to(EXAMPLE.resolve()) and target.is_file(), item
            if parsed.fragment: assert '## '+parsed.fragment in target.read_text(), item
        inspect(item)

for _, name, value in validated:
    if name == 'forge': continue  # Forge statuses are draft/supported/deprecated; checked below.
    inspect(value)

# ACP-015 forge specifications: a closed record with no upstream identity, a non-empty authored task pack whose
# directory holds task JSON only (never solution code), and competencies equal to what its tasks exercise.
forges = [value for path, name, value in validated if name == 'forge']
assert forges and not (project_ids & {forge['id'] for forge in forges})
for forge in forges:
    assert forge['data_class'] == 'live' and forge['status'] in ('draft', 'supported')
    assert 'repository_url' not in forge and 'upstream_organization' not in forge
    assert forge['task_packs'] and all(track in {t['id'] for t in tracks} for track in forge['track_alignment'])
    exercised = set()
    for pack in forge['task_packs']:
        files = sorted((ROOT/'tasks/forge'/pack).iterdir())
        assert files and all(file.suffix == '.json' for file in files), f'Forge pack {pack} must contain task JSON only'
        for file in files:
            task = json.loads(file.read_text())
            assert task['forge_id'] == forge['id'] and task['pack_id'] == pack
            exercised |= set(task['primary_competencies']) | set(task['secondary_competencies'])
    assert exercised == set(forge['competencies'])

edges = {
 'backlog':{'assigned','cancelled'}, 'assigned':{'investigating','cancelled'},
 'investigating':{'designing','implementing','cancelled'}, 'designing':{'implementing','investigating','cancelled'},
 'implementing':{'testing','investigating','cancelled'}, 'testing':{'code-review','validating','implementing','cancelled'},
 'code-review':{'validating','implementing','investigating','cancelled'},
 'validating':{'task-review','implementing','investigating','cancelled'},
 'task-review':{'evidence-recording','implementing','investigating','cancelled'},
 'evidence-recording':{'completed','task-review','cancelled'}, 'completed':set(), 'cancelled':set()
}

def fixture_task_checks(task):
    assert task['transitions'][0]['from'] == 'absent'
    assert task['transitions'][0]['to'] == 'backlog'
    previous = 'absent'
    previous_time = task['created_at']
    for index, event in enumerate(task['transitions']):
        assert event['from'] == previous and event['at'] >= previous_time
        if index: assert event['to'] in edges[previous]
        if event['from'] == 'investigating' and event['to'] == 'implementing': assert not task['design_required']
        previous, previous_time = event['to'], event['at']
    assert previous == task['status']
    if task['status'] == 'completed':
        assert task['blocked_reason'] is None
        assert {v['criterion_id'] for v in task['validation']} == {v['id'] for v in task['acceptance_criteria']}
        assert all(v['result'] == 'pass' and v['work_revision'] == task['work_artifact']['revision'] for v in task['validation'])
        assert task['completion_evidence_ids']
        assert all(records[e]['verification']['status'] == 'verified' and records[e]['task_id'] == task['id'] for e in task['completion_evidence_ids'])
        reviews = [r for r in records.values() if r.get('subject_id') == task['id']]
        assert any(r['kind'] == 'task' and r['outcome'] == 'accepted' and all(r['change'][k] == task['work_artifact'][k] for k in ('uri','revision')) and r['created_at'] >= max(v['checked_at'] for v in task['validation']) for r in reviews)
        if task['code_review_required']:
            assert any(r['kind'] == 'code' and r['outcome'] == 'approve' and
                       all(r['change'][k] == task['work_artifact'][k] for k in ('uri','revision')) for r in reviews)

for value in records.values():
    if 'transitions' in value: fixture_task_checks(value)
    if 'fact' in value:
        assert value['author']['role'] == 'team-lead'
        assert value['verification']['reviewer']['role'] == 'team-lead'
        assert value['fact']['observed_at'] <= value['verification']['checked_at'] <= value['created_at']
        assert value['assistance']['highest_level'] == max([a['level'] for a in value['assistance']['events']],default=0)
    if 'findings' in value and 'learner_id' in value:
        assert value['author']['role'] == 'team-lead'
        for finding in value['findings']:
            assert set(finding['evidence_ids']) <= set(value['evidence_ids'])
            if finding['status'] == 'unassessed': assert finding['demonstrated_level'] is None
            if finding['status'] == 'demonstrated': assert finding['evidence_ids']
    if 'period' in value: assert value['period']['start'] <= value['period']['end'] <= value['created_at']

cache = read_yaml(STATE/'competencies.yaml')
assert cache['effective_level'] == 'E0' and not any(r.get('kind') == 'promotion' for r in records.values())
latest = {}
for assessment in sorted([r for r in records.values() if r.get('kind') in ('baseline','technical') and r.get('scope') == 'longitudinal'],key=lambda r:r['created_at']):
    for finding in assessment['findings']: latest[finding['competency_id']] = (assessment['id'],finding)
assert len(cache['entries']) == len(latest)
for entry in cache['entries']:
    assessment_id, finding = latest[entry['competency_id']]
    assert entry['assessment_ids'] == [assessment_id]
    assert all(entry[k] == finding[k] for k in ('status','demonstrated_level','evidence_ids'))
assert set(cache['source_assessment_ids']) == {r['id'] for r in records.values() if r.get('kind') in ('baseline','technical') and r.get('scope') == 'longitudinal'}
assert set(cache['source_review_ids']) == {r['id'] for r in records.values() if 'outcome' in r}

negative = 0
samples = {name:value for _,name,value in validated}
for name, original in samples.items():
    for mutation in ('unknown-field','unsupported-version'):
        value = deepcopy(original)
        if mutation == 'unknown-field': value['unsupported'] = True
        else: value['schema_version'] = '999.0'
        assert list(schemas[name].iter_errors(value)), (name,mutation)
        negative += 1
for field,bad in [('outcome','PROMOTE'),('author',{'id':'ACTOR-demo-manager','role':'manager'}),('kind','unknown')]:
    value = deepcopy(samples['review']);value[field] = bad
    assert list(schemas['review'].iter_errors(value));negative += 1
value = deepcopy(samples['current-project']);value['source_path'] = None
assert list(schemas['current-project'].iter_errors(value));negative += 1
value = deepcopy(samples['evidence']);value['assistance']['highest_level'] = 8
assert list(schemas['evidence'].iter_errors(value));negative += 1
# Isolated review-shape specimens, not published promotion decisions or runtime proof.
promotion = deepcopy(records['REV-performance-demo'])
promotion.update({'kind':'promotion','author':{'id':'ACTOR-demo-promotion-reviewer','role':'promotion-reviewer'},
                  'from_level':'E0','target_level':'E1','previous_promotion_id':None,
                  'technical_reviewer_id':'ACTOR-demo-team-lead',
                  'recommendation_review_id':'REV-performance-demo','readiness_assessment_id':'ASM-navigation-demo',
                  'authorization':{'learner_id':profile['learner_id'],'at':'2026-09-10T10:30:00Z',
                                   'artifact':{'uri':'fixture:authorization','revision':'fixture-v1','description':'Shape-only synthetic authorization.'}},
                  'dimension_findings':[{'dimension':d,'evidence_ids':[],'judgment':'unknown','rationale':'Shape-only specimen; capability not evaluated.'} for d in levels['dimensions']],
                  'quality_analysis':{k:'Shape-only specimen; no promotion judgment is claimed.' for k in ['repetition','recency','diversity','scope','independence','contrary_evidence']}})
for outcome in ('PROMOTE','NOT YET','INSUFFICIENT EVIDENCE'):
    promotion['outcome'] = outcome
    schemas['review'].validate(promotion)
for mutation in ('wrong-author','missing-authorization','missing-dimensions'):
    value = deepcopy(promotion)
    if mutation == 'wrong-author': value['author'] = {'id':'ACTOR-demo-manager','role':'manager'}
    if mutation == 'missing-authorization': del value['authorization']
    if mutation == 'missing-dimensions': del value['dimension_findings']
    assert list(schemas['review'].iter_errors(value));negative += 1
completed = records['TASK-map-demo']
for mutation in ('skip-investigation','stale-approval','failed-criterion','missing-evidence'):
    value = deepcopy(completed)
    if mutation == 'skip-investigation': value['transitions'][2]['to'] = 'testing'
    if mutation == 'stale-approval': value['work_artifact']['revision'] = 'fixture-new-revision'
    if mutation == 'failed-criterion': value['validation'][0]['result'] = 'fail'
    if mutation == 'missing-evidence': value['completion_evidence_ids'] = []
    try: fixture_task_checks(value)
    except AssertionError: negative += 1
    else: raise AssertionError('Invalid fixture accepted: '+mutation)

headers = ['Purpose','Trigger Conditions','Preconditions','Inputs','State Read','State Written','Allowed Actions','Forbidden Actions','Required Outputs','Optional Outputs','Failure Behavior','Interaction With Other Skills','Evidence Produced','Assistance Rules','Idempotency / Repeat Invocation Behavior','Examples']
foundation_contract_names = ['onboarding','projects','task-assignment','teach','peer-engineer','code-review','team-lead','manager']
contracts = [ROOT/'contracts'/f'{name}.md' for name in foundation_contract_names]
assert all(path.exists() for path in contracts)
for path in contracts:
    assert all('## '+header+'\n\n' in path.read_text() for header in headers)
for path in ROOT.rglob('*.md'):
    if any(part in {'.git', 'node_modules', 'dist'} for part in path.parts): continue
    for link in re.findall(r'\]\(([^)]+)\)',path.read_text()):
        if ':' in link or link.startswith('#'): continue
        target = (path.parent/link.split('#')[0]).resolve()
        assert target.exists(), f'Broken link in {path}: {link}'
print(f'PASS: {len(schemas)} schemas; {len(validated)} fixture/catalog documents; {len(ids)} competencies; {len(tracks)} tracks; {len(projects)} projects; 6 levels x 13 dimensions; 8 frozen contracts; {negative} negative cases; fixture references, artifact links, task gates, derived cache and local Markdown links.')
print('LIMIT: these checks are specification/fixture-specific; runtime permission enforcement, crash recovery and Phase 6 execution are tested by the Node.js suite.')
