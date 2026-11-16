import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: {
  readonly valueA: { readonly label: "Value A"; readonly type: "number" };
  readonly valueB: { readonly label: "Value B"; readonly type: "number" };
} = { valueA: { label: "Value A", type: "number" }, valueB: { label: "Value B", type: "number" } } as const;

/** Node constructor. Compares finite numeric inputs using the selected comparison operation. */
export const NumberComparisonNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly result: { readonly label: "Result"; readonly type: "boolean" } },
  DataValues<typeof inputs> & { operator: string }
> = defineNode({
  kind: "data",
  type: "number_comparison",
  title: "Number Comparison",
  inputs,
  outputs: { result: { label: "Result", type: "boolean" } },
  properties: (): DataValues<typeof inputs> & { operator: string } => ({ operator: "equals", valueA: 0, valueB: 0 }),
  process: ({ valueA, valueB }, { properties }) => {
    switch (properties.operator) {
      case "equals":
        return { result: valueA === valueB };
      case "not_equals":
        return { result: valueA !== valueB };
      case "less":
        return { result: valueA < valueB };
      case "less_equal":
        return { result: valueA <= valueB };
      case "greater":
        return { result: valueA > valueB };
      case "greater_equal":
        return { result: valueA >= valueB };
      default:
        throw new Error("Unknown number comparison operator.");
    }
  },
  options: {
    key: "operator",
    label: "Compare",
    choices: [["equals", "Equal (=)"], ["not_equals", "Not equal (≠)"], ["less", "Less than (<)"], ["less_equal", "Less than or equal (≤)"], [
      "greater",
      "Greater than (>)",
    ], ["greater_equal", "Greater than or equal (≥)"]] as [string, string][],
  },
});
