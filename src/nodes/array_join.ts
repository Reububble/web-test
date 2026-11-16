import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: {
  readonly array: { readonly label: "Array"; readonly type: TypeDescriptor<Value[]> };
  readonly separator: { readonly label: "Separator"; readonly type: "text" };
} = { array: { label: "Array", type: arrayInput }, separator: { label: "Separator", type: "text" } } as const;

export const ArrayJoinNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly text: { readonly label: "Text"; readonly type: "text" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_join",
  title: "Array Join",
  inputs,
  outputs: { text: { label: "Text", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ array: [], separator: "," }),
  process: ({ array, separator }) => ({ text: array.join(separator) }),
  help:
    "Converts items to text and joins them with Separator (a comma by default). Uses JavaScript join rules: null becomes empty text, nested arrays use commas, and objects become [object Object]. An empty array returns empty text.",
});
