import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { type TypeDescriptor, typeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { JsonValue, Value } from "web-test/nodes/base.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { itemOptions, itemType } from "web-test/nodes/array_support.ts";
import { arrayItemType } from "web-test/nodes/data_support.ts";
import { matchesType } from "web-test/script_schema.ts";
function slots(properties: Record<string, Value>): string[] {
  const value = properties.slots;
  if (!Array.isArray(value) || !value.every((key) => typeof key === "string" && /^item_[1-9]\d*$/.test(key)) || new Set(value).size !== value.length) {
    throw new Error("Invalid Array Creator input slots.");
  }
  return value as string[];
}
/** Node constructor. Collects connected named item inputs into an array while maintaining one spare editor input. */
export const ArrayCreatorNode: DeclarativeNodeConstructor<
  {
    [k: string]: {
      label: string;
      type: TypeDescriptor<Temporal.Instant | Value[] | JsonValue | { elementId: string } | { listenerId: string }>;
      optional: true;
    };
  },
  { readonly array: { readonly label: "Array"; readonly type: "array" } },
  Record<string, Value>
> = defineNode({
  kind: "data",
  type: "array_creator",
  title: "Array Creator",
  help:
    "Creates an array from filled or connected inputs, in order, with one extra unused slot. Choose one item type for all inputs. Zero, false, JSON null, and empty nested arrays are valid items. Remove an item using its remove button. The spare slot is excluded from the array.",
  removableInputs: true,
  options: itemOptions,
  properties: (): Record<string, Value> => ({ itemType: "text", slots: ["item_1"] }),
  state: () => ({ nextItem: 2 }),
  inputs: ({ properties }) =>
    Object.fromEntries(
      slots(properties).map((
        key,
        index,
      ) => [key, { label: `Item ${index + 1}`, type: arrayItemType(typeDescriptor(itemType(properties.itemType))), optional: true }]),
    ),
  outputs: { array: { label: "Array", type: "array" } },
  syncInputs({ properties, state }, connected) {
    const type = itemType(properties.itemType), keys = slots(properties);
    state.nextItem = Math.max(state.nextItem, ...keys.map((key) => Number(key.slice(5)) + 1));
    for (const key of keys) {
      if (Object.hasOwn(properties, key) && (!matchesType(properties[key], type) || (type === "text" && properties[key] === ""))) delete properties[key];
    }
    const filled = keys.filter((key) => connected(key) || Object.hasOwn(properties, key));
    const spare = keys.findLast((key) => !filled.includes(key)) ?? `item_${state.nextItem++}`;
    properties.slots = [...filled, spare];
  },
  removeInput({ properties, state }, key) {
    const keys = slots(properties);
    if (!keys.includes(key)) return;
    delete properties[key];
    const retained = keys.filter((slot) => slot !== key);
    if (key === keys.at(-1)) retained.push(`item_${state.nextItem++}`);
    properties.slots = retained;
  },
  process: (inputs, { properties }) => ({ array: slots(properties).slice(0, -1).map((key) => inputs[key]) }),
});
