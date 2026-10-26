import { assertEquals, assertThrows } from "@std/assert";
import { Graph, inputs, type NodeType, type Value } from "web/graph.ts";
Deno.test("JSON inputs accept typed JSON values without conversion and preserve connections", () => {
  const sources: [NodeType, string, Value][] = [
    ["text_literal", "text", "hello"],
    ["text_literal", "text", ""],
    ["boolean_literal", "boolean", false],
    ["boolean_literal", "boolean", true],
    ["number_literal", "number", 0],
    ["number_literal", "number", 3.5],
    ["array_literal", "array", [1, "two", false]],
  ];
  const graph = new Graph(), creator = graph.add("array_creator", 0, 0);
  creator.properties.itemType = "json";
  const expected: Value[] = [];
  for (const [type, output, value] of sources) {
    const source = graph.add(type, 0, 0), variable = graph.add("json_variable", 0, 0), stringify = graph.add("json_stringify", 0, 0);
    source.properties.value = value;
    graph.connect(source.id, output, variable.id, "value");
    graph.connect(source.id, output, stringify.id, "json");
    graph.connect(source.id, output, creator.id, inputs(creator).at(-1)!.key);
    assertEquals(variable.dataValue("json", (key) => graph.value(variable, key)), value);
    assertEquals(stringify.dataValue("text", (key) => graph.value(stringify, key)), JSON.stringify(value, null, 2));
    expected.push(value);
  }
  graph.syncInputs();
  assertEquals(inputs(creator).length, sources.length + 1);
  assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), expected);
  const copy = Graph.deserialize(graph.serialize());
  assertEquals(copy.serialize(), graph.serialize());
  assertEquals(copy.node(creator.id).dataValue("array", (key) => copy.value(copy.node(creator.id), key)), expected);
  const variable = graph.add("json_variable", 0, 0),
    text = graph.add("text_literal", 0, 0),
    query = graph.add("query_selector", 0, 0),
    number = graph.add("number_literal", 0, 0);
  assertThrows(() => graph.connect(variable.id, "json", text.id, "value"));
  assertThrows(() => graph.connect(query.id, "element", variable.id, "value"));
  assertThrows(() => graph.connect(query.id, "next", variable.id, "value"));
  assertThrows(() => graph.connect(text.id, "text", number.id, "value"));
  creator.properties.itemType = "number";
  graph.syncInputs();
  assertEquals(creator.dataValue("array", (key) => graph.value(creator, key)), [0, 3.5]);
});
Deno.test("JSON Variable accepts manual and connected JSON values and preserves them in graph files", () => {
  const graph = new Graph();
  const variable = graph.add("json_variable", 20, 30);
  const read = () => variable.dataValue("json", (key) => graph.value(variable, key));
  assertEquals(read(), {});
  variable.properties.value = { nested: [1, true, null] };
  const restored = Graph.deserialize(graph.serialize());
  const copy = restored.node(variable.id);
  assertEquals(copy.dataValue("json", (key) => restored.value(copy, key)), { nested: [1, true, null] });
  const parse = graph.add("json_parse", 0, 0);
  parse.properties.text = '["connected", 2]';
  graph.connect(parse.id, "json", variable.id, "value");
  assertEquals(read(), ["connected", 2]);
  graph.disconnect(new Set([parse.id]));
  assertEquals(read(), { nested: [1, true, null] });
  variable.properties.value = NaN;
  assertThrows(read, Error, "serializable JSON");
});
Deno.test("Element Variable passes fresh connected references and preserves null as its default", () => {
  const graph = new Graph();
  const variable = graph.add("element_variable", 0, 0);
  const query = graph.add("query_selector", 0, 0);
  const click = graph.add("element_click", 0, 0);
  const read = () => variable.dataValue("element", (key) => graph.value(variable, key));
  assertEquals(read(), null);
  graph.connect(query.id, "element", variable.id, "value");
  graph.connect(variable.id, "element", click.id, "element");
  assertThrows(read, Error, "must run before");
  const reference = { elementId: "element-reference" };
  graph.results.set(query.id, { element: reference });
  assertEquals(graph.value(click, "element"), reference);
  const restored = Graph.deserialize(graph.serialize());
  assertEquals(restored.serialize(), graph.serialize());
  assertThrows(() => restored.value(restored.node(click.id), "element"), Error, "must run before");
  graph.disconnect(new Set([query.id]));
  assertEquals(read(), null);
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  variable.properties.value = "invalid reference";
  assertThrows(read, Error, "element reference or null");
});
