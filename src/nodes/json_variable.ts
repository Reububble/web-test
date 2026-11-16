import type { DataType, JsonValue } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { jsonInput } from "web-test/nodes/data_support.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: {
  readonly value: {
    readonly label: "Value";
    readonly type: { read(value: unknown): JsonValue; type: DataType; optional?: boolean; defaultValue(): JsonValue };
  };
} = { value: { label: "Value", type: jsonInput } } as const;

export const JsonVariableNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly json: { readonly label: "JSON"; readonly type: "json" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "json_variable",
  title: "JSON Variable",
  inputs,
  outputs: { json: { label: "JSON", type: "json" } },
  properties: (): DataValues<typeof inputs> => ({ value: {} }),
  process: ({ value }) => ({ json: value }),
});
