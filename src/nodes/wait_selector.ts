import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { browserNumber, nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly selector: { readonly label: "Selector"; readonly type: TypeDescriptor<string> };
  readonly timeout: { readonly label: "Timeout ms"; readonly type: TypeDescriptor<number> };
} = {
  flow: { label: "Flow", type: "flow" },
  selector: { label: "Selector", type: nonemptyText },
  timeout: { label: "Timeout ms", type: browserNumber(1, 60000) },
} as const;

export const WaitSelectorNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly element: { readonly label: "Element"; readonly type: "element" };
    readonly success: { readonly label: "Found"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
  kind: "browser",
  type: "wait_selector",
  title: "Wait for Element",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, element: { label: "Element", type: "element" }, success: { label: "Found", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ selector: "h1", timeout: 5000 }),
  async process({ selector, timeout }, { browser, nodeId }) {
    const page = await browser.getPage();
    let element;
    try {
      element = await page.waitForSelector(selector, { timeout });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
      element = null;
    }
    return { element: await browser.saveElement(element, `${nodeId}:element`), success: element !== null };
  },
});
