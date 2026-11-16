import { BaseNode, type NodeType, type PortRecord, type ResolveInput, type Value } from "web-test/nodes/base.ts";
import { resolveDescriptor, type ValueOf } from "web-test/nodes/type_descriptor.ts";
import type { BrowserSession } from "web-test/runtime/browser.ts";
import { copyValue } from "web-test/value.ts";
import { type BrowserProcessContext, InvalidAction } from "web-test/nodes/browser_context.ts";

type Values = Record<string, Value>;
export type DataValues<Ports extends PortRecord> = {
  -readonly [Key in keyof Ports as Ports[Key]["type"] extends "flow" ? never : Key]: ValueOf<Exclude<Ports[Key]["type"], "flow">>;
};
export interface NodeContext<Properties extends Values, State extends object> {
  properties: Properties;
  state: State;
}
export interface ExecutionServices {
  execute(node: BaseNode, properties: Values): Promise<Values>;
  call(macroId: string): Promise<void>;
  removeListener(listener: { listenerId: string }): boolean;
}
export type EventSource = Pick<BrowserSession, "onConsole" | "getPage">;
type Schema<Ports, Properties extends Values, State extends object> = Ports | ((context: NodeContext<Properties, State>) => Ports);
type DataProcess<Inputs extends PortRecord, Outputs extends PortRecord, Properties extends Values, State extends object> =
  | ((inputs: DataValues<Inputs>, context: NodeContext<Properties, State>) => DataValues<Outputs>)
  | { [Key in keyof DataValues<Outputs>]: (inputs: DataValues<Inputs>, context: NodeContext<Properties, State>) => DataValues<Outputs>[Key] };
type CheckedDefaults<Inputs extends PortRecord, Properties extends Values> = string extends keyof Inputs | keyof Properties ? Properties
  : Properties & { [Key in keyof Properties & keyof DataValues<Inputs>]: DataValues<Inputs>[Key] };
type Metadata<Inputs extends PortRecord, Outputs extends PortRecord, Properties extends Values, State extends object> = {
  control?: never;
  config?: never;
  type: NodeType;
  title: string;
  help?: string;
  properties: (() => Properties) & (() => CheckedDefaults<NoInfer<Inputs>, NoInfer<Properties>>);
  state?: () => State;
  inputs: Schema<Inputs, NoInfer<Properties>, NoInfer<State>>;
  outputs: Schema<Outputs, NoInfer<Properties>, NoInfer<State>>;
  options?: Schema<NonNullable<BaseNode["options"]>, NoInfer<Properties>, NoInfer<State>>;
  extraOptions?: NonNullable<BaseNode["options"]>[];
  multilineInputs?: string[];
  dynamicPorts?: boolean;
  removableInputs?: boolean;
  filePicker?: boolean;
  syncInputs?: (context: NodeContext<NoInfer<Properties>, NoInfer<State>>, connected: (key: string) => boolean, resolve: ResolveInput) => void;
  removeInput?: (context: NodeContext<NoInfer<Properties>, NoInfer<State>>, key: string) => void;
  setMacros?: (context: NodeContext<NoInfer<Properties>, NoInfer<State>>, macros: { id: string; name: string }[]) => void;
};
export type NodeDefinition<Inputs extends PortRecord, Outputs extends PortRecord, Properties extends Values, State extends object> =
  & Metadata<Inputs, Outputs, Properties, State>
  & (
    | { kind: "data"; process: DataProcess<NoInfer<Inputs>, NoInfer<Outputs>, NoInfer<Properties>, NoInfer<State>> }
    | { kind: "local" | "annotation" }
    | {
      kind: "browser";
      screenshot?: boolean;
      interruptBrowser?: boolean;
      process: (
        inputs: DataValues<NoInfer<Inputs>>,
        context: NodeContext<NoInfer<Properties>, NoInfer<State>> & BrowserProcessContext,
      ) => DataValues<NoInfer<Outputs>> | Promise<DataValues<NoInfer<Outputs>>>;
    }
    | {
      kind: "action";
      process: (
        inputs: DataValues<NoInfer<Inputs>>,
        context: NodeContext<NoInfer<Properties>, NoInfer<State>> & ExecutionServices,
      ) => DataValues<NoInfer<Outputs>> | Promise<DataValues<NoInfer<Outputs>>>;
    }
    | {
      kind: "event";
      subscribe: (source: EventSource, context: NodeContext<NoInfer<Properties>, NoInfer<State>>, emit: (values: Values) => void) => () => void;
      prepare?: (source: EventSource) => Promise<unknown>;
    }
  );

/** Shared runtime contract for declarative data, action, event and editor nodes. */
export abstract class DeclarativeNode extends BaseNode {
  abstract readonly kind: "data" | "browser" | "local" | "action" | "event" | "annotation";
  abstract run(resolve: ResolveInput, services: ExecutionServices): Promise<Values>;
  abstract readonly captureScreenshot: boolean;
  abstract readonly interruptBrowser: boolean;
  abstract runBrowser(context: BrowserProcessContext): Promise<Values>;
  abstract subscribe(source: EventSource, emit: (values: Values) => void): () => void;
  abstract prepare(source: EventSource): Promise<unknown>;
  abstract setMacros(macros: { id: string; name: string }[]): void;
}
export interface DeclarativeNodeInstance<Inputs extends PortRecord, Outputs extends PortRecord, Properties extends Values> extends DeclarativeNode {
  properties: Properties;
  readonly inputs: Inputs;
  readonly outputs: Outputs;
}
export interface DeclarativeNodeConstructor<Inputs extends PortRecord, Outputs extends PortRecord, Properties extends Values> {
  new (x: number, y: number): DeclarativeNodeInstance<Inputs, Outputs, Properties>;
  readonly title: string;
}

export function defineDeclarativeNode<
  const Inputs extends PortRecord,
  const Outputs extends PortRecord,
  Properties extends Values,
  State extends object = object,
>(
  definition: NodeDefinition<Inputs, Outputs, Properties, State>,
): DeclarativeNodeConstructor<Inputs, Outputs, Properties> {
  return class extends DeclarativeNode {
    static readonly title = definition.title;
    readonly title = definition.title;
    readonly type = definition.type;
    readonly kind = definition.kind;
    override readonly help = definition.help ?? "";
    override readonly dataOnly = definition.kind === "data" || definition.kind === "annotation";
    override readonly browserAction = definition.kind === "browser";
    readonly captureScreenshot = definition.kind === "browser" && (definition.screenshot ?? true);
    readonly interruptBrowser = definition.kind === "browser" && (definition.interruptBrowser ?? true);
    override readonly localAction = definition.kind === "local";
    override readonly eventTrigger = definition.kind === "event";
    override readonly dynamicPorts = definition.dynamicPorts ?? false;
    override readonly removableInputs = definition.removableInputs ?? false;
    override readonly filePicker = definition.filePicker ?? false;
    override readonly multilineInputs = definition.multilineInputs ?? [];
    override readonly extraOptions = definition.extraOptions ?? [];
    private readonly memory: State = definition.state?.() ?? {} as State;
    override readonly options = typeof definition.options === "function" ? definition.options(this.context()) : definition.options;
    declare properties: Properties;
    constructor(x: number, y: number) {
      super(x, y, copyValue(definition.properties()));
    }
    override get asynchronous(): boolean {
      return this.browserAction || this.kind === "action";
    }
    private context(): NodeContext<Properties, State> {
      return { properties: this.properties, state: this.memory };
    }
    get inputs(): Inputs {
      return typeof definition.inputs === "function" ? definition.inputs(this.context()) : definition.inputs;
    }
    get outputs(): Outputs {
      return typeof definition.outputs === "function" ? definition.outputs(this.context()) : definition.outputs;
    }
    override syncInputs(connected: (key: string) => boolean, resolve: ResolveInput): void {
      definition.syncInputs?.(this.context(), connected, resolve);
    }
    override removeInput(key: string): void {
      definition.removeInput?.(this.context(), key);
    }
    setMacros(macros: { id: string; name: string }[]): void {
      definition.setMacros?.(this.context(), macros);
    }
    private readInputs(resolve: ResolveInput, browser = false): DataValues<Inputs> {
      const result: Values = {};
      for (const [key, port] of Object.entries(this.inputs)) {
        const type = port.type;
        if (type === "flow") continue;
        Object.defineProperty(result, key, {
          enumerable: true,
          get: () => {
            try {
              const descriptor = resolveDescriptor(type);
              const value = resolve(key);
              if (browser && port.optional && value === undefined) return descriptor.defaultValue();
              return descriptor.read(value, browser ? key : `${this.title} ${port.label}`);
            } catch (error) {
              if (browser && error instanceof Error) throw new InvalidAction(error.message);
              throw error;
            }
          },
        });
      }
      return result as DataValues<Inputs>;
    }
    private validate(output: string, value: Value): Value {
      const port = this.outputs[output];
      if (!port || port.type === "flow") throw new Error(`Unknown ${this.title} data output: ${output}`);
      return resolveDescriptor(port.type).read(value, `${this.title} ${port.label}`);
    }
    override evaluate(output: string, resolve: ResolveInput): Values {
      if (definition.kind !== "data") return super.evaluate(output, resolve);
      const inputs = this.readInputs(resolve);
      if (typeof definition.process !== "function") {
        if (!Object.hasOwn(definition.process, output)) throw new Error(`Unknown ${this.title} data output: ${output}`);
        const handler = definition.process[output as keyof DataValues<Outputs>];
        return { [output]: this.validate(output, handler(inputs, this.context())) };
      }
      const values: Values = definition.process(inputs, this.context());
      if (Object.keys(values).length !== Object.keys(this.outputs).length) throw new Error(`${this.title} returned unexpected data outputs.`);
      for (const [key, value] of Object.entries(values)) this.validate(key, value);
      return values;
    }
    override dataValue(output: string, resolve: ResolveInput): Value {
      if (definition.kind !== "data") return super.dataValue(output, resolve);
      return this.evaluate(output, resolve)[output];
    }
    async run(resolve: ResolveInput, services: ExecutionServices): Promise<Values> {
      if (definition.kind === "action") return await definition.process(this.readInputs(resolve), { ...this.context(), ...services });
      if (definition.kind !== "browser" && definition.kind !== "local" && definition.kind !== "event") throw new Error(`${this.title} is not an action.`);
      const properties: Values = { ...this.properties };
      for (const [key, port] of Object.entries(this.inputs)) if (port.type !== "flow") properties[key] = resolve(key);
      return await services.execute(this, properties);
    }
    async runBrowser(context: BrowserProcessContext): Promise<Values> {
      if (definition.kind !== "browser") throw new InvalidAction("Unsupported browser action.");
      let inputs: DataValues<Inputs>;
      try {
        inputs = { ...this.readInputs((key) => this.properties[key], true) };
      } catch (error) {
        if (error instanceof Error) throw new InvalidAction(error.message);
        throw error;
      }
      const values: Values = await definition.process(inputs, { ...this.context(), ...context });
      const outputs = Object.entries(this.outputs).filter(([, port]) => port.type !== "flow");
      if (Object.keys(values).length !== outputs.length) throw new Error(`${this.title} returned unexpected data outputs.`);
      for (const [key] of outputs) {
        if (!Object.hasOwn(values, key)) throw new Error(`${this.title} is missing ${key}.`);
        this.validate(key, values[key]);
      }
      return values;
    }
    subscribe(source: EventSource, emit: (values: Values) => void): () => void {
      if (definition.kind !== "event") throw new Error(`${this.title} is not an event source.`);
      return definition.subscribe(source, this.context(), emit);
    }
    async prepare(source: EventSource): Promise<unknown> {
      return definition.kind === "event" ? await definition.prepare?.(source) : undefined;
    }
  };
}
