import type { ControlNodeConstructor } from "web-test/nodes/control_node.ts";
import type { Value } from "web-test/nodes/base.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

function steps(properties: Record<string, Value>): string[] {
  const value = properties.steps;
  if (
    !Array.isArray(value) || !value.length || !value.every((key) => typeof key === "string" && /^step_[1-9]\d*$/.test(key)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error("Invalid Sequence output slots.");
  }
  return value as string[];
}

export const SequenceNode: ControlNodeConstructor<{}, {}, string[], "flow"> = defineNode({
  type: "sequence",
  title: "Sequence",
  properties: () => ({ steps: ["step_1"] }),
  control: steps,
  inputs: {},
  outputs: {},
  refreshBranches: false,
  syncOutputs(properties, connected) {
    const keys = steps(properties);
    const used = keys.filter(connected);
    const spare = keys.findLast((key) => !connected(key)) ?? `step_${Math.max(...keys.map((key) => Number(key.slice(5)))) + 1}`;
    properties.steps = [...used, spare];
  },
  process: {
    *flow(_inputs, { controls = [], connected }) {
      for (const control of controls) if (connected?.(control)) yield { control };
      return {};
    },
  },
  help:
    "Runs each connected output in displayed order, finishing its entire branch before starting the next. Always keeps one spare output for another branch.",
});
