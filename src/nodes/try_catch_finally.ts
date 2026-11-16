import { type ControlNodeConstructor, ControlTransfer } from "web-test/nodes/control_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

/** Node constructor. Runs a Try branch, handles branch errors in Catch, and executes Finally during normal completion or unwinding. */
export const TryCatchFinallyNode: ControlNodeConstructor<
  {},
  { readonly error: { readonly label: "Error"; readonly type: "text" }; readonly failed: { readonly label: "Failed"; readonly type: "boolean" } },
  readonly ["try", "catch", "finally", "next"],
  "flow"
> = defineNode({
  type: "try_catch_finally",
  title: "Try / Catch / Finally",
  help:
    "Runs Try to completion. On failure, Error holds the message and Failed is true. Connecting Catch handles that failure if its branch completes. Finally runs after success or failure. Next runs after success or a handled failure. Leave each branch unconnected at its end; do not wire it back to this node. Stop interrupts immediately, including cleanup.",
  control: ["try", "catch", "finally", "next"],
  refreshBranches: false,
  inputs: {},
  outputs: { error: { label: "Error", type: "text" }, failed: { label: "Failed", type: "boolean" } },
  process: {
    *flow(_inputs, state) {
      let values = { error: "", failed: false };
      let pending: unknown;
      let failed = false;
      try {
        try {
          yield { control: "try", ...values };
        } catch (error) {
          if (error instanceof ControlTransfer) throw error;
          values = { error: error instanceof Error ? error.message : String(error), failed: true };
          pending = error;
          failed = true;
          if (state.connected?.("catch")) {
            try {
              yield { control: "catch", ...values };
              failed = false;
            } catch (error) {
              if (error instanceof ControlTransfer) throw error;
              pending = error;
              values = { error: error instanceof Error ? error.message : String(error), failed: true };
            }
          }
        }
      } finally {
        yield { control: "finally", ...values };
      }
      if (failed) throw pending;
      return { control: "next", ...values };
    },
  },
});
