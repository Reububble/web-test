import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { coordinateInput } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, x: { label: "X", type: coordinateInput }, y: { label: "Y", type: coordinateInput } } as const;

export const ClickNode = defineNode({
  kind: "browser",
  type: "click",
  title: "Click",
  inputs,
  outputs: { next: { label: "Next", type: "flow" } },
  properties: (): DataValues<typeof inputs> => ({ x: "500", y: "300" }),
  async process({ x, y }, { browser }) {
    await (await browser.getPage()).mouse.click(Number(x), Number(y));
    return {};
  },
});
