import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph } from "web/graph.ts";
Deno.test("Comments have no ports, persist in graphs and macros, and do not execute", async () => {
  const graph = new Graph(), comment = graph.add("comment", 40, 60), log = graph.add("log", 400, 60);
  comment.properties.text = "Explain this step\nSecond line";
  assertEquals(comment.inputs, {});
  assertEquals(comment.outputs, {});
  assertThrows(() => graph.connect(log.id, "next", comment.id, "flow"));
  const copy = Graph.deserialize(graph.serialize());
  assertEquals(copy.serialize(), graph.serialize());
  const selected = graph.copySelection(new Set([comment.id, log.id]));
  assertEquals(selected.node(comment.id).properties.text, comment.properties.text);
  const visits: string[] = [];
  await copy.run((node) => {
    visits.push(node.id);
    return Promise.resolve({});
  });
  assertEquals(visits, [log.id]);
  copy.remove(new Set([log.id]));
  await assertRejects(() => copy.run(() => Promise.resolve({})), Error, "Add a flow block");
});
