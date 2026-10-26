import { defineNode } from "web/nodes/define_node.ts";
import type { DataValues } from "web/nodes/declarative_node.ts";
import { browserNumber } from "web/nodes/browser_support.ts";

const inputs = { flow: { label: "Flow", type: "flow" }, milliseconds: { label: "Wait ms", type: browserNumber(0, 60000) } } as const;

export const DelayNode = defineNode({
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
