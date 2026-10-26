import { assert, assertEquals, assertRejects } from "@std/assert";
import { Graph, outputs, type Value } from "web/graph.ts";

Deno.test("Sequence keeps connected output identities and exactly one spare through edits and graph files", () => {
  const graph = new Graph(), sequence = graph.add("sequence", 0, 0);
  const first = graph.add("log", 0, 0), second = graph.add("log", 0, 0), third = graph.add("log", 0, 0);
  assertEquals(outputs(sequence).map((port) => port.key), ["step_1"]);
  graph.connect(sequence.id, "step_1", first.id, "flow");
  graph.connect(sequence.id, "step_2", second.id, "flow");
  graph.connect(sequence.id, "step_3", third.id, "flow");
  assertEquals(outputs(sequence).map((port) => port.key), ["step_1", "step_2", "step_3", "step_4"]);
  const lastLink = graph.links.find((link) => link.to === third.id)!;
  graph.remove(new Set([second.id]));
  assertEquals(outputs(sequence).map((port) => port.key), ["step_1", "step_3", "step_4"]);
  assertEquals(graph.links.find((link) => link.to === third.id), lastLink);
  const saved = graph.serialize(), restored = Graph.deserialize(saved);
  assertEquals(restored.serialize(), saved);
  assertEquals(outputs(restored.node(sequence.id)).length, 3);
  restored.disconnect(new Set([first.id, third.id]));
  assertEquals(outputs(restored.node(sequence.id)).length, 1);
});

Deno.test("Sequence awaits whole branches in order and preserves earlier branch results", async () => {
  const graph = new Graph(), sequence = graph.add("sequence", 0, 0);
  const first = graph.add("navigate", 0, 0), end = graph.add("page_info", 0, 0), second = graph.add("log", 0, 0);
  graph.connect(sequence.id, "step_1", first.id, "flow");
  graph.connect(first.id, "next", end.id, "flow");
  graph.connect(sequence.id, "step_2", second.id, "flow");
  graph.connect(end.id, "title", second.id, "message");
  const calls: string[] = [];
  await graph.run(async (node, properties): Promise<Record<string, Value>> => {
    calls.push(`${node.type}:start`);
    await new Promise((resolve) => setTimeout(resolve, 1));
    if (node.type === "log") assertEquals(properties.message, "earlier branch");
    calls.push(`${node.type}:end`);
    return node.type === "page_info" ? { title: "earlier branch" } : {};
  });
  assertEquals(calls, ["navigate:start", "navigate:end", "page_info:start", "page_info:end", "log:start", "log:end"]);
  assertEquals(graph.results.get(end.id), { title: "earlier branch" });
});

Deno.test("Sequence stops before later branches on failure or cancellation and tolerates no connected outputs", async () => {
  const empty = new Graph();
  empty.add("sequence", 0, 0);
  await empty.run(() => {
    throw new Error("No branch is connected");
  });
  for (const cancel of [false, true]) {
    const graph = new Graph(), sequence = graph.add("sequence", 0, 0), first = graph.add("delay", 0, 0), second = graph.add("log", 0, 0);
    graph.connect(sequence.id, "step_1", first.id, "flow");
    graph.connect(sequence.id, "step_2", second.id, "flow");
    const controller = new AbortController(), calls: string[] = [];
    await assertRejects(
      () =>
        graph.run(
          (node) => {
            calls.push(node.id);
            if (cancel) controller.abort(new Error("cancelled"));
            else throw new Error("failed branch");
            return Promise.resolve({});
          },
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal,
        ),
      Error,
      cancel ? "cancelled" : "failed branch",
    );
    assertEquals(calls, [first.id]);
    assert(!graph.results.has(second.id));
  }
});
