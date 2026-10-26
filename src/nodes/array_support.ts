import type { DataType, Value } from "web/nodes/base.ts";
import { dataTypes, matchesType } from "web/script_schema.ts";
export function array(value: Value): Value[] {
  if (!matchesType(value, "array")) throw new Error("Expected an array of pipeline values.");
  return value as Value[];
}
export function index(value: Value): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Array index must be a finite number.");
  return Math.trunc(value);
}
export function itemType(value: Value): DataType {
  if (typeof value !== "string" || !dataTypes.includes(value as DataType)) throw new Error("Select a valid item type.");
  return value as DataType;
}
export const itemOptions = {
  key: "itemType",
  label: "Item type",
  choices: dataTypes.map((type): [string, string] => [type, type === "json" ? "JSON (any value)" : type]),
  changesPorts: true,
};
