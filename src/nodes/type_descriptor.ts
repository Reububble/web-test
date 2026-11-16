import type { DataType, JsonValue, Value } from "web-test/nodes/base.ts";
import { dataTypes, matchesType } from "web-test/script_schema.ts";

export type Optional<T> = T | null;
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
export interface TypeDescriptor<T extends Value> {
  readonly type: DataType;
  readonly optional?: boolean;
  defaultValue(): T;
  read(value: unknown, label: string): T;
}
export type TypeReference = DataType | TypeDescriptor<Value>;
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

export function resolveDescriptor<Type extends TypeReference>(type: Type): TypeDescriptor<ValueOf<Type>>;
export function resolveDescriptor(type: TypeReference): TypeDescriptor<Value> {
  return typeof type === "string" ? typeDescriptor(type) : type;
}

export class OptionalDescriptor<Type extends TypeReference> implements TypeDescriptor<Optional<ValueOf<Type>>> {
  readonly optional = true;
  readonly type: DataType;
  private readonly inner: TypeDescriptor<ValueOf<Type>>;
  constructor(type: Type) {
    this.inner = resolveDescriptor(type);
    this.type = this.inner.type;
  }
  defaultValue(): null {
    return null;
  }
  read(value: unknown, label: string): Optional<ValueOf<Type>> {
    return value === null ? null : this.inner.read(value, label);
  }
}

export class ArrayDescriptor<T extends Value> implements TypeDescriptor<T[]> {
  readonly type = "array";
  constructor(readonly item: TypeDescriptor<T>) {}
  defaultValue(): T[] {
    return [];
  }
  read(value: unknown, label: string): T[] {
    if (!Array.isArray(value) || !matchesType(value, "array")) throw new Error(`${label} must be an array of pipeline values.`);
    for (const [index, item] of value.entries()) this.item.read(item, `${label} item ${index}`);
    return value as T[];
  }
}

/** A persisted type selection; descriptors are rebuilt rather than serialized. */
export class TypeConfig<const Key extends string = string> {
  readonly choices: [string, string][] = dataTypes.map((type): [string, string] => [type, type === "json" ? "JSON (any value)" : type]);
  constructor(readonly options: { key: Key; label: string; default: DataType }) {}
  resolve(value: Value): TypeDescriptor<Value> {
    if (typeof value !== "string" || !dataTypes.includes(value as DataType)) throw new Error(`Select a valid ${this.options.label.toLowerCase()}.`);
    return typeDescriptor(value as DataType);
  }
}
