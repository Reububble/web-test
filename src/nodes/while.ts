import type { ControlNodeConstructor } from "web-test/nodes/control_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

/** Node constructor. Reevaluates a boolean condition before each branch iteration and supports structured break control. */
export const WhileNode: ControlNodeConstructor<
  { readonly condition: { readonly label: "Condition"; readonly type: "boolean"; readonly default: false } },
  { readonly index: { readonly label: "Index"; readonly type: "number"; readonly default: 0 } },
  readonly ["each", "done"],
  "flow" | "break"
> = defineNode({
  type: "while",
  title: "While",
  help:
    "Checks Condition before every iteration. Runs Each while true, then Done once when false. Wire a branch to Break to exit this active loop immediately and continue through Done. Index starts at zero and increments after each completed branch. Condition must be available before the first iteration. Do not wire the body back to Flow.",
  control: ["each", "done"],
  inputs: { condition: { label: "Condition", type: "boolean", default: false } },
  outputs: { index: { label: "Index", type: "number", default: 0 } },
  process: {
    *flow() {
      let index = 0;
      while (true) {
        // Publish the new index before resolving a condition that may depend on it.
        const { condition } = yield { index };
        if (!condition) return { control: "done" as const, index };
        yield { control: "each" as const, index };
        index++;
        if (!Number.isSafeInteger(index)) throw new Error("While iteration index exceeded the safe integer range.");
      }
    },
    break(_inputs, { output }) {
      return { control: "done", index: output.index };
    },
  },
});
