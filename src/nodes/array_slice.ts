import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { OptionalDescriptor } from "web/nodes/type_descriptor.ts";
import { arrayInput } from "web/nodes/data_support.ts";

const inputs = {
  array: { label: "Array", type: arrayInput },
  start: { label: "Start", type: "number" },
  end: { label: "End (exclusive)", type: new OptionalDescriptor("number"), optional: true },
} as const;

export const ArraySliceNode = defineNode({
  kind: "data",
  type: "array_slice",
  title: "Array Slice",
  inputs,
  outputs: { array: { label: "Array", type: "array" } },
  properties: (): DataValues<typeof inputs> => ({ array: [], start: 0, end: null }),
  process: ({ array, start, end }) => ({ array: array.slice(start, end ?? undefined) }),
  help: "Copies items from Start up to, but excluding, End. Leave End blank to include the rest. Negative indices count from the end.",
});
