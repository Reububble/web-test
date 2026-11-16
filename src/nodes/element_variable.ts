import type { DataType } from "web-test/nodes/base.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { elementInput } from "web-test/nodes/data_support.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: {
  readonly value: {
    readonly label: "Value";
    readonly type: { read(value: unknown): { elementId: string } | null; type: DataType; optional?: boolean; defaultValue(): { elementId: string } | null };
  };
} = { value: { label: "Value", type: elementInput } } as const;

export const ElementVariableNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly element: { readonly label: "Element"; readonly type: "element" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "data",
  type: "element_variable",
  title: "Element Variable",
  inputs,
  outputs: { element: { label: "Element", type: "element" } },
  properties: (): DataValues<typeof inputs> => ({ value: null }),
  process: ({ value }) => ({ element: value }),
  help: "Connect an element output to Value to use it through this variable. Defaults to null. Element references expire after navigation or browser reset.",
});
