import { InvalidAction } from "web-test/nodes/browser_context.ts";
import { type TypeDescriptor, typeDescriptor } from "web-test/nodes/type_descriptor.ts";

/** Read a browser-action text field, rejecting empty text unless explicitly allowed. */
export function text(fields: Record<string, unknown>, key: string, empty = false): string {
  const value = fields[key];
  if (typeof value !== "string" || (!empty && !value.trim())) throw new InvalidAction(`${key} must be ${empty ? "" : "nonempty "}text.`);
  return value;
}

/** Read a finite browser-action number or numeric string and enforce the supplied inclusive bounds. */
export function number(fields: Record<string, unknown>, key: string, min = -Infinity, max = Infinity): number {
  const value = fields[key];
  if (
    (typeof value !== "string" && typeof value !== "number") || String(value).trim() === "" || !Number.isFinite(Number(value)) || Number(value) < min ||
    Number(value) > max
  ) throw new InvalidAction(`${key} must be a finite number between ${min} and ${max}.`);
  return Number(value);
}

/** A text descriptor that rejects missing or whitespace-only browser-action inputs. */
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
