import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { nonemptyText } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, url: { label: "URL", type: nonemptyText } } as const;

export const NavigateNode = defineNode({
  kind: "browser",
  type: "navigate",
  title: "Navigate",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, url: { label: "URL", type: "text" }, title: { label: "Title", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({ url: "https://wikipedia.org" }),
  async process({ url }, { browser }) {
    const page = await browser.getPage();
    await browser.clearElements();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return { url: page.url(), title: await page.title() };
  },
});
