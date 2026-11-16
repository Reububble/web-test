/**
 * Browser-action metadata and script-port validation for editor integrations.
 *
 * {@link scriptActions} maps the generated JavaScript `browser` methods to runtime
 * actions and positional argument names. {@link readScriptPorts} validates named
 * input/output declarations before a script runs. These exports do not launch a
 * browser or start a workflow and can be used by a browser-based editor.
 *
 * @example
 * ```ts
 * import { readScriptPorts, scriptActions } from "@reububble/web-test/script";
 *
 * const ports = readScriptPorts([{ name: "message", type: "text" }]);
 * console.log(ports[0].name); // "message"
 * console.log(scriptActions.navigate.inputs); // ["url"]
 * ```
 *
 * @module
 */
export { scriptActions } from "web-test/runtime/script_actions.ts";
export { readScriptPorts } from "web-test/script_schema.ts";
export type { ScriptPort } from "web-test/script_schema.ts";
