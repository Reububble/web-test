import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph, inputs, type NodeType, outputs, type Value } from "web-test/graph.ts";
import { nodeClasses } from "web-test/nodes/index.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { BrowserSession, InvalidAction } from "web-test/runtime/browser.ts";
import { GraphRun } from "web-test/runtime/graph_run.ts";
import type { RunEvent } from "web-test/run_events.ts";

/** Authoring checks remain strict across data, browser and configured-control definitions. */
export function declarativeNodeTypeChecks(): void {
  const badDefault = {
    kind: "data",
    type: "number_literal",
    title: "Number",
    inputs: { value: { label: "Value", type: "number" } },
    outputs: { number: { label: "Number", type: "number" } },
    properties: () => ({ value: "wrong" }),
    process: ({ value }: { value: number }) => ({ number: value }),
  } as const;
  defineNode({ ...badDefault, properties: () => ({ value: 0 }) });
  // @ts-expect-error Static defaults must match the input descriptors.
  defineNode(badDefault);
  const badOutput = { ...badDefault, properties: () => ({ value: 0 }), process: ({ value }: { value: number }) => ({ number: String(value) }) };
  // @ts-expect-error Process outputs must match the output descriptors.
  defineNode(badOutput);
  const browserDefinition = { ...badDefault, kind: "browser", properties: () => ({ value: 0 }) } as const;
  defineNode(browserDefinition);
  // @ts-expect-error Browser process outputs must also match the output descriptors.
  defineNode({ ...browserDefinition, process: () => ({ number: "wrong" }) });
  // @ts-expect-error Browser nodes must define their behavior alongside their ports.
  defineNode({ ...browserDefinition, process: undefined });
  defineNode({
    kind: "data",
    type: "number_literal",
    title: "Number",
    inputs: { value: { label: "Value", type: "number" } },
    outputs: { number: { label: "Number", type: "number" } },
    properties: () => ({ value: 0 }),
    process(inputs) {
      // @ts-expect-error Inputs have named, typed entries.
      inputs.typo;
      // @ts-expect-error A numeric input does not have string methods.
      inputs.value.toUpperCase();
      return { number: inputs.value };
    },
  });
  const graph = new Graph(), map = graph.add("array_map", 0, 0), filter = graph.add("array_filter", 0, 0), navigate = graph.add("navigate", 0, 0);
  // @ts-expect-error A configured array process takes an array.
  map.process.flow({ array: "wrong", result: null }, { output: {} });
  // @ts-expect-error Predicate inputs are boolean.
  filter.process.flow({ array: [], result: 1 }, { output: {} });
  // @ts-expect-error Browser properties keep their declared input types.
  navigate.properties.url = 1;
}

Deno.test("every registered node uses named records and survives a saved graph round trip", () => {
  const graph = new Graph();
  for (const type of Object.keys(nodeClasses) as NodeType[]) {
    const node = graph.add(type, 10, 20);
    assert(!Array.isArray(node.inputs), `${type} has legacy array inputs`);
    assert(!Array.isArray(node.outputs), `${type} has legacy array outputs`);
    assertEquals(inputs(node).map(({ key }) => key), Object.keys(node.inputs));
    assertEquals(outputs(node).map(({ key }) => key), Object.keys(node.outputs));
  }
  graph.syncInputs();
  const saved = graph.serialize();
  assertEquals(Graph.deserialize(saved).serialize(), saved);
});

Deno.test("browser definitions resolve execution inputs without changing stored defaults", async () => {
  const node = new Graph().add("navigate", 0, 0);
  const result = await node.run(() => "https://example.test", {
    execute(current, properties) {
      assertEquals(current, node);
      assertEquals(properties.url, "https://example.test");
      return Promise.resolve({ url: properties.url, title: "Example" });
    },
    call() {
      throw new Error("No subgraph expected");
    },
    removeListener() {
      throw new Error("No listener removal expected");
    },
  });
  assertEquals(result, { url: "https://example.test", title: "Example" });
  assertEquals(node.properties.url, "https://wikipedia.org");
});

Deno.test("browser processes receive typed inputs, node identity, cancellation and browser services", async () => {
  const browser = new BrowserSession();
  const controller = new AbortController();
  let processed = 0;
  const BrowserNode = defineNode({
    kind: "browser",
    type: "page_info",
    title: "Browser process",
    inputs: { flow: { label: "Flow", type: "flow" }, text: { label: "Text", type: "text" } },
    outputs: { next: { label: "Next", type: "flow" }, text: { label: "Text", type: "text" } },
    properties: () => ({ text: "example" }),
    async process({ text }, context) {
      assertEquals(context.browser, browser);
      assertEquals(context.nodeId, "node-under-test");
      assertEquals(context.signal, controller.signal);
      assertEquals(context.properties.text, text);
      await context.browser.clearElements();
      processed++;
      return { text: text.toUpperCase() };
    },
  });
  const node = new BrowserNode(0, 0);
  const context = { browser, nodeId: "node-under-test", signal: controller.signal };
  assertEquals(await node.runBrowser(context), { text: "EXAMPLE" });
  assertEquals(processed, 1);
  // @ts-expect-error Exercise the runtime boundary used by untrusted browser action requests.
  node.properties.text = 12;
  await assertRejects(() => node.runBrowser(context), InvalidAction, "text must be text");
  assertEquals(processed, 1, "Invalid inputs never reach the process body");
});

Deno.test("browser processes reject invalid output values and missing output names", async () => {
  const browser = new BrowserSession();
  const definition = {
    kind: "browser",
    type: "page_info",
    title: "Browser process",
    inputs: { flow: { label: "Flow", type: "flow" } },
    outputs: { next: { label: "Next", type: "flow" }, text: { label: "Text", type: "text" } },
    properties: () => ({}),
  } as const;
  const context = { browser, nodeId: "node-under-test" };
  // Model malformed implementations supplied from untyped JavaScript.
  const BadValue = defineNode({ ...definition, process: () => ({ text: 12 } as unknown as { text: string }) });
  await assertRejects(() => new BadValue(0, 0).runBrowser(context), Error, "must be text");
  const BadName = defineNode({ ...definition, process: () => ({ typo: "wrong" } as unknown as { text: string }) });
  await assertRejects(() => new BadName(0, 0).runBrowser(context), Error, "missing text");
});

Deno.test("browser sessions reject unsupported actions and malformed dynamic schemas before opening a browser", async () => {
  const browser = new BrowserSession();
  browser.getPage = () => {
    throw new Error("Invalid requests must not open a browser");
  };
  try {
    for (const type of ["unknown", "constructor", "text_literal", null]) {
      await assertRejects(() => browser.execute(type, {}), InvalidAction, "Unsupported browser action");
    }
    await assertRejects(() => browser.execute("page_info", []), InvalidAction, "Properties must be an object");
    await assertRejects(() => browser.execute("navigate", { url: "" }), InvalidAction, "nonempty text");
    await assertRejects(() => browser.execute("script", { inputPorts: "invalid" }), InvalidAction);
    await assertRejects(() => browser.execute("reset_browser", { acceptInsecureCerts: null }), InvalidAction, "must be boolean");
    await browser.configureCertificate(true);
    assertEquals(await browser.execute("reset_browser", {}), { output: {}, screenshot: new Uint8Array() });
    assertEquals(browser.settings(), { acceptInsecureCerts: true }, "Omitting certificate settings preserves the session configuration");
  } finally {
    await browser.close();
  }
});

Deno.test("editor state and mutable option choices belong to each node instance", () => {
  const graph = new Graph(), first = graph.add("macro", 0, 0), second = graph.add("macro", 0, 0);
  first.properties.macroId = "missing";
  first.setMacros([{ id: "one", name: "First" }]);
  second.setMacros([{ id: "two", name: "Second" }]);
  assertEquals(first.options?.choices, [["", "Choose a macro"], ["one", "First"], ["missing", "Missing macro"]]);
  assertEquals(second.options?.choices, [["", "Choose a macro"], ["two", "Second"]]);
});

Deno.test("per-output data handlers preserve File Read availability", () => {
  const node = new Graph().add("file_read", 0, 0);
  const resolve = () => {
    throw new Error("File Read has no data inputs");
  };
  assertEquals(node.dataValue("loaded", resolve), false);
  assertThrows(() => node.dataValue("text", resolve), Error, "Choose a file");
  Object.assign(node.properties, { contents: "hello", name: "hello.txt", size: 5, loaded: true });
  for (const [key, expected] of Object.entries({ text: "hello", name: "hello.txt", size: 5, loaded: true })) {
    assertEquals(node.dataValue(key, resolve), expected);
  }
});

Deno.test("declarative event sources filter independently and release every subscription", async () => {
  const graph = new Graph(), start = graph.add("navigate", 0, 0), warn = graph.add("console_trigger", 0, 0), info = graph.add("console_trigger", 0, 0);
  warn.properties.level = "warn";
  info.properties.level = "info";
  for (const trigger of [warn, info]) {
    const log = graph.add("log", 0, 0);
    graph.connect(trigger.id, "event", log.id, "flow");
    graph.connect(trigger.id, "message", log.id, "message");
  }
  graph.connect(warn.id, "next", info.id, "flow");
  graph.connect(info.id, "next", start.id, "flow");
  const listeners = new Set<(values: Record<string, Value>) => void>();
  const session = new BrowserSession();
  session.getPage = () => Promise.resolve({} as Awaited<ReturnType<BrowserSession["getPage"]>>);
  session.onConsole = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  session.execute = (type) => {
    assertEquals(type, start.type);
    for (const values of [{ level: "warn", message: "warning" }, { level: "info", message: "information" }]) {
      for (const listener of listeners) listener(values);
    }
    return Promise.resolve({ output: {}, screenshot: new Uint8Array() });
  };
  const events: RunEvent[] = [];
  const run = new GraphRun(graph, session, (event) => events.push(event));
  try {
    await run.start();
    assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["warning", "information"]);
    assertEquals(listeners.size, 2);
    run.stop();
    assertEquals(listeners.size, 0);
  } finally {
    run.stop();
    await session.close();
  }
});
