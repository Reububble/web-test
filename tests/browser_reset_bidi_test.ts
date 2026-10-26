import { testBrowserLauncher } from "tests/browser_fixture.ts";
import { assert, assertEquals, assertThrows } from "@std/assert";
import type { Page } from "puppeteer";
import { BrowserSession } from "web/runtime/browser.ts";
import { GraphRun } from "web/runtime/graph_run.ts";
import { Graph } from "web/graph.ts";
import type { RunEvent } from "web/run_events.ts";
Deno.test("Reset Browser closes the session, expires elements and continues the graph", async () => {
  class Session extends BrowserSession {
    pageRequests = 0;
    override getPage(): Promise<Page> {
      this.pageRequests++;
      return super.getPage();
    }
  }
  const session = new Session(testBrowserLauncher());
  try {
    assertEquals(await session.execute("reset_browser", {}), { output: {}, screenshot: new Uint8Array() });
    assertEquals(session.pageRequests, 0, "Resetting a closed browser does not launch it for a screenshot");
    await session.configureCertificate(true);
    const oldPage = await session.getPage();
    await oldPage.setContent("<h1>Old page</h1>");
    const reference = await session.saveElement(await oldPage.$("h1"), "heading");
    const graph = new Graph();
    const reset = graph.add("reset_browser", 30, 40);
    reset.properties.acceptInsecureCerts = true;
    const info = graph.add("page_info", 400, 40);
    graph.connect(reset.id, "next", info.id, "flow");
    const restored = Graph.deserialize(JSON.parse(JSON.stringify(graph.serialize())));
    assertEquals(restored.serialize(), graph.serialize());
    const events: RunEvent[] = [];
    const run = new GraphRun(restored, session, (event) => {
      events.push(event);
      if (event.type === "node-end" && event.nodeId === reset.id) {
        assert(oldPage.isClosed(), "Reset completes after closing the browser");
        assertThrows(() => session.element(reference), Error, "expired");
        assertEquals(session.settings(), { acceptInsecureCerts: true });
      }
    });
    await run.start();
    assert(!events.some((event) => event.type === "error"), JSON.stringify(events));
    assert(events.some((event) => event.type === "screenshot" && event.screenshot.byteLength === 0), "Reset clears the browser monitor");
    const screenshot = events.find((event) => event.type === "screenshot" && event.screenshot.byteLength > 0);
    assert(screenshot?.type === "screenshot");
    assertEquals(screenshot.screenshot.slice(0, 8), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "Browser actions return binary PNG data");
    const result = events.find((event) => event.type === "node-end" && event.nodeId === info.id);
    assert(result?.type === "node-end");
    assertEquals(result.values.url, "about:blank");
    assert((await session.getPage()) !== oldPage, "Downstream actions use a fresh browser");
    assertEquals(events.at(-1), { type: "run-end", listening: false });
    run.stop();
  } finally {
    await session.close();
  }
});
