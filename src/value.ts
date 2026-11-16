/** JSON encoding and copying for pipeline values and their containing records. */
import type { Value } from "web-test/nodes/base.ts";
/** Validate runtime values, including instants nested in arrays or records. */

export function isValue(value: unknown, seen = new Set<object>(), depth = 0): value is Value {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean" || value instanceof Temporal.Instant) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  const next = new Set(seen).add(value);
  if (Array.isArray(value)) return value.every((item) => isValue(item, next, depth + 1));
  return Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every((item) => isValue(item, next, depth + 1));
}
/** Copy arrays and plain records. Immutable instants can safely be shared. */

export function copyValue<T>(value: T): T {
  if (value instanceof Temporal.Instant || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => copyValue(item)) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError("Expected a plain record, array, or Temporal.Instant.");
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)])) as T;
}
/** Encode instants before JSON.stringify can invoke their toJSON method. */

export function stringifyValue(value: unknown, space?: number): string {
  const encode = (item: unknown): unknown => {
    if (typeof item === "number" && !Number.isFinite(item)) throw new TypeError("Pipeline numbers must be finite.");
    if (item instanceof Temporal.Instant) {
      const billion = 1_000_000_000n;
      const total = item.epochNanoseconds;
      const nanoseconds = (total % billion + billion) % billion;
      return { $type: "instant", epochSeconds: Number((total - nanoseconds) / billion), nanoseconds: Number(nanoseconds) };
    }
    if (Array.isArray(item)) return item.map(encode);
    if (item !== null && typeof item === "object") {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new TypeError("Expected a plain record, array, or Temporal.Instant.");
      }
      const entries = Object.entries(item).map(([key, value]) => [key, encode(value)]);
      // Escape tagged user records so they cannot be mistaken for an instant.
      if (Object.hasOwn(item, "$type")) return { $type: "record", entries };
      return Object.fromEntries(entries);
    }
    return item;
  };
  return JSON.stringify(encode(value), null, space);
}
/** Decode tagged instants without guessing from field names or ISO strings. */

export function parseValue(text: string): unknown {
  const decode = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(decode);
    if (item === null || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    if (record.$type === "instant") {
      const { epochSeconds, nanoseconds } = record;
      if (
        Object.keys(record).length !== 3 || !Number.isSafeInteger(epochSeconds) || !Number.isInteger(nanoseconds) || (nanoseconds as number) < 0 ||
        (nanoseconds as number) >= 1_000_000_000
      ) throw new SyntaxError("Invalid instant encoding.");
      try {
        return Temporal.Instant.fromEpochNanoseconds(BigInt(epochSeconds as number) * 1_000_000_000n + BigInt(nanoseconds as number));
      } catch {
        throw new SyntaxError("Instant is outside the supported range.");
      }
    }
    if (record.$type === "record") {
      if (
        Object.keys(record).length !== 2 || !Array.isArray(record.entries) ||
        !record.entries.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string")
      ) throw new SyntaxError("Invalid record encoding.");
      return Object.fromEntries(record.entries.map(([key, value]) => [key, decode(value)]));
    }
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, decode(value)]));
  };
  return decode(JSON.parse(text));
}
