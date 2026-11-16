import type { DataType, JsonValue, Value } from "web-test/nodes/base.ts";
import { array } from "web-test/nodes/array_support.ts";
import { type TypeDescriptor, typeDescriptor } from "web-test/nodes/type_descriptor.ts";

/** Preserve the text nodes' existing explicit JavaScript string conversion. */
export const textInput: TypeDescriptor<string> = { ...typeDescriptor("text"), read: (value) => String(value) };
/** A text descriptor that converts null and undefined to empty text before string conversion. */
export const emptyTextInput: TypeDescriptor<string> = { ...typeDescriptor("text"), read: (value) => String(value ?? "") };
/** A descriptor for arrays whose items are valid graph runtime values. */
export const arrayInput: TypeDescriptor<Value[]> = { ...typeDescriptor("array"), read: (value) => array(value as Value) };
/** A descriptor that accepts only serializable JSON values for a JSON variable. */
export const jsonInput: { read(value: unknown): JsonValue; type: DataType; optional?: boolean; defaultValue(): JsonValue } = {
  ...typeDescriptor("json"),
  read(value: unknown) {
    try {
      return typeDescriptor("json").read(value, "JSON Variable");
    } catch {
      throw new Error("JSON Variable requires a serializable JSON value.");
    }
  },
};
/** A descriptor for nullable element-reference records used by element variables. */
export const elementInput: {
  read(value: unknown): { elementId: string } | null;
  type: DataType;
  optional?: boolean;
  defaultValue(): { elementId: string } | null;
} = {
  ...typeDescriptor("element"),
  read(value: unknown) {
    try {
      return typeDescriptor("element").read(value, "Element Variable");
    } catch {
      throw new Error("Element Variable requires an element reference or null.");
    }
  },
};
/** A descriptor that accepts only boolean inputs without coercion. */
export const booleanInput: TypeDescriptor<boolean> = {
  ...typeDescriptor("boolean"),
  read(value) {
    if (typeof value !== "boolean") throw new Error("Boolean gates require boolean values.");
    return value;
  },
};

/** Array iteration errors retain the selected type's existing wording. */
export function arrayItemType<T extends Value>(descriptor: TypeDescriptor<T>): TypeDescriptor<T> {
  return {
    ...descriptor,
    read(value, label) {
      try {
        return descriptor.read(value, label);
      } catch {
        throw new Error(`${label} must be ${descriptor.type}.`);
      }
    },
  };
}
