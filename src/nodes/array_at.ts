import type { Value } from "web/nodes/base.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { ArrayDescriptor, TypeConfig, type TypeDescriptor } from "web/nodes/type_descriptor.ts";

export const ArrayAtNode = defineNode({
  type: "array_at",
  title: "Array At",
  help: "Gets one item. Negative indices count from the end. Found is false for an out-of-range index; Value then uses the selected type's empty value.",
  config: { inputs: { array: new TypeConfig({ key: "itemType", label: "Item type", default: "json" }) } },
})(<T extends Value>(config: { inputs: { array: TypeDescriptor<T> } }) => ({
  inputs: {
    array: { label: "Array", type: new ArrayDescriptor(config.inputs.array) },
    index: { label: "Index", type: "number", default: 0 },
  },
  outputs: { value: { label: "Value", type: config.inputs.array }, found: { label: "Found", type: "boolean" } },
  process({ array, index }: { array: T[]; index: number }) {
    const value = array.at(index);
    return { value: value === undefined ? config.inputs.array.defaultValue() : value, found: value !== undefined };
  },
}));
