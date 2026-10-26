import type { Value } from "web/nodes/base.ts";
import { array } from "web/nodes/array_support.ts";
import { type TypeDescriptor, typeDescriptor } from "web/nodes/type_descriptor.ts";

/** Preserve the text nodes' existing explicit JavaScript string conversion. */
export const textInput: TypeDescriptor<string> = { ...typeDescriptor("text"), read: (value) => String(value) };
export const emptyTextInput: TypeDescriptor<string> = { ...typeDescriptor("text"), read: (value) => String(value ?? "") };
export const arrayInput: TypeDescriptor<Value[]> = { ...typeDescriptor("array"), read: (value) => array(value as Value) };
export const jsonInput = {
  ...typeDescriptor("json"),
  read(value: unknown) {
    try {
      return typeDescriptor("json").read(value, "JSON Variable");
    } catch {
      throw new Error("JSON Variable requires a serializable JSON value.");
    }
  },
};
export const elementInput = {
  ...typeDescriptor("element"),
  read(value: unknown) {
    try {
      return typeDescriptor("element").read(value, "Element Variable");
    } catch {
      throw new Error("Element Variable requires an element reference or null.");
    }
  },
};
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
