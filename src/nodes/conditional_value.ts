import { type ConfigurableFunctionNodeConstructor, defineNode } from "web-test/nodes/define_node.ts";
import type { Value } from "web-test/nodes/base.ts";
import { TypeConfig, type TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
/** Node constructor. Lazily reads and returns one of two values according to a boolean condition. */
export const ConditionalValueNode: ConfigurableFunctionNodeConstructor<
  { condition: boolean; trueValue: Value; falseValue: Value },
  { value: Value },
  { inputs: { value: TypeConfig<"valueType"> } }
> = defineNode({
  type: "conditional_value",
  title: "Conditional Value",
  help: "Selects True value or False value using Condition. Both values and the output share the selected type. Only the selected input is evaluated.",
  config: { inputs: { value: new TypeConfig({ key: "valueType", label: "Value type", default: "text" }) } },
})(<T extends Value>(config: { inputs: { value: TypeDescriptor<T> } }) => ({
  lazyInputs: true,
  inputs: {
    condition: { label: "Condition", type: "boolean", default: false },
    trueValue: { label: "True value", type: config.inputs.value, syncDefault: true },
    falseValue: { label: "False value", type: config.inputs.value, syncDefault: true },
  },
  outputs: { value: { label: "Value", type: config.inputs.value } },
  process(inputs: { condition: boolean; trueValue: T; falseValue: T }) {
    return { value: inputs.condition ? inputs.trueValue : inputs.falseValue };
  },
}));
