import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly selector: { readonly label: "Selector"; readonly type: TypeDescriptor<string> };
} = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

/** Node constructor. Reads text from the first element matching a page selector and reports whether it was found. */
export const ScrapeTextNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly text: { readonly label: "Text"; readonly type: "text" };
    readonly success: { readonly label: "Success"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
