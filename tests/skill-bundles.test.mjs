import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expectedBundle, packageSkills, root, validateInstalled } from '../scripts/package-skills.mjs';

function temporary(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-skills-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function copiedRepository(t) {
  const directory = temporary(t);
  const { manifest } = expectedBundle();
  const sources = [...manifest.shared_sources, ...manifest.skills.flatMap(skill => skill.sources)];
  for (const file of [...new Set([...sources, 'skill-pack/manifest.json'])]) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(directory, file));
  }
  fs.cpSync(path.join(root, 'skills'), path.join(directory, 'skills'), { recursive: true });
  return directory;
}

test('all committed bundles match authority and a check never rewrites drift', t => {
  const count = expectedBundle().manifest.skills.length;
  assert.equal(packageSkills({ check: true }), count);
  const directory = copiedRepository(t);
  const source = path.join(directory, 'docs/architecture/permissions-model.md');
  fs.appendFileSync(source, '\nTest-only changed authority.\n');
  const generated = path.join(directory, 'skills/onboarding/references/permissions-model.md');
  const before = fs.readFileSync(generated);
  assert.throws(() => packageSkills({ check: true, base: directory }), /Bundle drift/);
  assert.deepEqual(fs.readFileSync(generated), before);
  packageSkills({ base: directory });
  assert.equal(packageSkills({ check: true, base: directory }), count);
});

test('each skill works as a standalone file bundle with locally compilable schemas', t => {
  const directory = temporary(t);
  for (const { name } of expectedBundle().manifest.skills) {
    const installed = path.join(directory, name);
    fs.cpSync(path.join(root, 'skills', name), installed, { recursive: true });
    const files = validateInstalled(installed);
    assert.ok(files.includes('assets/proposal.md'));
    assert.ok(files.includes(`references/contract-${name}.md`));
    const schemas = files.filter(file => file.endsWith('.schema.json'));
    assert.equal(schemas.length, 13);
    const ajv = new Ajv2020({ strict: false, validateFormats: true });
    addFormats(ajv);
    for (const file of schemas) ajv.compile(JSON.parse(fs.readFileSync(path.join(installed, file), 'utf8')));
  }
});

test('manifest format 2 gives each skill only shared and declared contract references', () => {
  const { manifest } = expectedBundle();
  for (const skill of manifest.skills) {
    const { expected } = expectedBundle(root, skill.name);
    assert.ok(expected.has(`references/contract-${skill.name}.md`));
    for (const source of skill.sources) assert.ok(expected.has(`references/contract-${path.basename(source)}`));
    const declared = new Set(skill.sources.map(source => `references/contract-${path.basename(source)}`));
    for (const other of manifest.skills) {
      const own = `references/contract-${other.name}.md`;
      assert.equal(expected.has(own), declared.has(own), `${skill.name} unexpected dependency ${own}`);
    }
    const provenance = JSON.parse(expected.get('references/bundle.json'));
    assert.equal(provenance.format_version, 2);
    assert.equal(provenance.skill, skill.name);
  }
});

test('installed bundle rejects missing and altered required resources', t => {
  const directory = temporary(t);
  const installed = path.join(directory, 'onboarding');
  fs.cpSync(path.join(root, 'skills/onboarding'), installed, { recursive: true });
  const reference = path.join(installed, 'references/assessment.schema.json');
  const bytes = fs.readFileSync(reference);
  fs.unlinkSync(reference);
  assert.throws(() => validateInstalled(installed), /Broken installed link/);
  fs.writeFileSync(reference, Buffer.concat([bytes, Buffer.from('\n')]));
  assert.throws(() => validateInstalled(installed), /Bundle digest mismatch/);
});

test('unknown source dependencies fail bundling rather than becoming broken references', t => {
  const directory = copiedRepository(t);
  fs.appendFileSync(path.join(directory, 'contracts/teach.md'), '\n[Required future procedure](not-bundled.md)\n');
  assert.throws(() => packageSkills({ base: directory }), /Unbundled dependency/);
});

test('entrypoint validation rejects duplicate YAML fields and scaffold markers', t => {
  const directory = temporary(t);
  const installed = path.join(directory, 'teach');
  fs.cpSync(path.join(root, 'skills/teach'), installed, { recursive: true });
  const entry = path.join(installed, 'SKILL.md');
  const original = fs.readFileSync(entry, 'utf8');
  fs.writeFileSync(entry, original.replace('name: teach', 'name: teach\nname: teach'));
  assert.throws(() => validateInstalled(installed), /Invalid frontmatter/);
  fs.writeFileSync(entry, original + '\nTODO: write workflow\n');
  assert.throws(() => validateInstalled(installed), /Unfinished scaffold/);
});

test('FR-31: a description with no routing boundary is rejected', t => {
  const directory = temporary(t);
  const installed = path.join(directory, 'teach');
  fs.cpSync(path.join(root, 'skills/teach'), installed, { recursive: true });
  const entry = path.join(installed, 'SKILL.md');
  const original = fs.readFileSync(entry, 'utf8');
  fs.writeFileSync(entry, original.replace('; debugging collaboration belongs to peer-engineer.', '.'));
  assert.throws(() => validateInstalled(installed), /Description states no boundary: teach/);
});

test('escaping references and resource symlinks cannot satisfy portability checks', t => {
  const directory = temporary(t);
  const installed = path.join(directory, 'teach');
  fs.cpSync(path.join(root, 'skills/teach'), installed, { recursive: true });
  const entry = path.join(installed, 'SKILL.md');
  const original = fs.readFileSync(entry, 'utf8');
  fs.writeFileSync(path.join(directory, 'outside.md'), 'External dependency');
  fs.writeFileSync(entry, original + '\n[Outside](../outside.md)\n');
  assert.throws(() => validateInstalled(installed), /Unsafe package path/);
  fs.writeFileSync(entry, original);
  const resource = path.join(installed, 'assets/proposal.md');
  fs.unlinkSync(resource);
  fs.symlinkSync(path.join(directory, 'outside.md'), resource);
  assert.throws(() => validateInstalled(installed), /Symlink/);
});

test('regeneration is deterministic and extra untracked resources fail closed', t => {
  const directory = copiedRepository(t);
  const first = fs.readFileSync(path.join(directory, 'skills/manager/references/bundle.json'));
  packageSkills({ base: directory });
  packageSkills({ base: directory });
  assert.deepEqual(fs.readFileSync(path.join(directory, 'skills/manager/references/bundle.json')), first);
  fs.writeFileSync(path.join(directory, 'skills/manager/references/unmanaged.md'), 'Not in the manifest.\n');
  assert.throws(() => packageSkills({ check: true, base: directory }), /Unmanaged skill resource/);
});

test('portable skill entrypoints and contracts name no model, vendor or agent host', () => {
  // The charter's agent-independence principle: host-specific behavior belongs in adapters/, never in the
  // portable instructions every harness reads.
  const hosts = /\b(claude|codex|anthropic|openai|gpt-\d|gemini|cursor|windsurf|opencode|kiro|openhands|copilot)\b/i;
  const files = [
    ...fs.readdirSync(path.join(root, 'contracts')).map(file => `contracts/${file}`),
    ...expectedBundle().manifest.skills.flatMap(({ name }) => [`skills/${name}/SKILL.md`, `skills/${name}/assets/proposal.md`]),
    'skill-pack/runtime.md', 'skill-pack/proposals.md', 'skill-pack/proposal.md',
  ];
  for (const file of files) {
    const match = fs.readFileSync(path.join(root, file), 'utf8').match(hosts);
    assert.equal(match, null, `${file} names host-specific ${match?.[0]}`);
  }
});
