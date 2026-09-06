/**
 * API response serializer.
 *
 * The frontend was built against a MongoDB-backed API where every entity
 * exposed an `id`, the field is `_id`. Prisma exposes `id` on all rows.
 *
 * `toClient` recursively renames every `id` key to `_id` (and drops
 * `password`/`__v`) so the API contract stays identical to the old build.
 * It only touches plain objects, leaving Date/number/string leaves intact.
 */

const STRIPPED_KEYS = new Set(['password', '__v']);

export const toClient = (value) => {
  if (Array.isArray(value)) {
    return value.map(toClient);
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (STRIPPED_KEYS.has(key)) continue;
      const outKey = key === 'id' ? '_id' : key;
      out[outKey] = toClient(nested);
    }
    return out;
  }

  return value;
};