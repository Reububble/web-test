import type { DataType, JsonValue, Value } from "web-test/nodes/base.ts";
import { isValue } from "web-test/value.ts";
/** A named script input or output with one of the supported runtime data types. */
export interface ScriptPort {
  /** The unique port identifier or user-facing saved name. */
  name: string;
  /** The saved node identifier or resolved runtime port type tag. */
  type: DataType;
}
/** Supported runtime data tags in the order used by port and type-selection controls. */
export const dataTypes: DataType[] = ["text", "boolean", "number", "json", "element", "array", "instant", "listener"];
/** Validate and normalize up to 32 named script ports; reject duplicate names, reserved names, and unknown types. */
export function readScriptPorts(value: unknown): ScriptPort[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error("Declare at most 32 script ports per side.");
  const names = new Set<string>();
  return value.map((item) => {
    if (
      !item || typeof item !== "object" || typeof item.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(item.name) ||
      ["__proto__", "prototype", "constructor", "next", "flow", "code", "timeout"].includes(item.name)
    ) throw new Error("Port names must be unique identifiers, e.g. message or isReady.");
    if (names.has(item.name)) throw new Error("Port names must be unique on each side.");
    if (!dataTypes.includes(item.type)) throw new Error("Unknown script port type.");
    names.add(item.name);
    return { name: item.name, type: item.type };
  });
}
/** Create an empty runtime value for a built-in data type; array defaults are independent instances. */
export function defaultValue(type: DataType): Value {
  if (type === "instant") return Temporal.Instant.fromEpochMilliseconds(0);
  if (type === "array") return [];
  return type === "boolean" ? false : type === "number" ? 0 : type === "text" ? "" : null;
}
/** Check whether a value is finite JSON data in plain records and arrays, rejecting cycles and excessive nesting. */
export function isJson(value: unknown, seen = new Set<object>(), depth = 0): value is JsonValue {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  const next = new Set(seen).add(value);
  if (Array.isArray(value)) return value.every((item) => isJson(item, next, depth + 1));
  return Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every((item) => isJson(item, next, depth + 1));
}
/** Check a runtime value against a built-in port tag, including instant and session-reference shapes. */
export function matchesType(value: unknown, type: DataType): boolean {
  if (type === "instant") return value instanceof Temporal.Instant;
  if (type === "array") return Array.isArray(value) && isValue(value);
  if (type === "json") return isJson(value);
  if (type === "element") return value === null || (typeof value === "object" && value !== null && "elementId" in value && typeof value.elementId === "string");
  if (type === "listener") {
    return value === null || (typeof value === "object" && value !== null && "listenerId" in value && typeof value.listenerId === "string");
  }
  return typeof value === (type === "text" ? "string" : type) && (type !== "number" || Number.isFinite(value));
}
