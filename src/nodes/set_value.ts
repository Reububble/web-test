import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly element: { readonly label: "Element"; readonly type: "element" };
  readonly text: { readonly label: "Text"; readonly type: "text" };
} = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" }, text: { label: "Text", type: "text" } } as const;

/** Node constructor. Sets a retained form element's value and dispatches input and change events. */
export const SetValueNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" }; readonly success: { readonly label: "Success"; readonly type: "boolean" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "browser",
  type: "set_value",
  title: "Set Value",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, success: { label: "Success", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ element: null, text: "" }),
  async process({ element: reference, text }, { browser }) {
    const element = browser.element(reference);
    if (!element) throw new InvalidAction("Connect an element from Query Selector or Wait for Element first.");
    await element.evaluate((node, value) => {
      const prototype = node instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : node instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : node instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : null;
      if (!prototype) throw new Error("Set Value requires an input, textarea, or select element.");
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, text);
    return { success: true };
  },
});
