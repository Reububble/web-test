import { assertEquals, assertThrows } from "@std/assert";
import { Graph, inputs, outputs, type Value } from "web-test/graph.ts";
import type { DataType } from "web-test/nodes/base.ts";
Deno.test("Conditional Value selects matching values of every supported type", () => {
  const pairs: [DataType, Value, Value][] = [
    ["text", "yes", "no"],
    ["boolean", true, false],
    ["number", 7, 0],
    ["json", { nested: [1, null] }, [false, "other"]],
    ["element", { elementId: "element" }, null],
    ["array", [1, "two"], []],
  ];
  for (const [type, yes, no] of pairs) {
    const graph = new Graph(), node = graph.add("conditional_value", 20, 30);
    node.properties = { valueType: type, condition: true, trueValue: yes, falseValue: no };
    assertEquals(inputs(node).map((input) => input.type), ["boolean", type, type]);
    assertEquals(outputs(node).map((output) => output.type), [type]);
    for (const condition of [true, false]) {
      node.properties.condition = condition;
      const restored = Graph.deserialize(graph.serialize());
      const copy = restored.node(node.id);
      assertEquals(copy.dataValue("value", (key) => restored.value(copy, key)), condition ? yes : no);
    }
  }
});
Deno.test("Conditional Value resolves only the selected branch during execution", async () => {
  const graph = new Graph(), select = graph.add("conditional_value", 0, 0);
  const missing = graph.add("extract_text", 0, 0), literal = graph.add("text_literal", 0, 0);
  const log = graph.add("log", 0, 0);
  literal.properties.value = "Chosen";
  graph.connect(missing.id, "text", select.id, "trueValue");
  graph.connect(literal.id, "text", select.id, "falseValue");
  graph.connect(select.id, "value", log.id, "message");
  graph.connect(log.id, "next", missing.id, "flow");
  let logged: Value = null;
  await graph.run((node, properties) => {
    if (node.type === "log") logged = properties.message;
    return Promise.resolve<Record<string, Value>>(node.type === "extract_text" ? { text: "Other", success: true } : {});
  });
  assertEquals(logged, "Chosen");
  graph.results.clear();
  select.properties.condition = true;
  assertThrows(() => select.dataValue("value", (key) => graph.value(select, key)), Error, "must run before");
});
Deno.test("Conditional Value type changes prune incompatible links and preserve Condition", () => {
  const graph = new Graph(), select = graph.add("conditional_value", 0, 0);
  const bool = graph.add("boolean_literal", 0, 0), text = graph.add("text_literal", 0, 0), log = graph.add("log", 0, 0);
  graph.connect(bool.id, "boolean", select.id, "condition");
  graph.connect(text.id, "text", select.id, "trueValue");
  graph.connect(select.id, "value", log.id, "message");
  select.properties.valueType = "number";
  graph.syncInputs();
  assertEquals(graph.links.map((link) => link.input), ["condition"]);
  assertEquals(select.properties.trueValue, 0);
  assertEquals(select.properties.falseValue, 0);
  assertThrows(() => graph.connect(text.id, "text", select.id, "trueValue"));
  // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
  select.properties.condition = "false";
  const properties: Record<string, Value> = select.properties;
  assertThrows(() => select.dataValue("value", (key) => properties[key]), Error, "boolean");
});
