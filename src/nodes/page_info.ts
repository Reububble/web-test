import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";

const inputs = { flow: { label: "Flow", type: "flow" } } as const;

export const PageInfoNode = defineNode({
  kind: "browser",
  type: "page_info",
  title: "Page Info",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, url: { label: "URL", type: "text" }, title: { label: "Title", type: "text" } },
  properties: (): DataValues<typeof inputs> => ({}),
  async process(_inputs, { browser }) {
    const page = await browser.getPage();
    return { url: page.url(), title: await page.title() };
  },
});
