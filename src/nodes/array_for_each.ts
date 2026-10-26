import type { ControlProcess, ControlValues, StepValues } from "web/nodes/control_node.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { ArrayDescriptor, TypeConfig } from "web/nodes/type_descriptor.ts";
import { arrayItemType } from "web/nodes/data_support.ts";
import { copyValue } from "web/value.ts";

export const ArrayForEachNode = defineNode({
  type: "array_for_each",
  title: "Array For Each",
  help:
    "Runs Each once per item, in order, with zero-based Index and Value. When the Each branch ends, the next item starts automatically. Done runs once after all items, including for an empty array. Do not wire the branch back to this node.",
  control: ["each", "done"],
  config: { inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) } },
  properties: () => ({ resultType: "json", result: null }),
})((config) => {
  const item = arrayItemType(config.inputs.array);
  const inputs = { array: { label: "Array", type: new ArrayDescriptor(item) } } as const;
  const outputs = {
    index: { label: "Index", type: "number", deferred: true as const },
    value: { label: "Value", type: item, deferred: true as const },
  } as const;
  const process: { flow: ControlProcess<ControlValues<typeof inputs>, StepValues<typeof outputs>, "each" | "done"> } = {
    *flow(inputs, state) {
      const items = copyValue(inputs.array);
      for (const [index, value] of items.entries()) {
        yield { control: "each" as const, index, value };
      }
      return { control: "done" as const, ...state.output };
    },
  };
  return { inputs, outputs, process };
});
