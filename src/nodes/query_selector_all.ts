import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { nonemptyText } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

export const QuerySelectorAllNode = defineNode({
  kind: "browser",
  type: "query_selector_all",
  title: "Query Selector All",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, elements: { label: "Elements", type: "array" }, success: { label: "Found", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ selector: "h1" }),
  async process({ selector }, { browser, nodeId }) {
    const elements = await (await browser.getPage()).$$(selector);
    const references = await browser.saveElements(elements, `${nodeId}:elements`);
    return { elements: references, success: references.length > 0 };
  },
  help:
    "Finds all matching DOM elements in document order. No matches returns an empty array and Found = false. Connect Elements to Array For Each and choose Item type = Element. References expire when this node runs again, after navigation, or on browser reset.",
});
