import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { browserNumber } from "web-test/nodes/browser_support.ts";

const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly milliseconds: { readonly label: "Wait ms"; readonly type: TypeDescriptor<number> };
} = { flow: { label: "Flow", type: "flow" }, milliseconds: { label: "Wait ms", type: browserNumber(0, 60000) } } as const;

export const DelayNode: DeclarativeNodeConstructor<
  typeof inputs,
  { readonly next: { readonly label: "Next"; readonly type: "flow" } },
  DataValues<typeof inputs>
> = defineNode({
  kind: "browser",
  type: "delay",
  title: "Delay",
  interruptBrowser: false,
  inputs,
  outputs: { next: { label: "Next", type: "flow" } },
  properties: (): DataValues<typeof inputs> => ({ milliseconds: 500 }),
  async process({ milliseconds }, { signal }) {
    await new Promise<void>((resolve, reject) => {
      signal?.throwIfAborted();
      const finish = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
    });
    return {};
  },
});
