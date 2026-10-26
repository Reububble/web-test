import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { InvalidAction } from "web/nodes/browser_context.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" }, text: { label: "Text", type: "text" } } as const;

export const SetValueNode = defineNode({
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
