import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: {
  readonly first: { readonly label: "First array"; readonly type: TypeDescriptor<Value[]> };
  readonly second: { readonly label: "Second array"; readonly type: TypeDescriptor<Value[]> };
} = {
  first: { label: "First array", type: arrayInput },
  second: { label: "Second array", type: arrayInput },
} as const;

export const ArrayConcatNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly array: { readonly label: "Array"; readonly type: "array" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_concat",
  title: "Array Concat",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ first: [], second: [] }),
  process: ({ first, second }) => ({ array: [...first, ...second] }),
  help: "Joins two arrays in order without changing either input or flattening nested arrays.",
});
