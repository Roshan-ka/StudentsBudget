import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { askAnswer, quickAddAnswer, setupAnswer } from '@/features/ai/contract';
import { strictJsonSchema, type JsonSchema } from '../../../../supabase/functions/_shared/ai/strict-schema';

// The answers as a strict structured-output API takes them (the Groq switch, chunk 1).

const LEFT_OUT = ['$schema', '$defs', '$ref', 'format', 'pattern', 'minLength', 'maxLength', 'minItems', 'maxItems'];

/** Every object node of a schema, with its path. */
function objectsOf(node: JsonSchema, path = '$'): [string, JsonSchema][] {
  const found: [string, JsonSchema][] = [];
  const types = Array.isArray(node.type) ? node.type : [node.type];
  if (types.includes('object')) found.push([path, node]);
  const properties = (node.properties ?? {}) as Record<string, JsonSchema>;
  for (const [name, property] of Object.entries(properties)) found.push(...objectsOf(property, `${path}.${name}`));
  if (node.items) found.push(...objectsOf(node.items as JsonSchema, `${path}[]`));
  for (const branch of (node.anyOf ?? []) as JsonSchema[]) found.push(...objectsOf(branch, `${path}|`));
  return found;
}

describe('strictJsonSchema', () => {
  for (const [name, schema] of [
    ['quick add', quickAddAnswer],
    ['Ask', askAnswer],
    ['the setup chat', setupAnswer],
  ] as const) {
    it(`gives ${name}'s answer in strict form: every object closed, every property required, no bounds`, () => {
      const strict = strictJsonSchema(schema);
      expect(strict.type).toBe('object');
      const objects = objectsOf(strict);
      expect(objects.length).toBeGreaterThan(0);
      for (const [path, node] of objects) {
        expect(node.additionalProperties, path).toBe(false);
        expect(node.required, path).toEqual(Object.keys((node.properties ?? {}) as object));
      }
      const text = JSON.stringify(strict);
      for (const keyword of LEFT_OUT) expect(text, keyword).not.toContain(`"${keyword}"`);
    });
  }

  it('writes a field that may be null as a type union, arrays and dates included', () => {
    const quick = strictJsonSchema(quickAddAnswer).properties as Record<string, JsonSchema>;
    expect(quick.amount).toEqual({ type: ['number', 'null'] });
    // A date's format and pattern go; zod checks the answer's date afterwards.
    expect(quick.date).toEqual({ type: ['string', 'null'] });
    const patch = (strictJsonSchema(setupAnswer).properties as Record<string, JsonSchema>).patch;
    const accounts = (patch.properties as Record<string, JsonSchema>).accounts;
    expect(accounts.type).toEqual(['array', 'null']);
    expect((accounts.items as JsonSchema).type).toBe('object');
    expect(accounts.anyOf).toBeUndefined();
  });

  it('keeps an enum, which strict mode takes', () => {
    const patch = (strictJsonSchema(setupAnswer).properties as Record<string, JsonSchema>).patch;
    const accounts = (patch.properties as Record<string, JsonSchema>).accounts;
    const kind = ((accounts.items as JsonSchema).properties as Record<string, JsonSchema>).kind;
    expect(kind).toEqual({ type: 'string', enum: ['bank', 'cash'] });
  });

  it('inlines a part zod writes as a reference', () => {
    const line = z.strictObject({ a: z.string() }).meta({ id: 'strict-schema-test-line' });
    const strict = strictJsonSchema(z.strictObject({ x: line, y: line }));
    expect(JSON.stringify(strict)).not.toContain('$ref');
    expect((strict.properties as Record<string, JsonSchema>).y).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
      additionalProperties: false,
    });
  });

  it('refuses what strict mode can’t take: a missing field, a non-object answer, a loop', () => {
    expect(() => strictJsonSchema(z.strictObject({ a: z.string().optional() }))).toThrow(/\.nullable\(\)/);
    expect(() => strictJsonSchema(z.string())).toThrow(/must be an object/);
    type Node = { next: Node | null };
    const node: z.ZodType<Node> = z.lazy(() => z.strictObject({ next: node.nullable() }));
    expect(() => strictJsonSchema(z.strictObject({ root: node }))).toThrow();
  });
});
