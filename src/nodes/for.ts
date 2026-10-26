import { defineNode } from "web/nodes/define_node.ts";

export const ForNode = defineNode({
  type: "for",
  title: "For",
  help:
    "Snapshots Start, End and Step. Runs Each with Value starting at Start, advancing by Step, and stopping before End. Negative Step counts down. Step must be nonzero. Index counts iterations from zero. Wire a branch to Break to exit this active loop immediately and continue through Done. Done runs once, including for an empty range. Do not wire the body back to Flow.",
  control: ["each", "done"],
  inputs: {
    start: { label: "Start", type: "number", default: 0 },
    end: { label: "End (exclusive)", type: "number", default: 10 },
    step: { label: "Step", type: "number", default: 1 },
  },
  outputs: { index: { label: "Index", type: "number", deferred: true }, value: { label: "Value", type: "number", deferred: true } },
  process: {
    *flow({ start, end, step }, state) {
      if (step === 0) throw new Error("For Step must be nonzero.");
      let index = 0;
      for (let value = start; step > 0 ? value < end : value > end; index++) {
        if (!Number.isSafeInteger(index)) throw new Error("For iteration index exceeded the safe integer range.");
        yield { control: "each", index, value };
        const advanced = value + step;
        if (advanced === value) throw new Error("For Step is too small to advance Value at this magnitude.");
        value = advanced;
      }
      return { control: "done", ...state.output };
    },
    break(_inputs, state) {
      return { control: "done", ...state.output };
    },
  },
});
