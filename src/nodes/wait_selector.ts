import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { browserNumber, nonemptyText } from "web/nodes/browser_support.ts";

const inputs = {
  flow: { label: "Flow", type: "flow" },
  selector: { label: "Selector", type: nonemptyText },
  timeout: { label: "Timeout ms", type: browserNumber(1, 60000) },
} as const;

export const WaitSelectorNode = defineNode({
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
