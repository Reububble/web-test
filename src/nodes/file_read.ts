import { defineNode } from "web/nodes/define_node.ts";
export const FileReadNode = defineNode({
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
