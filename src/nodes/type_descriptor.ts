import type { DataType, JsonValue, Value } from "web-test/nodes/base.ts";
import { dataTypes, matchesType } from "web-test/script_schema.ts";

/** A value of type T, or null when the value is absent. */
export type Optional<T> = T | null;
/** Runtime value types associated with the built-in data-port tags. */
export type PortValuesByType = {
  text: string;
  number: number;
  boolean: boolean;
  json: JsonValue;
  array: Value[];
  element: { elementId: string } | null;
  listener: { listenerId: string } | null;
  instant: Temporal.Instant;
};
/** Validates an untrusted port value and supplies a default for a typed data port. */
export interface TypeDescriptor<T extends Value> {
  /** The built-in runtime port tag exposed by this descriptor. */
  readonly type: DataType;
  /** Whether null is accepted as an absent value for this data port. */
  readonly optional?: boolean;
  /** Create the descriptor's empty runtime value; mutable values must be independent instances. */
  defaultValue(): T;
  /** Validate an untrusted value and return its typed form, using the label in validation errors. */
  read(value: unknown, label: string): T;
}
/** A built-in data-port tag or a custom descriptor that validates its value. */
export type TypeReference = DataType | TypeDescriptor<Value>;
/** Extracts the runtime value type represented by a data-port tag or descriptor. */
export type ValueOf<Type extends TypeReference> = Type extends DataType ? PortValuesByType[Type]
  : Type extends TypeDescriptor<infer T> ? T
  : never;

const defaults: { [Type in DataType]: () => PortValuesByType[Type] } = {
  text: () => "",
  number: () => 0,
  boolean: () => false,
  json: () => null,
  array: () => [],
  element: () => null,
  listener: () => null,
  instant: () => Temporal.Instant.fromEpochMilliseconds(0),
};

/** Create a descriptor for a built-in data type, rejecting incompatible values when read. */
export function typeDescriptor<Type extends DataType>(type: Type): TypeDescriptor<PortValuesByType[Type]> {
  return {
    type,
    defaultValue: defaults[type],
    read(value, label) {
      if (!matchesType(value, type)) throw new Error(`${label} must be ${type === "number" ? "a finite number" : type}.`);
      // matchesType validates the runtime tag at this untrusted-value boundary.
      return value as PortValuesByType[Type];
    },
  };
}

/** Return a custom descriptor unchanged, or create the descriptor for a built-in data type. */
export function resolveDescriptor<Type extends TypeReference>(type: Type): TypeDescriptor<ValueOf<Type>>;
/** Return a custom descriptor unchanged, or create the descriptor for a built-in data type. */
export function resolveDescriptor(type: TypeReference): TypeDescriptor<Value> {
  return typeof type === "string" ? typeDescriptor(type) : type;
}

/** Wraps a data type so null represents absence and becomes its default value. */
export class OptionalDescriptor<Type extends TypeReference> implements TypeDescriptor<Optional<ValueOf<Type>>> {
  /** Whether null is accepted as an absent value for this data port. */
  readonly optional = true;
  /** The wrapped descriptor's built-in port tag. */
  readonly type: DataType;
  private readonly inner: TypeDescriptor<ValueOf<Type>>;
  /** Wrap a built-in tag or custom descriptor with support for absent null values. */
  constructor(type: Type) {
    this.inner = resolveDescriptor(type);
    this.type = this.inner.type;
  }
  /** Create the descriptor's empty runtime value; mutable values must be independent instances. */
  defaultValue(): null {
    return null;
  }
  /** Validate an untrusted value and return its typed form, using the label in validation errors. */
  read(value: unknown, label: string): Optional<ValueOf<Type>> {
    return value === null ? null : this.inner.read(value, label);
  }
}

/** Validates an array and each of its items with a supplied element descriptor. */
export class ArrayDescriptor<T extends Value> implements TypeDescriptor<T[]> {
  /** The array port tag exposed regardless of the element descriptor's type. */
  readonly type = "array";
  /** Create an array descriptor that validates every item with the supplied descriptor. */
  constructor(readonly item: TypeDescriptor<T>) {}
  /** Create the descriptor's empty runtime value; mutable values must be independent instances. */
  defaultValue(): T[] {
    return [];
  }
  /** Validate an untrusted value and return its typed form, using the label in validation errors. */
  read(value: unknown, label: string): T[] {
    if (!Array.isArray(value) || !matchesType(value, "array")) throw new Error(`${label} must be an array of pipeline values.`);
    for (const [index, item] of value.entries()) this.item.read(item, `${label} item ${index}`);
    return value as T[];
  }
}

/** A persisted type selection; descriptors are rebuilt rather than serialized. */
export class TypeConfig<const Key extends string = string> {
  /** Available saved type tags paired with their editor display labels. */
  readonly choices: [string, string][] = dataTypes.map((type): [string, string] => [type, type === "json" ? "JSON (any value)" : type]);
  /** Declare the saved property key, editor label, and default tag for a configurable port type. */
  constructor(readonly options: { key: Key; label: string; default: DataType }) {}
  /** Validate a saved type selection and return its built-in data descriptor. */
  resolve(value: Value): TypeDescriptor<Value> {
    if (typeof value !== "string" || !dataTypes.includes(value as DataType)) throw new Error(`Select a valid ${this.options.label.toLowerCase()}.`);
    return typeDescriptor(value as DataType);
  }
}
