/** Browser sessions and exported pipeline execution for Deno. @module */
export { createBrowserSession } from "@local/web-test/browser";
export type { ActionResult, AutomationSession, JsonValue, Page, Value } from "@local/web-test/browser";
export { runPipelineFile } from "@local/web-test/pipeline";
export type { PipelineOptions } from "@local/web-test/pipeline";
export { copyValue, parseValue, stringifyValue } from "web/value.ts";

export { BrowserLauncher } from "@local/web-test/browser";
export type { BrowserLaunchOptions, BrowserLifecycle } from "@local/web-test/browser";
export type { BrowserContext, BrowserProcessContext } from "web/nodes/browser_context.ts";
export { defineFunctionNode } from "web/nodes/function_node.ts";
export type { FunctionNode, FunctionNodeConstructor } from "web/nodes/function_node.ts";
export { defineNode } from "web/nodes/define_node.ts";
export type { ConfigurableFunctionNode, ResolvedConfig } from "web/nodes/define_node.ts";
export type {
  DataValues,
  DeclarativeNodeConstructor,
  DeclarativeNodeInstance,
  EventSource,
  ExecutionServices,
  NodeContext,
  NodeDefinition,
} from "web/nodes/declarative_node.ts";
export type { ControlInvocation, ControlNodeInstance, ControlProcess, ControlState, ControlStep } from "web/nodes/control_node.ts";
export type { ControlDefinition, ControlPorts, ControlValues, StepValues } from "web/nodes/control_node.ts";
export { ArrayDescriptor, OptionalDescriptor, TypeConfig, typeDescriptor } from "web/nodes/type_descriptor.ts";
export type { Optional, TypeDescriptor, ValueOf } from "web/nodes/type_descriptor.ts";
