import { defineFunctionNode } from "web/nodes/function_node.ts";

export const StringAtNode = defineFunctionNode({
  type: "string_at",
  title: "String At",
  help: "Returns the UTF-16 code unit at Index. Negative indices count from the end. An out-of-range index returns empty text and Found = false.",
  inputs: {
    text: { label: "Text", type: "text", default: "" },
    index: { label: "Index", type: "number", default: 0 },
  },
  outputs: {
    text: { label: "Text", type: "text" },
    found: { label: "Found", type: "boolean" },
  },
  process({ text, index }: { text: string; index: number }) {
    const value = text.at(index);
    return { text: value ?? "", found: value !== undefined };
  },
});
