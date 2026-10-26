import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph, type MacroDefinition, type Value } from "web/graph.ts";
Deno.test("selection macros copy internal links and handles, preserve properties and omit outside blocks", async () => {
  const graph = new Graph(),
    source = graph.add("text_literal", -200, 500),
    first = graph.add("log", -200, -100),
    second = graph.add("log", 300, -100),
    outside = graph.add("log", 900, -100);
  source.properties.value = "selected";
  second.properties.message = "second";
  graph.connect(source.id, "text", first.id, "message");
  graph.connect(first.id, "next", second.id, "flow");
  graph.links[1].handles = [{ x: 100, y: -300 }];
  graph.connect(second.id, "next", outside.id, "flow");
  const original = graph.serialize();
  const selection = graph.copySelection(new Set([source.id, first.id, second.id]));
  assertEquals(graph.serialize(), original);
  assertEquals(selection.nodes.map((node) => node.id), [source.id, first.id, second.id]);
  assertEquals(selection.links.length, 2);
  assertEquals(selection.links[1].handles, [{ x: 330, y: 30 }]);
  assertEquals([selection.node(first.id).xPos, selection.node(first.id).yPos], [30, 230]);
  assertEquals([selection.node(second.id).xPos, selection.node(second.id).yPos], [530, 230]);
  const messages: Value[] = [];
  await selection.run((_node, properties) => {
    messages.push(properties.message);
    return Promise.resolve({});
  });
  assertEquals(messages, ["selected", "second"]);
  assertThrows(() => graph.copySelection(new Set()), Error, "Select at least one block");
  assertThrows(() => graph.copySelection(new Set(["node_missing"])), Error, "Select at least one block");
});
function definition(name: string, graph: Graph): MacroDefinition {
  return { id: `macro_${name}`, name, graph: graph.serialize() };
}
Deno.test("macros persist as a flat library and execute nested calls before Next", async () => {
  const leaf = new Graph(), log = leaf.add("log", 0, 0);
  log.properties.message = "leaf";
  const parent = new Graph(), call = parent.add("macro", 0, 0), after = parent.add("log", 0, 0);
  call.properties.macroId = "macro_leaf";
  after.properties.message = "parent done";
  parent.connect(call.id, "next", after.id, "flow");
  const graph = new Graph(), first = graph.add("macro", 0, 0), second = graph.add("macro", 0, 0), end = graph.add("log", 0, 0);
  first.properties.macroId = second.properties.macroId = "macro_parent";
  end.properties.message = "done";
  graph.connect(first.id, "next", second.id, "flow");
  graph.connect(second.id, "next", end.id, "flow");
  graph.macros = [definition("leaf", leaf), definition("parent", parent)];
  const copy = Graph.deserialize(graph.serialize());
  assertEquals(copy.serialize(), graph.serialize());
  const messages: Value[] = [], visible: string[] = [];
  await copy.run(
    (_node, properties) => {
      messages.push(properties.message);
      return Promise.resolve({});
    },
    undefined,
    undefined,
    undefined,
    (event) => {
      if (event.type === "node-start") visible.push(event.nodeId);
    },
  );
  assertEquals(messages, ["leaf", "parent done", "leaf", "parent done", "done"]);
  assertEquals(visible, [first.id, second.id, end.id]);
});
Deno.test("each macro invocation starts with fresh feedback values", async () => {
  const body = new Graph(), script = body.add("script", 0, 0);
  script.properties.inputPorts = [{ name: "count", type: "number" }];
  script.properties.outputPorts = [{ name: "count", type: "number" }];
  script.properties.arg_count = 0;
  body.connect(script.id, "count", script.id, "arg_count");
  const graph = new Graph(), first = graph.add("macro", 0, 0), second = graph.add("macro", 0, 0);
  first.properties.macroId = second.properties.macroId = "macro_body";
  graph.connect(first.id, "next", second.id, "flow");
  graph.macros = [definition("body", body)];
  const seen: Value[] = [];
  await graph.run((_node, properties) => {
    seen.push(properties.arg_count);
    return Promise.resolve({ count: 1 });
  });
  assertEquals(seen, [0, 0]);
});
Deno.test("direct and indirect macro recursion yield and abort the entire call chain", async () => {
  for (const indirect of [false, true]) {
    const a = new Graph(), log = a.add("log", 0, 0), call = a.add("macro", 0, 0);
    a.connect(log.id, "next", call.id, "flow");
    call.properties.macroId = indirect ? "macro_b" : "macro_a";
    const b = new Graph(), back = b.add("macro", 0, 0);
    back.properties.macroId = "macro_a";
    const graph = new Graph(), entry = graph.add("macro", 0, 0), done = graph.add("log", 0, 0);
    entry.properties.macroId = "macro_a";
    graph.connect(entry.id, "next", done.id, "flow");
    graph.macros = [definition("a", a), ...(indirect ? [definition("b", b)] : [])];
    const controller = new AbortController();
    let calls = 0;
    const timer = setTimeout(() => controller.abort(new Error("Recursion did not yield")), 5000);
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await assertRejects(
        () =>
          graph.run(
            (node) => {
              assertEquals(node.id, log.id);
              calls++;
              if (calls === 5) stopTimer = setTimeout(() => controller.abort(new Error("Stopped recursion")), 0);
              return Promise.resolve({});
            },
            undefined,
            undefined,
            undefined,
            undefined,
            controller.signal,
          ),
        Error,
        "Stopped recursion",
      );
      assert(calls >= 5);
    } finally {
      clearTimeout(timer);
      clearTimeout(stopTimer);
    }
  }
});
Deno.test("macro calls fail clearly for missing graphs and console triggers", async () => {
  const graph = new Graph(), call = graph.add("macro", 0, 0);
  call.properties.macroId = "macro_missing";
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "existing macro");
  const trigger = new Graph();
  trigger.add("console_trigger", 0, 0);
  graph.macros = [definition("missing", trigger)];
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "contains a console trigger");
});
Deno.test("macro imports reject duplicate IDs, malformed graphs and embedded libraries", () => {
  const graph = new Graph(), body = new Graph();
  body.add("log", 0, 0);
  const macro = definition("body", body);
  const saved = graph.serialize();
  assertThrows(() => Graph.deserialize({ ...saved, macros: [macro, macro] }));
  assertThrows(() => Graph.deserialize({ ...saved, macros: [{ ...macro, graph: { version: 2 } }] }));
  assertThrows(() => Graph.deserialize({ ...saved, macros: [{ ...macro, graph: { ...macro.graph, macros: [macro] } }] }));
  assertThrows(() => Graph.deserialize({ ...saved, macros: [{ ...macro, id: "bad id" }] }));
});
