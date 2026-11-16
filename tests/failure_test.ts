import { assertEquals, assertRejects } from "@std/assert";
import { Graph, type GraphNode, type Value } from "web-test/graph.ts";
function block(graph: Graph, message: string, type: "log" | "fail" = "log") {
  const node = graph.add(type, 0, 0);
  node.properties.message = message;
  return node;
}
function recorder(messages: Value[]) {
  return (_node: GraphNode, properties: Record<string, Value>) => {
    messages.push(properties.message);
    return Promise.resolve({ message: properties.message });
  };
}
Deno.test("Fail terminates execution with its connected message and survives graph files", async () => {
  const graph = new Graph(), fail = block(graph, "default", "fail"), message = graph.add("text_literal", 0, 0);
  message.properties.value = "deliberate failure";
  graph.connect(message.id, "text", fail.id, "message");
  const copy = Graph.deserialize(graph.serialize());
  assertEquals(copy.serialize(), graph.serialize());
  await assertRejects(
    () =>
      copy.run(() => {
        throw new Error("Fail must run locally without a browser action");
      }),
    Error,
    "deliberate failure",
  );
});
Deno.test("Try runs Catch only on failure, always runs Finally, then Next after handling", async () => {
  for (const fails of [false, true]) {
    const graph = new Graph(),
      handler = graph.add("try_catch_finally", 0, 0),
      body = block(graph, "body", fails ? "fail" : "log"),
      caught = block(graph, "catch"),
      cleanup = block(graph, "finally"),
      after = block(graph, "next");
    graph.connect(handler.id, "try", body.id, "flow");
    graph.connect(handler.id, "catch", caught.id, "flow");
    graph.connect(handler.id, "error", caught.id, "message");
    graph.connect(handler.id, "finally", cleanup.id, "flow");
    graph.connect(handler.id, "next", after.id, "flow");
    const copy = Graph.deserialize(graph.serialize()), messages: Value[] = [];
    await copy.run(recorder(messages));
    assertEquals(messages, ["body", "finally", "next"]);
    assertEquals(copy.results.get(handler.id), { error: fails ? "body" : "", failed: fails });
    assertEquals(copy.results.has(caught.id), fails);
  }
});
Deno.test("Finally-only handlers clean up and preserve unhandled failures", async () => {
  const graph = new Graph(),
    handler = graph.add("try_catch_finally", 0, 0),
    fail = block(graph, "unhandled", "fail"),
    cleanup = block(graph, "cleanup"),
    after = block(graph, "unreachable");
  graph.connect(handler.id, "try", fail.id, "flow");
  graph.connect(handler.id, "finally", cleanup.id, "flow");
  graph.connect(handler.id, "next", after.id, "flow");
  graph.connect(handler.id, "error", cleanup.id, "message");
  const messages: Value[] = [];
  await assertRejects(() => graph.run(recorder(messages)), Error, "unhandled");
  assertEquals(messages, ["unhandled"]);
});
Deno.test("Catch and Finally failures propagate to outer handlers, with Finally taking precedence", async () => {
  for (const cleanupFails of [false, true]) {
    const graph = new Graph(),
      outer = graph.add("try_catch_finally", 0, 0),
      inner = graph.add("try_catch_finally", 0, 0),
      fail = block(graph, "original", "fail"),
      caught = block(graph, "catch failed", "fail"),
      cleanup = block(graph, "finally failed", cleanupFails ? "fail" : "log"),
      outerCatch = block(graph, ""),
      outerFinally = block(graph, "outer cleanup"),
      after = block(graph, "next");
    graph.connect(outer.id, "try", inner.id, "flow");
    graph.connect(inner.id, "try", fail.id, "flow");
    graph.connect(inner.id, "catch", caught.id, "flow");
    graph.connect(inner.id, "finally", cleanup.id, "flow");
    graph.connect(outer.id, "catch", outerCatch.id, "flow");
    graph.connect(outer.id, "error", outerCatch.id, "message");
    graph.connect(outer.id, "finally", outerFinally.id, "flow");
    graph.connect(outer.id, "next", after.id, "flow");
    const messages: Value[] = [];
    await graph.run(recorder(messages));
    assertEquals(messages, cleanupFails ? ["finally failed", "outer cleanup", "next"] : ["finally failed", "catch failed", "outer cleanup", "next"]);
  }
});
Deno.test("Try catches executor errors and failures raised inside macros", async () => {
  for (const macro of [false, true]) {
    const graph = new Graph(), handler = graph.add("try_catch_finally", 0, 0), body = graph.add(macro ? "macro" : "navigate", 0, 0), caught = block(graph, "");
    graph.connect(handler.id, "try", body.id, "flow");
    graph.connect(handler.id, "catch", caught.id, "flow");
    graph.connect(handler.id, "error", caught.id, "message");
    const child = new Graph();
    block(child, "action failed", "fail");
    graph.macros = [{ id: "macro_failure", name: "Failure", graph: child.serialize() }];
    if ("macroId" in body.properties) body.properties.macroId = "macro_failure";
    const messages: Value[] = [];
    await graph.run((node, properties) => {
      if (node.type === "navigate") throw new Error("action failed");
      return recorder(messages)(node, properties);
    });
    assertEquals(messages, ["action failed"]);
  }
});
Deno.test("Try resets Error and skipped branch values on repeated loop invocations", async () => {
  const graph = new Graph(),
    loop = graph.add("for", 0, 0),
    handler = graph.add("try_catch_finally", 0, 0),
    comparison = graph.add("number_comparison", 0, 0),
    branch = graph.add("conditional", 0, 0),
    fail = block(graph, "first", "fail"),
    caught = block(graph, "caught"),
    cleanup = block(graph, "cleanup");
  loop.properties.end = 2;
  comparison.properties.valueB = 0;
  graph.connect(loop.id, "each", handler.id, "flow");
  graph.connect(handler.id, "try", branch.id, "flow");
  graph.connect(loop.id, "index", comparison.id, "valueA");
  graph.connect(comparison.id, "result", branch.id, "condition");
  graph.connect(branch.id, "true", fail.id, "flow");
  graph.connect(handler.id, "catch", caught.id, "flow");
  graph.connect(handler.id, "finally", cleanup.id, "flow");
  const observations: unknown[] = [];
  await graph.run((node) => {
    if (node.id === cleanup.id) observations.push({ ...graph.results.get(handler.id), caught: graph.results.has(caught.id) });
    return Promise.resolve({});
  });
  assertEquals(observations, [{ error: "first", failed: true, caught: true }, { error: "", failed: false, caught: false }]);
});
Deno.test("Stop bypasses Catch and Finally; cleanup itself remains interruptible", async () => {
  for (const stopInCleanup of [false, true]) {
    const graph = new Graph(),
      handler = graph.add("try_catch_finally", 0, 0),
      body = block(graph, "body"),
      caught = block(graph, "catch"),
      cleanup = block(graph, "finally"),
      after = block(graph, "next"),
      controller = new AbortController(),
      reason = new Error("Execution stopped.");
    graph.connect(handler.id, "try", body.id, "flow");
    graph.connect(handler.id, "catch", caught.id, "flow");
    graph.connect(handler.id, "finally", cleanup.id, "flow");
    graph.connect(handler.id, "next", after.id, "flow");
    const messages: Value[] = [];
    await assertRejects(
      () =>
        graph.run(
          (node, properties) => {
            if (node.id === (stopInCleanup ? cleanup.id : body.id)) controller.abort(reason);
            return recorder(messages)(node, properties);
          },
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal,
        ),
      Error,
      "Execution stopped.",
    );
    assertEquals(messages, stopInCleanup ? ["body", "finally"] : ["body"]);
  }
});
