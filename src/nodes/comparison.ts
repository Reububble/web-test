import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { textInput } from "web/nodes/data_support.ts";

const inputs = { valueA: { label: "Value A", type: textInput }, valueB: { label: "Value B", type: textInput } } as const;

export const ComparisonNode = defineNode({
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
