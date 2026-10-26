import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { nonemptyText } from "web/nodes/browser_support.ts";

const inputs = {
  flow: { label: "Flow", type: "flow" },
  element: { label: "Element", type: "element" },
  attribute: { label: "Attribute", type: nonemptyText },
} as const;

export const GetAttributeNode = defineNode({
  kind: "browser",
  type: "get_attribute",
  title: "Get Attribute",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, text: { label: "Value", type: "text" }, success: { label: "Exists", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ element: null, attribute: "href" }),
  async process({ element: reference, attribute }, { browser }) {
    const element = browser.element(reference);
    const value = element ? await element.evaluate((node, name) => node.getAttribute(name), attribute) : null;
    return { text: value ?? "", success: value !== null };
  },
});
