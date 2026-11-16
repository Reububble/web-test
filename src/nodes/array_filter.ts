import { type ConfigurableControlNodeConstructor, defineNode } from "web-test/nodes/define_node.ts";
import type { Value } from "web-test/nodes/base.ts";
import { ArrayDescriptor, TypeConfig, type TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { ControlProcess, ControlValues, StepValues } from "web-test/nodes/control_node.ts";
import { arrayItemType } from "web-test/nodes/data_support.ts";
import { copyValue } from "web-test/value.ts";

/** Node constructor. Runs a predicate branch for each item and collects the items whose result is true. */
export const ArrayFilterNode: ConfigurableControlNodeConstructor<
  {
    readonly array: { readonly label: "Array"; readonly type: ArrayDescriptor<Value> };
    readonly result: { readonly label: "Result"; readonly type: "boolean"; readonly syncDefault: true };
  },
  {
    readonly index: { readonly label: "Index"; readonly type: "number"; readonly deferred: true };
    readonly value: { readonly label: "Value"; readonly type: TypeDescriptor<Value>; readonly deferred: true };
    readonly array: { readonly label: "Completed array"; readonly type: ArrayDescriptor<Value>; readonly deferred: true };
  },
  readonly ["each", "done"],
  "flow",
  { inputs: { array: TypeConfig<"itemType"> } },
  { resultType: string; result: false }
> = defineNode({
  type: "array_filter",
  title: "Array Filter",
  help:
    "Runs Each for every item, then reads the boolean Result after the branch ends. Keeps the original item when Result is true. Completed array becomes available on Done. Result can come from a data-only condition; Each may be left unconnected.",
  control: ["each", "done"],
  config: { inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) } },
  properties: () => ({ resultType: "json", result: false }),
})((config) => {
  const item = arrayItemType(config.inputs.array);
  const inputs = { array: { label: "Array", type: new ArrayDescriptor(item) }, result: { label: "Result", type: "boolean", syncDefault: true } } as const;
  const outputs = {
    index: { label: "Index", type: "number", deferred: true as const },
    value: { label: "Value", type: item, deferred: true as const },
    array: { label: "Completed array", type: new ArrayDescriptor(item), deferred: true as const },
  } as const;
  const process: { flow: ControlProcess<ControlValues<typeof inputs>, StepValues<typeof outputs>, "each" | "done"> } = {
    *flow(inputs, state) {
      const items = copyValue(inputs.array);
      const collected: ReturnType<typeof item.defaultValue>[] = [];
      for (const [index, value] of items.entries()) {
        const { result } = yield { control: "each" as const, index, value };
        if (result) collected.push(value);
      }
      return { control: "done" as const, ...state.output, array: collected };
    },
  };
  return { inputs, outputs, process };
});
