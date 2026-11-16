import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { Value } from "web-test/nodes/base.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { emptyTextInput } from "web-test/nodes/data_support.ts";
export const StringConcatNode: DeclarativeNodeConstructor<
  { [k: string]: { label: string; type: TypeDescriptor<string> } },
  { readonly text: { readonly label: "Text"; readonly type: "text" } },
  Record<string, Value>
> = defineNode({
  kind: "data",
  type: "string_concat",
  title: "String Concatenate",
  help:
    "Joins strings in input order without adding spaces. Filled or connected inputs are followed by one empty input. Clearing an input removes its empty row while keeping one spare.",
  properties: (): Record<string, Value> => ({ part_1: "" }),
  state: () => ({ parts: ["part_1"], nextPart: 2 }),
  inputs: ({ state }) => Object.fromEntries(state.parts.map((key, index) => [key, { label: `String ${index + 1}`, type: emptyTextInput }])),
  outputs: { text: { label: "Text", type: "text" } },
  syncInputs({ properties, state }, connected) {
    state.parts = Object.keys(properties).filter((key) => /^part_\d+$/.test(key)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
    state.nextPart = Math.max(state.nextPart, ...state.parts.map((key) => Number(key.slice(5)) + 1));
    const filled = state.parts.filter((key) => connected(key) || String(properties[key] ?? "") !== "");
    const spare = state.parts.findLast((key) => !filled.includes(key)) ?? `part_${state.nextPart++}`;
    for (const key of state.parts) if (!filled.includes(key) && key !== spare) delete properties[key];
    state.parts = [...filled, spare];
    properties[spare] ??= "";
  },
  process: (inputs) => ({ text: Object.values(inputs).join("") }),
});
