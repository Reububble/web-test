import { defineNode } from "web/nodes/define_node.ts";

export const WhileNode = defineNode({
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
