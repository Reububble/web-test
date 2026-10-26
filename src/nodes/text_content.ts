import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" } } as const;

export const TextContentNode = defineNode({
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
