import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = { array: { label: "Array", type: arrayInput }, separator: { label: "Separator", type: "text" } } as const;

export const ArrayJoinNode = defineNode({
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
