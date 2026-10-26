import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = { value: { label: "Value", type: arrayInput } } as const;

export const ArrayLiteralNode = defineNode({
  kind: "data",
  type: "array_literal",
  title: "Array Variable",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ value: [] }),
  process: ({ value }) => ({ array: value }),
});
