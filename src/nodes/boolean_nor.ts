import { defineNode } from "web/nodes/define_node.ts";
import { booleanInput } from "web/nodes/data_support.ts";

export const BooleanNorNode = defineNode({
  kind: "data",
  type: "boolean_nor",
  title: "NOR",
  inputs: { valueA: { label: "Value A", type: booleanInput }, valueB: { label: "Value B", type: booleanInput } },
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): { valueA: boolean; valueB: boolean } => ({ valueA: false, valueB: false }),
  process: ({ valueA, valueB }) => ({ result: !(valueA || valueB) }),
});
