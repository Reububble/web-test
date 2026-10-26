import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { nonemptyText } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

export const QuerySelectorNode = defineNode({
  kind: "browser",
  type: "query_selector",
  title: "Query Selector",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, element: { label: "Element", type: "element" }, success: { label: "Found", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ selector: "h1" }),
  async process({ selector }, { browser, nodeId }) {
    const element = await (await browser.getPage()).$(selector);
    return { element: await browser.saveElement(element, `${nodeId}:element`), success: element !== null };
  },
  help: "Find the first matching DOM element. Element references expire after navigation.",
});
