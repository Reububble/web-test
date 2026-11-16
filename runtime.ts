/**
 * Execution runtimes and events for embedding Web Test in Deno applications.
 *
 * {@link BrowserSession} serializes browser actions and owns element references.
 * {@link GraphRun} executes a {@link Graph}, including console-triggered branches.
 * {@link ScriptRun} evaluates JavaScript in a separate permissionless Deno process
 * and routes browser calls through the supplied session. Run events let editors
 * report progress, logs, screenshots, errors, and overlapping async invocations.
 *
 * Call `cancel()` to stop a run, then close its browser session to release resources.
 *
 * @example
 * ```ts
 * import { BrowserSession, ScriptRun } from "@reububble/web-test/runtime";
 *
 * const session = new BrowserSession();
 * const run = new ScriptRun("console.info('hello');", session, console.log);
 * try {
 *   await run.start();
 * } finally {
 *   await run.cancel();
 *   await session.close();
 * }
 * ```
 *
 * @module
 */
export { BrowserSession, InvalidAction } from "web-test/runtime/browser.ts";
export { BrowserLauncher } from "web-test/runtime/browser_launcher.ts";
export type { BrowserLaunchOptions, BrowserLifecycle } from "web-test/runtime/browser_launcher.ts";
export type { BrowserContext, BrowserProcessContext } from "web-test/nodes/browser_context.ts";
export { GraphRun } from "web-test/runtime/graph_run.ts";
export type { RunEvent } from "web-test/run_events.ts";
export { ScriptRun } from "web-test/runtime/script_run.ts";
export type { AsyncOutcome, ScriptEvent } from "web-test/runtime/script_events.ts";
export { Graph, inputs, outputs } from "web-test/graph.ts";
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
export type { Value } from "web-test/graph.ts";
export type { JsonValue } from "web-test/nodes/base.ts";
export { copyValue, parseValue, stringifyValue } from "web-test/value.ts";
