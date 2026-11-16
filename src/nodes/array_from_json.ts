import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { array } from "web-test/nodes/array_support.ts";

const inputs: { readonly json: { readonly label: "JSON"; readonly type: "json" } } = { json: { label: "JSON", type: "json" } } as const;

/** Node constructor. Validates that a JSON value is an array and forwards it through an Array port. */
export const ArrayFromJsonNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly array: { readonly label: "Array"; readonly type: "array" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_from_json",
  title: "Array From JSON",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ json: [] }),
  process: ({ json }) => ({ array: array(json) }),
  help: "Converts a JSON array to an Array connection. Fails if the JSON value is not an array.",
});
