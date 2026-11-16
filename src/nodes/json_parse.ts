import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { isJson } from "web-test/script_schema.ts";
import { textInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly text: { readonly label: "Text"; readonly type: TypeDescriptor<string> } } = { text: { label: "Text", type: textInput } } as const;

/** Node constructor. Parses text as validated JSON graph data. */
export const JsonParseNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly json: { readonly label: "JSON"; readonly type: "json" }; readonly success: { readonly label: "Valid JSON"; readonly type: "boolean" } },
  DataValues<typeof inputs>
> = defineNode({
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
