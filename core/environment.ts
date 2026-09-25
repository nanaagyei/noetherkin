import { spawnSync } from 'node:child_process';
import type { ObjectValue } from './common.js';

export type CheckStatus = 'ok' | 'missing' | 'warn';
export interface EnvironmentCheck { check: string; status: CheckStatus; detail: string; remedy: string | null }

/**
 * The first command that proves a language toolchain is usable. The map is keyed by catalog `primary_languages`
 * values, so adding a project in a new language needs only a new row here, never a project-specific branch.
 */
const toolchains: Record<string, { binary: string; args: string[]; remedy: string }> = {
  Java: { binary: 'java', args: ['-version'], remedy: 'Install a JDK (17 or newer), for example from https://adoptium.net.' },
  Python: { binary: 'python3', args: ['--version'], remedy: 'Install Python 3.11 or newer from https://www.python.org or your package manager.' },
  TypeScript: { binary: 'node', args: ['--version'], remedy: 'Node.js is already required by Noetherkin; make sure `node` is on PATH.' },
  JavaScript: { binary: 'node', args: ['--version'], remedy: 'Node.js is already required by Noetherkin; make sure `node` is on PATH.' },
  Go: { binary: 'go', args: ['version'], remedy: 'Install Go from https://go.dev/dl.' },
  Rust: { binary: 'cargo', args: ['--version'], remedy: 'Install Rust with rustup from https://rustup.rs.' },
  'C++': { binary: 'c++', args: ['--version'], remedy: 'Install a C++ compiler (Xcode Command Line Tools on macOS, build-essential on Debian or Ubuntu).' },
  C: { binary: 'cc', args: ['--version'], remedy: 'Install a C compiler (Xcode Command Line Tools on macOS, build-essential on Debian or Ubuntu).' },
  Dart: { binary: 'dart', args: ['--version'], remedy: 'Install the Dart or Flutter SDK from https://dart.dev/get-dart.' },
  OCaml: { binary: 'ocaml', args: ['-version'], remedy: 'Install OCaml with opam from https://ocaml.org/install.' },
  Lean: { binary: 'lean', args: ['--version'], remedy: 'Install Lean with elan from https://lean-lang.org.' },
  HCL: { binary: 'terraform', args: ['version'], remedy: 'Install Terraform or OpenTofu.' }
};

export type Spawner = (binary: string, args: string[]) => { ok: boolean; output: string };
export const defaultSpawner: Spawner = (binary, args) => {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 5_000 });
  return { ok: !result.error && result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n')[0] ?? '' };
};

export function coreChecks(spawn: Spawner = defaultSpawner): EnvironmentCheck[] {
  const major = Number(process.versions.node.split('.')[0]);
  const git = spawn('git', ['--version']);
  return [
    { check: 'node', status: major >= 24 ? 'ok' : 'missing', detail: `Node.js ${process.versions.node}`, remedy: major >= 24 ? null : 'Install Node.js 24 or newer from https://nodejs.org.' },
    { check: 'platform', status: ['darwin', 'linux'].includes(process.platform) ? 'ok' : 'missing', detail: process.platform, remedy: ['darwin', 'linux'].includes(process.platform) ? null : 'Canonical publication runs on macOS or Linux. On Windows, use WSL.' },
    { check: 'git', status: git.ok ? 'ok' : 'missing', detail: git.ok ? git.output : 'git was not found on PATH', remedy: git.ok ? null : 'Install git; project selection, cloning and work snapshots need it.' }
  ];
}

/** Checks the toolchains a catalog project or forge names. Unknown languages are reported, never guessed. */
export function toolchainChecks(project: ObjectValue, spawn: Spawner = defaultSpawner): EnvironmentCheck[] {
  const languages: string[] = Array.isArray(project.primary_languages) ? project.primary_languages : [];
  const seen = new Set<string>();
  return languages.flatMap((language): EnvironmentCheck[] => {
    const toolchain = toolchains[language];
    if (!toolchain) return [{ check: `toolchain:${language}`, status: 'warn' as const, detail: `No automatic check for ${language}.`, remedy: `Follow the setup instructions of ${project.name ?? project.id}.` }];
    if (seen.has(toolchain.binary)) return [];
    seen.add(toolchain.binary);
    const result = spawn(toolchain.binary, toolchain.args);
    return [{ check: `toolchain:${language}`, status: result.ok ? 'ok' as const : 'missing' as const, detail: result.ok ? result.output : `${toolchain.binary} was not found for ${project.name ?? project.id}`, remedy: result.ok ? null : toolchain.remedy }];
  });
}
