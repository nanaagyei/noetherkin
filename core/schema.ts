/**
 * JSON Schema Draft 2020-12 validator for the subset the protocol schemas use.
 *
 * Supported keywords, which is exactly what `schemas/*.schema.json` contains:
 *   $ref (local pointers only) · type · enum · const
 *   properties · required · additionalProperties
 *   items · minItems · maxItems · uniqueItems · contains
 *   minLength · pattern · format (date-time, uri)
 *   minimum · maximum
 *   allOf · anyOf · oneOf · not · if/then/else
 *
 * An unsupported keyword in a schema position is a hard error rather than a silent skip, so a
 * schema that grows beyond this subset fails loudly instead of validating less than it claims.
 * All errors are collected; there is no fail-fast mode.
 */
import { canonical, type ObjectValue } from './common.js';

export interface SchemaError { path: string; message: string }

/* Formats -------------------------------------------------------------------------------------
 * RFC 3339 section 5.6 date-time, with a required timezone, and RFC 3986 absolute URI.
 * Semantics deliberately match ajv-formats in its default "full" mode, including real calendar
 * day checks and the leap-second allowance, so that swapping validators cannot change which
 * documents are accepted. The URI pattern is the RFC 3986 Appendix A grammar as expressed by
 * ajv-formats (MIT, Evgeny Poberezkin), which in turn credits is-my-json-valid (MIT, Mathias Buus).
 */
const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
const TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
const DATE_TIME_SEPARATOR = /t|\s/i;
const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;

const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

function isDate(value: string): boolean {
  const matched = DATE.exec(value);
  if (!matched) return false;
  const [year, month, day] = [Number(matched[1]), Number(matched[2]), Number(matched[3])];
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS[month];
  return month >= 1 && month <= 12 && day >= 1 && limit !== undefined && day <= limit;
}
function isTime(value: string): boolean {
  const matched = TIME.exec(value);
  if (!matched) return false;
  const [hour, minute, second] = [Number(matched[1]), Number(matched[2]), Number(matched[3])];
  const zone = matched[4];
  const sign = matched[5] === '-' ? -1 : 1;
  const zoneHour = Number(matched[6] ?? 0);
  const zoneMinute = Number(matched[7] ?? 0);
  if (zoneHour > 23 || zoneMinute > 59 || !zone) return false;
  if (hour <= 23 && minute <= 59 && second < 60) return true;
  const utcMinute = minute - zoneMinute * sign;
  const utcHour = hour - zoneHour * sign - (utcMinute < 0 ? 1 : 0);
  return (utcHour === 23 || utcHour === -1) && (utcMinute === 59 || utcMinute === -1) && second < 61;
}
const formats: Record<string, (value: string) => boolean> = {
  'date-time': value => { const parts = value.split(DATE_TIME_SEPARATOR); return parts.length === 2 && isDate(parts[0]!) && isTime(parts[1]!); },
  uri: value => URI.test(value),
};

/* Validation --------------------------------------------------------------------------------- */

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs', 'examples', 'default', 'deprecated', 'readOnly', 'writeOnly', '$comment']);
const SUPPORTED = new Set(['$ref', 'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'contains', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else']);

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}
const matchesType = (expected: string, value: unknown): boolean =>
  expected === 'number' ? kindOf(value) === 'integer' || kindOf(value) === 'number' : kindOf(value) === expected;

function resolve(pointer: string, root: ObjectValue, path: string): ObjectValue {
  if (!pointer.startsWith('#/')) throw new Error(`Unsupported $ref ${pointer} at ${path}: only local pointers are supported.`);
  let target: unknown = root;
  for (const rawSegment of pointer.slice(2).split('/')) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (target === null || typeof target !== 'object') throw new Error(`Unresolvable $ref ${pointer} at ${path}.`);
    target = (target as ObjectValue)[segment];
  }
  if (target === null || typeof target !== 'object') throw new Error(`Unresolvable $ref ${pointer} at ${path}.`);
  return target as ObjectValue;
}

/**
 * Locate a duplicate pair the way ajv's uniqueItems keyword does, returning [j, i] for its
 * "items ## j and i are identical" message. ajv picks one of two loops depending on whether `items`
 * declares only scalar types, and the two report their index pair in opposite orders, so both are
 * reproduced here rather than normalized. Diagnostics are the only thing that depends on this.
 */
function declaredTypes(items: unknown): string[] {
  if (items === null || typeof items !== 'object' || Array.isArray(items)) return [];
  const declared = (items as ObjectValue)['type'];
  if (declared === undefined) return [];
  return Array.isArray(declared) ? declared as string[] : [declared as string];
}
function findDuplicate(value: unknown[], items: unknown): [number, number] | null {
  const types = declaredTypes(items);
  if (types.length > 0 && !types.some(one => one === 'object' || one === 'array')) {
    // ajv's optimized scalar loop: descend, keying an index map by the raw item.
    const indices = new Map<string, number>();
    for (let i = value.length - 1; i >= 0; i--) {
      const item = value[i];
      if (!types.some(one => matchesType(one, item))) continue;
      const key = types.length > 1 && typeof item === 'string' ? `${item}_` : String(item);
      const seen = indices.get(key);
      if (seen !== undefined) return [seen, i];
      indices.set(key, i);
    }
    return null;
  }
  // ajv's general loop: descending outer index, descending inner index below it, deep equality.
  for (let i = value.length - 1; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) if (canonical(value[i]) === canonical(value[j])) return [j, i];
  }
  return null;
}

function check(schema: ObjectValue, value: unknown, path: string, root: ObjectValue, errors: SchemaError[]): void {
  const fail = (message: string): number => errors.push({ path, message });

  if (typeof schema['$ref'] === 'string') check(resolve(schema['$ref'], root, path), value, path, root, errors);

  if (schema['type'] !== undefined) {
    const expected: string[] = Array.isArray(schema['type']) ? schema['type'] : [schema['type']];
    if (!expected.some(one => matchesType(one, value))) fail(`must be ${expected.join(',')}`);
  }
  if (schema['enum'] !== undefined && !(schema['enum'] as unknown[]).some(one => canonical(one) === canonical(value))) fail('must be equal to one of the allowed values');
  if (schema['const'] !== undefined && canonical(schema['const']) !== canonical(value)) fail('must be equal to constant');

  if (typeof value === 'string') {
    if (typeof schema['minLength'] === 'number' && value.length < schema['minLength']) fail(`must NOT have fewer than ${schema['minLength']} characters`);
    if (typeof schema['maxLength'] === 'number' && value.length > schema['maxLength']) fail(`must NOT have more than ${schema['maxLength']} characters`);
    if (typeof schema['pattern'] === 'string' && !new RegExp(schema['pattern'], 'u').test(value)) fail(`must match pattern "${schema['pattern']}"`);
    if (typeof schema['format'] === 'string' && !formats[schema['format']]!(value)) fail(`must match format "${schema['format']}"`);
  }
  if (typeof value === 'number') {
    if (typeof schema['minimum'] === 'number' && value < schema['minimum']) fail(`must be >= ${schema['minimum']}`);
    if (typeof schema['maximum'] === 'number' && value > schema['maximum']) fail(`must be <= ${schema['maximum']}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema['maxItems'] === 'number' && value.length > schema['maxItems']) fail(`must NOT have more than ${schema['maxItems']} items`);
    if (typeof schema['minItems'] === 'number' && value.length < schema['minItems']) fail(`must NOT have fewer than ${schema['minItems']} items`);
    if (schema['uniqueItems'] === true && value.length > 1) {
      const duplicate = findDuplicate(value, schema['items']);
      if (duplicate) fail(`must NOT have duplicate items (items ## ${duplicate[0]} and ${duplicate[1]} are identical)`);
    }
    if (schema['items'] !== undefined) value.forEach((item, index) => check(schema['items'] as ObjectValue, item, `${path}/${index}`, root, errors));
    if (schema['contains'] !== undefined) {
      const inner: SchemaError[] = [];
      const matched = value.some((item, index) => subschemaPasses(schema['contains'] as ObjectValue, item, `${path}/${index}`, root, inner));
      if (!matched) { errors.push(...inner); fail('must contain at least 1 valid item(s)'); }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as ObjectValue;
    const declared = (schema['properties'] ?? {}) as ObjectValue;
    for (const name of (schema['required'] ?? []) as string[]) {
      if (!Object.prototype.hasOwnProperty.call(record, name)) fail(`must have required property '${name}'`);
    }
    if (schema['additionalProperties'] === false) {
      for (const name of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(declared, name)) { fail('must NOT have additional properties'); break; }
      }
    } else if (typeof schema['additionalProperties'] === 'object' && schema['additionalProperties'] !== null) {
      for (const name of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(declared, name)) check(schema['additionalProperties'] as ObjectValue, record[name], `${path}/${name}`, root, errors);
      }
    }
    for (const [name, subschema] of Object.entries(declared)) {
      if (Object.prototype.hasOwnProperty.call(record, name)) check(subschema as ObjectValue, record[name], `${path}/${name}`, root, errors);
    }
  }

  for (const subschema of (schema['allOf'] ?? []) as ObjectValue[]) check(subschema, value, path, root, errors);
  if (schema['anyOf'] !== undefined) {
    const inner: SchemaError[] = [];
    if (!(schema['anyOf'] as ObjectValue[]).some(one => subschemaPasses(one, value, path, root, inner))) { errors.push(...inner); fail('must match a schema in anyOf'); }
  }
  if (schema['oneOf'] !== undefined) {
    const inner: SchemaError[] = [];
    const matched = (schema['oneOf'] as ObjectValue[]).filter(one => subschemaPasses(one, value, path, root, inner)).length;
    if (matched === 0) { errors.push(...inner); fail('must match exactly one schema in oneOf'); }
    else if (matched > 1) fail('must match exactly one schema in oneOf');
  }
  if (schema['not'] !== undefined && subschemaPasses(schema['not'] as ObjectValue, value, path, root)) fail('must NOT be valid');
  if (schema['if'] !== undefined) {
    const taken = subschemaPasses(schema['if'] as ObjectValue, value, path, root) ? 'then' : 'else';
    const branch = schema[taken];
    if (branch !== undefined) {
      const before = errors.length;
      check(branch as ObjectValue, value, path, root, errors);
      if (errors.length > before) fail(`must match "${taken}" schema`);
    }
  }
}

function subschemaPasses(schema: ObjectValue, value: unknown, path: string, root: ObjectValue, collect?: SchemaError[]): boolean {
  const errors: SchemaError[] = [];
  check(schema, value, path, root, errors);
  if (errors.length > 0 && collect) collect.push(...errors);
  return errors.length === 0;
}

/**
 * Statically walk every schema position so an unsupported keyword surfaces at load time rather than
 * on the first record that happens to reach that branch. A validating walk cannot do this, because it
 * only descends into branches the probe value reaches.
 */
const SUBSCHEMA = ['items', 'contains', 'not', 'if', 'then', 'else', 'additionalProperties'] as const;
const SUBSCHEMA_LIST = ['allOf', 'anyOf', 'oneOf'] as const;
const SUBSCHEMA_MAP = ['properties', '$defs'] as const;
function assertSupported(schema: ObjectValue, path: string): void {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) throw new Error(`Schema at ${path} is not an object.`);
  for (const keyword of Object.keys(schema)) {
    if (!ANNOTATIONS.has(keyword) && !SUPPORTED.has(keyword)) throw new Error(`Unsupported schema keyword "${keyword}" at ${path}. Extend core/schema.ts before using it.`);
  }
  if (typeof schema['format'] === 'string' && !formats[schema['format']]) throw new Error(`Unsupported format "${schema['format']}" at ${path}.`);
  if (typeof schema['pattern'] === 'string') new RegExp(schema['pattern'], 'u');
  for (const keyword of SUBSCHEMA) {
    const child = schema[keyword];
    if (child !== undefined && typeof child === 'object' && child !== null) assertSupported(child as ObjectValue, `${path}/${keyword}`);
  }
  for (const keyword of SUBSCHEMA_LIST) {
    const children = schema[keyword];
    if (Array.isArray(children)) children.forEach((child, index) => assertSupported(child as ObjectValue, `${path}/${keyword}/${index}`));
  }
  for (const keyword of SUBSCHEMA_MAP) {
    const children = schema[keyword];
    if (children !== undefined && typeof children === 'object' && children !== null) {
      for (const [name, child] of Object.entries(children as ObjectValue)) assertSupported(child as ObjectValue, `${path}/${keyword}/${name}`);
    }
  }
}

/** Compile once at load so an unsupported keyword surfaces at startup, not on the first bad record. */
export function compileSchema(schema: ObjectValue): (value: unknown) => SchemaError[] {
  assertSupported(schema, '#');
  return (value: unknown) => { const errors: SchemaError[] = []; check(schema, value, '', schema, errors); return errors; };
}
export const errorsText = (errors: SchemaError[]): string =>
  errors.map(error => `${error.path === '' ? 'data' : `data${error.path}`} ${error.message}`).join('; ');
