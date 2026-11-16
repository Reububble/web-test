import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly flow: { readonly label: "Flow"; readonly type: "flow" }; readonly message: { readonly label: "Message"; readonly type: "text" } } = {
  flow: { label: "Flow", type: "flow" },
  message: { label: "Message", type: "text" },
} as const;

export const LogNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly message: { readonly label: "Message"; readonly type: "text" };
    readonly timestamp: { readonly label: "Timestamp"; readonly type: "instant" };
  },
  DataValues<typeof inputs> & { level: string }
> = defineNode({
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
