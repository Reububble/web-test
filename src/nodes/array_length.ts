import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = { array: { label: "Array", type: arrayInput } } as const;

export const ArrayLengthNode = defineNode({
  kind: "data",
  type: "array_length",
  title: "Array Length",
  inputs,
  outputs: { length: { label: "Length", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ array: [] }),
  process: ({ array }) => ({ length: array.length }),
});
