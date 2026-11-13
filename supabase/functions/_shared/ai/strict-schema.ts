// An answer's zod schema as the JSON Schema a strict structured-output API takes (the Groq switch, chunk 1,
// docs/superpowers/plans/2026-11-13-groq-free-plan.md). Strict mode wants every property required, no other
// properties, and a field that may be null as a type union. It may refuse formats, patterns and length or item bounds,
// so those are left out: `readStructured` checks the answer against the zod schema again, bounds included.

import { z } from 'zod';

export type JsonSchema = { [key: string]: unknown };

/** Keywords a strict structured-output API may refuse or that say nothing to the model. zod still checks the bounds. */
const LEFT_OUT = new Set([
  '$schema',
  '$id',
  '$defs',
  'definitions',
  'title',
  'default',
  'examples',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minProperties',
  'maxProperties',
]);

/** Ways of combining schemas strict mode doesn't take; zod writes them for intersections and the like. */
const REFUSED = new Set(['allOf', 'oneOf', 'not', 'if', 'then', 'else', 'patternProperties', 'dependentSchemas']);

/** How deep a schema may nest: far beyond any answer, short of a loop. */
const MAX_DEPTH = 32;

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The strict JSON Schema of an answer: zod's own (`z.toJSONSchema`, the output side, reused parts inlined), with
 * references inlined, every object closed and all its properties required, a nullable single type written as
 * `type: [T, "null"]`, and the keywords in `LEFT_OUT` dropped. An answer that isn't an object, a property that may be
 * missing (use `.nullable()`), a recursive schema or a combination strict mode can't take throws.
 */
export function strictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { io: 'output', reused: 'inline', cycles: 'throw', unrepresentable: 'throw' });
  if (!isSchema(raw)) throw new Error('zod gave no schema');
  const defs = isSchema(raw.$defs) ? raw.$defs : {};
  const strict = tidy(raw, defs, 0);
  if (strict.type !== 'object') throw new Error('a structured answer must be an object');
  return strict;
}

function tidy(node: JsonSchema, defs: JsonSchema, depth: number): JsonSchema {
  if (depth > MAX_DEPTH) throw new Error('the schema nests too deeply for a structured answer');
  if (typeof node.$ref === 'string') {
    const name = /^#\/\$defs\/(.+)$/.exec(node.$ref)?.[1];
    const target = name === undefined ? undefined : defs[name];
    if (!isSchema(target)) throw new Error(`a reference strict mode can't take: ${node.$ref}`);
    return tidy(target, defs, depth + 1);
  }

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (LEFT_OUT.has(key)) continue;
    if (REFUSED.has(key)) throw new Error(`strict mode can't take "${key}"`);
    if (key === 'properties' && isSchema(value)) {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, property]) => [name, tidy(asSchema(property), defs, depth + 1)]),
      );
    } else if (key === 'items' && isSchema(value)) {
      out.items = tidy(value, defs, depth + 1);
    } else if (key === 'anyOf' && Array.isArray(value)) {
      out.anyOf = value.map((branch) => tidy(asSchema(branch), defs, depth + 1));
    } else {
      out[key] = value;
    }
  }

  const merged = nullableAsUnion(out);
  if (typesOf(merged).includes('object')) closeObject(merged);
  return merged;
}

function asSchema(value: unknown): JsonSchema {
  if (!isSchema(value)) throw new Error('a schema part that is not an object');
  return value;
}

const typesOf = (node: JsonSchema): unknown[] => (Array.isArray(node.type) ? node.type : [node.type]);

/** `anyOf [S, {type: "null"}]` with one type in S becomes S with `type: [that type, "null"]`. */
function nullableAsUnion(node: JsonSchema): JsonSchema {
  const branches = node.anyOf;
  if (!Array.isArray(branches) || branches.length !== 2) return node;
  const isNull = (branch: JsonSchema) => branch.type === 'null' && Object.keys(branch).length === 1;
  const nullAt = (branches as JsonSchema[]).findIndex(isNull);
  if (nullAt === -1) return node;
  const other = (branches as JsonSchema[])[1 - nullAt];
  if (typeof other.type !== 'string' || other.type === 'null') return node;
  const rest: JsonSchema = { ...node };
  delete rest.anyOf;
  return { ...rest, ...other, type: [other.type, 'null'] };
}

/** Every property required and nothing else allowed; a property that may be missing throws. */
function closeObject(node: JsonSchema): void {
  const properties = isSchema(node.properties) ? node.properties : {};
  const required = new Set(Array.isArray(node.required) ? node.required : []);
  for (const name of Object.keys(properties)) {
    if (!required.has(name)) throw new Error(`"${name}" must always be in the answer: make it .nullable()`);
  }
  node.properties = properties;
  node.required = Object.keys(properties);
  node.additionalProperties = false;
}
