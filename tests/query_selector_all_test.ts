import { testBrowserLauncher } from "tests/browser_fixture.ts";
/// <reference lib="dom" />
import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { ElementHandle } from "puppeteer";
import { BrowserSession } from "web-test/runtime/browser.ts";
import { GraphRun } from "web-test/runtime/graph_run.ts";
import { Graph } from "web-test/graph.ts";
import type { RunEvent } from "web-test/run_events.ts";
Deno.test("element array replacement releases every old handle and respects the retention limit", async () => {
  const session = new BrowserSession(testBrowserLauncher());
  const fake = () => {
    const state = { disposed: 0 };
    const handle = {
      dispose: () => {
        state.disposed++;
        return Promise.resolve();
      },
    } as unknown as ElementHandle<Element>;
    return { state, handle };
  };
  try {
    const other = fake(), first = fake(), second = fake(), replacement = fake();
    const otherRef = await session.saveElement(other.handle, "other:element");
    const old = await session.saveElements([first.handle, second.handle], "query:elements");
    const current = await session.saveElements([replacement.handle], "query:elements");
    assertEquals(first.state.disposed, 1);
    assertEquals(second.state.disposed, 1);
    for (const reference of old) assertThrows(() => session.element(reference), Error, "expired");
    assertEquals(session.element(current[0]), replacement.handle);
    assertEquals(session.element(otherRef), other.handle);
    assertEquals(await session.saveElements([], "query:elements"), []);
    assertEquals(replacement.state.disposed, 1);
    const oversized = Array.from({ length: 1024 }, fake);
    await assertRejects(() => session.saveElements(oversized.map((item) => item.handle), "oversized:elements"), Error, "Too many retained");
    assert(oversized.every((item) => item.state.disposed === 1));
    assertEquals(session.element(otherRef), other.handle);
  } finally {
    await session.close();
  }
});
Deno.test("Query Selector All returns ordered references and supports element For Each workflows", async () => {
  const session = new BrowserSession(testBrowserLauncher());
  try {
    await session.execute("navigate", { url: "data:text/html,<ul><li>First</li><li>Second</li><li>Third</li></ul>" });
    const first = (await session.execute("query_selector_all", { selector: "li" }, "all")).output;
    assertEquals(first.success, true);
    assert(Array.isArray(first.elements));
    assertEquals(first.elements.length, 3);
    const values: string[] = [];
    for (const element of first.elements) {
      const value = (await session.execute("text_content", { element })).output;
      values.push(String(value.text));
    }
    assertEquals(values, ["First", "Second", "Third"]);
    const second = (await session.execute("query_selector_all", { selector: "li:first-child" }, "all")).output;
    assert(Array.isArray(second.elements));
    assertEquals(second.elements.length, 1);
    for (const element of first.elements) assertThrows(() => session.element(element), Error, "expired");
    const empty = (await session.execute("query_selector_all", { selector: ".missing" }, "all")).output;
    assertEquals(empty, { elements: [], success: false });
    assert(Array.isArray(second.elements));
    const secondElement = second.elements[0];
    assertThrows(() => session.element(secondElement), Error, "expired");
    await assertRejects(() => session.execute("query_selector_all", { selector: "[" }));
    await assertRejects(() => session.execute("query_selector_all", { selector: "" }));
    const graph = new Graph(),
      query = graph.add("query_selector_all", 0, 0),
      each = graph.add("array_for_each", 0, 0),
      text = graph.add("text_content", 0, 0),
      log = graph.add("log", 0, 0),
      done = graph.add("log", 0, 0);
    query.properties.selector = "li";
    each.properties.itemType = "element";
    done.properties.message = "done";
    graph.connect(query.id, "next", each.id, "flow");
    graph.connect(query.id, "elements", each.id, "array");
    graph.connect(each.id, "each", text.id, "flow");
    graph.connect(each.id, "value", text.id, "element");
    graph.connect(text.id, "next", log.id, "flow");
    graph.connect(text.id, "text", log.id, "message");
    graph.connect(each.id, "done", done.id, "flow");
    const restored = Graph.deserialize(graph.serialize());
    assertEquals(restored.serialize(), graph.serialize());
    const events: RunEvent[] = [];
    const run = new GraphRun(restored, session, (event) => events.push(event));
    await run.start();
    assertEquals(events.filter((event) => event.type === "error"), []);
    assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["First", "Second", "Third", "done"]);
    const refs = restored.results.get(query.id)!.elements;
    assert(Array.isArray(refs));
    await session.execute("navigate", { url: "about:blank" });
    for (const ref of refs) assertThrows(() => session.element(ref), Error, "expired");
    const beforeReset = (await session.execute("query_selector_all", { selector: "html" }, "all")).output.elements;
    assert(Array.isArray(beforeReset));
    assertEquals(beforeReset.length, 1);
    await session.execute("reset_browser", {});
    assertThrows(() => session.element(beforeReset[0]), Error, "expired");
  } finally {
    await session.close();
  }
});
