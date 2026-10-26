import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, message: { label: "Message", type: "text" } } as const;

export const LogNode = defineNode({
  kind: "local",
  type: "log",
  title: "Log",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, message: { label: "Message", type: "text" }, timestamp: { label: "Timestamp", type: "instant" } },
  properties: (): DataValues<typeof inputs> & { level: string } => ({ message: "", level: "log" }),
  help: "Writes a message to the editor's log panel and console, then continues through Next.",
  options: {
    key: "level",
    label: "Level",
    choices: [["log", "Log"], ["info", "Info"], ["warn", "Warning"], ["error", "Error"], ["debug", "Debug"]] as [string, string][],
  },
});
