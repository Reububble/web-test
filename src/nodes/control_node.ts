import { BaseNode, type NodeType, type ResolveInput, type Value } from "web-test/nodes/base.ts";
import { resolveDescriptor, type TypeReference, type ValueOf } from "web-test/nodes/type_descriptor.ts";
import { copyValue } from "web-test/value.ts";

type Values = Record<string, Value>;
export type ControlPorts = Readonly<Record<string, { label: string; type: TypeReference; default?: Value; deferred?: boolean; syncDefault?: boolean }>>;
export type ControlValues<Ports extends ControlPorts> = { -readonly [Key in keyof Ports]: ValueOf<Ports[Key]["type"]> };
type DeferredKeys<Ports extends ControlPorts> = { [Key in keyof Ports]: Ports[Key] extends { deferred: true } ? Key : never }[keyof Ports];
export type StepValues<Ports extends ControlPorts> = Omit<ControlValues<Ports>, DeferredKeys<Ports>> & Partial<Pick<ControlValues<Ports>, DeferredKeys<Ports>>>;
type CheckedPorts<Ports extends ControlPorts> = { [Key in keyof Ports]: { default?: ValueOf<Ports[Key]["type"]> } };
type FlowPorts<Keys extends string> = { readonly [Key in Keys]: { label: string; type: "flow" } };
export type ControlStep<Control extends string = string, Outputs extends Values = Values> = Outputs & { control?: Control };
export interface ControlState<Outputs extends Values> {
  readonly output: Readonly<Outputs>;
  readonly connected?: (control: string) => boolean;
  readonly controls?: readonly string[];
}
export type ControlProcess<Inputs extends Values, Outputs extends Values, Control extends string> = (
  inputs: Inputs,
  state: ControlState<Outputs>,
) => ControlStep<Control, Outputs> | Generator<ControlStep<Control, Outputs>, ControlStep<Control, Outputs>, Inputs>;
export interface ControlDefinition<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string> {
  kind?: never;
  config?: never;
  type: NodeType;
  title: string;
  help?: string;
  control: Controls | ((properties: Values) => Controls);
  properties?: () => Values;
  syncOutputs?: (properties: Values, connected: (key: string) => boolean) => void;
  inputs: Inputs & CheckedPorts<Inputs>;
  outputs: Outputs & CheckedPorts<Outputs>;
  entry?: Entry;
  refreshBranches?: boolean;
  process: Record<Entry, ControlProcess<ControlValues<NoInfer<Inputs>>, StepValues<NoInfer<Outputs>>, NoInfer<Controls[number]>>>;
}
export interface ControlInvocation {
  readonly scoped: boolean;
  next(): IteratorResult<ControlStep, ControlStep>;
  throw(error: unknown): IteratorResult<ControlStep, ControlStep>;
  close(): void;
}

/** Structured control transfer bypasses application Catch handlers while still running Finally. */
export class ControlTransfer extends Error {
  constructor(readonly nodeId: string, readonly input: string) {
    super("Control transfer");
  }
}

/** Runtime interface; the factory retains concrete types on each node's process handlers. */
export abstract class ControlNode extends BaseNode {
  abstract readonly entry: string;
  abstract readonly interrupts: readonly string[];
  abstract readonly control: readonly string[];
  abstract readonly refreshBranches: boolean;
  override get asynchronous(): boolean {
    return true;
  }
  abstract initialOutput(): Values;
  abstract invoke(entry: string, resolve: ResolveInput, state: ControlState<Values>): ControlInvocation;
  abstract validateStep(step: ControlStep): { control?: string; values: Values };
}

export interface ControlNodeInstance<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string>
  extends ControlNode {
  properties: ControlValues<Inputs>;
  readonly inputs: Inputs & FlowPorts<Entry>;
  readonly outputs: Outputs & FlowPorts<Controls[number]>;
  readonly process: ControlDefinition<Inputs, Outputs, Controls, Entry>["process"];
}
export interface ControlNodeConstructor<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string> {
  new (x: number, y: number): ControlNodeInstance<Inputs, Outputs, Controls, Entry>;
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
