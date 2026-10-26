import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { InvalidAction } from "web/nodes/browser_context.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" } } as const;

export const ElementClickNode = defineNode({
  kind: "browser",
  type: "element_click",
  title: "Click Element",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, success: { label: "Success", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ element: null }),
  async process({ element: reference }, { browser }) {
    const element = browser.element(reference);
    if (!element) throw new InvalidAction("Connect an element from Query Selector or Wait for Element first.");
    await element.click();
    return { success: true };
  },
});
