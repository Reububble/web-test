import { type ConfigurableControlNodeConstructor, defineNode } from "web-test/nodes/define_node.ts";
import type { Value } from "web-test/nodes/base.ts";
import { ArrayDescriptor, TypeConfig, type TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { ControlProcess, ControlValues, StepValues } from "web-test/nodes/control_node.ts";
import { arrayItemType } from "web-test/nodes/data_support.ts";
import { copyValue } from "web-test/value.ts";

/** Node constructor. Executes a branch per item and collects its computed Result values into a completed array. */
export const ArrayMapNode: ConfigurableControlNodeConstructor<
  {
    readonly array: { readonly label: "Array"; readonly type: ArrayDescriptor<Value> };
    readonly result: { readonly label: "Result"; readonly type: TypeDescriptor<Value>; readonly syncDefault: true };
  },
  {
    readonly index: { readonly label: "Index"; readonly type: "number"; readonly deferred: true };
    readonly value: { readonly label: "Value"; readonly type: TypeDescriptor<Value>; readonly deferred: true };
    readonly array: { readonly label: "Completed array"; readonly type: ArrayDescriptor<Value>; readonly deferred: true };
  },
  readonly ["each", "done"],
  "flow",
  { inputs: { array: TypeConfig<"itemType"> }; outputs: { result: TypeConfig<"resultType"> } },
  { result: null }
> = defineNode({
  type: "array_map",
  title: "Array Map",
  help:
    "Runs Each for every item, then reads Result after the branch ends. Connect the branch's computed value to Result. Item type and Result type may differ. Completed array becomes available on Done. No flow connection back to this node is needed.",
  control: ["each", "done"],
  config: {
    inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) },
    outputs: { result: new TypeConfig({ key: "resultType", label: "Result type", default: "json" }) },
  },
  properties: () => ({ result: null }),
})((config) => {
  const item = arrayItemType(config.inputs.array);
  const resultType = arrayItemType(config.outputs.result);
  const inputs = { array: { label: "Array", type: new ArrayDescriptor(item) }, result: { label: "Result", type: resultType, syncDefault: true } } as const;
  const outputs = {
    index: { label: "Index", type: "number", deferred: true as const },
    value: { label: "Value", type: item, deferred: true as const },
    array: { label: "Completed array", type: new ArrayDescriptor(resultType), deferred: true as const },
  } as const;
  const process: { flow: ControlProcess<ControlValues<typeof inputs>, StepValues<typeof outputs>, "each" | "done"> } = {
    *flow(inputs, state) {
      const items = copyValue(inputs.array);
      const collected: ReturnType<typeof resultType.defaultValue>[] = [];
      for (const [index, value] of items.entries()) {
        const { result } = yield { control: "each" as const, index, value };
        collected.push(result);
      }
      return { control: "done" as const, ...state.output, array: collected };
    },
  };
  return { inputs, outputs, process };
});
