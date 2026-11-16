import { InvalidAction } from "web-test/nodes/browser_context.ts";
import { type TypeDescriptor, typeDescriptor } from "web-test/nodes/type_descriptor.ts";

export function text(fields: Record<string, unknown>, key: string, empty = false): string {
  const value = fields[key];
  if (typeof value !== "string" || (!empty && !value.trim())) throw new InvalidAction(`${key} must be ${empty ? "" : "nonempty "}text.`);
  return value;
}

export function number(fields: Record<string, unknown>, key: string, min = -Infinity, max = Infinity): number {
  const value = fields[key];
  if (
    (typeof value !== "string" && typeof value !== "number") || String(value).trim() === "" || !Number.isFinite(Number(value)) || Number(value) < min ||
    Number(value) > max
  ) throw new InvalidAction(`${key} must be a finite number between ${min} and ${max}.`);
  return Number(value);
}

export const nonemptyText: TypeDescriptor<string> = { ...typeDescriptor("text"), read: (value, label) => text({ [label]: value }, label) };

/** Keep accepting numeric strings from existing browser action clients. */
export function browserNumber(min = -Infinity, max = Infinity): TypeDescriptor<number> {
  return { ...typeDescriptor("number"), read: (value, label) => number({ [label]: value }, label, min, max) };
}

/** Coordinate ports remain text ports for compatibility with saved graphs. */
export const coordinateInput: TypeDescriptor<string> = {
  ...typeDescriptor("text"),
  read(value, label) {
    number({ [label]: value }, label);
    return String(value);
  },
};
