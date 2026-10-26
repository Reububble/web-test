import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { textInput } from "web/nodes/data_support.ts";

const inputs = { value: { label: "Value", type: textInput } } as const;

export const TextLiteralNode = defineNode({
  kind: "data",
  type: "text_literal",
  title: "Text Variable",
  inputs,
  outputs: { text: { label: "Text", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ value: "" }),
  process: ({ value }) => ({ text: value }),
});
