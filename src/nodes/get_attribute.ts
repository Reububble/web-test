import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { nonemptyText } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly element: { readonly label: "Element"; readonly type: "element" };
  readonly attribute: { readonly label: "Attribute"; readonly type: TypeDescriptor<string> };
} = {
  flow: { label: "Flow", type: "flow" },
  element: { label: "Element", type: "element" },
  attribute: { label: "Attribute", type: nonemptyText },
} as const;

export const GetAttributeNode: DeclarativeNodeConstructor<
  typeof inputs,
  {
    readonly next: { readonly label: "Next"; readonly type: "flow" };
    readonly text: { readonly label: "Value"; readonly type: "text" };
    readonly success: { readonly label: "Exists"; readonly type: "boolean" };
  },
  DataValues<typeof inputs>
> = defineNode({
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
