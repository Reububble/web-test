import { jsonInput } from "web/nodes/data_support.ts";
import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { value: { label: "Value", type: jsonInput } } as const;

export const JsonVariableNode = defineNode({
  kind: "data",
  type: "json_variable",
  title: "JSON Variable",
  inputs,
  outputs: { json: { label: "JSON", type: "json" } },
  properties: (): DataValues<typeof inputs> => ({ value: {} }),
  process: ({ value }) => ({ json: value }),
});
