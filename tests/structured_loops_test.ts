import { assertEquals, assertRejects } from "@std/assert";
import { Graph, type GraphNode, type Value } from "web-test/graph.ts";
Deno.test("While and For Break exit on a condition, take Done once, and reset on rerun", async () => {
  for (const type of ["while", "for"] as const) {
    const graph = new Graph(),
      loop = graph.add(type, 0, 0),
      body = graph.add("log", 0, 0),
      condition = graph.add("number_comparison", 0, 0),
      branch = graph.add("conditional", 0, 0),
      done = graph.add("log", 0, 0);
    if ("condition" in loop.properties) loop.properties.condition = true;
    if ("end" in loop.properties) loop.properties.end = 100;
    condition.properties.operator = "greater_equal";
    condition.properties.valueB = 2;
    graph.connect(loop.id, "each", body.id, "flow");
    graph.connect(body.id, "next", branch.id, "flow");
    graph.connect(loop.id, "index", condition.id, "valueA");
    graph.connect(condition.id, "result", branch.id, "condition");
    graph.connect(branch.id, "true", loop.id, "break");
    graph.connect(loop.id, "done", done.id, "flow");
    const copy = Graph.deserialize(graph.serialize());
    assertEquals(copy.serialize(), graph.serialize());
    for (let run = 0; run < 2; run++) {
      const visits: Value[] = [];
      await copy.run(async (node) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        visits.push(node.id === body.id ? copy.results.get(loop.id)!.index : "done");
        return {};
      });
      assertEquals(visits, [0, 1, 2, "done"]);
      assertEquals(copy.results.get(loop.id)?.index, 2);
    }
  }
});
Deno.test("nested Break targets the chosen loop and skips inner Done when exiting an outer loop", async () => {
  for (const outerType of ["while", "for"] as const) {
    for (const targetOuter of [false, true]) {
      const graph = new Graph(),
        outer = graph.add(outerType, 0, 0),
        inner = graph.add(outerType === "while" ? "for" : "while", 0, 0),
        compare = graph.add("number_comparison", 0, 0),
        body = graph.add("log", 0, 0),
        innerDone = graph.add("log", 0, 0),
        outerDone = graph.add("log", 0, 0);
      if ("end" in outer.properties) outer.properties.end = 2;
      compare.properties.operator = "less";
      compare.properties.valueB = 2;
      if (outerType === "while") {
        graph.connect(outer.id, "index", compare.id, "valueA");
        graph.connect(compare.id, "result", outer.id, "condition");
      }
      if ("condition" in inner.properties) inner.properties.condition = true;
      graph.connect(outer.id, "each", inner.id, "flow");
      graph.connect(inner.id, "each", body.id, "flow");
      graph.connect(body.id, "next", targetOuter ? outer.id : inner.id, "break");
      graph.connect(inner.id, "done", innerDone.id, "flow");
      graph.connect(outer.id, "done", outerDone.id, "flow");
      const order: string[] = [];
      await graph.run((node) => {
        order.push(node.id === body.id ? "body" : node.id === innerDone.id ? "inner done" : "outer done");
        return Promise.resolve({});
      });
      assertEquals(order, targetOuter ? ["body", "outer done"] : ["body", "inner done", "body", "inner done", "outer done"]);
    }
  }
});
Deno.test("Break runs Finally without being caught as an error", async () => {
  for (const type of ["while", "for"] as const) {
    for (const breakingBranch of ["try", "catch", "finally"] as const) {
      const graph = new Graph(),
        loop = graph.add(type, 0, 0),
        handler = graph.add("try_catch_finally", 0, 0),
        body = graph.add("log", 0, 0),
        caught = graph.add("log", 0, 0),
        cleanup = graph.add("log", 0, 0),
        after = graph.add("log", 0, 0),
        done = graph.add("log", 0, 0);
      if ("condition" in loop.properties) loop.properties.condition = true;
      graph.connect(loop.id, "each", handler.id, "flow");
      graph.connect(handler.id, "try", body.id, "flow");
      graph.connect(handler.id, "catch", caught.id, "flow");
      graph.connect(handler.id, "finally", cleanup.id, "flow");
      graph.connect(handler.id, "next", after.id, "flow");
      graph.connect(loop.id, "done", done.id, "flow");
      graph.connect(breakingBranch === "try" ? body.id : breakingBranch === "catch" ? caught.id : cleanup.id, "next", loop.id, "break");
      const order: string[] = [];
      await graph.run((node) => {
        if (node.id === body.id && breakingBranch === "catch") throw new Error("Handled");
        order.push(
          node.id === body.id ? "body" : node.id === caught.id ? "catch" : node.id === cleanup.id ? "finally" : node.id === done.id ? "done" : "after",
        );
        return Promise.resolve({});
      });
      assertEquals(order, breakingBranch === "catch" ? ["catch", "finally", "done"] : ["body", "finally", "done"]);
    }
  }
});
Deno.test("Break rejects inactive targets and supports direct Each to Break", async () => {
  for (const type of ["while", "for"] as const) {
    const graph = new Graph(), loop = graph.add(type, 0, 0), done = graph.add("log", 0, 0);
    if ("condition" in loop.properties) loop.properties.condition = true;
    graph.connect(loop.id, "each", loop.id, "break");
    graph.connect(loop.id, "done", done.id, "flow");
    let completions = 0;
    await graph.run(() => {
      completions++;
      return Promise.resolve({});
    });
    assertEquals(completions, 1);
    graph.connect(done.id, "next", loop.id, "break");
    await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "Break requires an active loop");
  }
});
Deno.test("For visits exclusive numeric ranges in both directions and takes Done once", async () => {
  for (
    const [start, end, step, expected] of [[0, 3, 1, [0, 1, 2]], [3, 0, -1, [3, 2, 1]], [0, 1, 0.25, [0, 0.25, 0.5, 0.75]], [3, 3, 1, []], [3, 0, 1, []], [
      0,
      3,
      -1,
      [],
    ]] as const
  ) {
    const graph = new Graph(), loop = graph.add("for", 0, 0), body = graph.add("script", 0, 0), done = graph.add("log", 0, 0);
    Object.assign(loop.properties, { start, end, step });
    body.properties.inputPorts = [{ name: "index", type: "number" }, { name: "value", type: "number" }];
    graph.connect(loop.id, "each", body.id, "flow");
    graph.connect(loop.id, "index", body.id, "arg_index");
    graph.connect(loop.id, "value", body.id, "arg_value");
    graph.connect(loop.id, "done", done.id, "flow");
    const copy = Graph.deserialize(graph.serialize());
    const visits: Value[] = [];
    await copy.run(async (node, properties) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      visits.push(node.id === body.id ? [properties.arg_index, properties.arg_value] : "done");
      return {};
    });
    assertEquals(visits, [...expected.map((value, index) => [index, value]), "done"]);
  }
});
Deno.test("For snapshots connected bounds and rejects steps that cannot advance", async () => {
  const graph = new Graph(), loop = graph.add("for", 0, 0), end = graph.add("number_literal", 0, 0), body = graph.add("log", 0, 0);
  end.properties.value = 3;
  graph.connect(end.id, "number", loop.id, "end");
  graph.connect(loop.id, "each", body.id, "flow");
  const values: Value[] = [];
  await graph.run(() => {
    values.push(graph.results.get(loop.id)!.value);
    end.properties.value = 0;
    return Promise.resolve({});
  });
  assertEquals(values, [0, 1, 2]);
  graph.disconnect(new Set([end.id]));
  loop.properties.step = 0;
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "nonzero");
  loop.properties.step = NaN;
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "finite number");
  Object.assign(loop.properties, { start: 1e16, end: 1e16 + 4, step: 1 });
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "too small to advance");
});
Deno.test("While reevaluates its connected condition before Each and stops at false", async () => {
  for (const limit of [0, 3]) {
    const graph = new Graph(),
      loop = graph.add("while", 0, 0),
      compare = graph.add("number_comparison", 0, 0),
      body = graph.add("log", 0, 0),
      done = graph.add("log", 0, 0);
    compare.properties.operator = "less";
    compare.properties.valueB = limit;
    graph.connect(loop.id, "index", compare.id, "valueA");
    graph.connect(compare.id, "result", loop.id, "condition");
    graph.connect(loop.id, "each", body.id, "flow");
    graph.connect(loop.id, "done", done.id, "flow");
    const copy = Graph.deserialize(graph.serialize()), visits: Value[] = [];
    await copy.run((node) => {
      visits.push(node.id === body.id ? copy.results.get(loop.id)!.index : "done");
      return Promise.resolve({});
    });
    assertEquals(visits, [...Array.from({ length: limit }, (_, index) => index), "done"]);
    assertEquals(copy.results.get(loop.id)?.index, limit);
  }
});
Deno.test("While reads a body output after completion and rejects a skipped stale condition", async () => {
  const graph = new Graph(),
    loop = graph.add("while", 0, 0),
    select = graph.add("conditional_value", 0, 0),
    first = graph.add("number_comparison", 0, 0),
    body = graph.add("script", 0, 0);
  first.properties.operator = "equals";
  graph.connect(loop.id, "index", first.id, "valueA");
  select.properties.valueType = "boolean";
  select.properties.trueValue = true;
  graph.connect(first.id, "result", select.id, "condition");
  body.properties.outputPorts = [{ name: "again", type: "boolean" }];
  graph.connect(body.id, "again", select.id, "falseValue");
  graph.connect(select.id, "value", loop.id, "condition");
  graph.connect(loop.id, "each", body.id, "flow");
  let executions = 0;
  await graph.run(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    executions++;
    return { again: executions < 3 };
  });
  assertEquals(executions, 3);
  const branch = graph.add("conditional", 0, 0);
  branch.properties.condition = true;
  graph.connect(loop.id, "each", branch.id, "flow");
  graph.connect(branch.id, "true", body.id, "flow");
  await assertRejects(
    () =>
      graph.run(() => {
        branch.properties.condition = false;
        return Promise.resolve({ again: true });
      }),
    Error,
    "must run before",
  );
});
Deno.test("While nests inside For and For Each without changing its parent values", async () => {
  for (const outerType of ["for", "array_for_each"] as const) {
    const graph = new Graph(),
      outer = graph.add(outerType, 0, 0),
      inner = graph.add("while", 0, 0),
      compare = graph.add("number_comparison", 0, 0),
      body = graph.add("log", 0, 0);
    if ("end" in outer.properties) outer.properties.end = 2;
    if ("array" in outer.properties) outer.properties.array = [0, 1];
    compare.properties.operator = "less";
    compare.properties.valueB = 2;
    graph.connect(inner.id, "index", compare.id, "valueA");
    graph.connect(compare.id, "result", inner.id, "condition");
    graph.connect(outer.id, "each", inner.id, "flow");
    graph.connect(inner.id, "each", body.id, "flow");
    const pairs: Value[] = [];
    await graph.run(() => {
      pairs.push([graph.results.get(outer.id)!.value, graph.results.get(inner.id)!.index]);
      return Promise.resolve({});
    });
    assertEquals(pairs, [[0, 0], [0, 1], [1, 0], [1, 1]]);
  }
});
Deno.test("While and For stay cancellable with empty bodies and never take Done on cancellation", async () => {
  for (const type of ["while", "for"] as const) {
    const graph = new Graph(), loop = graph.add(type, 0, 0), done = graph.add("log", 0, 0);
    if ("condition" in loop.properties) loop.properties.condition = true;
    if ("end" in loop.properties) loop.properties.end = 1e9;
    graph.connect(loop.id, "done", done.id, "flow");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Canceled")), 50);
    try {
      await assertRejects(
        () =>
          graph.run(
            () => {
              throw new Error("Done must not run after cancellation");
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
    } finally {
      clearTimeout(timer);
    }
  }
});
Deno.test("While validates Condition and structured loops reject a flow connection back", async () => {
  const graph = new Graph(), loop = graph.add("while", 0, 0);
  const untrusted: GraphNode = loop;
  untrusted.properties.condition = 1;
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "Condition must be boolean");
  if ("condition" in loop.properties) loop.properties.condition = true;
  const body = graph.add("log", 0, 0);
  graph.connect(loop.id, "each", body.id, "flow");
  graph.connect(body.id, "next", loop.id, "flow");
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "without wiring flow back");
});
