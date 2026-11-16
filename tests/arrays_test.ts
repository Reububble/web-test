import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph, type GraphNode, type Value } from "web-test/graph.ts";
import { defaultValue, matchesType, readScriptPorts } from "web-test/script_schema.ts";
const read = (graph: Graph, node: GraphNode, output: string) => node.dataValue(output, (key) => graph.value(node, key));
Deno.test("array type validates JSON arrays and persists distinct connections", () => {
  assertEquals(defaultValue("array"), []);
  assert(matchesType([1, "two", null, [false]], "array"));
  assert(!matchesType({}, "array"));
  assert(!matchesType([undefined], "array"));
  assertEquals(readScriptPorts([{ name: "items", type: "array" }]), [{ name: "items", type: "array" }]);
  const graph = new Graph();
  const literal = graph.add("array_literal", 0, 0), length = graph.add("array_length", 0, 0);
  literal.properties.value = [1, 2, 3];
  graph.connect(literal.id, "array", length.id, "array");
  assertThrows(() => graph.connect(graph.add("text_literal", 0, 0).id, "text", length.id, "array"));
  const restored = Graph.deserialize(graph.serialize());
  assertEquals(restored.serialize(), graph.serialize());
  assertEquals(read(restored, restored.node(length.id), "length"), 3);
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  literal.properties.value = {};
  assertThrows(() => read(graph, literal, "array"), Error, "Expected an array");
});
Deno.test("concat, slice and at preserve arrays and handle negative and missing indices", () => {
  const graph = new Graph();
  const concat = graph.add("array_concat", 0, 0);
  concat.properties.first = [1, [2]];
  concat.properties.second = [3, 4];
  assertEquals(read(graph, concat, "array"), [1, [2], 3, 4]);
  assertEquals(concat.properties.first, [1, [2]]);
  const slice = graph.add("array_slice", 0, 0);
  graph.connect(concat.id, "array", slice.id, "array");
  slice.properties.start = -2;
  assertEquals(read(graph, slice, "array"), [3, 4]);
  slice.properties.end = -1;
  assertEquals(read(graph, slice, "array"), [3]);
  slice.properties.start = 100;
  assertEquals(read(graph, slice, "array"), []);
  // A configured number array validates every element before its process runs.
  concat.properties.first = [1, 2];
  const at = graph.add("array_at", 0, 0);
  graph.connect(concat.id, "array", at.id, "array");
  at.properties.itemType = "number";
  at.properties.index = -1;
  assertEquals(read(graph, at, "value"), 4);
  at.properties.index = 100;
  assertEquals(read(graph, at, "found"), false);
  assertEquals(read(graph, at, "value"), 0);
  concat.properties.first = [1, [2]];
  at.properties.index = 1;
  assertThrows(() => read(graph, at, "value"), Error, "must be a finite number");
  concat.properties.first = [1, 2];
  at.properties.index = Infinity;
  assertThrows(() => read(graph, at, "found"), Error, "finite number");
  const from = graph.add("array_from_json", 0, 0), to = graph.add("array_to_json", 0, 0);
  from.properties.json = ["a", null];
  graph.connect(from.id, "array", to.id, "array");
  assertEquals(read(graph, to, "json"), ["a", null]);
  from.properties.json = { array: [] };
  assertThrows(() => read(graph, from, "array"));
});
Deno.test("For Each waits for each branch and runs Done once, including empty input", async () => {
  for (const items of [["a", "b", "c"], []]) {
    const graph = new Graph();
    const loop = graph.add("array_for_each", 0, 0), body = graph.add("log", 0, 0), done = graph.add("log", 0, 0);
    loop.properties.array = items;
    loop.properties.itemType = "text";
    graph.connect(loop.id, "each", body.id, "flow");
    graph.connect(loop.id, "done", done.id, "flow");
    graph.connect(loop.id, "value", body.id, "message");
    const order: Value[] = [];
    await graph.run(async (node, properties) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      order.push(node.id === done.id ? "done" : [graph.results.get(loop.id)!.index, properties.message]);
      return {};
    });
    assertEquals(order, [...items.map((value, index) => [index, value]), "done"]);
  }
});
Deno.test("Map reads Result after execution, supports changing types and publishes only on Done", async () => {
  const graph = new Graph();
  const map = graph.add("array_map", 0, 0), script = graph.add("script", 0, 0), eachConsumer = graph.add("log", 0, 0);
  map.properties.array = [2, 4, 6];
  map.properties.itemType = "number";
  map.properties.resultType = "text";
  script.properties.inputPorts = [{ name: "item", type: "number" }];
  script.properties.outputPorts = [{ name: "result", type: "text" }];
  graph.connect(map.id, "each", script.id, "flow");
  graph.connect(map.id, "value", script.id, "arg_item");
  graph.connect(script.id, "result", map.id, "result");
  graph.connect(map.id, "done", eachConsumer.id, "flow");
  const copy = Graph.deserialize(graph.serialize());
  const order: string[] = [];
  await copy.run((node, properties) => {
    if (node.id === script.id) {
      assert(!Object.hasOwn(copy.results.get(map.id)!, "array"));
      order.push(String(properties.arg_item));
      return Promise.resolve({ result: `item ${properties.arg_item}` });
    }
    assertEquals(copy.results.get(map.id)?.array, ["item 2", "item 4", "item 6"]);
    order.push("done");
    return Promise.resolve({});
  });
  assertEquals(order, ["2", "4", "6", "done"]);
});
Deno.test("Map and Filter accept data-only Result connections without Each flow", async () => {
  const graph = new Graph();
  const map = graph.add("array_map", 0, 0),
    format = graph.add("string_format", 0, 0),
    filter = graph.add("array_filter", 0, 0),
    comparison = graph.add("comparison", 0, 0);
  map.properties.array = ["a", "b", "a"];
  map.properties.itemType = map.properties.resultType = "text";
  format.properties.template = "item {name}";
  graph.syncInputs();
  graph.connect(map.id, "value", format.id, "arg_name");
  graph.connect(format.id, "text", map.id, "result");
  graph.connect(map.id, "done", filter.id, "flow");
  graph.connect(map.id, "array", filter.id, "array");
  filter.properties.itemType = "text";
  comparison.properties.valueB = "item a";
  graph.connect(filter.id, "value", comparison.id, "valueA");
  graph.connect(comparison.id, "result", filter.id, "result");
  const copy = Graph.deserialize(graph.serialize());
  await copy.run(() => {
    throw new Error("Data-only results require no browser action");
  });
  assertEquals(copy.results.get(filter.id)?.array, ["item a", "item a"]);
  map.properties.array = [];
  await graph.run(() => Promise.resolve({}));
  assertEquals(graph.results.get(map.id)?.array, []);
  assertEquals(graph.results.get(filter.id)?.array, []);
});
Deno.test("nested For Each completes its inner loop before advancing the outer loop", async () => {
  const graph = new Graph();
  const outer = graph.add("array_for_each", 0, 0), inner = graph.add("array_for_each", 0, 0), body = graph.add("log", 0, 0);
  outer.properties.array = ["a", "b"];
  inner.properties.array = [10, 20];
  graph.connect(outer.id, "each", inner.id, "flow");
  graph.connect(inner.id, "each", body.id, "flow");
  const pairs: Value[] = [];
  await graph.run(() => {
    pairs.push([graph.results.get(outer.id)!.value, graph.results.get(inner.id)!.value]);
    return Promise.resolve({});
  });
  assertEquals(pairs, [["a", 10], ["a", 20], ["b", 10], ["b", 20]]);
});
Deno.test("Map rejects a Result from a branch skipped in the current iteration", async () => {
  const graph = new Graph();
  const map = graph.add("array_map", 0, 0), branch = graph.add("conditional", 0, 0), script = graph.add("script", 0, 0);
  map.properties.array = [true, false];
  map.properties.itemType = "boolean";
  map.properties.resultType = "text";
  graph.connect(map.id, "each", branch.id, "flow");
  graph.connect(map.id, "value", branch.id, "condition");
  graph.connect(branch.id, "true", script.id, "flow");
  graph.connect(script.id, "result", map.id, "result");
  await assertRejects(() => graph.run(() => Promise.resolve({ result: "first" })), Error, "must run before");
});
Deno.test("array loops reject mismatched values and explicit flow back to the loop", async () => {
  const graph = new Graph();
  const loop = graph.add("array_for_each", 0, 0), body = graph.add("log", 0, 0);
  loop.properties.array = [1];
  loop.properties.itemType = "text";
  graph.connect(loop.id, "each", body.id, "flow");
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "item 0 must be text");
  loop.properties.itemType = "number";
  graph.connect(body.id, "next", loop.id, "flow");
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "without wiring flow back");
  const filterGraph = new Graph(), filter = filterGraph.add("array_filter", 0, 0);
  filter.properties.array = [1];
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  filter.properties.result = "yes";
  await assertRejects(() => filterGraph.run(() => Promise.resolve({})), Error, "Result must be boolean");
});
Deno.test("For Each yields between iterations and cancellation never takes Done", async () => {
  const graph = new Graph();
  const loop = graph.add("array_for_each", 0, 0), body = graph.add("log", 0, 0), done = graph.add("log", 0, 0);
  loop.properties.array = Array.from({ length: 1000 }, (_, index) => index);
  graph.connect(loop.id, "each", body.id, "flow");
  graph.connect(loop.id, "done", done.id, "flow");
  const controller = new AbortController();
  let iterations = 0;
  const timer = setTimeout(() => controller.abort(new Error("Canceled")), 30);
  try {
    await assertRejects(
      () =>
        graph.run(
          (node) => {
            assertEquals(node.id, body.id);
            iterations++;
            return Promise.resolve({});
          },
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal,
        ),
      Error,
      "Canceled",
    );
    assert(iterations < 1000);
  } finally {
    clearTimeout(timer);
  }
});
Deno.test("Map snapshots its prior completed array when Done feeds another invocation", async () => {
  const graph = new Graph();
  const map = graph.add("array_map", 0, 0), script = graph.add("script", 0, 0), branch = graph.add("conditional", 0, 0), done = graph.add("log", 0, 0);
  map.properties.array = [0];
  map.properties.itemType = map.properties.resultType = "number";
  script.properties.inputPorts = [{ name: "value", type: "number" }];
  script.properties.outputPorts = [{ name: "result", type: "number" }, { name: "again", type: "boolean" }];
  graph.connect(map.id, "array", map.id, "array");
  graph.connect(map.id, "each", script.id, "flow");
  graph.connect(map.id, "value", script.id, "arg_value");
  graph.connect(script.id, "result", map.id, "result");
  graph.connect(map.id, "done", branch.id, "flow");
  graph.connect(script.id, "again", branch.id, "condition");
  graph.connect(branch.id, "true", map.id, "flow");
  graph.connect(branch.id, "false", done.id, "flow");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Feedback failed to advance")), 1000);
  const seen: Value[] = [];
  try {
    await graph.run(
      (node, properties) => {
        if (node.id !== script.id) return Promise.resolve({});
        const value = Number(properties.arg_value);
        seen.push(value);
        return Promise.resolve({ result: value + 1, again: value < 1 });
      },
      undefined,
      undefined,
      undefined,
      undefined,
      controller.signal,
    );
    assertEquals(seen, [0, 1]);
    assertEquals(graph.results.get(map.id)?.array, [2]);
  } finally {
    clearTimeout(timer);
  }
});
