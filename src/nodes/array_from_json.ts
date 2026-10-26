import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { array } from "web/nodes/array_support.ts";

const inputs = { json: { label: "JSON", type: "json" } } as const;

export const ArrayFromJsonNode = defineNode({
  kind: "data",
  type: "array_from_json",
  title: "Array From JSON",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ json: [] }),
  process: ({ json }) => ({ array: array(json) }),
  help: "Converts a JSON array to an Array connection. Fails if the JSON value is not an array.",
});
