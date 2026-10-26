import { defineNode } from "web/nodes/define_node.ts";

export const IfNode = defineNode({
  type: "conditional",
  title: "If",
  control: ["true", "false"],
  inputs: { condition: { label: "Condition", type: "boolean", default: false } },
  outputs: {},
  process: { flow: ({ condition }) => ({ control: condition ? "true" : "false" }) },
});
