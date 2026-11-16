/**
 * Browser automation, graph execution, and typed node authoring for Deno.
 *
 * Create a lazy browser session with {@link createBrowserSession}, execute a saved
 * graph with {@link runPipelineFile}, or define reusable nodes with
 * {@link defineNode} and {@link defineFunctionNode}. Always close sessions after use.
 * Browser selection and executable paths belong to the embedding application's setup.
 *
 * The `/browser` entrypoint contains the browser lifecycle API; `/pipeline` runs
 * saved graphs; `/runtime` exposes graph and JavaScript run events; `/script`
 * provides the browser-action contract for editor integrations.
 *
 * @example
 * ```ts
 * import { createBrowserSession } from "@reububble/web-test";
 *
 * const session = createBrowserSession();
 * try {
 *   const page = await session.getPage();
 *   await page.goto("https://example.com");
 *   console.log(await page.title());
 * } finally {
 *   await session.close();
 * }
 * ```
 *
 * @module
 */
export { createBrowserSession } from "web-test/browser.ts";
export type { ActionResult, AutomationSession, JsonValue, Page, Value } from "web-test/browser.ts";
export { runPipelineFile } from "web-test/pipeline.ts";
export type { PipelineOptions } from "web-test/pipeline.ts";
export { copyValue, parseValue, stringifyValue } from "web-test/value.ts";

export { BrowserLauncher } from "web-test/browser.ts";
export type { BrowserLaunchOptions, BrowserLifecycle } from "web-test/browser.ts";
export type { BrowserContext, BrowserProcessContext } from "web-test/nodes/browser_context.ts";
export { defineFunctionNode } from "web-test/nodes/function_node.ts";
export type { FunctionNode, FunctionNodeConstructor } from "web-test/nodes/function_node.ts";
export { defineNode } from "web-test/nodes/define_node.ts";
export type {
  ConfigurableControlNodeConstructor,
  ConfigurableFunctionNode,
  ConfigurableFunctionNodeConstructor,
  ConfiguredControlBuilder,
  ConfiguredFunctionBuilder,
  ResolvedConfig,
} from "web-test/nodes/define_node.ts";
export type {
  DataValues,
  DeclarativeNodeConstructor,
  DeclarativeNodeInstance,
  EventSource,
  ExecutionServices,
  NodeContext,
  NodeDefinition,
} from "web-test/nodes/declarative_node.ts";
export type { ControlInvocation, ControlNodeInstance, ControlProcess, ControlState, ControlStep } from "web-test/nodes/control_node.ts";
export type { ControlDefinition, ControlPorts, ControlValues, StepValues } from "web-test/nodes/control_node.ts";
export { ArrayDescriptor, OptionalDescriptor, TypeConfig, typeDescriptor } from "web-test/nodes/type_descriptor.ts";
export type { Optional, TypeDescriptor, ValueOf } from "web-test/nodes/type_descriptor.ts";
