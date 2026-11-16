import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import type { Value } from "web-test/nodes/base.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { readScriptPorts } from "web-test/script_schema.ts";
import { runScript } from "web-test/nodes/script_process.ts";
export const ScriptNode: DeclarativeNodeConstructor<
  {
    readonly flow: { readonly label: "Flow"; readonly type: "flow" };
    readonly code: { readonly label: "Code"; readonly type: "text" };
    readonly timeout: { readonly label: "Timeout ms"; readonly type: "number" };
  },
  { readonly next: { readonly label: "Next"; readonly type: "flow" } },
  Record<string, Value>
> = defineNode({
  kind: "browser",
  type: "script",
  title: "JavaScript",
  help:
    "Runs in the automated page. Read input.name and assign output.name. Async/await is supported. Declare each named input/output below; element ports contain real DOM elements inside the script.",
  dynamicPorts: true,
  multilineInputs: ["code"],
  properties: (): Record<string, Value> => ({
    code: "output.result = input.text;",
    timeout: 10000,
    inputPorts: [{ name: "text", type: "text" }],
    outputPorts: [{ name: "result", type: "text" }],
    arg_text: "",
  }),
  inputs: ({ properties }) => ({
    flow: { label: "Flow", type: "flow" },
    code: { label: "Code", type: "text" },
    timeout: { label: "Timeout ms", type: "number" },
    ...Object.fromEntries(readScriptPorts(properties.inputPorts).map((port) => [`arg_${port.name}`, { label: port.name, type: port.type }])),
  } as const),
  outputs: ({ properties }) => ({
    next: { label: "Next", type: "flow" },
    ...Object.fromEntries(readScriptPorts(properties.outputPorts).map((port) => [port.name, { label: port.name, type: port.type }])),
  } as const),
  process(inputs, { browser, nodeId, properties }) {
    return runScript(browser, { ...properties, ...inputs }, nodeId);
  },
});
