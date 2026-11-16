/** Browser sessions and exported pipeline execution for Deno. @module */
export { createBrowserSession } from "@reububble/web-test/browser";
export type { ActionResult, AutomationSession, JsonValue, Page, Value } from "@reububble/web-test/browser";
export { runPipelineFile } from "@reububble/web-test/pipeline";
export type { PipelineOptions } from "@reububble/web-test/pipeline";
export { copyValue, parseValue, stringifyValue } from "web-test/value.ts";

export { BrowserLauncher } from "@reububble/web-test/browser";
export type { BrowserLaunchOptions, BrowserLifecycle } from "@reububble/web-test/browser";
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
