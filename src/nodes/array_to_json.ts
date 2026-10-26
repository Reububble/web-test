import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { isJson } from "web/script_schema.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = { array: { label: "Array", type: arrayInput } } as const;

export const ArrayToJsonNode = defineNode({
  kind: "data",
  type: "array_to_json",
  title: "Array To JSON",
  inputs,
  outputs: { json: { label: "JSON", type: "json" } },
  properties: (): DataValues<typeof inputs> => ({ array: [] }),
  process: ({ array }) => {
    if (!isJson(array)) throw new Error("Array To JSON requires serializable JSON items.");
    return { json: array };
  },
});
