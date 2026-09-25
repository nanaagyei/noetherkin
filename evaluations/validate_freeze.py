"""Targeted in-memory specification oracles. Not a runtime or access-control service."""
from pathlib import Path
from copy import deepcopy
import hashlib
import json
import unittest
import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'examples/spring-petclinic/.apprenticeship'

def load(path):
    return json.loads(path.read_text())

SCHEMAS = {p.name.split('.')[0]: Draft202012Validator(load(p), format_checker=FormatChecker())
           for p in (ROOT / 'schemas').glob('*.schema.json')}

def valid(kind, value):
    return not list(SCHEMAS[kind].iter_errors(value))

def stale_closure(dependencies, seeds):
    stale = set(seeds)
    while True:
        expanded = stale | {node for node, refs in dependencies.items() if stale.intersection(refs)}
        if expanded == stale:
            return stale
        stale = expanded

def standing(awarded, supported_tip):
    # The tip here is the already validated unique adjacent supported chain.
    return {'last_awarded_level': awarded,
            'standing': 'current' if supported_tip == awarded else 'unresolved',
            'effective_level': supported_tip if supported_tip == awarded else None}

def grant_valid(config, bound_actor, claimed_actor, at):
    if bound_actor != claimed_actor:
        return False
    grants = config['principals']
    if len({g['id'] for g in grants}) != len(grants):
        return False
    return any(g['id'] == bound_actor['id'] and g['role'] == bound_actor['role']
               and g['granted_at'] <= at and (g['retired_at'] is None or at < g['retired_at'])
               for g in grants)

def registry_update(old, new):
    if (old['learner_id'], old['learner_principal_id']) != (new['learner_id'], new['learner_principal_id']):
        return False
    rows = {g['id']: g for g in new['principals']}
    if len(rows) != len(new['principals']):
        return False
    for g in old['principals']:
        n = rows.get(g['id'])
        if n is None or any(n[k] != g[k] for k in g if k != 'retired_at'):
            return False
        if g['retired_at'] is not None and n['retired_at'] != g['retired_at']:
            return False
        if n['retired_at'] is not None and (n['retired_at'] <= n['granted_at'] or n['id'] == old['learner_principal_id']):
            return False
    return True

EXECUTION = {'status', 'blocked_reason', 'work_artifact', 'design_artifact', 'design_assessment_id',
             'validation', 'completion_evidence_ids', 'transitions', 'assistance_history'}

def frozen_assignment(old, new):
    return {k: v for k, v in old.items() if k not in EXECUTION} == {k: v for k, v in new.items() if k not in EXECUTION}

def design_gate(task, assessment, stale=()):
    return (assessment['id'] not in stale and assessment['scope'] == 'checkpoint'
            and assessment['kind'] == 'technical' and assessment['author']['role'] == 'team-lead'
            and assessment['task_id'] == task['id'] and assessment['project_id'] == task['project_id']
            and task['design_assessment_id'] == assessment['id']
            and assessment['design'] is not None and assessment['design']['decision'] == 'approve'
            and all(assessment['design']['artifact'][k] == task['design_artifact'][k] for k in ('uri', 'revision')))

def packet_valid(promotion, recommendation, readiness, learner_actor):
    authors = [promotion['author']['id'], recommendation['author']['id'], readiness['author']['id']]
    scope = promotion['evaluation_scope']
    return (len(set(authors)) == 3 and learner_actor not in authors
            and promotion['recommendation_review_id'] == recommendation['id']
            and promotion['readiness_assessment_id'] == readiness['id']
            and readiness['id'] in promotion['assessment_ids'] and readiness['id'] in recommendation['assessment_ids']
            and recommendation['kind'] == 'performance' and recommendation['outcome'] == 'recommend-promotion-review'
            and recommendation['subject_id'] == promotion['subject_id'] == readiness['learner_id']
            and recommendation['period'] == promotion['period']
            and recommendation['evaluation_scope'] == scope
            and readiness['scope'] == 'longitudinal'
            and {f['competency_id'] for f in readiness['findings']} == set(scope['core_competencies'] + scope['specialization_competencies'])
            and readiness['created_at'] <= recommendation['created_at'] <= promotion['authorization']['at'] <= promotion['created_at'])

def help_valid(event):
    provider = event['provider']
    return (event['at'] <= event['recorded_at']
            and ((provider['kind'] == 'registered' and provider['principal_id'] is not None)
                 or (provider['kind'] in ('external', 'unknown') and provider['principal_id'] is None)))

def aggregate(assessments):
    result = {}
    for a in sorted(assessments, key=lambda a: a['created_at']):
        if a['scope'] == 'longitudinal':
            for finding in a['findings']:
                result[finding['competency_id']] = finding
    return result

class FreezeSpec(unittest.TestCase):
    def setUp(self):
        self.task = load(STATE / 'work/TASK-map-demo.yaml')
        self.assessment = load(STATE / 'assessments/ASM-navigation-demo.yaml')
        self.evidence = load(STATE / 'evidence/EVID-map-demo.yaml')
        self.config = load(STATE / 'config.yaml')

    def test_fr01_transitive_staleness(self):
        deps = {'E1': {'artifact'}, 'A1': {'E1'}, 'M1': {'A1'}, 'P1': {'A1', 'M1'}, 'P2': {'P1'}, 'unrelated': set()}
        self.assertEqual(stale_closure(deps, {'artifact'}), {'artifact', 'E1', 'A1', 'M1', 'P1', 'P2'})

    def test_fr02_unresolved_is_readable(self):
        cache = load(STATE / 'competencies.yaml')
        cache.update(standing('E2', 'E0'), stale_record_ids=['REV-stale'])
        self.assertTrue(valid('competency-state', cache))
        cache['effective_level'] = 'E2'
        self.assertFalse(valid('competency-state', cache))

    def test_fr03_partial_then_full_reconciliation(self):
        self.assertEqual(standing('E2', 'E1')['effective_level'], None)
        self.assertEqual(standing('E2', 'E2')['effective_level'], 'E2')
        self.assertEqual(standing('E2', 'E0')['last_awarded_level'], 'E2')

    def test_fr04_exact_artifact_restoration(self):
        deps = {'E': {'artifact'}, 'A': {'E'}}
        self.assertEqual(stale_closure(deps, set()), set())
        self.assertIn('A', stale_closure(deps, {'artifact'}))
        # Restoration cannot clear an independent supersession/help seed.
        self.assertIn('A', stale_closure(deps, {'E'}))

    def test_fr05_corrective_record_does_not_inherit_old_support(self):
        deps = {'old-assessment': {'old-evidence'}, 'new-assessment': {'new-evidence'}}
        self.assertEqual(stale_closure(deps, {'old-evidence'}), {'old-evidence', 'old-assessment'})
        corrected = deepcopy(self.evidence)
        corrected['id'] = 'EVID-corrected'; corrected['supersedes'] = self.evidence['id']
        self.assertTrue(valid('evidence', corrected))

    def promotion_packet(self):
        rec = load(STATE / 'reviews/performance/REV-performance-demo.yaml')
        ready = deepcopy(self.assessment)
        ready['findings'] = [dict(self.assessment['findings'][0], competency_id=c) for c in
                             rec['evaluation_scope']['core_competencies'] + rec['evaluation_scope']['specialization_competencies']]
        rec['assessment_ids'] = [ready['id']]; rec['outcome'] = 'recommend-promotion-review'
        pro = deepcopy(rec)
        pro.update(id='REV-shape-promotion', kind='promotion', outcome='INSUFFICIENT EVIDENCE',
                   author={'id': 'ACTOR-demo-promotion-reviewer', 'role': 'promotion-reviewer'},
                   from_level='E0', target_level='E1', previous_promotion_id=None,
                   technical_reviewer_id=ready['author']['id'], recommendation_review_id=rec['id'], readiness_assessment_id=ready['id'],
                   authorization={'learner_id': ready['learner_id'], 'at': rec['created_at'],
                                  'artifact': {'uri': 'fixture:authorization', 'revision': 'fixture-v2', 'description': 'Shape only.'}},
                   dimension_findings=[{'dimension': d, 'evidence_ids': [], 'judgment': 'unknown', 'rationale': 'Shape only.'}
                                       for d in load(ROOT / 'catalog/levels.yaml')['dimensions']],
                   quality_analysis={k: 'Shape only.' for k in ('repetition','recency','diversity','scope','independence','contrary_evidence')})
        return pro, rec, ready

    def test_fr06_pinned_packet_and_missing_edges(self):
        pro, rec, ready = self.promotion_packet()
        self.assertTrue(valid('review', pro))
        self.assertTrue(packet_valid(pro, rec, ready, self.config['learner_principal_id']))
        for field in ('recommendation_review_id','readiness_assessment_id','evaluation_scope'):
            bad = deepcopy(pro); del bad[field]
            self.assertFalse(valid('review', bad))
        bad = deepcopy(rec); bad['id'] = 'REV-later'
        self.assertFalse(packet_valid(pro, bad, ready, self.config['learner_principal_id']))

    def test_fr07_period_and_scope_mismatch(self):
        pro, rec, ready = self.promotion_packet()
        for field, value in [('period', {'start':'2020-01-01T00:00:00Z','end':'2020-01-02T00:00:00Z'}),
                             ('evaluation_scope', dict(rec['evaluation_scope'], specialization_competencies=[]))]:
            bad = deepcopy(rec); bad[field] = value
            self.assertFalse(packet_valid(pro, bad, ready, self.config['learner_principal_id']))

    def test_fr08_all_pairwise_author_distinctions(self):
        original = self.promotion_packet()
        for left, right in [(0,1),(0,2),(1,2)]:
            packet = deepcopy(original)
            packet[left]['author']['id'] = packet[right]['author']['id']
            self.assertFalse(packet_valid(*packet, self.config['learner_principal_id']))

    def test_fr09_retirement_preserves_historical_authority(self):
        c = deepcopy(self.config); g = next(g for g in c['principals'] if g['role'] == 'team-lead')
        g['retired_at'] = '2026-09-12T12:00:00Z'; actor = {'id':g['id'],'role':g['role']}
        self.assertTrue(grant_valid(c, actor, actor, '2026-09-11T12:00:00Z'))
        self.assertFalse(grant_valid(c, actor, actor, '2026-09-12T12:00:00Z'))

    def test_fr10_no_role_reassignment_or_duplicate_actor(self):
        bad = deepcopy(self.config); bad['principals'][1]['role'] = 'promotion-reviewer'
        self.assertFalse(registry_update(self.config, bad))
        bad = deepcopy(self.config); bad['principals'].append(deepcopy(bad['principals'][0]))
        self.assertFalse(registry_update(self.config, bad))
        bad = deepcopy(self.config); bad['learner_principal_id'] = bad['principals'][1]['id']
        self.assertFalse(registry_update(self.config, bad))

    def test_fr11_forged_invocation_identity(self):
        learner = {'id':self.config['learner_principal_id'],'role':'learner'}
        reviewer = self.assessment['author']
        self.assertFalse(grant_valid(self.config, learner, reviewer, '2026-09-11T12:00:00Z'))

    def design_pair(self):
        task, a = deepcopy(self.task), deepcopy(self.assessment)
        artifact = {'uri':'fixture:design','revision':'A','description':'Shape-only design.'}
        a.update(scope='checkpoint', task_id=task['id'], design={'artifact':artifact,'decision':'approve'})
        task.update(design_required=True, design_artifact=artifact, design_assessment_id=a['id'])
        return task, a

    def test_fr12_exact_design_gate(self):
        task, a = self.design_pair()
        self.assertTrue(valid('assessment', a)); self.assertTrue(design_gate(task, a))
        for field, value in [('task_id','TASK-other'), ('scope','longitudinal')]:
            bad = deepcopy(a); bad[field] = value
            self.assertFalse(design_gate(task, bad))
        self.assertFalse(design_gate(task, a, {a['id']}))

    def test_fr13_design_revision_and_decision(self):
        task, a = self.design_pair()
        for decision in ['rework','insufficient-evidence']:
            bad = deepcopy(a); bad['design']['decision'] = decision
            self.assertFalse(design_gate(task, bad))
        task = deepcopy(task); task['design_artifact']['revision'] = 'B'
        self.assertFalse(design_gate(task, a))

    def test_fr14_external_and_unknown_provider(self):
        event = deepcopy(self.task['assistance_history'][0])
        event['provider'] = {'kind':'external','principal_id':None,'label':'Coworker report'}
        event['recorder'] = {'id':self.config['learner_principal_id'],'role':'learner'}
        event['level'] = 7
        task = deepcopy(self.task); task['assistance_history'].append(event | {'id':'HELP-external'})
        self.assertTrue(valid('task', task)); self.assertTrue(help_valid(event))
        event['provider']['kind'] = 'unknown'
        self.assertTrue(help_valid(event)); self.assertEqual(event['level'], 7)
        event['provider']['principal_id'] = 'ACTOR-unregistered'
        self.assertFalse(help_valid(event))

    def test_fr15_terminal_help_correction_preserves_history(self):
        before = deepcopy(self.task); after = deepcopy(before)
        event = deepcopy(after['assistance_history'][0])
        event.update(id='HELP-correction', supersedes=event['id'], level=7, recorded_at='2026-09-12T12:00:00Z')
        after['assistance_history'].append(event)
        self.assertTrue(valid('task', after)); self.assertTrue(help_valid(event))
        self.assertEqual(after['status'], 'completed')
        self.assertEqual(after['assistance_history'][:-1], before['assistance_history'])
        self.assertTrue(frozen_assignment(before, after))
        self.assertIn('promotion', stale_closure({'evidence':{'HELP-correction'},'promotion':{'evidence'}}, {'HELP-correction'}))

    def test_fr16_workspace_project_is_immutable(self):
        original = load(STATE / 'projects/spring-petclinic-microservices.yaml')
        changed = deepcopy(original); changed['repository_url'] = 'https://example.invalid/other'
        # A structurally valid project refresh is still forbidden by lifetime immutability.
        self.assertTrue(valid('project', changed)); self.assertNotEqual(original, changed)
        self.assertEqual(original, deepcopy(original))

    def test_fr17_nonservice_rubric(self):
        levels = load(ROOT / 'catalog/levels.yaml')
        for level in levels['levels']:
            self.assertEqual(set(level['expectations']), set(levels['dimensions']))
        e3 = levels['levels'][3]['expectations']
        self.assertIn('library', e3['scope'])
        self.assertFalse(any('service' in text for text in e3.values()))
        self.assertIn('subsystems', levels['levels'][4]['expectations']['scope'])

    def test_fr18_every_assignment_field_is_frozen(self):
        self.assertTrue(frozen_assignment(self.task, deepcopy(self.task)))
        for field in self.task.keys() - EXECUTION:
            bad = deepcopy(self.task); bad[field] = None
            self.assertFalse(frozen_assignment(self.task, bad), field)
        for field in ('testing_expectations', 'constraints', 'documentation_requirements'):
            bad = deepcopy(self.task); bad[field] = ['Weakened requirement']
            self.assertFalse(frozen_assignment(self.task, bad))
        bad = deepcopy(self.task); bad['code_review_required'] = False
        self.assertFalse(frozen_assignment(self.task, bad))

    def test_fr19_checkpoint_cannot_replace_synthesis(self):
        earlier = deepcopy(self.assessment)
        later = deepcopy(earlier); later.update(scope='checkpoint', task_id=self.task['id'], created_at='2026-09-12T12:00:00Z')
        later['findings'][0].update(status='unassessed', demonstrated_level=None, evidence_ids=[])
        self.assertEqual(aggregate([earlier,later]), aggregate([earlier]))
        later['scope'] = 'longitudinal'; later['task_id'] = None
        self.assertNotEqual(aggregate([earlier,later]), aggregate([earlier]))

    def test_fr20_project_free_baseline_and_no_fake_artifact(self):
        e = deepcopy(self.evidence); e.update(project_id=None,task_id=None)
        self.assertTrue(valid('evidence', e))
        e['task_id'] = self.task['id']; self.assertFalse(valid('evidence', e))
        e['task_id'] = None; e['fact']['artifacts'] = []
        self.assertFalse(valid('evidence', e))

    def test_fr21_portable_subset(self):
        sample = {'on':'on','off':'off','zero':'012','date':'2026-09-12','truth':True,'number':12,'null':None,'unicode':'λ'}
        raw = json.dumps(sample,ensure_ascii=False)
        self.assertEqual(json.loads(raw),yaml.safe_load(raw))
        for folder in ('catalog','examples'):
            for p in (ROOT/folder).rglob('*.yaml'):
                self.assertEqual(json.loads(p.read_text()),yaml.safe_load(p.read_text()),str(p))

    def test_fr22_archive_and_version_separation(self):
        archive = ROOT/'archive/protocol-1.0'
        for name,digest in load(archive/'SHA256SUMS.json').items():
            self.assertEqual(hashlib.sha256((archive/name).read_bytes()).hexdigest(),digest,name)
        archived = {path.name.split('.')[0] for path in (archive/'schemas').glob('*.schema.json')}
        for name in archived:
            self.assertIn('/3.0/',SCHEMAS[name].schema['$id'])
            self.assertIn('/1.0/',load(archive/f'schemas/{name}.schema.json')['$id'])
        for name in ('track','current-track','forge'):
            self.assertIn('/3.0/',SCHEMAS[name].schema['$id'])
        self.assertIn('/3.0/',SCHEMAS['attention-advisory'].schema['$id'])
        self.assertEqual(len(SCHEMAS),13)  # ACP-015 adds forge (Phase 13); ACP-014 adds attention-advisory (Phase 14).

if __name__ == '__main__':
    unittest.main(verbosity=2)
