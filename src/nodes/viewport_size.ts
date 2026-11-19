import { defineNode } from "web-test/nodes/define_node.ts";
import { browserNumber } from "web-test/nodes/browser_support.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly width: { readonly label: "Width"; readonly type: TypeDescriptor<number> };
  readonly height: { readonly label: "Height"; readonly type: TypeDescriptor<number> };
} = {
  flow: { label: "Flow", type: "flow" },
  width: { label: "Width", type: browserNumber(1) },
  height: { label: "Height", type: browserNumber(1) },
};
const outputs: { readonly next: { readonly label: "Next"; readonly type: "flow" } } = { next: { label: "Next", type: "flow" } };

/** Resize the page viewport in CSS pixels while preserving other viewport settings. */
export const ViewportSizeNode: DeclarativeNodeConstructor<typeof inputs, typeof outputs, DataValues<typeof inputs>> = defineNode({
  kind: "browser",
  type: "viewport_size",
  title: "Viewport Size",
  inputs,
  outputs,
  properties: () => ({ width: 1024, height: 576 }),
  async process({ width, height }, { browser }) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new InvalidAction("Viewport width and height must be positive integers.");
    const page = await browser.getPage();
    await page.setViewport({ ...page.viewport(), width, height });
    return {};
  },
});
