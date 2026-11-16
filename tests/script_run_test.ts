import { ScriptRun } from "web-test/runtime/script_run.ts";
import type { ScriptEvent } from "web-test/runtime/script_events.ts";
import { assert, assertEquals } from "@std/assert";

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for script events.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function controlledSession() {
  const calls = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  return {
    calls,
    async execute(_type: unknown, properties: unknown, _nodeId?: string, signal?: AbortSignal) {
      const gate = Promise.withResolvers<void>();
      calls.set((properties as { url: string }).url, gate);
      const abort = () => gate.reject(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        signal?.throwIfAborted();
        await gate.promise;
        return { output: {}, screenshot: new Uint8Array() };
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}

Deno.test("ScriptRun emits separate start/end events for overlapping invocations of the same block", async () => {
  const session = controlledSession(), events: ScriptEvent[] = [];
  const run = new ScriptRun(
    `await Promise.all([
    browser.track("block", () => browser.navigate("first")),
    browser.track("block", () => browser.navigate("second"))
  ]);`,
    session,
    (event) => events.push(event),
    { runId: "test" },
  );
  try {
    const finished = run.start();
    await until(() => session.calls.size === 2);
    const starts = events.filter((event) => event.type === "async-start");
    assertEquals(starts.length, 2);
    assert(starts[0].invocationId !== starts[1].invocationId);
    session.calls.get("first")!.resolve();
    await until(() => events.filter((event) => event.type === "async-end").length === 1);
    assertEquals(events.at(-1)?.type, "async-end");
    session.calls.get("second")!.resolve();
    await finished;
    const ends = events.filter((event) => event.type === "async-end");
    assertEquals(ends.map((event) => event.invocationId).sort(), starts.map((event) => event.invocationId).sort());
    assertEquals(ends.map((event) => event.outcome), ["completed", "completed"]);
    assertEquals(events.at(-1)?.type, "run-end");
    assert(events.every((event) => event.runId === "test"));
  } finally {
    await run.cancel();
  }
});

Deno.test("ScriptRun closes every active invocation on failure and cancellation", async () => {
  for (const cancel of [false, true]) {
    const session = controlledSession(), events: ScriptEvent[] = [];
    const run = new ScriptRun(
      `await Promise.all([
      browser.track("a", () => browser.navigate("first")),
      browser.track("b", () => browser.navigate("second"))
    ]);`,
      session,
      (event) => events.push(event),
    );
    try {
      const finished = run.start();
      await until(() => session.calls.size === 2);
      if (cancel) await run.cancel();
      else session.calls.get("first")!.reject(new Error("Navigation failed"));
      await finished;
      assertEquals(events.filter((event) => event.type === "async-start").length, 2);
      const ends = events.filter((event) => event.type === "async-end");
      assertEquals(ends.length, 2);
      assertEquals(new Set(ends.map((event) => event.invocationId)).size, 2);
      assert(ends.every((event) => event.outcome === (cancel ? "canceled" : "failed")));
      assertEquals(events.at(-1)?.type, cancel ? "stopped" : "error");
    } finally {
      await run.cancel();
    }
  }
});

Deno.test("ScriptRun interrupts synchronous loops and denies evaluator environment access", async () => {
  const session = controlledSession(), events: ScriptEvent[] = [];
  const run = new ScriptRun('await browser.track("loop", async () => { while (true) {} });', session, (event) => events.push(event), { timeout: 250 });
  await run.start();
  assertEquals(events.filter((event) => event.type === "async-end").length, 1);
  assertEquals(events.at(-1)?.type, "error");
  const denied: ScriptEvent[] = [];
  await new ScriptRun('Deno.env.get("PATH");', session, (event) => denied.push(event)).start();
  assertEquals(denied.at(-1)?.type, "error");
});

Deno.test("ScriptRun returns named browser results and preserves instant values across process messages", async () => {
  const events: ScriptEvent[] = [], calls: { type: unknown; properties: unknown }[] = [];
  const session = {
    execute(type: unknown, properties: unknown) {
      calls.push({ type, properties });
      return Promise.resolve({ output: { timestamp: Temporal.Instant.fromEpochNanoseconds(123_456_789n), success: true }, screenshot: new Uint8Array() });
    },
  };
  const run = new ScriptRun(
    `
    const result = await browser.querySelector("h1");
    if (!result.success || !(result.timestamp instanceof Temporal.Instant) || result.timestamp.epochNanoseconds !== 123456789n) throw new Error("Result codec failed");
    await browser.evaluate("output.result = input.value;", {value: result.timestamp}, [{name: "value", type: "instant"}], [{name: "result", type: "instant"}], 1000);
  `,
    session,
    (event) => events.push(event),
  );
  await run.start();
  assertEquals(events.at(-1)?.type, "run-end");
  assertEquals(calls[0], { type: "query_selector", properties: { selector: "h1" } });
  assertEquals(calls[1].type, "script");
  const properties = calls[1].properties as Record<string, unknown>;
  assert(properties.arg_value instanceof Temporal.Instant);
  assertEquals(properties.arguments, undefined);
});
