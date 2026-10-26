import { defineNode } from "web/nodes/define_node.ts";

export const FailNode = defineNode({
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
