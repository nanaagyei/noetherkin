import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

export const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const links = /(!?\[[^\]\n]*\])\(([^\s)]+)\)/g;
const remote = value => /^[a-z][a-z0-9+.-]*:/i.test(value);

function safe(base, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..' || p === '')) {
    throw new Error(`Unsafe package path: ${relative}`);
  }
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in package path: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return current;
}

function destination(source) {
  if (source === 'skill-pack/proposal.md') return 'assets/proposal.md';
  const name = source.startsWith('contracts/') ? `contract-${path.basename(source)}` : path.basename(source);
  return `references/${name}`;
}

export function expectedBundle(base = root, skillName = undefined) {
  const manifest = JSON.parse(fs.readFileSync(safe(base, 'skill-pack/manifest.json'), 'utf8'));
  if (manifest.format_version !== 2 || !Array.isArray(manifest.shared_sources) || !Array.isArray(manifest.skills)) throw new Error('Unsupported skill manifest');
  const names = manifest.skills.map(skill => skill.name);
  if (new Set(names).size !== names.length || names.some(name => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))) throw new Error('Duplicate or invalid skill name');
  const selected = skillName ? manifest.skills.find(skill => skill.name === skillName) : manifest.skills[0];
  if (!selected) throw new Error(`Unknown skill: ${skillName}`);
  const sources = [...manifest.shared_sources, ...selected.sources];
  if (new Set(sources).size !== sources.length) throw new Error(`Duplicate source for ${selected.name}`);
  const mapping = new Map(sources.map(source => [source, destination(source)]));
  if (new Set(mapping.values()).size !== sources.length) throw new Error(`Duplicate destination for ${selected.name}`);
  const knownSources = new Set([...manifest.shared_sources, ...manifest.skills.flatMap(skill => skill.sources)]);
  const expected = new Map();
  const provenance = [];
  for (const [source, target] of mapping) {
    const bytes = fs.readFileSync(safe(base, source));
    let output = bytes;
    if (source.endsWith('.md')) {
      const relocated = bytes.toString('utf8').replace(links, (whole, label, href) => {
        if (remote(href) || href.startsWith('#')) return whole;
        const [pathname, anchor] = href.split('#');
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), decodeURIComponent(pathname)));
        if (mapping.has(resolved)) {
          const link = path.posix.relative(path.posix.dirname(target), mapping.get(resolved));
          return `${label}(${link}${anchor ? `#${anchor}` : ''})`;
        }
        const reason = manifest.context_only_links[resolved] ?? (knownSources.has(resolved) ? 'Related skill contract; omitted from this focused bundle.' : undefined);
        if (!reason) throw new Error(`Unbundled dependency in ${source}: ${href}`);
        // Context citations remain explicit, never dangling local links.
        return `${label.slice(1, -1)} (repository context: \`${resolved}\`; ${reason})`;
      });
      output = Buffer.from(relocated);
    }
    expected.set(target, output);
    provenance.push({ source, target, source_sha256: sha256(bytes), bundled_sha256: sha256(output) });
  }
  const index = '# Bundled reference index\n\nGenerated from the protocol 2.0 source manifest. Read the runtime guide and the invoked skill contract first; load other references only as needed. Source paths in frozen prose identify repository authority; this table locates their installed copies. All contracts are bundled to explain handoffs, not to install other skills or grant roles. The complete schema/catalog set supports cross-record references without a checkout.\n\n| Authoritative source | Installed reference |\n| --- | --- |\n' +
    provenance.map(p => `| \`${p.source}\` | [${path.basename(p.target)}](${path.posix.relative('references', p.target)}) |`).join('\n') + '\n';
  expected.set('references/index.md', Buffer.from(index));
  expected.set('references/bundle.json', Buffer.from(json({
    format_version: 2, protocol_version: manifest.protocol_version, skill: selected.name,
    manifest_sha256: sha256(fs.readFileSync(safe(base, 'skill-pack/manifest.json'))),
    context_only_links: manifest.context_only_links,
    files: provenance,
    index_sha256: sha256(index),
  })));
  return { manifest, expected };
}

function filesUnder(base, relative = '') {
  return fs.readdirSync(path.join(base, relative), { withFileTypes: true }).flatMap(entry => {
    const file = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink in skill: ${file}`);
    if (entry.isDirectory()) return filesUnder(base, file);
    if (!entry.isFile()) throw new Error(`Unexpected file type: ${file}`);
    return [file];
  });
}

export function validateInstalled(skillRoot, name = path.basename(skillRoot)) {
  const files = filesUnder(skillRoot);
  const entry = fs.readFileSync(safe(skillRoot, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(entry);
  if (!frontmatter) throw new Error(`Missing frontmatter: ${name}`);
  const doc = parseDocument(frontmatter[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`Invalid frontmatter: ${name}: ${doc.errors[0].message}`);
  const meta = doc.toJS();
  if (meta.name !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error(`Invalid skill name: ${name}`);
  if (typeof meta.description !== 'string' || !meta.description.trim() || meta.description.length > 1024) throw new Error(`Invalid description: ${name}`);
  if (entry.split('\n').length >= 500) throw new Error(`Entrypoint too long: ${name}`);
  for (const file of files.filter(file => file.endsWith('.md'))) {
    const content = fs.readFileSync(safe(skillRoot, file), 'utf8');
    if (/\bTODO\b|\bTBD\b|\[INSERT\b|\[PLACEHOLDER\b/i.test(content)) throw new Error(`Unfinished scaffold: ${file}`);
    for (const [, , href] of content.matchAll(links)) {
      if (remote(href) || href.startsWith('#')) continue;
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(href.split('#')[0])));
      if (!fs.existsSync(safe(skillRoot, relative))) throw new Error(`Broken installed link: ${file}: ${href}`);
    }
  }
  const provenance = JSON.parse(fs.readFileSync(safe(skillRoot, 'references/bundle.json'), 'utf8'));
  for (const item of provenance.files) {
    if (sha256(fs.readFileSync(safe(skillRoot, item.target))) !== item.bundled_sha256) throw new Error(`Bundle digest mismatch: ${item.target}`);
  }
  if (sha256(fs.readFileSync(safe(skillRoot, 'references/index.md'))) !== provenance.index_sha256) throw new Error('Index digest mismatch');
  return files;
}

export function packageSkills({ check = false, base = root } = {}) {
  const { manifest } = expectedBundle(base);
  const names = manifest.skills.map(skill => skill.name);
  const skillNames = fs.readdirSync(safe(base, 'skills')).sort();
  if (JSON.stringify(skillNames) !== JSON.stringify([...names].sort())) throw new Error('Unexpected skills directory inventory');
  for (const name of names) {
    const { expected } = expectedBundle(base, name);
    const skillRoot = safe(base, `skills/${name}`);
    if (!check) {
      // references/ and assets/ are deterministic generated output. Validate the
      // existing tree before replacing it so symlinks or special files never
      // turn cleanup into an escape from the skill directory.
      filesUnder(skillRoot);
      for (const generated of ['references', 'assets']) {
        const target = safe(skillRoot, generated);
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });
      }
    }
    for (const [relative, bytes] of expected) {
      const target = safe(skillRoot, relative);
      if (check) {
        if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) throw new Error(`Bundle drift: ${name}/${relative}`);
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
    const files = validateInstalled(skillRoot, name);
    for (const file of files) {
      if (file !== 'SKILL.md' && !expected.has(file)) throw new Error(`Unmanaged skill resource: ${name}/${file}`);
    }
  }
  return names.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/package-skills.mjs [--check]');
    const check = process.argv.includes('--check');
    console.log(`${check ? 'Verified' : 'Bundled'} ${packageSkills({ check })} portable skills. Structural checks only; agent behavior is not evaluated.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
