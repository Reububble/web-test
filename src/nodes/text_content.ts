import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly flow: { readonly label: "Flow"; readonly type: "flow" }; readonly element: { readonly label: "Element"; readonly type: "element" } } =
  { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" } } as const;

export const TextContentNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly text: { readonly label: "Text"; readonly type: "text" };
    readonly success: { readonly label: "Success"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
  kind: "browser",
  type: "text_content",
  title: "Text Content",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, text: { label: "Text", type: "text" }, success: { label: "Success", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ element: null }),
  async process({ element: reference }, { browser }) {
    const element = browser.element(reference);
    return element ? { text: await element.evaluate((node) => node.textContent ?? ""), success: true } : { text: "", success: false };
  },
});
