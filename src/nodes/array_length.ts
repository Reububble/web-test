import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly array: { readonly label: "Array"; readonly type: TypeDescriptor<Value[]> } } = {
  array: { label: "Array", type: arrayInput },
} as const;

export const ArrayLengthNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly length: { readonly label: "Length"; readonly type: "number" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_length",
  title: "Array Length",
  inputs,
  outputs: { length: { label: "Length", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ array: [] }),
  process: ({ array }) => ({ length: array.length }),
});
