import { testBrowserLauncher } from "tests/browser_fixture.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { BrowserSession } from "web/runtime/browser.ts";
Deno.test("script ports preserve instants and nested instant arrays across Firefox BiDi", async () => {
  const session = new BrowserSession(testBrowserLauncher());
  const instant = Temporal.Instant.fromEpochNanoseconds(-123_456_789n);
  try {
    const properties = {
      code:
        "if (!(input.time instanceof Temporal.Instant)) throw new Error('Lost instant'); output.time = input.time.add({nanoseconds: 1}); output.items = input.items;",
      timeout: 3000,
      inputPorts: [{ name: "time", type: "instant" }, { name: "items", type: "array" }],
      outputPorts: [{ name: "time", type: "instant" }, { name: "items", type: "array" }],
      arg_time: instant,
      arg_items: [{ nested: [instant], $type: "instant" }],
    };
    const { output } = await session.execute("script", properties);
    assert(output.time instanceof Temporal.Instant);
    assertEquals(output.time.epochNanoseconds, instant.epochNanoseconds + 1n);
    assertEquals(output.items, properties.arg_items);
    await assertRejects(() => session.execute("script", { ...properties, code: "output.time = '2026-10-23T00:00Z'; output.items = [];" }), Error, "instant");
  } finally {
    await session.close();
  }
});
