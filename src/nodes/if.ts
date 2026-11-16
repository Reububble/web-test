import type { ControlNodeConstructor } from "web-test/nodes/control_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

/** Node constructor. Selects the True or False flow branch from a boolean condition. */
export const IfNode: ControlNodeConstructor<
  { readonly condition: { readonly label: "Condition"; readonly type: "boolean"; readonly default: false } },
  {},
  readonly ["true", "false"],
  "flow"
> = defineNode({
  type: "conditional",
  title: "If",
  control: ["true", "false"],
  inputs: { condition: { label: "Condition", type: "boolean", default: false } },
  outputs: {},
  process: { flow: ({ condition }) => ({ control: condition ? "true" : "false" }) },
});
