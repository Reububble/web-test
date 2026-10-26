import { assert, assertEquals, assertThrows } from "@std/assert";
import { copyValue, parseValue, stringifyValue } from "web/value.ts";
import { Graph } from "web/graph.ts";
import { GraphRun } from "web/runtime/graph_run.ts";
import { BrowserSession } from "web/runtime/browser.ts";
import { isJson, matchesType } from "web/script_schema.ts";
import type { RunEvent } from "web/run_events.ts";
Deno.test("instant JSON preserves nanoseconds, negative epochs and the full supported range", () => {
  for (const nanos of [0n, 1n, -1n, -1_000_000_001n, 1_792_728_000_123_456_789n, -8_640_000_000_000_000_000_000n, 8_640_000_000_000_000_000_000n]) {
    const instant = Temporal.Instant.fromEpochNanoseconds(nanos);
    const encoded = stringifyValue({ nested: [instant] });
    const wire = JSON.parse(encoded).nested[0];
    assertEquals(wire.$type, "instant");
    assert(Number.isSafeInteger(wire.epochSeconds));
    assert(wire.nanoseconds >= 0 && wire.nanoseconds < 1_000_000_000);
    const decoded = parseValue(encoded) as { nested: Temporal.Instant[] };
    assert(decoded.nested[0] instanceof Temporal.Instant);
    assertEquals(decoded.nested[0].epochNanoseconds, nanos);
  }
});
Deno.test("value JSON escapes tag collisions and preserves ordinary JSON without date guessing", () => {
  const value = {
    date: "2026-10-23T00:00:00Z",
    nested: [{ $type: "instant", epochSeconds: 0, nanoseconds: 0 }, { $type: "record", entries: [["x", 1]] }],
    plain: { text: "hello", number: 3, boolean: true, nothing: null },
  };
  assertEquals(parseValue(stringifyValue(value)), value);
  assertEquals(parseValue(JSON.stringify(value.plain)), value.plain);
  const proto = JSON.parse('{"__proto__":{"polluted":true}}');
  assertEquals(Object.getPrototypeOf(parseValue(stringifyValue(proto))), Object.prototype);
  assertEquals(({} as Record<string, unknown>).polluted, undefined);
});
Deno.test("value JSON rejects malformed and out of range instant tags", () => {
  for (
    const fields of [
      { epochSeconds: 0.5, nanoseconds: 0 },
      { epochSeconds: 0, nanoseconds: -1 },
      { epochSeconds: 0, nanoseconds: 1_000_000_000 },
      { epochSeconds: 0, nanoseconds: 0.5 },
      { epochSeconds: "0", nanoseconds: 0 },
      { epochSeconds: 8_640_000_000_001, nanoseconds: 0 },
      { epochSeconds: 0, nanoseconds: 0, extra: true },
    ]
  ) assertThrows(() => parseValue(JSON.stringify({ $type: "instant", ...fields })), SyntaxError);
});
Deno.test("value copies isolate mutable containers and retain immutable instants", () => {
  const instant = Temporal.Now.instant();
  const source = { nested: [{ instant, items: [1] }] };
  const copy = copyValue(source);
  copy.nested[0].items.push(2);
  assertEquals(source.nested[0].items, [1]);
  assert(copy.nested[0].instant === instant);
  assert(matchesType(instant, "instant"));
  assert(matchesType([instant], "array"));
  assert(!isJson(instant));
  assert(!matchesType(instant, "text"));
});
Deno.test("log instants survive graph execution, inspection and saved instant connections", async () => {
  const graph = new Graph();
  const log = graph.add("log", 0, 0);
  const choose = graph.add("conditional_value", 300, 0);
  choose.properties.valueType = "instant";
  choose.properties.condition = true;
  graph.syncInputs();
  graph.connect(log.id, "timestamp", choose.id, "trueValue");
  const restored = Graph.deserialize(parseValue(stringifyValue(graph.serialize())));
  const events: RunEvent[] = [];
  await new GraphRun(restored, new BrowserSession(), (event) => events.push(event)).start();
  assert(!events.some((event) => event.type === "error"));
  const timestamp = restored.results.get(log.id)?.timestamp;
  assert(timestamp instanceof Temporal.Instant);
  assert(restored.lastKnown.get(log.id)?.timestamp.updatedAt instanceof Temporal.Instant);
  const event = events.find((event) => event.type === "log");
  assert(event?.type === "log" && event.timestamp instanceof Temporal.Instant);
  assertEquals(event.timestamp.epochNanoseconds, timestamp.epochNanoseconds);
});
