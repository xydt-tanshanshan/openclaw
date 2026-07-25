/**
 * Recursively anchor JSON Schema `pattern` fields so providers whose regex
 * validator requires full anchoring (e.g. llama.cpp's JSON schema converter)
 * accept the tool schema instead of returning a 400.
 *
 * Only `pattern` string values are rewritten; already-anchored patterns are
 * left untouched. See openclaw/openclaw#113562.
 */

const SCHEMA_MAP_KEYS = new Set(["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"]);
const SCHEMA_OBJECT_KEYS = new Set([
  "additionalProperties",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);
const SCHEMA_ARRAY_KEYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);

/** Ensure a regex pattern source is fully anchored with `^` at the start and `$` at the end. */
export function anchorPattern(pattern: string): string {
  if (typeof pattern !== "string" || pattern === "") {
    return pattern;
  }
  const startsAnchored = pattern.startsWith("^");
  const endsAnchored = pattern.endsWith("$");
  if (startsAnchored && endsAnchored) {
    return pattern;
  }
  const start = startsAnchored ? "" : "^";
  const end = endsAnchored ? "" : "$";
  return `${start}${pattern}${end}`;
}

/** Recursively anchor every `pattern` string in a JSON Schema node. */
export function anchorStringPatterns(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  if (Array.isArray(schema)) {
    let changed = false;
    const next = schema.map((entry) => {
      const rewritten = anchorStringPatterns(entry);
      if (rewritten !== entry) {
        changed = true;
      }
      return rewritten;
    });
    return changed ? next : schema;
  }

  const obj = schema as Record<string, unknown>;
  let changed = false;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "pattern" && typeof value === "string") {
      const anchored = anchorPattern(value);
      if (anchored !== value) {
        changed = true;
      }
      cleaned[key] = anchored;
      continue;
    }

    if (SCHEMA_MAP_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      const sourceMap = value as Record<string, unknown>;
      let mapChanged = false;
      const next = Object.fromEntries(
        Object.entries(sourceMap).map(([childKey, childValue]) => {
          const rewritten = anchorStringPatterns(childValue);
          if (rewritten !== childValue) {
            mapChanged = true;
          }
          return [childKey, rewritten];
        }),
      );
      cleaned[key] = mapChanged ? next : value;
      changed ||= mapChanged;
      continue;
    }

    if (SCHEMA_OBJECT_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      const next = anchorStringPatterns(value);
      if (next !== value) {
        changed = true;
      }
      cleaned[key] = next;
      continue;
    }

    if (SCHEMA_ARRAY_KEYS.has(key) && Array.isArray(value)) {
      let arrayChanged = false;
      const next = value.map((entry) => {
        const rewritten = anchorStringPatterns(entry);
        if (rewritten !== entry) {
          arrayChanged = true;
        }
        return rewritten;
      });
      cleaned[key] = arrayChanged ? next : value;
      changed ||= arrayChanged;
      continue;
    }

    cleaned[key] = value;
  }

  return changed ? cleaned : schema;
}
