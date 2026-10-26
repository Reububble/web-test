import { elementInput } from "web/nodes/data_support.ts";
import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { value: { label: "Value", type: elementInput } } as const;

export const ElementVariableNode = defineNode({
  kind: "data",
  type: "element_variable",
  title: "Element Variable",
  inputs,
  outputs: { element: { label: "Element", type: "element" } },
  properties: (): DataValues<typeof inputs> => ({ value: null }),
  process: ({ value }) => ({ element: value }),
  help: "Connect an element output to Value to use it through this variable. Defaults to null. Element references expire after navigation or browser reset.",
});
