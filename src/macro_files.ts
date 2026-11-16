import { copyValue, stringifyValue } from "web-test/value.ts";
import { Graph, type MacroDefinition, type SerializedGraph } from "web-test/graph.ts";
export type MacroFile = SerializedGraph & { macro?: { id: string; name: string } };
export function exportMacroFile(graph: Graph, library: MacroDefinition[], macro?: { id: string; name: string }): MacroFile {
  const saved = graph.serialize();
  delete saved.macros;
  const dependencies = new Map<string, MacroDefinition>();
  const visit = (snapshot: SerializedGraph): void => {
    for (const node of snapshot.nodes) {
      if (node.type !== "macro" || typeof node.properties.macroId !== "string") continue;
      const id = node.properties.macroId;
      if (dependencies.has(id)) continue;
      const definition = library.find((item) => item.id === id);
      if (!definition) continue;
      // Preserve missing calls so execution reports the error.
      dependencies.set(id, definition);
      visit(definition.graph);
    }
  };
  visit(saved);
  return copyValue({
    ...saved,
    ...(dependencies.size ? { macros: [...dependencies.values()] } : {}),
    ...(macro ? { macro: { id: macro.id, name: macro.name } } : {}),
  });
}
export function importMacroFile(value: unknown, filename: string, existing: MacroDefinition[]): { definitions: MacroDefinition[]; id: string } {
  const graph = Graph.deserialize(value);
  const metadata = (value as MacroFile).macro;
  if (
    metadata !== undefined &&
    (!metadata || typeof metadata.id !== "string" || !/^macro_[\w-]+$/.test(metadata.id) || typeof metadata.name !== "string" || !metadata.name.trim())
  ) throw new Error("Invalid macro file metadata.");
  const { macros: dependencies = [], ...snapshot } = graph.serialize();
  const root: MacroDefinition = {
    id: metadata?.id ?? `macro_${crypto.randomUUID()}`,
    name: metadata?.name.trim() || filename.replace(/\.json$/i, "") || "Imported macro",
    graph: snapshot,
  };
  const incoming = [...dependencies.filter((item) => item.id !== root.id), root];
  const remap = new Map<string, string>();
  for (const item of incoming) {
    const collision = existing.find((macro) => macro.id === item.id);
    remap.set(item.id, collision ? `macro_${crypto.randomUUID()}` : item.id);
  }
  const definitions = copyValue(existing);
  for (const item of incoming) {
    const id = remap.get(item.id)!;
    if (definitions.some((macro) => macro.id === id)) continue;
    const saved = copyValue(item.graph);
    for (const node of saved.nodes) {
      if (node.type === "macro" && typeof node.properties.macroId === "string") {
        node.properties.macroId = remap.get(node.properties.macroId) ?? node.properties.macroId;
      }
    }
    let name = item.name, suffix = 2;
    while (definitions.some((macro) => macro.name === name)) name = `${item.name} (${suffix++})`;
    definitions.push({ id, name, graph: saved });
  }
  return { definitions, id: remap.get(root.id)! };
}
export function downloadMacroFile(file: MacroFile, name: string): void {
  const url = URL.createObjectURL(new Blob([stringifyValue(file, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  // Windows filenames must exclude control characters as well as reserved symbols.

  // deno-lint-ignore no-control-regex
  const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "workflow";
  link.download = `${safeName}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
