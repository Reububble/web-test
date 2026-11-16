import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly value: { readonly label: "Value"; readonly type: "boolean" } } = { value: { label: "Value", type: "boolean" } } as const;

/** Node constructor. Provides a saved boolean literal as graph data. */
export const BooleanLiteralNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly boolean: { readonly label: "Boolean"; readonly type: "boolean" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "boolean_literal",
  title: "Boolean Variable",
  inputs,
  outputs: { boolean: { label: "Boolean", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ value: false }),
  process: ({ value }) => ({ boolean: value }),
});
