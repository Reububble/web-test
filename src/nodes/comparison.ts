import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { textInput } from "web-test/nodes/data_support.ts";

const inputs: {
  readonly valueA: { readonly label: "Value A"; readonly type: TypeDescriptor<string> };
  readonly valueB: { readonly label: "Value B"; readonly type: TypeDescriptor<string> };
} = { valueA: { label: "Value A", type: textInput }, valueB: { label: "Value B", type: textInput } } as const;

export const ComparisonNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly result: { readonly label: "Result"; readonly type: "boolean" } },
  DataValues<typeof inputs> & { operator: string }
> = defineNode({
  kind: "data",
  type: "comparison",
  title: "Comparison",
  inputs,
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): DataValues<typeof inputs> & { operator: string } => ({ operator: "equals", valueA: "", valueB: "Target Match" }),
  process: ({ valueA, valueB }, { properties }) => {
    switch (properties.operator) {
      case "equals":
        return { result: valueA === valueB };
      case "not_equals":
        return { result: valueA !== valueB };
      case "contains":
        return { result: valueA.includes(valueB) };
      default:
        throw new Error("Unknown comparison operator.");
    }
  },
  options: {
    key: "operator",
    label: "Compare",
    choices: [["equals", "Equals"], ["not_equals", "Not equal"], ["contains", "Contains"]] as [string, string][],
  },
});
