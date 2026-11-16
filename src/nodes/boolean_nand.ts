import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { booleanInput } from "web-test/nodes/data_support.ts";

/** Node constructor. Computes the negation of logical AND for two boolean inputs. */
export const BooleanNandNode: DeclarativeNodeConstructor<
  {
    readonly valueA: { readonly label: "Value A"; readonly type: TypeDescriptor<boolean> };
    readonly valueB: { readonly label: "Value B"; readonly type: TypeDescriptor<boolean> };
  },
  { readonly result: { readonly label: "Result"; readonly type: "boolean" } },
  { valueA: boolean; valueB: boolean }
> = defineNode({
  kind: "data",
  type: "boolean_nand",
  title: "NAND",
  inputs: { valueA: { label: "Value A", type: booleanInput }, valueB: { label: "Value B", type: booleanInput } },
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): { valueA: boolean; valueB: boolean } => ({ valueA: false, valueB: false }),
  process: ({ valueA, valueB }) => ({ result: !(valueA && valueB) }),
});
