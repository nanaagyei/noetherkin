import { createHash, randomUUID } from 'node:crypto';

/** Schema-validated protocol objects. Schemas, rather than duplicated TS models, own their shape. */
export type ObjectValue = Record<string, any>;
export type Coverage = 'bootstrap' | 'structural' | 'simulation' | 'catalog' | 'none';
export interface Diagnostic { code: string; path: string; message: string }
export interface Result {
  command: string;
  outcome: 'success' | 'no-change' | 'proposal' | 'invalid' | 'incomplete' | 'recovery-required';
  coverage: Coverage;
  data: ObjectValue;
  diagnostics: Diagnostic[];
}
export class Failure extends Error {
  constructor(public code: string, public path: string, message: string, public exitCode = 1) { super(message); }
}
export function requireThat(condition: unknown, code: string, path: string, message: string): asserts condition {
  if (!condition) throw new Failure(code, path, message);
}
export function diagnostic(error: unknown): Diagnostic {
  return error instanceof Failure ? { code: error.code, path: error.path, message: error.message }
    : { code: 'IO_ERROR', path: '', message: error instanceof Error ? error.message : String(error) };
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as ObjectValue)[key])}`).join(',')}}`;
}
export const encode = (value: unknown): string => canonical(value) + '\n';
/** POSIX single-quote quoting, so a printed command can be pasted into a shell unchanged. */
export function shellQuote(value: string): string { return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`; }
export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const validId = (value: unknown, prefix: string): boolean => typeof value === 'string' && new RegExp(`^${prefix}-${uuidPattern}$`, 'i').test(value);
export const makeId = (prefix: string): string => `${prefix}-${randomUUID()}`;
export function closed(value: ObjectValue, keys: string[], path: string): void {
  requireThat(value && typeof value === 'object' && !Array.isArray(value) && canonical(Object.keys(value).sort()) === canonical([...keys].sort()), 'ENVELOPE_INVALID', path, 'Unexpected or missing envelope fields. Preserve the original and inspect its producer.');
}
