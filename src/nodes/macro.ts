import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
export const MacroNode: DeclarativeNodeConstructor<
  { readonly flow: { readonly label: "Flow"; readonly type: "flow" } },
  { readonly next: { readonly label: "Next"; readonly type: "flow" } },
  { macroId: string }
> = defineNode({
  kind: "action",
  type: "macro",
  title: "Run Macro",
  inputs: { flow: { label: "Flow", type: "flow" } },
  outputs: { next: { label: "Next", type: "flow" } },
  properties: () => ({ macroId: "" }),
  state: () => ({ choices: [["", "Choose a macro"]] as [string, string][] }),
  options: ({ state }) => ({ key: "macroId", label: "Macro", choices: state.choices }),
  setMacros({ properties, state }, macros) {
    const choices: [string, string][] = [["", "Choose a macro"], ...macros.map((macro): [string, string] => [macro.id, macro.name])];
    if (properties.macroId && !macros.some((macro) => macro.id === properties.macroId)) choices.push([properties.macroId, "Missing macro"]);
    state.choices.splice(0, state.choices.length, ...choices);
  },
  async process(_inputs, { properties, call }) {
    await call(properties.macroId);
    return {};
  },
  help:
    "Runs the selected saved graph, then continues through Next. Macro calls may nest or recurse. Stop workflow interrupts the whole call chain, including synchronous loops. Each invocation has its own execution values and shares the automation browser.",
});
