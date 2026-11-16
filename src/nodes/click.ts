import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { coordinateInput } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly x: { readonly label: "X"; readonly type: TypeDescriptor<string> };
  readonly y: { readonly label: "Y"; readonly type: TypeDescriptor<string> };
} = { flow: { label: "Flow", type: "flow" }, x: { label: "X", type: coordinateInput }, y: { label: "Y", type: coordinateInput } } as const;

export const ClickNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" } },
  DataValues<typeof inputs>
> = defineNode({
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
