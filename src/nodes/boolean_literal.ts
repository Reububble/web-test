import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { value: { label: "Value", type: "boolean" } } as const;

export const BooleanLiteralNode = defineNode({
  kind: "data",
  type: "boolean_literal",
  title: "Boolean Variable",
  inputs,
  outputs: { boolean: { label: "Boolean", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ value: false }),
  process: ({ value }) => ({ boolean: value }),
});
