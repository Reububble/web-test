import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly element: { readonly label: "Element"; readonly type: "element" };
  readonly text: { readonly label: "Text"; readonly type: "text" };
} = { flow: { label: "Flow", type: "flow" }, element: { label: "Element", type: "element" }, text: { label: "Text", type: "text" } } as const;

export const TypeTextNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" }; readonly success: { readonly label: "Success"; readonly type: "boolean" } },
  DataValues<typeof inputs>
> = defineNode({
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
