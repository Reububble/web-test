import { assertEquals, assertRejects } from "@std/assert";
import { createBrowserSession, runPipelineFile } from "@local/web-test";
Deno.test("package session can close before a browser is launched", async () => {
  const session = createBrowserSession();
  await session.close();
  await session.close();
});
Deno.test("package pipeline logs success and rejects an unhandled assertion", async () => {
  const file = await Deno.makeTempFile({ suffix: ".json" });
  try {
    const graph = {
      version: 1,
      nodes: [{ id: "node_package", type: "log", xPos: 0, yPos: 0, properties: { message: "package passed", level: "info" } }],
      links: [],
    };
    await Deno.writeTextFile(file, JSON.stringify(graph));
    const logs: string[] = [];
    await runPipelineFile(file, { timeout: 5000, log: (message) => logs.push(message) });
    assertEquals(logs, ["package passed"]);
    graph.nodes[0].type = "fail";
    graph.nodes[0].properties.message = "package assertion failed";
    await Deno.writeTextFile(file, JSON.stringify(graph));
    await assertRejects(() => runPipelineFile(file), Error, "package assertion failed");
  } finally {
    await Deno.remove(file);
  }
});
