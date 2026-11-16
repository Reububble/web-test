import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly value: { readonly label: "Value"; readonly type: TypeDescriptor<Value[]> } } = {
  value: { label: "Value", type: arrayInput },
} as const;

/** Node constructor. Provides a saved array value or forwards a connected array input. */
export const ArrayLiteralNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly array: { readonly label: "Array"; readonly type: "array" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_literal",
  title: "Array Variable",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ value: [] }),
  process: ({ value }) => ({ array: value }),
});
