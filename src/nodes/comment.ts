import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
export const CommentNode: DeclarativeNodeConstructor<{}, {}, { text: string }> = defineNode({
  kind: "annotation",
  type: "comment",
  title: "Comment",
  inputs: {},
  outputs: {},
  properties: () => ({ text: "" }),
});
