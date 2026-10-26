import type { ControlProcess, ControlValues, StepValues } from "web/nodes/control_node.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { ArrayDescriptor, TypeConfig } from "web/nodes/type_descriptor.ts";
import { arrayItemType } from "web/nodes/data_support.ts";
import { copyValue } from "web/value.ts";

export const ArrayReduceNode = defineNode({
  type: "array_reduce",
  title: "Array Reduce",
  help:
    "Starts Accumulator at Initial value. Each runs for every item with Index, Value, and Accumulator available. Connect the branch's new accumulator to Result; it is read after Each finishes. Completed result is available on Done. An empty array returns Initial value. Item and accumulator types may differ. No flow wire back to this node is needed.",
  control: ["each", "done"],
  config: {
    inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) },
    outputs: { result: new TypeConfig({ key: "resultType", label: "Accumulator type", default: "json" }) },
  },
  properties: () => ({ result: null }),
})((config) => {
  const item = arrayItemType(config.inputs.array);
  const resultType = arrayItemType(config.outputs.result);
  const inputs = {
    array: { label: "Array", type: new ArrayDescriptor(item) },
    initial: { label: "Initial value", type: resultType, syncDefault: true },
    result: { label: "Result", type: resultType, syncDefault: true },
  } as const;
  const outputs = {
    index: { label: "Index", type: "number", deferred: true as const },
    value: { label: "Value", type: item, deferred: true as const },
    accumulator: { label: "Accumulator", type: resultType, deferred: true as const },
    result: { label: "Completed result", type: resultType, deferred: true as const },
  } as const;
  const process: { flow: ControlProcess<ControlValues<typeof inputs>, StepValues<typeof outputs>, "each" | "done"> } = {
    *flow(inputs, state) {
      const items = copyValue(inputs.array);
      let accumulator = copyValue(inputs.initial);
      for (const [index, value] of items.entries()) {
        const { result } = yield { control: "each" as const, index, value, accumulator: copyValue(accumulator) };
        accumulator = copyValue(result);
      }
      return { control: "done" as const, ...state.output, accumulator, result: accumulator };
    },
  };
  return { inputs, outputs, process };
});
