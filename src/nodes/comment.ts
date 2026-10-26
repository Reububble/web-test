import { defineNode } from "web/nodes/define_node.ts";
export const CommentNode = defineNode({ kind: "annotation", type: "comment", title: "Comment", inputs: {}, outputs: {}, properties: () => ({ text: "" }) });
