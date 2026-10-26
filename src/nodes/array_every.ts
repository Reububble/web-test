import type { ControlProcess, ControlValues, StepValues } from "web/nodes/control_node.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { ArrayDescriptor, TypeConfig } from "web/nodes/type_descriptor.ts";
import { arrayItemType } from "web/nodes/data_support.ts";
import { copyValue } from "web/value.ts";

export const ArrayEveryNode = defineNode({
  type: "array_every",
  title: "Array Every",
  help:
    "Tests items in order, reading boolean Result after Each ends. Stops at the first false Result. Completed result on Done is true if all items pass, including an empty array. Result can come from a data-only condition; Each may be left unconnected.",
  control: ["each", "done"],
  config: { inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) } },
  properties: () => ({ resultType: "json", result: false }),
})((config) => {
  const item = arrayItemType(config.inputs.array);
  const inputs = { array: { label: "Array", type: new ArrayDescriptor(item) }, result: { label: "Result", type: "boolean", syncDefault: true } } as const;
  const outputs = {
    index: { label: "Index", type: "number", deferred: true as const },
    value: { label: "Value", type: item, deferred: true as const },
    result: { label: "Completed result", type: "boolean", deferred: true as const },
  } as const;
  const process: { flow: ControlProcess<ControlValues<typeof inputs>, StepValues<typeof outputs>, "each" | "done"> } = {
    *flow(inputs, state) {
      const items = copyValue(inputs.array);
      let matched = true;
      for (const [index, value] of items.entries()) {
        const { result } = yield { control: "each" as const, index, value };
        if (result === false) {
          matched = result;
          break;
        }
      }
      return { control: "done" as const, ...state.output, result: matched };
    },
  };
  return { inputs, outputs, process };
});
