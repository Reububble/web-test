import { assertEquals, assertThrows, fail } from "@std/assert";
import { Graph, type NodeType } from "web-test/graph.ts";
Deno.test("number comparisons cover ordering and equality with strictly numeric inputs", () => {
  const graph = new Graph(), compare = graph.add("number_comparison", 0, 0);
  const cases: [string, boolean[]][] = [
    ["equals", [false, true, false]],
    ["not_equals", [true, false, true]],
    ["less", [true, false, false]],
    ["less_equal", [true, true, false]],
    ["greater", [false, false, true]],
    ["greater_equal", [false, true, true]],
  ];
  for (const [operator, expected] of cases) {
    compare.properties.operator = operator;
    compare.properties.valueB = 2;
    assertEquals(
      [1, 2, 3].map((value) => {
        compare.properties.valueA = value;
        return compare.dataValue("result", (key) => graph.value(compare, key));
      }),
      expected,
    );
  }
  for (const invalid of [NaN, Infinity, "2"]) {
    // @ts-expect-error Deliberately corrupt a typed property to verify runtime validation.
    compare.properties.valueA = invalid;
    assertThrows(() => compare.dataValue("result", (key) => graph.value(compare, key)), Error, "finite number");
  }
  assertThrows(() => graph.connect(graph.add("text_literal", 0, 0).id, "text", compare.id, "valueA"));
});
Deno.test("boolean gates implement their truth tables and reject non-boolean values", () => {
  const tables: [NodeType, boolean[]][] = [
    ["boolean_and", [false, false, false, true]],
    ["boolean_or", [false, true, true, true]],
    ["boolean_xor", [false, true, true, false]],
    ["boolean_nand", [true, true, true, false]],
    ["boolean_nor", [true, false, false, false]],
    ["boolean_xnor", [true, false, false, true]],
  ];
  for (const [type, expected] of tables) {
    const graph = new Graph(), gate = graph.add(type, 0, 0);
    const actual = [[false, false], [false, true], [true, false], [true, true]].map(([a, b]) => {
      gate.properties.valueA = a;
      gate.properties.valueB = b;
      return gate.dataValue("result", (key) => graph.value(gate, key));
    });
    assertEquals(actual, expected);
    gate.properties.valueB = 1;
    assertThrows(() => gate.dataValue("result", (key) => graph.value(gate, key)), Error, "boolean values");
  }
  const not = new Graph().add("boolean_not", 0, 0);
  for (const value of [false, true]) assertEquals(not.dataValue("result", (key) => key === "valueA" ? value : fail("NOT must have only one input")), !value);
});
Deno.test("String Length and At follow JavaScript indices and handle missing positions", () => {
  const graph = new Graph(), length = graph.add("string_length", 0, 0), at = graph.add("string_at", 0, 0);
  const text = graph.add("text_literal", 0, 0);
  text.properties.value = "hello";
  graph.connect(text.id, "text", length.id, "text");
  graph.connect(text.id, "text", at.id, "text");
  assertEquals(length.dataValue("length", (key) => graph.value(length, key)), 5);
  for (const [index, expected, found] of [[0, "h", true], [-1, "o", true], [1.9, "e", true], [5, "", false], [-6, "", false]] as const) {
    at.properties.index = index;
    assertEquals(at.dataValue("text", (key) => graph.value(at, key)), expected);
    assertEquals(at.dataValue("found", (key) => graph.value(at, key)), found);
  }
  text.properties.value = "";
  assertEquals(length.dataValue("length", (key) => graph.value(length, key)), 0);
  assertEquals(at.dataValue("found", (key) => graph.value(at, key)), false);
  text.properties.value = "🙂";
  at.properties.index = -1;
  assertEquals(length.dataValue("length", (key) => graph.value(length, key)), 2);
  assertEquals(at.dataValue("text", (key) => graph.value(at, key)), "\ude42");
  at.properties.index = Infinity;
  assertThrows(() => at.dataValue("text", (key) => graph.value(at, key)), Error, "finite number");
});
