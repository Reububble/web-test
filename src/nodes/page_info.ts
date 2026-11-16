import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";

const inputs: { readonly flow: { readonly label: "Flow"; readonly type: "flow" } } = { flow: { label: "Flow", type: "flow" } } as const;

/** Node constructor. Reads the automated page's current URL and title. */
export const PageInfoNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly url: { readonly label: "URL"; readonly type: "text" };
    readonly title: { readonly label: "Title"; readonly type: "text" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
