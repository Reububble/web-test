import type { Value } from "web/nodes/base.ts";
import { defineNode } from "web/nodes/define_node.ts";
import { emptyTextInput } from "web/nodes/data_support.ts";
import type { TypeDescriptor } from "web/nodes/type_descriptor.ts";
const tokens = /{{|}}|{([A-Za-z_][A-Za-z0-9_]*)}/g;
const names = (template: string): string[] => [...new Set([...template.matchAll(tokens)].flatMap((match) => match[1] ? [match[1]] : []))];
export const StringFormatNode = defineNode({
  kind: "data",
  type: "string_format",
  title: "String Format",
  help:
    "Each {name} placeholder creates a named text input. Repeated names share one input. Names use letters, digits and underscores, starting with a letter or underscore. Use {{ and }} for literal braces. The template can also come from a connection.",
  multilineInputs: ["template"],
  properties: (): Record<string, Value> => ({ template: "hello {name} how are you?", arg_name: "" }),
  state: () => ({ parameters: ["name"] }),
  inputs: ({ state }): Record<string, { label: string; type: TypeDescriptor<string> }> => ({
    template: { label: "Template", type: emptyTextInput },
    ...Object.fromEntries(state.parameters.map((name) => [`arg_${name}`, { label: name, type: emptyTextInput }])),
  }),
  outputs: { text: { label: "Text", type: "text" } },
  syncInputs({ properties, state }, _connected, resolve) {
    let template: string;
    try {
      template = String(resolve("template") ?? "");
    } catch {
      state.parameters = Object.keys(properties).filter((key) => key.startsWith("arg_")).map((key) => key.slice(4));
      return;
    }
    state.parameters = names(template);
    for (const name of state.parameters) properties[`arg_${name}`] ??= "";
    for (const key of Object.keys(properties)) if (key.startsWith("arg_") && !state.parameters.includes(key.slice(4))) delete properties[key];
  },
  process: (inputs) => ({
    text: inputs.template.replace(tokens, (match, name: string | undefined) => name ? inputs[`arg_${name}`] : match === "{{" ? "{" : "}"),
  }),
});
