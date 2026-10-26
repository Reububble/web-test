import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { nonemptyText } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

export const ScrapeTextNode = defineNode({
  kind: "browser",
  type: "extract_text",
  title: "Scrape Text",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, text: { label: "Text", type: "text" }, success: { label: "Success", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ selector: "h1" }),
  async process({ selector }, { browser }) {
    const element = await (await browser.getPage()).$(selector);
    try {
      return element ? { text: await element.evaluate((node) => node.textContent ?? ""), success: true } : { text: "", success: false };
    } finally {
      await element?.dispose();
    }
  },
});
