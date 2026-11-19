import { assertEquals, assertRejects } from "@std/assert";
import type { Page } from "puppeteer";
import { createNode } from "web-test/nodes/index.ts";
import { type BrowserContext, InvalidAction } from "web-test/nodes/browser_context.ts";
import type { Value } from "web-test/nodes/base.ts";

function fixture() {
  const calls: unknown[] = [];
  const page = {
    mainFrame: () => ({
      browsingContext: {
        performActions: (actions: unknown) => {
          calls.push(actions);
          return Promise.resolve();
        },
        releaseActions: () => {
          calls.push("releaseActions");
          return Promise.resolve();
        },
      },
    }),
    viewport: () => ({ width: 1024, height: 576, deviceScaleFactor: 2, hasTouch: true }),
    setViewport: (value: unknown) => {
      calls.push(value);
    },
  } as unknown as Page;
  const browser = { getPage: () => Promise.resolve(page) } as BrowserContext;
  const run = (type: "pointer_down" | "pointer_move" | "pointer_up" | "release_inputs" | "viewport_size", properties: Record<string, Value>) => {
    const node = createNode(type, 0, 0);
    node.properties = { ...node.properties, ...properties };
    return node.runBrowser({ browser, nodeId: "test" });
  };
  return { calls, run };
}

Deno.test("separate pointer nodes share gestures and reject invalid transitions without sending input", async () => {
  const { calls, run } = fixture();
  for (const pointerType of ["mouse", "touch"]) {
    calls.length = 0;
    await run("pointer_down", { x: 10, y: 20, pointerType });
    await assertRejects(() => run("pointer_down", { x: 30, y: 40, pointerType }), InvalidAction, "already down");
    await run("pointer_move", { x: 50, y: 60, pointerType });
    await run("pointer_up", { pointerType });
    await assertRejects(() => run("pointer_up", { pointerType }), InvalidAction, "down first");
    assertEquals(calls.length, 3);
  }
  calls.length = 0;
  await assertRejects(() => run("pointer_move", { pointerType: "touch", x: 10, y: 20 }), InvalidAction, "down first");
  assertEquals(calls, []);
  await run("pointer_move", { x: 10, y: 20 });
  assertEquals(calls.length, 1);
});

Deno.test("release clears all inputs, clears both pointer states, and is safe to repeat", async () => {
  const { calls, run } = fixture();
  await run("pointer_down", { x: 20, y: 30 });
  await run("pointer_down", { x: 20, y: 30, pointerType: "touch" });
  await run("release_inputs", {});
  assertEquals(calls.at(-1), "releaseActions");
  await assertRejects(() => run("pointer_up", {}), InvalidAction, "down first");
  await assertRejects(() => run("pointer_up", { pointerType: "touch" }), InvalidAction, "down first");
  await run("release_inputs", {});
  for (const pointerType of ["mouse", "touch"]) {
    await run("pointer_down", { x: 40, y: 50, pointerType });
    await run("pointer_up", { pointerType });
  }
});

Deno.test("invalid pointer and viewport inputs send no input and resizing preserves emulation", async () => {
  const { calls, run } = fixture();
  const invalidPointers: Record<string, Value>[] = [{ x: NaN }, { x: -1 }, { y: Infinity }, { pointerType: "pen" }, { pointerType: null }];
  for (const properties of invalidPointers) await assertRejects(() => run("pointer_down", properties), InvalidAction);
  const invalidSizes: Record<string, Value>[] = [{ width: 0 }, { height: -1 }, { width: 20.5 }, { height: Infinity }];
  for (const properties of invalidSizes) await assertRejects(() => run("viewport_size", properties), InvalidAction);
  assertEquals(calls, []);
  await run("viewport_size", { width: 375, height: 812 });
  assertEquals(calls, [{ width: 375, height: 812, deviceScaleFactor: 2, hasTouch: true }]);
});
