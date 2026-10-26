import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph } from "web/graph.ts";
Deno.test("flow cycles allow synchronous nodes, including nested cycles and saved graphs", () => {
  const graph = new Graph();
  const a = graph.add("log", 0, 0), b = graph.add("log", 0, 0);
  graph.connect(a.id, "next", b.id, "flow");
  graph.connect(b.id, "next", a.id, "flow");
  graph.connect(a.id, "next", a.id, "flow");
  const async = graph.add("delay", 0, 0);
  graph.connect(b.id, "next", async.id, "flow");
  graph.connect(async.id, "next", a.id, "flow");
  assertEquals(Graph.deserialize(graph.serialize()).serialize(), graph.serialize());
  const branch = graph.add("conditional", 0, 0);
  graph.connect(async.id, "next", branch.id, "flow");
  graph.connect(branch.id, "true", a.id, "flow");
  const before = graph.serialize();
  graph.connect(b.id, "next", branch.id, "flow");
  assertEquals(before.nodes.length, graph.nodes.length);
  const invalid = graph.serialize();
  invalid.links.push({ id: "link_sync_cycle", from: branch.id, output: "false", to: branch.id, input: "flow", type: "flow" });
  assertEquals(Graph.deserialize(invalid).serialize(), invalid);
});
Deno.test("data-only cycles remain invalid when async nodes exist elsewhere", () => {
  const graph = new Graph();
  graph.add("delay", 0, 0);
  const a = graph.add("text_literal", 0, 0), b = graph.add("text_literal", 0, 0);
  graph.connect(a.id, "text", b.id, "value");
  assertThrows(() => graph.connect(b.id, "text", a.id, "value"), Error, "Circular data");
});
Deno.test("a standalone async loop starts, updates feedback values and exits through If", async () => {
  const graph = new Graph();
  const script = graph.add("script", 0, 0);
  script.properties.inputPorts = [{ name: "count", type: "number" }];
  script.properties.outputPorts = [{ name: "count", type: "number" }, { name: "again", type: "boolean" }];
  script.properties.arg_count = 0;
  const branch = graph.add("conditional", 0, 0), end = graph.add("log", 0, 0);
  graph.connect(script.id, "count", script.id, "arg_count");
  graph.connect(script.id, "again", branch.id, "condition");
  graph.connect(script.id, "next", branch.id, "flow");
  graph.connect(branch.id, "true", script.id, "flow");
  graph.connect(branch.id, "false", end.id, "flow");
  const restored = Graph.deserialize(graph.serialize());
  const inputs: number[] = [];
  let ended = false;
  await restored.run((node, properties) => {
    if (node.type === "log") {
      ended = true;
      return Promise.resolve({});
    }
    const count = Number(properties.arg_count);
    inputs.push(count);
    return Promise.resolve({ count: count + 1, again: count < 2 });
  });
  assertEquals(inputs, [0, 1, 2]);
  assert(ended);
  assertEquals(restored.results.get(script.id)?.count, 3);
});
Deno.test("immediately resolved async self loops yield to timers and can be aborted", async () => {
  const graph = new Graph();
  const delay = graph.add("delay", 0, 0);
  graph.connect(delay.id, "next", delay.id, "flow");
  const controller = new AbortController();
  let steps = 0;
  const timer = setTimeout(() => controller.abort(new Error("Test stopped")), 30);
  try {
    await assertRejects(
      () =>
        graph.run(
          () => {
            steps++;
            return Promise.resolve({});
          },
          () => {},
          () => {},
          undefined,
          undefined,
          controller.signal,
        ),
      Error,
      "Test stopped",
    );
    assert(steps > 1);
  } finally {
    clearTimeout(timer);
  }
});
