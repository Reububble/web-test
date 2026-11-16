import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { isJson } from "web-test/script_schema.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: { readonly array: { readonly label: "Array"; readonly type: TypeDescriptor<Value[]> } } = {
  array: { label: "Array", type: arrayInput },
} as const;

export const ArrayToJsonNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly json: { readonly label: "JSON"; readonly type: "json" } },
  DataValues<typeof inputs>
> = defineNode({
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
