import type { Value } from "web/nodes/base.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { TypeConfig, type TypeDescriptor } from "web/nodes/type_descriptor.ts";
export const ConditionalValueNode = defineNode({
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
