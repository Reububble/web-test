import type { ControlNodeConstructor } from "web-test/nodes/control_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

/** Node constructor. Raises a graph execution error containing the supplied message. */
export const FailNode: ControlNodeConstructor<
  { readonly message: { readonly label: "Message"; readonly type: "text"; readonly default: "Pipeline failed." } },
  {},
  readonly [],
  "flow"
> = defineNode({
  type: "fail",
  title: "Fail",
  help: "Fails the current branch with Message. A surrounding Try/Catch/Finally can handle it; otherwise the pipeline fails.",
  control: [],
  inputs: { message: { label: "Message", type: "text", default: "Pipeline failed." } },
  outputs: {},
  process: {
    flow({ message }) {
      throw new Error(message);
    },
  },
});
