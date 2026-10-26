import { assertEquals } from "@std/assert";
import { Graph, type MacroDefinition } from "web/graph.ts";
import { exportMacroFile, importMacroFile } from "web/macro_files.ts";
Deno.test("macro exports include only reachable dependencies and keep recursive calls runnable", async () => {
  const leaf = new Graph();
  leaf.add("log", 0, 0).properties.message = "leaf";
  const parent = new Graph(), call = parent.add("macro", 0, 0);
  call.properties.macroId = "macro_leaf";
  const library: MacroDefinition[] = [{ id: "macro_leaf", name: "Leaf", graph: leaf.serialize() }, {
    id: "macro_parent",
    name: "Parent",
    graph: parent.serialize(),
  }, { id: "macro_unrelated", name: "Unrelated", graph: leaf.serialize() }];
  const saved = exportMacroFile(parent, library, { id: "macro_parent", name: "Parent" });
  assertEquals(saved.macros?.map((macro) => macro.id), ["macro_leaf"]);
  const imported = importMacroFile(saved, "parent.json", []);
  const root = imported.definitions.find((macro) => macro.id === imported.id)!;
  const restored = Graph.deserialize(root.graph);
  restored.macros = imported.definitions;
  const messages: unknown[] = [];
  await restored.run((_node, properties) => {
    messages.push(properties.message);
    return Promise.resolve({});
  });
  assertEquals(messages, ["leaf"]);
  call.properties.macroId = "macro_parent";
  library[1].graph = parent.serialize();
  const recursive = exportMacroFile(parent, library, library[1]);
  assertEquals(recursive.macros?.map((macro) => macro.id), ["macro_parent"]);
  const copy = importMacroFile(recursive, "parent.json", library);
  const recursiveRoot = copy.definitions.find((macro) => macro.id === copy.id)!;
  assertEquals(recursiveRoot.graph.nodes[0].properties.macroId, copy.id);
  assertEquals(copy.definitions.find((macro) => macro.id === "macro_parent")!.graph, library[1].graph);
});
Deno.test("import adds graphs without overwriting existing macros, remapping indirect recursion and duplicate names", () => {
  const a = new Graph(), b = new Graph();
  a.add("macro", 0, 0).properties.macroId = "macro_b";
  b.add("macro", 0, 0).properties.macroId = "macro_a";
  const library: MacroDefinition[] = [{ id: "macro_a", name: "A", graph: a.serialize() }, { id: "macro_b", name: "B", graph: b.serialize() }];
  const file = exportMacroFile(a, library, library[0]);
  const imported = importMacroFile(file, "a.json", library);
  assertEquals(imported.definitions.length, 4);
  assertEquals(imported.definitions.slice(0, 2), library);
  const root = imported.definitions.find((macro) => macro.id === imported.id)!;
  const dependency = imported.definitions.find((macro) => macro.id === root.graph.nodes[0].properties.macroId)!;
  assertEquals(root.name, "A (2)");
  assertEquals(dependency.name, "B (2)");
  assertEquals(dependency.graph.nodes[0].properties.macroId, imported.id);
  const raw = importMacroFile(new Graph().serialize(), "Working graph.json", []);
  assertEquals(raw.definitions[0].name, "Working graph");
});
