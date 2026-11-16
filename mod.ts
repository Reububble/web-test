/** Browser sessions and exported pipeline execution for Deno. @module */
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
