import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly json: { readonly label: "JSON"; readonly type: "json" } } = { json: { label: "JSON", type: "json" } } as const;

export const JsonStringifyNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly text: { readonly label: "Text"; readonly type: "text" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "json_stringify",
  title: "JSON Stringify",
  inputs,
  outputs: { text: { label: "Text", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ json: {} }),
  process: ({ json }) => ({ text: JSON.stringify(json, null, 2) }),
});
