import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

export const RemoveListenerNode: DeclarativeNodeConstructor<
  { readonly flow: { readonly label: "Flow"; readonly type: "flow" }; readonly listener: { readonly label: "Listener"; readonly type: "listener" } },
  { readonly next: { readonly label: "Next"; readonly type: "flow" }; readonly removed: { readonly label: "Removed"; readonly type: "boolean" } },
  { listener: null }
> = defineNode({
  kind: "action",
  type: "remove_listener",
  title: "Remove Listener",
  inputs: { flow: { label: "Flow", type: "flow" }, listener: { label: "Listener", type: "listener" } },
  outputs: { next: { label: "Next", type: "flow" }, removed: { label: "Removed", type: "boolean" } },
  properties: () => ({ listener: null }),
  process({ listener }, { removeListener }) {
    if (!listener) throw new Error("Connect a Listener output before removing a listener.");
    return { removed: removeListener(listener) };
  },
  help:
    "Removes the connected listener, preventing new events. Already captured messages finish processing. Removed is false if it was already removed. Then continues through Next.",
});
