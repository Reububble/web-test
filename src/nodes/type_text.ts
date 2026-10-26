import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { InvalidAction } from "web/nodes/browser_context.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" }, text: { label: "Text", type: "text" } } as const;

export const TypeTextNode = defineNode({
  kind: "browser",
  type: "type_text",
  title: "Type Text",
  inputs,
  outputs: { next: { label: "Next", type: "flow" }, success: { label: "Success", type: "boolean" } },
  properties: (): DataValues<typeof inputs> => ({ element: null, text: "" }),
  async process({ element: reference, text }, { browser }) {
    const element = browser.element(reference);
    if (!element) throw new InvalidAction("Connect an element from Query Selector or Wait for Element first.");
    const editable = await element.evaluate((node) =>
      (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
        ? !node.disabled && !node.readOnly &&
          (node instanceof HTMLTextAreaElement || ["text", "search", "email", "url", "tel", "password", "number"].includes(node.type))
        : node instanceof HTMLElement && node.isContentEditable
    );
    if (!editable) throw new InvalidAction("Type Text requires an editable input, textarea, or contenteditable element.");
    await element.type(text);
    return { success: true };
  },
  help:
    "Focuses an input, textarea, or editable element and types Text using keyboard events. Appends to existing text at the caret. Connect an Element from Query Selector or Wait for Element. Use Set Value to replace a field's contents.",
  multilineInputs: ["text"],
});
