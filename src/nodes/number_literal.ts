import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { value: { label: "Value", type: "number" } } as const;

export const NumberLiteralNode = defineNode({
  kind: "data",
  type: "number_literal",
  title: "Number Variable",
  inputs,
  outputs: { number: { label: "Number", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ value: 0 }),
  process: ({ value }) => ({ number: value }),
});
