import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { textInput } from "web/nodes/data_support.ts";

const inputs = { text: { label: "Text", type: textInput } } as const;

export const StringLengthNode = defineNode({
  kind: "data",
  type: "string_length",
  title: "String Length",
  inputs,
  outputs: { length: { label: "Length", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ text: "" }),
  process: ({ text }) => ({ length: text.length }),
  help: "Returns JavaScript string length, counting UTF-16 code units. Some emoji count as two units.",
});
