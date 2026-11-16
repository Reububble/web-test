import { testBrowserLauncher } from "tests/browser_fixture.ts";
/// <reference lib="dom" />
import { assertEquals, assertRejects } from "@std/assert";
import { BrowserSession, InvalidAction } from "web-test/runtime/browser.ts";
import { GraphRun } from "web-test/runtime/graph_run.ts";
import { Graph } from "web-test/graph.ts";
import type { RunEvent } from "web-test/run_events.ts";
Deno.test("Type Text types connected strings with keyboard events and preserves existing input", async () => {
  const session = new BrowserSession(testBrowserLauncher());
  try {
    await session.execute("navigate", {
      url: "data:text/html,<input value='Start: '><textarea></textarea><div contenteditable='true'></div><button>Button</button><input id='locked' readonly>",
    });
    const page = await session.getPage();
    await page.evaluate(() => {
      const input = document.querySelector("input")!;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dataset.keys = "0";
      input.dataset.inputs = "0";
      input.addEventListener("keydown", () => {
        input.dataset.keys = String(Number(input.dataset.keys) + 1);
      });
      input.addEventListener("input", () => {
        input.dataset.inputs = String(Number(input.dataset.inputs) + 1);
      });
    });
    const graph = new Graph();
    const query = graph.add("query_selector", 0, 0);
    query.properties.selector = "input";
    const literal = graph.add("text_literal", 0, 200);
    literal.properties.value = "Hello!";
    const type = graph.add("type_text", 300, 0);
    const log = graph.add("log", 600, 0);
    log.properties.message = "typed";
    graph.connect(query.id, "next", type.id, "flow");
    graph.connect(query.id, "element", type.id, "element");
    graph.connect(literal.id, "text", type.id, "text");
    graph.connect(type.id, "next", log.id, "flow");
    const restored = Graph.deserialize(graph.serialize());
    assertEquals(restored.serialize(), graph.serialize());
    const events: RunEvent[] = [];
    await new GraphRun(restored, session, (event) => events.push(event)).start();
    assertEquals(events.filter((event) => event.type === "error"), []);
    assertEquals(events.filter((event) => event.type === "log").map((event) => event.message), ["typed"]);
    assertEquals(restored.results.get(type.id), { success: true });
    assertEquals(await page.$eval("input", (input) => ({ value: input.value, keys: input.dataset.keys, inputs: input.dataset.inputs })), {
      value: "Start: Hello!",
      keys: "6",
      inputs: "6",
    });
    const queryElement = async (selector: string) => (await session.execute("query_selector", { selector }, selector)).output.element;
    const area = await queryElement("textarea");
    await session.execute("type_text", { element: area, text: "First\nSecond café" });
    assertEquals(await page.$eval("textarea", (area) => area.value), "First\nSecond café");
    const editable = await queryElement("div");
    await session.execute("type_text", { element: editable, text: "Editable" });
    assertEquals(await page.$eval("div", (div) => div.textContent), "Editable");
    await session.execute("type_text", { element: area, text: "" });
    assertEquals(await page.$eval("textarea", (area) => area.value), "First\nSecond café");
    for (const selector of ["button", "#locked"]) {
      await assertRejects(() => queryElement(selector).then((element) => session.execute("type_text", { element, text: "no" })), InvalidAction, "editable");
    }
    await assertRejects(() => session.execute("type_text", { element: null, text: "no" }), InvalidAction, "Connect an element");
    await assertRejects(() => session.execute("type_text", { element: area, text: 12 }), InvalidAction, "text must be");
    await session.execute("navigate", { url: "about:blank" });
    await assertRejects(() => session.execute("type_text", { element: area, text: "no" }), InvalidAction, "expired");
  } finally {
    await session.close();
  }
});
