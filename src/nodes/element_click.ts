import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";

const inputs: { readonly flow: { readonly label: "Flow"; readonly type: "flow" }; readonly element: { readonly label: "Element"; readonly type: "element" } } =
  { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" } } as const;

/** Node constructor. Clicks an element retained by the current browser session. */
export const ElementClickNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" }; readonly success: { readonly label: "Success"; readonly type: "boolean" } },
  DataValues<typeof inputs>
> = defineNode({
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
