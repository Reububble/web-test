import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly selector: { readonly label: "Selector"; readonly type: TypeDescriptor<string> };
} = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

/** Node constructor. Finds all matching page elements and returns their ordered session-owned references. */
export const QuerySelectorAllNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly elements: { readonly label: "Elements"; readonly type: "array" };
    readonly success: { readonly label: "Found"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
