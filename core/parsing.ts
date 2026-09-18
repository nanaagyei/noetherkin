import { TextDecoder } from 'node:util';
import { parseAllDocuments, visit, isAlias, isScalar } from 'yaml';
import { Failure, requireThat, type ObjectValue } from './common.js';

export function parse(bytes: Buffer | string, file: string): ObjectValue {
  try {
    const text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const docs = parseAllDocuments(text, { version: '1.2', schema: 'core', uniqueKeys: true, strict: true });
    requireThat(docs.length === 1, 'YAML_INVALID', file, 'Exactly one YAML document is required.');
    const doc = docs[0]!;
    requireThat(doc.errors.length === 0 && doc.warnings.length === 0, 'YAML_INVALID', file, [...doc.errors, ...doc.warnings].map(e => e.message).join('; '));
    visit(doc, {
      Node(_key, node) {
        requireThat(!isAlias(node) && !('anchor' in node && node.anchor) && !node.tag, 'YAML_INVALID', file, 'Aliases, anchors, and explicit tags are not permitted.');
        if (isScalar(node) && typeof node.value === 'number') requireThat(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(node.source ?? '') && Number.isFinite(node.value) && (!Number.isInteger(node.value) || Number.isSafeInteger(node.value)), 'YAML_INVALID', file, 'Use finite JSON number syntax within the runtime’s exact integer range.');
      },
      Pair(_key, pair) { requireThat(isScalar(pair.key) && typeof pair.key.value === 'string', 'YAML_INVALID', file, 'Mapping keys must be strings.'); }
    });
    const value = doc.toJS({ maxAliasCount: 0 });
    function check(item: unknown): void {
      requireThat(item === null || ['string', 'boolean', 'number', 'object'].includes(typeof item), 'YAML_INVALID', file, 'Only JSON-compatible values are permitted.');
      if (typeof item === 'number') requireThat(Number.isFinite(item), 'YAML_INVALID', file, 'Non-finite numbers are not permitted.');
      if (item && typeof item === 'object') {
        requireThat(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype, 'YAML_INVALID', file, 'Non-JSON objects are not permitted.');
        for (const child of Object.values(item)) check(child);
      }
    }
    check(value);
    requireThat(value && typeof value === 'object' && !Array.isArray(value), 'YAML_INVALID', file, 'The document must contain a mapping.');
    return value;
  } catch (e) { if (e instanceof Failure) throw e; throw new Failure('YAML_INVALID', file, String(e)); }
}
