import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly selector: { readonly label: "Selector"; readonly type: TypeDescriptor<string> };
} = { flow: { label: "Flow", type: "flow" }, selector: { label: "Selector", type: nonemptyText } } as const;

/** Node constructor. Finds the first matching page element and returns a session-owned reference and success flag. */
export const QuerySelectorNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly element: { readonly label: "Element"; readonly type: "element" };
    readonly success: { readonly label: "Found"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
