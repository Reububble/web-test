import { defineNode } from "web/nodes/define_node.ts";
import { booleanInput } from "web/nodes/data_support.ts";

export const BooleanNotNode = defineNode({
  kind: "data",
  type: "boolean_not",
  title: "NOT",
  inputs: { valueA: { label: "Value", type: booleanInput } },
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): { valueA: boolean; valueB: boolean } => ({ valueA: false, valueB: false }),
  process: ({ valueA }) => ({ result: !valueA }),
});
