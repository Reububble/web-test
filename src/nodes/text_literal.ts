import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { textInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly value: { readonly label: "Value"; readonly type: TypeDescriptor<string> } } = { value: { label: "Value", type: textInput } } as const;

export const TextLiteralNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly text: { readonly label: "Text"; readonly type: "text" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "text_literal",
  title: "Text Variable",
  inputs,
  outputs: { text: { label: "Text", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ value: "" }),
  process: ({ value }) => ({ text: value }),
});
