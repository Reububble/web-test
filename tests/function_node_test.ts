import { assertEquals, assertThrows } from "@std/assert";
import type { BaseNode } from "web/nodes/base.ts";
import { defineFunctionNode } from "web/nodes/function_node.ts";
import { StringAtNode } from "web/nodes/string_at.ts";
import { Graph, type GraphEvent } from "web/graph.ts";

const inputPorts = {
  text: { label: "Text", type: "text", default: "" },
  index: { label: "Index", type: "number", default: 0 },
} as const;
const outputPorts = { text: { label: "Text", type: "text" }, found: { label: "Found", type: "boolean" } } as const;
const definition = {
  type: "string_at",
  title: "String At",
  inputs: inputPorts,
  outputs: outputPorts,
  process({ text, index }: { text: string; index: number }) {
    const value = text.at(index);
    return { text: value ?? "", found: value !== undefined };
  },
} as const;

/** Compiled but never executed: these errors are part of the factory's authoring contract. */
export function functionNodeTypeChecks(): void {
  const node = new StringAtNode(0, 0);
  const input: { text: string; index: number } = node.properties;
  const _result: { text: string; found: boolean } = node.process(input);
  const _text: string = node.dataValue("text", () => "");
  const _found: boolean = node.dataValue("found", () => "");
  // @ts-expect-error Input keys come from the process's input object.
  node.process({ text: "hello", offset: 1 });
  // @ts-expect-error The process takes a numeric index.
  node.process({ text: "hello", index: "1" });
  // @ts-expect-error The process takes a string.
  node.process({ text: 42, index: 1 });
  // @ts-expect-error All declared inputs are required.
  node.process({ text: "hello" });
  // @ts-expect-error Output names come from the process's returned record.
  node.dataValue("missing", () => "hello");
  // @ts-expect-error Properties retain their declared types.
  node.properties.index = "1";
  defineFunctionNode({
    ...definition,
    inputs: {
      ...inputPorts,
      // @ts-expect-error Runtime port metadata must agree with the process argument.
      index: { label: "Index", type: "text", default: "" },
    },
  });
  defineFunctionNode({
    ...definition,
    inputs: {
      ...inputPorts,
      // @ts-expect-error Defaults must agree with the process argument.
      index: { label: "Index", type: "number", default: "0" },
    },
  });
  defineFunctionNode({
    ...definition,
    inputs: {
      ...inputPorts,
      // @ts-expect-error Undeclared input ports are rejected.
      extra: { label: "Extra", type: "number", default: 0 },
    },
  });
  defineFunctionNode({
    ...definition,
    // @ts-expect-error Every process output requires port metadata.
    outputs: { text: outputPorts.text },
  });
  defineFunctionNode({
    ...definition,
    outputs: {
      ...outputPorts,
      // @ts-expect-error Output port types must agree with the process's return type.
      found: { label: "Found", type: "text" },
    },
  });
  defineFunctionNode({
    ...definition,
    outputs: {
      ...outputPorts,
      // @ts-expect-error Undeclared output ports are rejected.
      extra: { label: "Extra", type: "number" },
    },
  });
  defineFunctionNode({
    ...definition,
    // @ts-expect-error Undefined must be normalized to a supported pipeline value.
    process({ text, index }: { text: string; index: number }) {
      return { text: text.at(index), found: true };
    },
  });
}

Deno.test("String At exposes named port records and a typed input/output process", () => {
  const node = new StringAtNode(10, 20);
  assertEquals(Object.keys(node.inputs), ["text", "index"]);
  assertEquals(Object.keys(node.outputs), ["text", "found"]);
  assertEquals(node.inputs.index.type, "number");
  for (const text of ["", "hello", "🙂"]) {
    for (const index of [0, -1, 1.9, text.length, -text.length - 1]) {
      const value = text.at(index);
      assertEquals(node.process({ text, index }), { text: value ?? "", found: value !== undefined });
    }
  }
});

Deno.test("the factory binds arbitrary port names and computes its output record in one invocation", () => {
  let calls = 0;
  const At = defineFunctionNode({
    type: "string_at",
    title: "Named At",
    inputs: {
      word: { label: "Word", type: "text", default: "" },
      position: { label: "Position", type: "number", default: 0 },
    },
    outputs: { character: { label: "Character", type: "text" }, exists: { label: "Exists", type: "boolean" } },
    process({ word, position }: { word: string; position: number }) {
      calls++;
      const value = word.at(position);
      return { character: value ?? "", exists: value !== undefined };
    },
  });
  const reads: string[] = [];
  const node = new At(0, 0);
  assertEquals(
    node.evaluate("character", (key) => {
      reads.push(key);
      return key === "word" ? "hello" : -1;
    }),
    { character: "o", exists: true },
  );
  assertEquals(calls, 1);
  assertEquals(reads, ["word", "position"]);
});

Deno.test("function nodes validate untrusted graph inputs and reject unknown output names", () => {
  const node: BaseNode = new StringAtNode(0, 0);
  for (const index of ["0", NaN, Infinity]) {
    assertThrows(() => node.dataValue("text", (key) => key === "text" ? "hello" : index), Error, "finite number");
  }
  assertThrows(() => node.dataValue("text", (key) => key === "text" ? 42 : 0), Error, "text");
  assertThrows(() => node.dataValue("typo", () => "hello"), Error, "Unknown String At output");
});

Deno.test("record ports survive saved graphs and publish all function outputs together", async () => {
  const graph = new Graph();
  const at = graph.add("string_at", 0, 0), log = graph.add("log", 300, 0);
  at.properties.text = "hello";
  at.properties.index = -1;
  graph.connect(at.id, "text", log.id, "message");
  const restored = Graph.deserialize(JSON.parse(JSON.stringify(graph.serialize())));
  assertEquals(restored.serialize(), graph.serialize());
  const events: GraphEvent[] = [];
  await restored.run(
    (_node, properties) => {
      assertEquals(properties.message, "o");
      return Promise.resolve({});
    },
    undefined,
    undefined,
    undefined,
    (event) => events.push(event),
  );
  const result = events.find((event) => event.type === "node-end" && event.nodeId === at.id);
  assertEquals(result?.type === "node-end" ? result.values : undefined, { text: "o", found: true });
  assertEquals(restored.inspect(restored.node(at.id), "found")?.value, true);
});
