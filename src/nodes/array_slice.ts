import { OptionalDescriptor, type TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { arrayInput } from "web-test/nodes/data_support.ts";

const inputs: {
  readonly array: { readonly label: "Array"; readonly type: TypeDescriptor<Value[]> };
  readonly start: { readonly label: "Start"; readonly type: "number" };
  readonly end: { readonly label: "End (exclusive)"; readonly type: OptionalDescriptor<"number">; readonly optional: true };
} = {
  array: { label: "Array", type: arrayInput },
  start: { label: "Start", type: "number" },
  end: { label: "End (exclusive)", type: new OptionalDescriptor("number"), optional: true },
} as const;

export const ArraySliceNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly array: { readonly label: "Array"; readonly type: "array" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "array_slice",
  title: "Array Slice",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ array: [], start: 0, end: null }),
  process: ({ array, start, end }) => ({ array: array.slice(start, end ?? undefined) }),
  help: "Copies items from Start up to, but excluding, End. Leave End blank to include the rest. Negative indices count from the end.",
});
