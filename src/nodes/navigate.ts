import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly url: { readonly label: "URL"; readonly type: TypeDescriptor<string> };
} = { flow: { label: "Flow", type: "flow" }, url: { label: "URL", type: nonemptyText } } as const;

/** Node constructor. Navigates the automated page and publishes its resulting URL and title. */
export const NavigateNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly url: { readonly label: "URL"; readonly type: "text" };
    readonly title: { readonly label: "Title"; readonly type: "text" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
