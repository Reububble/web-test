import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { textInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly text: { readonly label: "Text"; readonly type: TypeDescriptor<string> } } = { text: { label: "Text", type: textInput } } as const;

export const StringLengthNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly length: { readonly label: "Length"; readonly type: "number" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "string_length",
  title: "String Length",
  inputs,
  outputs: { length: { label: "Length", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ text: "" }),
  process: ({ text }) => ({ length: text.length }),
  help: "Returns JavaScript string length, counting UTF-16 code units. Some emoji count as two units.",
});
