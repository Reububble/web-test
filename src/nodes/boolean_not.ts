import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { booleanInput } from "web-test/nodes/data_support.ts";

/** Node constructor. Negates a validated boolean input. */
export const BooleanNotNode: DeclarativeNodeConstructor<
  { readonly valueA: { readonly label: "Value"; readonly type: TypeDescriptor<boolean> } },
  { readonly result: { readonly label: "Result"; readonly type: "boolean" } },
  { valueA: boolean; valueB: boolean }
> = defineNode({
  kind: "data",
  type: "boolean_not",
  title: "NOT",
  inputs: { valueA: { label: "Value", type: booleanInput } },
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): { valueA: boolean; valueB: boolean } => ({ valueA: false, valueB: false }),
  process: ({ valueA }) => ({ result: !valueA }),
});
