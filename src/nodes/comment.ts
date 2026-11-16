import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
/** Node constructor. Stores an editor annotation without data ports or runtime execution. */
export const CommentNode: DeclarativeNodeConstructor<{}, {}, { text: string }> = defineNode({
  kind: "annotation",
  type: "comment",
  title: "Comment",
  inputs: {},
  outputs: {},
  properties: () => ({ text: "" }),
});
