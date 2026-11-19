import type { TypeDescriptor } from "web-test/nodes/type_descriptor.ts";

type BuiltinNodeType = "navigate" | "click" | "extract_text" | "conditional" | "comparison" | "text_literal" | "boolean_literal";
/** Additional built-in node identifiers beyond the original browser and literal node catalog. */
export type ExtraNodeType =
  | "pointer_down"
  | "pointer_move"
  | "pointer_up"
  | "release_inputs"
  | "viewport_size"
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
/** Supported built-in node identifiers used in saved graphs and the node registry. */
export type NodeType = BuiltinNodeType | ExtraNodeType;
/** Built-in runtime data-port tags, including arrays, instants, and session-owned references. */
export type DataType = "text" | "boolean" | "number" | "json" | "element" | "instant" | "array" | "listener";
/** A flow connection or one of the built-in data-port tags. */
export type PortType = "flow" | DataType;
/** Check whether an output type can connect to an input, including scalar and array inputs accepted by JSON ports. */
export function acceptsPortType(output: PortType, input: PortType): boolean {
  return output === input || (input === "json" && ["text", "boolean", "number", "array"].includes(output));
}
/** Finite JSON-compatible primitives, arrays, and plain records; excludes Temporal instants. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/** Runtime graph values, including JSON-like records, arrays, reference records, and Temporal.Instant values. */
export type Value = string | number | boolean | null | Temporal.Instant | Value[] | { [key: string]: Value };
/** Editor-facing metadata for a named graph port and its resolved runtime type. */
export interface Port {
  /** The unique connection name of this port. */
  key: string;
  /** The editor-facing display label for this port. */
  label: string;
  /** The built-in catalog identifier used when saving or reconstructing this node. */
  type: PortType;
  /** Whether null is accepted as an absent value for this data port. */
  optional?: boolean;
}
/** Port metadata before a custom type descriptor is projected to its built-in type tag. */
export type PortDefinition = Omit<Port, "key" | "type"> & { type: PortType | TypeDescriptor<Value> };
/** A read-only record of port definitions keyed by their unique connection names. */
export type PortRecord = Readonly<Record<string, PortDefinition>>;
/** Project named port definitions into a list with resolved type tags and descriptor optionality. */
export function listPorts(ports: PortRecord): Port[] {
  return Object.entries(ports).map(([key, definition]) => {
    const { type, ...metadata } = definition;
    return typeof type === "string" ? { ...metadata, key, type } : { ...metadata, key, type: type.type, ...(type.optional ? { optional: true } : {}) };
  });
}
/** Resolve a named input port to its current runtime graph value. */
export type ResolveInput = (key: string) => Value;
/** Common graph-node identity, saved properties, editor metadata, and data-evaluation hooks. */
export abstract class BaseNode {
  /** The stable identifier used by saved graph records and connections. */
  id = `node_${crypto.randomUUID()}`;
  /** The saved node identifier or resolved runtime port type tag. */
  abstract readonly type: NodeType;
  /** The node's display title used by editors and validation errors. */
  abstract readonly title: string;
  /** Named input-port schemas used to validate and resolve incoming values. */
  abstract readonly inputs: PortRecord;
  /** Named output-port schemas used to validate published values. */
  abstract readonly outputs: PortRecord;
  /** Whether this node evaluates solely through its data dependencies. */
  readonly dataOnly: boolean = false;
  /** Whether this node installs an event subscription when entered by flow. */
  readonly eventTrigger: boolean = false;
  /** Whether the node executes against the automated browser session. */
  readonly browserAction: boolean = false;
  /** Whether execution requires an async action or structured control invocation. */
  get asynchronous(): boolean {
    return this.browserAction;
  }
  /** Whether execution is delegated to the embedding application's local services. */
  readonly localAction: boolean = false;
  /** Whether the editor offers a file picker for this node's saved input. */
  readonly filePicker: boolean = false;
  /** Whether the node's named port set can change with properties or connections. */
  readonly dynamicPorts: boolean = false;
  /** Whether the editor may remove individual dynamic input ports. */
  readonly removableInputs: boolean = false;
  /** Input names that should use multiline text editors. */
  readonly multilineInputs: string[] = [];
  /** Explanatory text displayed by the editor for this node. */
  readonly help: string = "";
  /** Saved option-key metadata and editor choices, including whether a selection changes ports. */
  readonly options?: { key: string; label: string; choices: [string, string][]; changesPorts?: boolean };
  /** Additional persisted option selections displayed alongside the primary option. */
  readonly extraOptions: NonNullable<BaseNode["options"]>[] = [];
  /** Initialize a graph node's workspace coordinates and saved properties. */
  constructor(public xPos: number, public yPos: number, public properties: Record<string, Value>) {}
  /** Select the next named flow output using the node's resolved inputs. */
  flowOutput(_resolve: ResolveInput): string {
    return "next";
  }
  /** Rebuild dynamic port schemas and defaults from the graph's current properties and connections. */
  syncInputs(_connected: (key: string) => boolean, _resolve: ResolveInput, _outputConnected: (key: string) => boolean = () => false): void {}
  /** Remove a dynamic input from the node's saved editor properties. */
  removeInput(_key: string): void {}
  /** Resolve and validate one requested data output from the node's current inputs. */
  dataValue(_output: string, _resolve: ResolveInput): Value {
    throw new Error(`${this.title} provides its data after execution.`);
  }
  /** Evaluate one requested output, or an atomic output record for function nodes. */
  evaluate(output: string, resolve: ResolveInput): Record<string, Value> {
    return { [output]: this.dataValue(output, resolve) };
  }
}
