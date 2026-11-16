import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
/** Node constructor. Subscribes a graph event branch to console messages from the automated page. */
export const ConsoleTriggerNode: DeclarativeNodeConstructor<
  { readonly flow: { readonly label: "Flow"; readonly type: "flow" } },
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly event: { readonly label: "On message"; readonly type: "flow" };
    readonly listener: { readonly label: "Listener"; readonly type: "listener" };
    readonly message: { readonly label: "Message"; readonly type: "text" };
    readonly level: { readonly label: "Level"; readonly type: "text" };
    readonly args: { readonly label: "Arguments"; readonly type: "json" };
    readonly url: { readonly label: "Page URL"; readonly type: "text" };
    readonly source: { readonly label: "Source URL"; readonly type: "text" };
    readonly line: { readonly label: "Line"; readonly type: "number" };
    readonly column: { readonly label: "Column"; readonly type: "number" };
    readonly timestamp: { readonly label: "Timestamp"; readonly type: "instant" };
  },
  { level: string }
> = defineNode({
  kind: "event",
  type: "console_trigger",
  title: "Console Listener",
  inputs: { flow: { label: "Flow", type: "flow" } },
  outputs: {
    next: { label: "Next", type: "flow" },
    event: { label: "On message", type: "flow" },
    listener: { label: "Listener", type: "listener" },
    message: { label: "Message", type: "text" },
    level: { label: "Level", type: "text" },
    args: { label: "Arguments", type: "json" },
    url: { label: "Page URL", type: "text" },
    source: { label: "Source URL", type: "text" },
    line: { label: "Line", type: "number" },
    column: { label: "Column", type: "number" },
    timestamp: { label: "Timestamp", type: "instant" },
  },
  properties: () => ({ level: "all" }),
  subscribe: (source, { properties }, emit) =>
    source.onConsole((values) => {
      if (properties.level === "all" || properties.level === values.level) emit(values);
    }),
  prepare: (source) => source.getPage(),
  options: {
    key: "level",
    label: "Listen for",
    choices: [["all", "All console messages"], ["log", "Log"], ["info", "Info"], ["warn", "Warning"], ["error", "Error"], ["debug", "Debug"]] as [
      string,
      string,
    ][],
  },
  help:
    "Flow attaches a console listener, outputs its Listener reference, and continues through Next. Each matching message runs On message with fresh outputs. Remove Listener detaches it; Stop removes every listener. Re-entering this node replaces its previous listener. Lines and columns start at 1, or are 0 when unavailable.",
});
