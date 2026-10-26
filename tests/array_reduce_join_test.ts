import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph, type Value } from "web/graph.ts";
Deno.test("Array Join handles separators, mixed values and graph persistence", () => {
  const graph = new Graph(), join = graph.add("array_join", 0, 0), separator = graph.add("text_literal", 0, 0);
  const read = () => join.dataValue("text", (key) => graph.value(join, key));
  assertEquals(read(), "");
  join.properties.array = ["a", 0, false, null, [1, 2], { name: "test" }];
  assertEquals(read(), "a,0,false,,1,2,[object Object]");
  separator.properties.value = " | ";
  graph.connect(separator.id, "text", join.id, "separator");
  assertEquals(read(), "a | 0 | false |  | 1,2 | [object Object]");
  separator.properties.value = "";
  assertEquals(read(), "a0false1,2[object Object]");
  assertEquals(join.properties.array, ["a", 0, false, null, [1, 2], { name: "test" }]);
  const copy = Graph.deserialize(graph.serialize());
  assertEquals(copy.serialize(), graph.serialize());
  assertEquals(copy.node(join.id).dataValue("text", (key) => copy.value(copy.node(join.id), key)), read());
  graph.disconnect(new Set([separator.id]));
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  join.properties.separator = 2;
  assertThrows(read, Error, "Separator must be text");
  join.properties.separator = ",";
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  join.properties.array = {};
  assertThrows(read, Error, "Expected an array");
});
function numericReduce(items: Value[] = [2, 4, 6]) {
  const graph = new Graph(), reduce = graph.add("array_reduce", 0, 0), script = graph.add("script", 0, 0), done = graph.add("log", 0, 0);
  Object.assign(reduce.properties, { array: items, itemType: "number", resultType: "number", initial: 10 });
  script.properties.inputPorts = [{ name: "accumulator", type: "number" }, { name: "value", type: "number" }, { name: "index", type: "number" }];
  script.properties.outputPorts = [{ name: "result", type: "number" }];
  graph.connect(reduce.id, "each", script.id, "flow");
  graph.connect(reduce.id, "accumulator", script.id, "arg_accumulator");
  graph.connect(reduce.id, "value", script.id, "arg_value");
  graph.connect(reduce.id, "index", script.id, "arg_index");
  graph.connect(script.id, "result", reduce.id, "result");
  graph.connect(reduce.id, "done", done.id, "flow");
  return { graph, reduce, script, done };
}
Deno.test("Reduce awaits Each, advances Accumulator and exposes Completed result only on Done", async () => {
  const { graph, reduce, script, done } = numericReduce();
  const copy = Graph.deserialize(graph.serialize()), seen: Value[] = [];
  await copy.run(async (node, properties): Promise<Record<string, Value>> => {
    if (node.id === script.id) {
      assert(!Object.hasOwn(copy.results.get(reduce.id)!, "result"));
      seen.push([properties.arg_index, properties.arg_accumulator, properties.arg_value]);
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { result: Number(properties.arg_accumulator) + Number(properties.arg_value) };
    }
    assertEquals(node.id, done.id);
    assertEquals(copy.results.get(reduce.id)?.result, 22);
    seen.push("done");
    return {};
  });
  assertEquals(seen, [[0, 10, 2], [1, 12, 4], [2, 16, 6], "done"]);
  assertEquals(graph.node(reduce.id).properties.array, [2, 4, 6]);
});
Deno.test("Reduce supports data-only feedback, different types, empty arrays and repeated runs", async () => {
  const graph = new Graph(), reduce = graph.add("array_reduce", 0, 0), concat = graph.add("string_concat", 0, 0), at = graph.add("array_at", 0, 0);
  Object.assign(reduce.properties, { array: [["a"], ["b"]], itemType: "array", resultType: "text", initial: "start:" });
  at.properties.itemType = "text";
  graph.connect(reduce.id, "value", at.id, "array");
  graph.connect(reduce.id, "accumulator", concat.id, "part_1");
  graph.connect(at.id, "value", concat.id, "part_2");
  graph.connect(concat.id, "text", reduce.id, "result");
  const run = () =>
    graph.run(() => {
      throw new Error("No browser execution expected");
    });
  await run();
  assertEquals(graph.results.get(reduce.id)?.result, "start:ab");
  reduce.properties.array = [];
  await run();
  assertEquals(graph.results.get(reduce.id), { accumulator: "start:", result: "start:" });
  reduce.properties.array = [["c"]];
  await run();
  assertEquals(graph.results.get(reduce.id)?.result, "start:c");
});
Deno.test("Reduce rejects incompatible values, skipped Results and Each flow back to itself", async () => {
  const { graph, reduce, script } = numericReduce();
  reduce.properties.initial = "invalid";
  await assertRejects(() => graph.run(() => Promise.resolve({ result: 1 })), Error, "Initial value must be number");
  reduce.properties.initial = 0;
  await assertRejects(() => graph.run(() => Promise.resolve({ result: "invalid" })), Error, "Result must be number");
  reduce.properties.array = [true];
  await assertRejects(() => graph.run(() => Promise.resolve({ result: 1 })), Error, "item 0 must be number");
  reduce.properties.array = [1];
  graph.connect(script.id, "next", reduce.id, "flow");
  await assertRejects(() => graph.run(() => Promise.resolve({ result: 1 })), Error, "without wiring flow back");
  const skipped = new Graph(), loop = skipped.add("array_reduce", 0, 0), branch = skipped.add("conditional", 0, 0), body = skipped.add("script", 0, 0);
  Object.assign(loop.properties, { array: [true, false], itemType: "boolean", resultType: "text", initial: "" });
  skipped.connect(loop.id, "each", branch.id, "flow");
  skipped.connect(loop.id, "value", branch.id, "condition");
  skipped.connect(branch.id, "true", body.id, "flow");
  skipped.connect(body.id, "result", loop.id, "result");
  await assertRejects(() => skipped.run(() => Promise.resolve({ result: "first" })), Error, "must run before");
});
Deno.test("Reduce type changes prune incompatible ports and cancellation skips Done", async () => {
  const { graph, reduce, script } = numericReduce(Array.from({ length: 1000 }, () => 1));
  const controller = new AbortController();
  let iterations = 0;
  const timer = setTimeout(() => controller.abort(new Error("Canceled")), 30);
  try {
    await assertRejects(
      () =>
        graph.run(
          (node) => {
            assertEquals(node.id, script.id);
            iterations++;
            return Promise.resolve({ result: 1 });
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
    assert(!Object.hasOwn(graph.results.get(reduce.id) ?? {}, "result"));
  } finally {
    clearTimeout(timer);
  }
  reduce.properties.resultType = "array";
  graph.syncInputs();
  assertEquals(reduce.properties.initial, []);
  assertEquals(reduce.properties.result, []);
  assert(!graph.links.some((link) => link.from === reduce.id && link.output === "accumulator"));
  assert(!graph.links.some((link) => link.to === reduce.id && link.input === "result"));
});
