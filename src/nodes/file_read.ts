import type { DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { defineNode } from "web-test/nodes/define_node.ts";
export const FileReadNode: DeclarativeNodeConstructor<
  {},
  {
    readonly text: { readonly label: "Text"; readonly type: "text" };
    readonly name: { readonly label: "Filename"; readonly type: "text" };
    readonly size: { readonly label: "Bytes"; readonly type: "number" };
    readonly loaded: { readonly label: "Loaded"; readonly type: "boolean" };
  },
  { contents: string; name: string; size: number; loaded: boolean }
> = defineNode({
  kind: "data",
  type: "file_read",
  title: "File Read",
  help: "Choose a local text file at runtime (PEM, JS, JSON, CSV, etc.). Its contents stay in this graph until sent to a connected browser action.",
  filePicker: true,
  inputs: {},
  outputs: {
    text: { label: "Text", type: "text" },
    name: { label: "Filename", type: "text" },
    size: { label: "Bytes", type: "number" },
    loaded: { label: "Loaded", type: "boolean" },
  },
  properties: (): { contents: string; name: string; size: number; loaded: boolean } => ({ contents: "", name: "", size: 0, loaded: false }),
  process: {
    text(_inputs, { properties }) {
      if (!properties.loaded) throw new Error("Choose a file in File Read first.");
      return properties.contents;
    },
    name(_inputs, { properties }) {
      if (!properties.loaded) throw new Error("Choose a file in File Read first.");
      return properties.name;
    },
    size(_inputs, { properties }) {
      if (!properties.loaded) throw new Error("Choose a file in File Read first.");
      return properties.size;
    },
    loaded: (_inputs, { properties }) => properties.loaded,
  },
});
