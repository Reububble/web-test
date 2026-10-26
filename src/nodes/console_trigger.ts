import { defineNode } from "web/nodes/define_node.ts";
export const ConsoleTriggerNode = defineNode({
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
