import { assert, assertEquals } from "@std/assert";
import { type BrowserLifecycle, createBrowserSession, runPipelineFile } from "@local/web-test";
import type { Browser, Page } from "puppeteer";

function provider() {
  const launches: boolean[] = [];
  let closes = 0;
  const pages: { closed: boolean; page: Page }[] = [];
  const lifecycle: BrowserLifecycle = {
    launch(acceptInsecureCerts = false) {
      launches.push(acceptInsecureCerts);
      const entry = {
        closed: false,
        page: undefined as unknown as Page,
      };
      entry.page = {
        on() {},
        setViewport: () => Promise.resolve(),
        isClosed: () => entry.closed,
        url: () => "https://configured-browser.test/",
        title: () => Promise.resolve("Configured browser"),
        screenshot: () => Promise.resolve(new Uint8Array([137, 80, 78, 71])),
      } as unknown as Page;
      pages.push(entry);
      return Promise.resolve({ connected: true, newPage: () => Promise.resolve(entry.page) } as unknown as Browser);
    },
    reset() {
      for (const entry of pages) entry.closed = true;
      return Promise.resolve();
    },
    close() {
      closes++;
      return Promise.resolve();
    },
  };
  return { lifecycle, launches, closes: () => closes };
}

Deno.test("public sessions use the injected browser provider and forward changed certificate settings", async () => {
  const setup = provider();
  const session = createBrowserSession(setup.lifecycle);
  try {
    assertEquals(setup.launches, []);
    const first = await session.getPage();
    await session.reset(true);
    assert(first.isClosed());
    assert((await session.getPage()) !== first);
    assertEquals(setup.launches, [false, true]);
  } finally {
    await session.close();
  }
  assertEquals(setup.closes(), 1);
});

Deno.test("pipeline execution uses and closes the caller's browser provider", async () => {
  const setup = provider();
  const file = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(
      file,
      JSON.stringify({ version: 1, nodes: [{ id: "node_info", type: "page_info", xPos: 0, yPos: 0, properties: {} }], links: [] }),
    );
    await runPipelineFile(file, { browser: setup.lifecycle });
    assertEquals(setup.launches, [false]);
    assertEquals(setup.closes(), 1);
  } finally {
    await Deno.remove(file);
  }
});
