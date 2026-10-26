import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = {
  first: { label: "First array", type: arrayInput },
  second: { label: "Second array", type: arrayInput },
} as const;

export const ArrayConcatNode = defineNode({
  kind: "data",
  type: "array_concat",
  title: "Array Concat",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ first: [], second: [] }),
  process: ({ first, second }) => ({ array: [...first, ...second] }),
  help: "Joins two arrays in order without changing either input or flattening nested arrays.",
});
