import type { TypeDescriptor } from "web/nodes/type_descriptor.ts";

type BuiltinNodeType = "navigate" | "click" | "extract_text" | "conditional" | "comparison" | "text_literal" | "boolean_literal";
export type ExtraNodeType =
  | "comment"
  | "fail"
  | "try_catch_finally"
  | "macro"
  | "number_comparison"
  | "string_length"
  | "string_at"
  | "boolean_and"
  | "boolean_or"
  | "boolean_not"
  | "boolean_xor"
  | "boolean_nand"
  | "boolean_nor"
  | "boolean_xnor"
  | "while"
  | "for"
  | "element_variable"
  | "json_variable"
  | "array_literal"
  | "array_creator"
  | "array_length"
  | "array_concat"
  | "array_slice"
  | "array_at"
  | "array_for_each"
  | "array_map"
  | "array_filter"
  | "array_some"
  | "array_every"
  | "array_reduce"
  | "array_join"
  | "array_from_json"
  | "array_to_json"
  | "conditional_value"
  | "reset_browser"
  | "log"
  | "string_concat"
  | "string_format"
  | "console_trigger"
  | "remove_listener"
  | "sequence"
  | "file_read"
  | "script"
  | "query_selector"
  | "query_selector_all"
  | "text_content"
  | "get_attribute"
  | "set_value"
  | "type_text"
  | "element_click"
  | "wait_selector"
  | "delay"
  | "page_info"
  | "number_literal"
  | "json_parse"
  | "json_stringify";
export type NodeType = BuiltinNodeType | ExtraNodeType;
export type DataType = "text" | "boolean" | "number" | "json" | "element" | "instant" | "array" | "listener";
export type PortType = "flow" | DataType;
export function acceptsPortType(output: PortType, input: PortType): boolean {
  return output === input || (input === "json" && ["text", "boolean", "number", "array"].includes(output));
}
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Value = string | number | boolean | null | Temporal.Instant | Value[] | { [key: string]: Value };
export interface Port {
  key: string;
  label: string;
  type: PortType;
  optional?: boolean;
}
export type PortDefinition = Omit<Port, "key" | "type"> & { type: PortType | TypeDescriptor<Value> };
export type PortRecord = Readonly<Record<string, PortDefinition>>;
export function listPorts(ports: PortRecord): Port[] {
  return Object.entries(ports).map(([key, definition]) => {
    const { type, ...metadata } = definition;
    return typeof type === "string" ? { ...metadata, key, type } : { ...metadata, key, type: type.type, ...(type.optional ? { optional: true } : {}) };
  });
}
export type ResolveInput = (key: string) => Value;
export abstract class BaseNode {
  id = `node_${crypto.randomUUID()}`;
  abstract readonly type: NodeType;
  abstract readonly title: string;
  abstract readonly inputs: PortRecord;
  abstract readonly outputs: PortRecord;
  readonly dataOnly: boolean = false;
  readonly eventTrigger: boolean = false;
  readonly browserAction: boolean = false;
  get asynchronous(): boolean {
    return this.browserAction;
  }
  readonly localAction: boolean = false;
  readonly filePicker: boolean = false;
  readonly dynamicPorts: boolean = false;
  readonly removableInputs: boolean = false;
  readonly multilineInputs: string[] = [];
  readonly help: string = "";
  readonly options?: { key: string; label: string; choices: [string, string][]; changesPorts?: boolean };
  readonly extraOptions: NonNullable<BaseNode["options"]>[] = [];
  constructor(public xPos: number, public yPos: number, public properties: Record<string, Value>) {}
  flowOutput(_resolve: ResolveInput): string {
    return "next";
  }
  syncInputs(_connected: (key: string) => boolean, _resolve: ResolveInput, _outputConnected: (key: string) => boolean = () => false): void {}
  removeInput(_key: string): void {}
  dataValue(_output: string, _resolve: ResolveInput): Value {
    throw new Error(`${this.title} provides its data after execution.`);
  }
  /** Evaluate one requested output, or an atomic output record for function nodes. */
  evaluate(output: string, resolve: ResolveInput): Record<string, Value> {
    return { [output]: this.dataValue(output, resolve) };
  }
}
