import type { Value } from "web-test/nodes/base.ts";
export function finiteNumber(value: Value, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}
