import { BaseNode, type NodeType, type ResolveInput, type Value } from "web-test/nodes/base.ts";
import { resolveDescriptor, type TypeReference, type ValueOf } from "web-test/nodes/type_descriptor.ts";
import { copyValue } from "web-test/value.ts";

type Values = Record<string, Value>;
/** Named data-port schemas for a control node, including defaults and deferred-publication metadata. */
export type ControlPorts = Readonly<Record<string, { label: string; type: TypeReference; default?: Value; deferred?: boolean; syncDefault?: boolean }>>;
/** Map a control node's named data-port descriptors to their mutable runtime value record. */
export type ControlValues<Ports extends ControlPorts> = { -readonly [Key in keyof Ports]: ValueOf<Ports[Key]["type"]> };
type DeferredKeys<Ports extends ControlPorts> = { [Key in keyof Ports]: Ports[Key] extends { deferred: true } ? Key : never }[keyof Ports];
/** A control step's output values, with deferred outputs optional until the process publishes them. */
export type StepValues<Ports extends ControlPorts> = Omit<ControlValues<Ports>, DeferredKeys<Ports>> & Partial<Pick<ControlValues<Ports>, DeferredKeys<Ports>>>;
type CheckedPorts<Ports extends ControlPorts> = { [Key in keyof Ports]: { default?: ValueOf<Ports[Key]["type"]> } };
type FlowPorts<Keys extends string> = { readonly [Key in Keys]: { label: string; type: "flow" } };
/** A control process result containing output values and an optional branch name to execute. */
export type ControlStep<Control extends string = string, Outputs extends Values = Values> = Outputs & { control?: Control };
/** The latest published outputs and connection information visible to a control process. */
export interface ControlState<Outputs extends Values> {
  /** The most recently published output record for this invocation. */
  readonly output: Readonly<Outputs>;
  /** Check whether a named control output has a graph connection. */
  readonly connected?: (control: string) => boolean;
  /** The current ordered control-output names, including dynamic branches when present. */
  readonly controls?: readonly string[];
}
/** A handler that returns a control step or yields steps while receiving freshly resolved inputs on resumption. */
export type ControlProcess<Inputs extends Values, Outputs extends Values, Control extends string> = (
  inputs: Inputs,
  state: ControlState<Outputs>,
) => ControlStep<Control, Outputs> | Generator<ControlStep<Control, Outputs>, ControlStep<Control, Outputs>, Inputs>;
/** Schemas and named process handlers for a control node, including its entry and branch outputs. */
export interface ControlDefinition<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string> {
  /** The declarative execution category; omitted for structured control definitions. */
  kind?: never;
  /** Persisted type configuration; unavailable on this non-configured definition. */
  config?: never;
  /** The saved node identifier or resolved runtime port type tag. */
  type: NodeType;
  /** The node's display title used by editors and validation errors. */
  title: string;
  /** Explanatory text displayed by the editor for this node. */
  help?: string;
  /** Named branch outputs available to the control process. */
  control: Controls | ((properties: Values) => Controls);
  /** Saved node properties, including default values for unconnected inputs. */
  properties?: () => Values;
  /** Synchronize dynamic control outputs with saved properties and connected port names. */
  syncOutputs?: (properties: Values, connected: (key: string) => boolean) => void;
  /** Named input-port schemas used to validate and resolve incoming values. */
  inputs: Inputs & CheckedPorts<Inputs>;
  /** Named output-port schemas used to validate published values. */
  outputs: Outputs & CheckedPorts<Outputs>;
  /** The default control-input name, selected from the process handlers when omitted. */
  entry?: Entry;
  /** Whether branch data is refreshed between yielded steps; defaults to true. */
  refreshBranches?: boolean;
  /** The typed handler or named handlers that compute outputs for the node. */
  process: Record<Entry, ControlProcess<ControlValues<NoInfer<Inputs>>, StepValues<NoInfer<Outputs>>, NoInfer<Controls[number]>>>;
}
/** An active control handler that can advance, receive branch errors, or unwind its generator. */
export interface ControlInvocation {
  /** Whether the invocation suspends and resumes around branch execution. */
  readonly scoped: boolean;
  /** Advance the invocation and return its next yielded step or final result. */
  next(): IteratorResult<ControlStep, ControlStep>;
  /** Deliver a branch error to the suspended handler so it can catch or unwind it. */
  throw(error: unknown): IteratorResult<ControlStep, ControlStep>;
  /** Unwind the suspended generator and run its synchronous cleanup without scheduling further branches. */
  close(): void;
}

/** Structured control transfer bypasses application Catch handlers while still running Finally. */
export class ControlTransfer extends Error {
  /** Identify the active node and control input that should receive the structured transfer. */
  constructor(readonly nodeId: string, readonly input: string) {
    super("Control transfer");
  }
}

/** Runtime interface; the factory retains concrete types on each node's process handlers. */
export abstract class ControlNode extends BaseNode {
  /** The default control-input name, selected from the process handlers when omitted. */
  abstract readonly entry: string;
  /** Control-input names that interrupt an active invocation of this node. */
  abstract readonly interrupts: readonly string[];
  /** Named branch outputs available to the control process. */
  abstract readonly control: readonly string[];
  /** Whether branch data is refreshed between yielded steps; defaults to true. */
  abstract readonly refreshBranches: boolean;
  /** Whether execution requires an async action or structured control invocation. */
  override get asynchronous(): boolean {
    return true;
  }
  /** Create the invocation's initial output defaults, leaving deferred outputs unpublished. */
  abstract initialOutput(): Values;
  /** Start a named control handler with resolved inputs and current invocation state. */
  abstract invoke(entry: string, resolve: ResolveInput, state: ControlState<Values>): ControlInvocation;
  /** Validate a yielded or returned control step and separate its branch name from data outputs. */
  abstract validateStep(step: ControlStep): { control?: string; values: Values };
}

/** A control node with concrete data schemas, flow-port names, and typed process handlers. */
export interface ControlNodeInstance<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string>
  extends ControlNode {
  /** Saved node properties, including default values for unconnected inputs. */
  properties: ControlValues<Inputs>;
  /** Named input-port schemas used to validate and resolve incoming values. */
  readonly inputs: Inputs & FlowPorts<Entry>;
  /** Named output-port schemas used to validate published values. */
  readonly outputs: Outputs & FlowPorts<Controls[number]>;
  /** The typed handler or named handlers that compute outputs for the node. */
  readonly process: ControlDefinition<Inputs, Outputs, Controls, Entry>["process"];
}
/** Constructs a control node whose data ports and control entry names are statically known. */
export interface ControlNodeConstructor<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string> {
  /** Construct a new node at the supplied horizontal and vertical workspace coordinates. */
  new (x: number, y: number): ControlNodeInstance<Inputs, Outputs, Controls, Entry>;
  /** The node's display title used by editors and validation errors. */
  readonly title: string;
}

/** Implementation used by defineNode's control-process overload. */
export function defineControlNode<
  const Inputs extends ControlPorts,
  const Outputs extends ControlPorts,
  const Controls extends readonly string[],
  Entry extends string,
>(
  definition: ControlDefinition<Inputs, Outputs, Controls, Entry>,
): ControlNodeConstructor<Inputs, Outputs, Controls, Entry> {
  type Step = ControlStep<Controls[number], StepValues<Outputs>>;
  type ProcessGenerator = Generator<Step, Step, ControlValues<Inputs>>;
  const entries = Object.keys(definition.process) as Entry[];
  const entry = definition.entry ?? entries[0];
  if (!entry || !entries.includes(entry)) throw new Error("Select a declared control entry.");
  const controls = (properties: Values): Controls => typeof definition.control === "function" ? definition.control(properties) : definition.control;
  const initialControls = controls(definition.properties?.() ?? {});
  if (new Set(initialControls).size !== initialControls.length) throw new Error("Control output names must be unique.");
  if (entries.some((key) => Object.hasOwn(definition.inputs, key))) throw new Error("Control entries must differ from data input names.");
  if (Object.hasOwn(definition.outputs, "control") || initialControls.some((key) => Object.hasOwn(definition.outputs, key))) {
    throw new Error("Control output names must differ from data output names and the reserved control field.");
  }
  const defaults = (ports: ControlPorts): Values => {
    const values: Values = {};
    for (const [key, port] of Object.entries(ports)) {
      if (port.deferred) continue;
      const descriptor = resolveDescriptor(port.type);
      values[key] = copyValue(descriptor.read(port.default === undefined ? descriptor.defaultValue() : port.default, port.label));
    }
    return values;
  };
  const flowPorts = <Key extends string>(keys: readonly Key[]): FlowPorts<Key> =>
    Object.fromEntries(keys.map((key) => [key, { label: (key.charAt(0).toUpperCase() + key.slice(1)).replaceAll("_", " "), type: "flow" }])) as FlowPorts<Key>;
  return class extends ControlNode {
    static readonly title = definition.title;
    readonly title = definition.title;
    readonly type = definition.type;
    override readonly help = definition.help ?? "";
    readonly entry = entry;
    readonly interrupts = entries.filter((key) => key !== entry);
    get control(): Controls {
      return controls(this.properties);
    }
    readonly refreshBranches = definition.refreshBranches ?? true;
    readonly inputs = { ...flowPorts(entries), ...definition.inputs };
    get outputs(): Outputs & FlowPorts<Controls[number]> {
      return { ...flowPorts(this.control), ...definition.outputs };
    }
    readonly process = definition.process;
    declare properties: ControlValues<Inputs>;
    constructor(x: number, y: number) {
      super(x, y, { ...definition.properties?.(), ...defaults(definition.inputs) });
    }
    override syncInputs(_connected: (key: string) => boolean, _resolve: ResolveInput, outputConnected: (key: string) => boolean = () => false): void {
      definition.syncOutputs?.(this.properties, outputConnected);
    }
    initialOutput(): Values {
      return defaults(definition.outputs);
    }
    invoke(input: string, resolve: ResolveInput, state: ControlState<Values>): ControlInvocation {
      if (!Object.hasOwn(this.process, input)) throw new Error(`Unknown ${this.title} control input: ${input}`);
      // Accessors resolve and validate on consumption, including after a generator resumes.
      const readInputs = (): ControlValues<Inputs> => {
        const values: Values = {};
        for (const [key, port] of Object.entries(definition.inputs)) {
          Object.defineProperty(values, key, { enumerable: true, get: () => resolveDescriptor(port.type).read(resolve(key), `${this.title} ${port.label}`) });
        }
        return values as ControlValues<Inputs>;
      };
      const processState = state as ControlState<StepValues<Outputs>>;
      Object.assign(processState, { controls: this.control });
      const result = this.process[input as Entry](readInputs(), processState);
      const isGenerator = (value: typeof result): value is ProcessGenerator =>
        "next" in value && typeof value.next === "function" && "return" in value && typeof value.return === "function";
      if (!isGenerator(result)) {
        return {
          scoped: false,
          next: () => ({ done: true, value: result }),
          throw(error) {
            throw error;
          },
          close() {},
        };
      }
      return {
        scoped: true,
        next: () => result.next(readInputs()),
        throw: (error) => result.throw(error),
        close() {
          // Closing discards cleanup yields; they cannot schedule branches during unwinding.
          const final = { ...state.output } as Step;
          let closed = result.return(final);
          while (!closed.done) closed = result.return(final);
        },
      };
    }
    validateStep(step: ControlStep): { control?: string; values: Values } {
      if (step.control !== undefined && !this.control.includes(step.control)) throw new Error(`Unknown ${this.title} control output: ${step.control}`);
      const { control, ...values } = step;
      if (Object.keys(values).some((key) => !Object.hasOwn(definition.outputs, key))) throw new Error(`${this.title} returned unexpected data outputs.`);
      for (const [key, port] of Object.entries(definition.outputs)) {
        if (!Object.hasOwn(values, key)) {
          if (port.deferred) continue;
          throw new Error(`${this.title} returned unexpected data outputs: missing ${port.label}.`);
        }
        resolveDescriptor(port.type).read(values[key], `${this.title} ${port.label}`);
      }
      return { control, values };
    }
  };
}
