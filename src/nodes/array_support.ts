import type { DataType, Value } from "web-test/nodes/base.ts";
import { dataTypes, matchesType } from "web-test/script_schema.ts";
/** Read an array-valued graph input or throw when it is not an array of supported runtime values. */
export function array(value: Value): Value[] {
  if (!matchesType(value, "array")) throw new Error("Expected an array of pipeline values.");
  return value as Value[];
}
/** Validate a finite numeric index and truncate its fractional part toward zero. */
export function index(value: Value): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Array index must be a finite number.");
  return Math.trunc(value);
}
/** Validate a saved array-item type selection and return its built-in data tag. */
export function itemType(value: Value): DataType {
  if (typeof value !== "string" || !dataTypes.includes(value as DataType)) throw new Error("Select a valid item type.");
  return value as DataType;
}
/** Editor options for selecting an array's item type and rebuilding dependent ports. */
export const itemOptions: { key: string; label: string; choices: [string, string][]; changesPorts: boolean } = {
  key: "itemType",
  label: "Item type",
  choices: dataTypes.map((type): [string, string] => [type, type === "json" ? "JSON (any value)" : type]),
  changesPorts: true,
};
