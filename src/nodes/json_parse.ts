import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { isJson } from "web/script_schema.ts";
import { textInput } from "web/nodes/data_support.ts";

const inputs = { text: { label: "Text", type: textInput } } as const;

export const JsonParseNode = defineNode({
  kind: "data",
  type: "json_parse",
  title: "JSON Parse",
  inputs,
  outputs: { json: { label: "JSON", type: "json" }, success: { label: "Valid JSON", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ text: "{}" }),
  process: ({ text }) => {
    try {
      const json: unknown = JSON.parse(text);
      return isJson(json) ? { json, success: true } : { json: null, success: false };
    } catch (error) {
      if (error instanceof SyntaxError) return { json: null, success: false };
      throw error;
    }
  },
});
