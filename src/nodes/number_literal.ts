import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly value: { readonly label: "Value"; readonly type: "number" } } = { value: { label: "Value", type: "number" } } as const;

/** Node constructor. Provides a saved finite numeric literal as graph data. */
export const NumberLiteralNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly number: { readonly label: "Number"; readonly type: "number" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "number_literal",
  title: "Number Variable",
  inputs,
  outputs: { number: { label: "Number", type: "number" } },
  properties: (): DataValues<typeof inputs> => ({ value: 0 }),
  process: ({ value }) => ({ number: value }),
});
