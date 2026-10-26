import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { json: { label: "JSON", type: "json" } } as const;

export const JsonStringifyNode = defineNode({
  kind: "data",
  type: "json_stringify",
  title: "JSON Stringify",
  inputs,
  outputs: { text: { label: "Text", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ json: {} }),
  process: ({ json }) => ({ text: JSON.stringify(json, null, 2) }),
});
