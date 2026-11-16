import { assertEquals, assertThrows } from "@std/assert";
import { Graph, type GraphEvent, inputs, outputs } from "web-test/graph.ts";
import { ArrayAtNode } from "web-test/nodes/array_at.ts";
import type { BaseNode, Value } from "web-test/nodes/base.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
import { defineFunctionNode } from "web-test/nodes/function_node.ts";
import { ArrayDescriptor, type Optional, OptionalDescriptor, TypeConfig, typeDescriptor } from "web-test/nodes/type_descriptor.ts";
import { dataTypes, defaultValue } from "web-test/script_schema.ts";

const OptionalNumber = defineFunctionNode({
  type: "number_literal",
  title: "Optional Number",
  inputs: { value: { label: "Value", type: new OptionalDescriptor("number") } },
  outputs: { value: { label: "Value", type: new OptionalDescriptor("number") } },
  process({ value }: { value: Optional<number> }) {
    return { value };
  },
});

/** Compiled authoring checks: dynamic configuration keeps fixed port names and input types. */
export function configurableNodeTypeChecks(): void {
  const at = new ArrayAtNode(0, 0);
  const _found: boolean = at.process({ array: ["hello"], index: 0 }).found;
  const _value: Value = at.process({ array: ["hello"], index: 0 }).value;
  at.properties.itemType = "text";
  // @ts-expect-error Configuration selections must be supported data types.
  at.properties.itemType = "invalid";
  // @ts-expect-error Configuration property names are retained.
  at.properties.itemTypo = "text";
  // @ts-expect-error Named inputs survive generic configuration inference.
  at.process({ items: [], index: 0 });
  // @ts-expect-error Index remains numeric.
  at.process({ array: [], index: "0" });
  // @ts-expect-error Configured nodes retain their output names.
  at.dataValue("typo", () => null);
  const optional = new OptionalNumber(0, 0);
  optional.process({ value: null });
  optional.process({ value: 1 });
  // @ts-expect-error Optional number inputs still reject text.
  optional.process({ value: "1" });
  defineFunctionNode({
    type: "number_literal",
    title: "Wrong Optional",
    // @ts-expect-error Nullable descriptors require nullable process inputs.
    inputs: { value: { label: "Value", type: new OptionalDescriptor("number") } },
    outputs: { value: { label: "Value", type: "number" } },
    process: ({ value }: { value: number }) => ({ value }),
  });
  defineFunctionNode({
    type: "number_literal",
    title: "Wrong Array",
    // @ts-expect-error An array descriptor carries its element type.
    inputs: { value: { label: "Value", type: new ArrayDescriptor(typeDescriptor("number")) } },
    outputs: { value: { label: "Value", type: "array" } },
    process: ({ value }: { value: string[] }) => ({ value }),
  });
}

Deno.test("Array At rebuilds descriptor ports and executes for every selected item type", () => {
  const node = new ArrayAtNode(10, 20);
  assertEquals(Object.keys(node.inputs), ["array", "index"]);
  assertEquals(Object.keys(node.outputs), ["value", "found"]);
  assertEquals(node.properties, { itemType: "json", array: [], index: 0 });
  assertEquals(node.options?.key, "itemType");
  assertEquals(node.options?.changesPorts, true);
  const samples = {
    text: "hello",
    number: 42,
    boolean: true,
    json: { nested: [1, null] },
    element: { elementId: "element" },
    listener: { listenerId: "listener" },
    array: [1, "two"],
    instant: Temporal.Instant.fromEpochMilliseconds(123),
  };
  for (const type of dataTypes) {
    node.properties.itemType = type;
    assertEquals(outputs(node).map(({ key, type }) => [key, type]), [["value", type], ["found", "boolean"]]);
    assertEquals(inputs(node).map(({ key, type }) => [key, type]), [["array", "array"], ["index", "number"]]);
    assertEquals(node.process({ array: [samples[type]], index: -1 }), { value: samples[type], found: true });
    assertEquals(node.process({ array: [samples[type]], index: 0.9 }), { value: samples[type], found: true });
    assertEquals(node.process({ array: [], index: 0 }), { value: defaultValue(type), found: false });
    assertEquals(node.process({ array: [samples[type]], index: 10 }), { value: defaultValue(type), found: false });
  }
  node.properties.itemType = "json";
  assertEquals(node.process({ array: [null], index: 0 }), { value: null, found: true });
});

Deno.test("configured array descriptors validate all items before the typed process", () => {
  const node = new ArrayAtNode(0, 0);
  node.properties.itemType = "number";
  assertThrows(() => node.process({ array: [1, "wrong"], index: 0 }), Error, "item 1 must be a finite number");
  assertThrows(() => node.process({ array: [NaN], index: 0 }), Error);
  assertThrows(() => node.process({ array: [1], index: Infinity }), Error, "finite number");
  assertThrows(() => node.dataValue("value", () => "wrong"), Error, "array");
  const untrusted: BaseNode = node;
  untrusted.properties.itemType = "invalid";
  assertThrows(() => outputs(node), Error, "Select a valid item type");
});

Deno.test("Array At preserves configuration across graph round trips and publishes both outputs", async () => {
  const graph = new Graph();
  const at = graph.add("array_at", 0, 0), log = graph.add("log", 300, 0);
  at.properties.itemType = "text";
  at.properties.array = ["first", "last"];
  at.properties.index = -1;
  graph.connect(at.id, "value", log.id, "message");
  const saved = graph.serialize();
  const restored = Graph.deserialize(JSON.parse(JSON.stringify(saved)));
  assertEquals(restored.serialize(), saved);
  assertEquals(outputs(restored.node(at.id))[0].type, "text");
  const events: GraphEvent[] = [];
  await restored.run(
    (_node, properties) => {
      assertEquals(properties.message, "last");
      return Promise.resolve({});
    },
    undefined,
    undefined,
    undefined,
    (event) => events.push(event),
  );
  const event = events.find((event) => event.type === "node-end" && event.nodeId === at.id);
  assertEquals(event?.type === "node-end" ? event.values : undefined, { value: "last", found: true });
});

Deno.test("optional descriptors preserve null defaults, validate values and expose optional editor ports", () => {
  const node = new OptionalNumber(0, 0);
  assertEquals(node.properties.value, null);
  assertEquals(inputs(node), [{ key: "value", label: "Value", type: "number", optional: true }]);
  assertEquals(node.process({ value: null }), { value: null });
  assertEquals(node.process({ value: 42 }), { value: 42 });
  const untrusted: BaseNode = node;
  assertThrows(() => untrusted.dataValue("value", () => "42"), Error, "finite number");
  const nested = new OptionalDescriptor(new ArrayDescriptor(typeDescriptor("text")));
  assertEquals(nested.read(null, "Items"), null);
  assertEquals(nested.read(["hello"], "Items"), ["hello"]);
  assertThrows(() => nested.read([1], "Items"), Error, "must be text");
});

Deno.test("configuration is instance-local and supports multiple independent type selections", () => {
  let builds = 0;
  const Pair = defineNode({
    type: "array_at",
    title: "Pair",
    config: {
      inputs: {
        first: new TypeConfig({ key: "firstType", label: "First type", default: "text" }),
        second: new TypeConfig({ key: "secondType", label: "Second type", default: "number" }),
      },
    },
  })((config) => {
    builds++;
    return {
      inputs: { first: { label: "First", type: config.inputs.first }, second: { label: "Second", type: config.inputs.second } },
      outputs: { first: { label: "First", type: config.inputs.first }, second: { label: "Second", type: config.inputs.second } },
      process: ({ first, second }: { first: Value; second: Value }) => ({ first, second }),
    };
  });
  const first = new Pair(0, 0), second = new Pair(0, 0);
  assertEquals(builds, 2);
  assertEquals(first.properties.first, "");
  assertEquals(first.properties.second, 0);
  first.properties.firstType = "boolean";
  first.properties.secondType = "instant";
  assertEquals(outputs(first).map(({ type }) => type), ["boolean", "instant"]);
  assertEquals(outputs(second).map(({ type }) => type), ["text", "number"]);
  assertEquals(first.extraOptions[0].key, "secondType");
  const instant = Temporal.Instant.fromEpochMilliseconds(0);
  assertEquals(first.process({ first: true, second: instant }), { first: true, second: instant });
  assertEquals(builds, 3);
});
