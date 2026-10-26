import { assert, assertEquals } from "@std/assert";
import { Graph, type Value } from "web/graph.ts";
import { BrowserSession } from "web/runtime/browser.ts";
import { GraphRun, type RunEvent } from "web/runtime/graph_run.ts";

function source() {
  const callbacks = new Set<(values: Record<string, Value>) => void>();
  const session = new BrowserSession();
  session.getPage = () => Promise.resolve({} as Awaited<ReturnType<BrowserSession["getPage"]>>);
  session.onConsole = (callback) => {
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  };
  const emit = (message: string) => {
    for (const callback of [...callbacks]) callback({ message, level: "log" });
  };
  return { session, emit, count: () => callbacks.size };
}

Deno.test("a skipped listener never attaches or captures messages", async () => {
  const graph = new Graph(), branch = graph.add("conditional", 0, 0), listener = graph.add("console_trigger", 0, 0), log = graph.add("log", 0, 0);
  graph.connect(branch.id, "true", listener.id, "flow");
  graph.connect(listener.id, "event", log.id, "flow");
  const fixture = source(), events: RunEvent[] = [];
  const run = new GraphRun(graph, fixture.session, (event) => events.push(event));
  try {
    await run.start();
    assertEquals(fixture.count(), 0);
    assertEquals(events.at(-1), { type: "run-end", listening: false });
  } finally {
    run.stop();
  }
});

Deno.test("Sequence attaches a listener, captures work events, and removes it before later work", async () => {
  const graph = new Graph(), sequence = graph.add("sequence", 0, 0), listener = graph.add("console_trigger", 0, 0);
  const work = graph.add("script", 0, 0), remove = graph.add("remove_listener", 0, 0), later = graph.add("script", 0, 0), log = graph.add("log", 0, 0);
  graph.connect(sequence.id, "step_1", listener.id, "flow");
  graph.connect(sequence.id, "step_2", work.id, "flow");
  graph.connect(sequence.id, "step_3", remove.id, "flow");
  graph.connect(sequence.id, "step_4", later.id, "flow");
  graph.connect(listener.id, "listener", remove.id, "listener");
  graph.connect(listener.id, "event", log.id, "flow");
  graph.connect(listener.id, "message", log.id, "message");
  const fixture = source(), events: RunEvent[] = [], counts: number[] = [];
  fixture.session.execute = () => {
    counts.push(fixture.count());
    fixture.emit("message");
    return Promise.resolve({ output: { result: "done" }, screenshot: new Uint8Array() });
  };
  const run = new GraphRun(graph, fixture.session, (event) => events.push(event));
  try {
    await run.start();
    assertEquals(counts, [1, 0]);
    assertEquals(graph.results.get(remove.id), { removed: true });
    assertEquals(fixture.count(), 0);
    assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["message"]);
    assertEquals(events.filter((event) => event.type === "error"), []);
    assertEquals(events.at(-1), { type: "run-end", listening: false });
  } finally {
    run.stop();
  }
});

Deno.test("self-removal lets captured messages finish, ignores future messages, and reports repeated removal", async () => {
  const graph = new Graph(), listener = graph.add("console_trigger", 0, 0), work = graph.add("script", 0, 0);
  const remove = graph.add("remove_listener", 0, 0), again = graph.add("remove_listener", 0, 0), log = graph.add("log", 0, 0);
  graph.connect(listener.id, "next", work.id, "flow");
  graph.connect(listener.id, "event", remove.id, "flow");
  graph.connect(remove.id, "next", again.id, "flow");
  graph.connect(again.id, "next", log.id, "flow");
  graph.connect(listener.id, "listener", remove.id, "listener");
  graph.connect(listener.id, "listener", again.id, "listener");
  graph.connect(listener.id, "message", log.id, "message");
  const fixture = source(), events: RunEvent[] = [];
  fixture.session.execute = () => {
    fixture.emit("first");
    fixture.emit("second");
    return Promise.resolve({ output: {}, screenshot: new Uint8Array() });
  };
  const run = new GraphRun(graph, fixture.session, (event) => {
    events.push(event);
    if (event.type === "log") fixture.emit("too late");
  });
  try {
    await run.start();
    assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["first", "second"]);
    assertEquals(events.filter((event) => event.type === "error"), []);
    assertEquals(events.flatMap((event) => event.type === "node-end" && event.nodeId === remove.id ? [event.values.removed] : []), [true, false]);
    assertEquals(graph.results.get(again.id), { removed: false });
    assertEquals(fixture.count(), 0);
    assertEquals(events.at(-1), { type: "run-end", listening: false });
  } finally {
    run.stop();
  }
});

Deno.test("removing one listener keeps another attached and Stop releases the remainder", async () => {
  const graph = new Graph(),
    first = graph.add("console_trigger", 0, 0),
    second = graph.add("console_trigger", 0, 0),
    remove = graph.add("remove_listener", 0, 0);
  graph.connect(first.id, "next", second.id, "flow");
  graph.connect(second.id, "next", remove.id, "flow");
  graph.connect(first.id, "listener", remove.id, "listener");
  const fixture = source(), events: RunEvent[] = [];
  const run = new GraphRun(Graph.deserialize(graph.serialize()), fixture.session, (event) => events.push(event));
  await run.start();
  assertEquals(fixture.count(), 1);
  assertEquals(events.filter((event) => event.type === "error"), []);
  assertEquals(events.at(-1), { type: "run-end", listening: true });
  run.stop();
  assertEquals(fixture.count(), 0);
});

Deno.test("event branches retain startup data and clear stale branch results between callbacks", async () => {
  const graph = new Graph(), listener = graph.add("console_trigger", 0, 0), startup = graph.add("page_info", 0, 0);
  const branch = graph.add("conditional", 0, 0), script = graph.add("script", 0, 0), first = graph.add("log", 0, 0), stale = graph.add("log", 0, 0);
  graph.connect(listener.id, "next", startup.id, "flow");
  graph.connect(listener.id, "event", branch.id, "flow");
  const comparison = graph.add("comparison", 0, 0);
  comparison.properties.valueB = "first";
  graph.connect(listener.id, "message", comparison.id, "valueA");
  graph.connect(comparison.id, "result", branch.id, "condition");
  graph.connect(branch.id, "true", script.id, "flow");
  graph.connect(startup.id, "title", script.id, "arg_text");
  graph.connect(script.id, "next", first.id, "flow");
  graph.connect(script.id, "result", first.id, "message");
  graph.connect(branch.id, "false", stale.id, "flow");
  graph.connect(script.id, "result", stale.id, "message");
  const fixture = source(), events: RunEvent[] = [];
  fixture.session.execute = (type, properties) => {
    if (type === "page_info") {
      fixture.emit("first");
      fixture.emit("second");
      return Promise.resolve({ output: { title: "startup" }, screenshot: new Uint8Array() });
    }
    assertEquals((properties as Record<string, Value>).arg_text, "startup");
    return Promise.resolve({ output: { result: "fresh" }, screenshot: new Uint8Array() });
  };
  const run = new GraphRun(graph, fixture.session, (event) => events.push(event));
  await run.start();
  assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["fresh"]);
  assert(events.some((event) => event.type === "error" && event.error.includes("must run before")));
  assertEquals(fixture.count(), 0, "Failure releases active listeners");
});
