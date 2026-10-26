import { assertEquals, assertThrows } from "@std/assert";
import { Graph, inputs, type Value } from "web/graph.ts";
import type { DataType } from "web/nodes/base.ts";
Deno.test("Array Creator adds one spare slot and preserves connected keys through removals", () => {
  const graph = new Graph(), creator = graph.add("array_creator", 0, 0), text = graph.add("text_literal", 0, 0);
  const read = () => creator.dataValue("array", (key) => graph.value(creator, key));
  assertEquals(inputs(creator).length, 1);
  assertEquals(read(), []);
  creator.properties.item_1 = "first";
  graph.syncInputs();
  graph.connect(text.id, "text", creator.id, "item_2");
  assertEquals(inputs(creator).length, 3);
  assertEquals(read(), ["first", ""]);
  creator.properties.item_1 = "";
  graph.syncInputs();
  assertEquals(inputs(creator).map((input) => input.key), ["item_2", "item_3"]);
  assertEquals(graph.links[0].input, "item_2");
  assertEquals(read(), [""]);
  creator.removeInput("item_2");
  graph.syncInputs();
  assertEquals(graph.links, []);
  assertEquals(inputs(creator).length, 1);
  assertEquals(read(), []);
});
Deno.test("Array Creator retains valid false, zero, null and nested items without filling the spare", () => {
  const cases: [DataType, Value[]][] = [["number", [0, 2]], ["boolean", [false, true]], ["json", [null, { nested: [1] }]], ["array", [[], [2]]], ["element", [
    null,
    { elementId: "element" },
  ]]];
  for (const [type, values] of cases) {
    const graph = new Graph(), creator = graph.add("array_creator", 0, 0);
    creator.properties.itemType = type;
    for (const value of values) {
      const slot = inputs(creator).at(-1)!.key;
      creator.properties[slot] = value;
      graph.syncInputs();
    }
    assertEquals(inputs(creator).length, values.length + 1);
    assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), values);
    const restored = Graph.deserialize(graph.serialize());
    const copy = restored.node(creator.id);
    assertEquals(copy.dataValue("array", (key) => restored.value(copy, key)), values);
    assertEquals(restored.serialize(), graph.serialize());
    creator.removeInput(inputs(creator)[0].key);
    graph.syncInputs();
    assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), values.slice(1));
  }
});
Deno.test("Array Creator accepts arbitrarily many connections, including pending browser outputs", () => {
  const graph = new Graph(), creator = graph.add("array_creator", 0, 0);
  creator.properties.itemType = "number";
  for (let index = 0; index < 40; index++) {
    const number = graph.add("number_literal", 0, 0);
    number.properties.value = index;
    graph.connect(number.id, "number", creator.id, inputs(creator).at(-1)!.key);
  }
  assertEquals(inputs(creator).length, 41);
  assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), Array.from({ length: 40 }, (_, index) => index));
  const elements = graph.add("array_creator", 0, 0), query = graph.add("query_selector", 0, 0);
  elements.properties.itemType = "element";
  graph.connect(query.id, "element", elements.id, "item_1");
  assertEquals(inputs(elements).length, 2);
  const restored = Graph.deserialize(graph.serialize());
  assertEquals(inputs(restored.node(elements.id)).length, 2);
  assertThrows(() => elements.dataValue("array", (key) => graph.value(elements, key)), Error, "must run before");
});
Deno.test("Array Creator type changes discard incompatible inputs and prune their connections", () => {
  const graph = new Graph(), creator = graph.add("array_creator", 0, 0), text = graph.add("text_literal", 0, 0);
  creator.properties.item_1 = "first";
  graph.syncInputs();
  graph.connect(text.id, "text", creator.id, "item_2");
  creator.properties.itemType = "number";
  graph.syncInputs();
  assertEquals(graph.links, []);
  assertEquals(inputs(creator).length, 1);
  assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), []);
  assertThrows(() => graph.connect(text.id, "text", creator.id, inputs(creator)[0].key));
});
