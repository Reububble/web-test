import { assert, assertEquals, assertRejects } from "@std/assert";
import { Graph, type Value } from "web/graph.ts";
const modes = ["array_some", "array_every"] as const;
Deno.test("Some and Every await predicates, short circuit, and publish a boolean only on Done", async () => {
  for (const mode of modes) {
    for (const values of [[], [true, true], [false, false], [false, true, false], [true, false, true]]) {
      const graph = new Graph();
      const loop = graph.add(mode, 0, 0), body = graph.add("script", 300, 0), done = graph.add("log", 600, 0);
      loop.properties.array = values;
      loop.properties.itemType = "boolean";
      body.properties.inputPorts = [{ name: "value", type: "boolean" }];
      body.properties.outputPorts = [{ name: "result", type: "boolean" }];
      graph.connect(loop.id, "each", body.id, "flow");
      graph.connect(loop.id, "value", body.id, "arg_value");
      graph.connect(body.id, "result", loop.id, "result");
      graph.connect(loop.id, "done", done.id, "flow");
      const copy = Graph.deserialize(graph.serialize());
      assertEquals(copy.serialize(), graph.serialize());
      const expected = mode === "array_some" ? values.some(Boolean) : values.every(Boolean);
      const decisive = values.findIndex((value) => value === (mode === "array_some"));
      const visits: number[] = [];
      let completions = 0;
      await copy.run(async (node, properties): Promise<Record<string, Value>> => {
        if (node.id === body.id) {
          assert(!Object.hasOwn(copy.results.get(loop.id)!, "result"));
          visits.push(Number(copy.results.get(loop.id)!.index));
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { result: properties.arg_value };
        }
        assertEquals(copy.results.get(loop.id)?.result, expected);
        completions++;
        return {};
      });
      assertEquals(visits, Array.from({ length: decisive < 0 ? values.length : decisive + 1 }, (_, index) => index));
      assertEquals(completions, 1);
    }
  }
});
Deno.test("Some and Every support data-only predicates and reset on repeated runs", async () => {
  for (const mode of modes) {
    const graph = new Graph(), loop = graph.add(mode, 0, 0), comparison = graph.add("number_comparison", 300, 0), branch = graph.add("conditional", 600, 0);
    loop.properties.itemType = "number";
    comparison.properties.operator = "greater";
    graph.connect(loop.id, "value", comparison.id, "valueA");
    graph.connect(comparison.id, "result", loop.id, "result");
    graph.connect(loop.id, "done", branch.id, "flow");
    graph.connect(loop.id, "result", branch.id, "condition");
    for (const values of [[1, 2], [-1, -2], [-1, 2], []]) {
      loop.properties.array = values;
      await graph.run(() => {
        throw new Error("No executor needed");
      });
      assertEquals(graph.results.get(loop.id)?.result, mode === "array_some" ? values.some((value) => value > 0) : values.every((value) => value > 0));
    }
  }
});
Deno.test("Some and Every reject invalid predicates and skipped stale results", async () => {
  for (const mode of modes) {
    const graph = new Graph(), loop = graph.add(mode, 0, 0);
    loop.properties.array = [1];
    // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
    loop.properties.result = "yes";
    await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "Result must be boolean");
    loop.properties.result = false;
    loop.properties.itemType = "text";
    await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "item 0 must be text");
    loop.properties.itemType = "boolean";
    loop.properties.array = [true, false];
    const branch = graph.add("conditional", 300, 0), body = graph.add("script", 600, 0);
    body.properties.outputPorts = [{ name: "result", type: "boolean" }];
    graph.connect(loop.id, "each", branch.id, "flow");
    graph.connect(loop.id, "value", branch.id, "condition");
    graph.connect(branch.id, "true", body.id, "flow");
    graph.connect(body.id, "result", loop.id, "result");
    await assertRejects(() => graph.run(() => Promise.resolve({ result: mode === "array_every" })), Error, "must run before");
  }
});
Deno.test("Some and Every stop without publishing a result or taking Done on cancellation", async () => {
  for (const mode of modes) {
    const graph = new Graph(), loop = graph.add(mode, 0, 0), body = graph.add("log", 300, 0), done = graph.add("log", 600, 0);
    loop.properties.array = [1, 2, 3];
    loop.properties.result = mode === "array_every";
    graph.connect(loop.id, "each", body.id, "flow");
    graph.connect(loop.id, "done", done.id, "flow");
    const controller = new AbortController();
    await assertRejects(
      () =>
        graph.run(
          (node) => {
            assertEquals(node.id, body.id);
            controller.abort(new Error("Canceled"));
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
    assert(!Object.hasOwn(graph.results.get(loop.id)!, "result"));
  }
});
