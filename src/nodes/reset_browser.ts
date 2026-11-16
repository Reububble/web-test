import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";
import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";

const certificateInput: TypeDescriptor<boolean | null> = {
  type: "boolean",
  optional: true,
  defaultValue: () => null,
  read(value, label) {
    if (typeof value !== "boolean") throw new InvalidAction(`${label} must be boolean.`);
    return value;
  },
};

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly acceptInsecureCerts: { readonly label: "Trust insecure certificates"; readonly type: TypeDescriptor<boolean | null>; readonly optional: true };
} = {
  flow: { label: "Flow", type: "flow" },
  acceptInsecureCerts: { label: "Trust insecure certificates", type: certificateInput, optional: true },
} as const;

export const ResetBrowserNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "browser",
  type: "reset_browser",
  title: "Reset Browser",
  screenshot: false,
  inputs,
  outputs: { next: { label: "Next", type: "flow" } },
  properties: (): DataValues<typeof inputs> => ({ acceptInsecureCerts: false }),
  async process({ acceptInsecureCerts }, { browser }) {
    await browser.reset(acceptInsecureCerts ?? undefined);
    return {};
  },
  help:
    "Closes the browser, clears element references, and applies Trust insecure certificates to the next browser launch. These settings are saved with this graph. The next browser action opens a fresh browser.",
});
