import { BaseNode, type DataType, type NodeType, type PortRecord, type ResolveInput, type Value } from "web/nodes/base.ts";
import { type DeclarativeNodeConstructor, defineDeclarativeNode, type NodeDefinition } from "web/nodes/declarative_node.ts";
import { evaluateFunction, functionDefaults, type FunctionDefinition, type FunctionNode, processFunction } from "web/nodes/function_node.ts";
import { resolveDescriptor, type TypeConfig, type TypeDescriptor } from "web/nodes/type_descriptor.ts";
import {
  type ControlDefinition,
  ControlNode,
  type ControlNodeConstructor,
  type ControlNodeInstance,
  type ControlPorts,
  type ControlValues,
  defineControlNode,
} from "web/nodes/control_node.ts";

type Values = Record<string, Value>;
type Config = Record<string, Record<string, TypeConfig>>;
type ConfigFields<Configuration extends Config> = { [Group in keyof Configuration]: Configuration[Group][keyof Configuration[Group]] }[keyof Configuration];
type ConfigProperties<Configuration extends Config> = { [Field in ConfigFields<Configuration> as Field["options"]["key"]]: DataType };
export type ResolvedConfig<Configuration extends Config> = {
  readonly [Group in keyof Configuration]: { readonly [Key in keyof Configuration[Group]]: TypeDescriptor<Value> };
};
export interface ConfigurableFunctionNode<Inputs extends Values, Outputs extends Values, Configuration extends Config> extends FunctionNode<Inputs, Outputs> {
  properties: Inputs & ConfigProperties<Configuration>;
}

type ConfigMetadata<Configuration extends Config> = { type: NodeType; title: string; help?: string; config: Configuration; kind?: never; control?: never };
type ConfigControlMetadata<Configuration extends Config, Controls extends readonly string[], Extra extends Values> =
  & Omit<ConfigMetadata<Configuration>, "control">
  & {
    control: Controls;
    properties?: () => Extra;
  };
type ControlBlueprint<Inputs extends ControlPorts, Outputs extends ControlPorts, Controls extends readonly string[], Entry extends string> = Omit<
  ControlDefinition<Inputs, Outputs, Controls, Entry>,
  "type" | "title" | "help" | "control" | "config"
>;

export function defineNode<Configuration extends Config, const Controls extends readonly string[], Extra extends Values = Record<never, never>>(
  metadata: ConfigControlMetadata<Configuration, Controls, Extra>,
): ReturnType<typeof defineConfiguredControlNode<Configuration, Controls, Extra>>;

export function defineNode<Configuration extends Config>(metadata: ConfigMetadata<Configuration>): ReturnType<typeof defineConfiguredNode<Configuration>>;
export function defineNode<const Inputs extends PortRecord, const Outputs extends PortRecord, Properties extends Values, State extends object = object>(
  metadata: NodeDefinition<Inputs, Outputs, Properties, State>,
): DeclarativeNodeConstructor<Inputs, Outputs, Properties>;
export function defineNode<
  const Inputs extends ControlPorts,
  const Outputs extends ControlPorts,
  const Controls extends readonly string[],
  Entry extends string,
>(
  metadata: ControlDefinition<Inputs, Outputs, Controls, Entry>,
): ControlNodeConstructor<Inputs, Outputs, Controls, Entry>;
/** Return a control-process class, or configure a function-node builder through currying. */
export function defineNode(metadata: object): unknown {
  if ("kind" in metadata && metadata.kind !== undefined) return defineDeclarativeNode(metadata as NodeDefinition<PortRecord, PortRecord, Values, object>);
  if ("config" in metadata && metadata.config && "control" in metadata && Array.isArray(metadata.control)) {
    return defineConfiguredControlNode(metadata as ConfigControlMetadata<Config, readonly string[], Values>);
  }
  if ("control" in metadata && (Array.isArray(metadata.control) || typeof metadata.control === "function")) {
    return defineControlNode(metadata as ControlDefinition<ControlPorts, ControlPorts, readonly string[], string>);
  }
  return defineConfiguredNode(metadata as ConfigMetadata<Config>);
}

function defineConfiguredControlNode<Configuration extends Config, const Controls extends readonly string[], Extra extends Values>(
  metadata: ConfigControlMetadata<Configuration, Controls, Extra>,
) {
  const selections = Object.entries(metadata.config).flatMap(([group, fields]) => Object.entries(fields).map(([key, field]) => ({ group, key, field })));
  const options = selections.map(({ field }) => ({ key: field.options.key, label: field.options.label, choices: field.choices, changesPorts: true }));
  return function <const Inputs extends ControlPorts, const Outputs extends ControlPorts, Entry extends string>(
    build: (config: ResolvedConfig<Configuration>) => ControlBlueprint<Inputs, Outputs, Controls, Entry>,
  ): {
    new (
      x: number,
      y: number,
    ): ControlNodeInstance<Inputs, Outputs, Controls, Entry> & {
      properties: ControlValues<Inputs> & ConfigProperties<Configuration> & Omit<Extra, keyof ControlValues<Inputs>>;
    };
    readonly title: string;
  } {
    return class extends ControlNode {
      static readonly title = metadata.title;
      readonly title = metadata.title;
      readonly type = metadata.type;
      override readonly help = metadata.help ?? "";
      override readonly options = options[0];
      override readonly extraOptions = options.slice(1);
      declare properties: ControlValues<Inputs> & ConfigProperties<Configuration> & Omit<Extra, keyof ControlValues<Inputs>>;
      private cached?: { values: Value[]; node: ControlNodeInstance<Inputs, Outputs, Controls, Entry> };
      constructor(x: number, y: number) {
        super(x, y, { ...metadata.properties?.(), ...Object.fromEntries(selections.map(({ field }) => [field.options.key, field.options.default])) });
        Object.assign(this.properties, this.current().properties);
      }
      private current(): ControlNodeInstance<Inputs, Outputs, Controls, Entry> {
        const properties: Values = this.properties;
        const values = selections.map(({ field }) => properties[field.options.key]);
        const cached = this.cached;
        if (cached && values.every((value, index) => Object.is(value, cached.values[index]))) return cached.node;
        const resolved = Object.fromEntries(Object.keys(metadata.config).map((group) => [group, {}])) as Record<string, Record<string, TypeDescriptor<Value>>>;
        for (const { group, key, field } of selections) resolved[group][key] = field.resolve(properties[field.options.key]);
        const Constructor = defineControlNode({
          ...build(resolved as ResolvedConfig<Configuration>),
          type: this.type,
          title: this.title,
          control: metadata.control,
        });
        const node = new Constructor(0, 0);
        this.cached = { values, node };
        return node;
      }
      get entry() {
        return this.current().entry;
      }
      get interrupts() {
        return this.current().interrupts;
      }
      get control() {
        return metadata.control;
      }
      get refreshBranches() {
        return this.current().refreshBranches;
      }
      get inputs() {
        return this.current().inputs;
      }
      get outputs() {
        return this.current().outputs;
      }
      get process() {
        return this.current().process;
      }
      initialOutput() {
        return this.current().initialOutput();
      }
      invoke(...args: Parameters<ControlNode["invoke"]>) {
        return this.current().invoke(...args);
      }
      validateStep(...args: Parameters<ControlNode["validateStep"]>) {
        return this.current().validateStep(...args);
      }
      override syncInputs(): void {
        const properties: Values = this.properties;
        for (const [key, port] of Object.entries(this.inputs)) {
          if (!("syncDefault" in port) || !port.syncDefault) continue;
          const descriptor = resolveDescriptor(port.type);
          try {
            descriptor.read(properties[key], port.label);
          } catch {
            properties[key] = descriptor.defaultValue();
          }
        }
      }
    };
  };
}

function defineConfiguredNode<Configuration extends Config>(metadata: ConfigMetadata<Configuration>) {
  const selections = Object.entries(metadata.config).flatMap(([group, fields]) => Object.entries(fields).map(([key, field]) => ({ group, key, field })));
  const keys = selections.map(({ field }) => field.options.key);
  if (new Set(keys).size !== keys.length) throw new Error("Configuration properties must have unique keys.");
  const options = selections.map(({ field }) => ({ key: field.options.key, label: field.options.label, choices: field.choices, changesPorts: true }));
  return function <Inputs extends Values, Outputs extends Values>(build: (config: ResolvedConfig<Configuration>) => FunctionDefinition<Inputs, Outputs>): {
    new (x: number, y: number): ConfigurableFunctionNode<Inputs, Outputs, Configuration>;
    readonly title: string;
  } {
    return class extends BaseNode implements ConfigurableFunctionNode<Inputs, Outputs, Configuration> {
      static readonly title = metadata.title;
      readonly title = metadata.title;
      readonly type = metadata.type;
      override readonly dataOnly = true;
      override readonly help = metadata.help ?? "";
      override readonly options = options[0];
      override readonly extraOptions = options.slice(1);
      declare properties: Inputs & ConfigProperties<Configuration>;
      private cached?: { values: Value[]; definition: FunctionDefinition<Inputs, Outputs> };
      constructor(x: number, y: number) {
        super(x, y, Object.fromEntries(selections.map(({ field }) => [field.options.key, field.options.default])));
        if (Object.keys(this.definition().inputs).some((key) => keys.includes(key))) throw new Error("Configuration keys must differ from input names.");
        Object.assign(this.properties, functionDefaults(this.definition()));
      }
      private definition(): FunctionDefinition<Inputs, Outputs> {
        const values = selections.map(({ field }) => this.properties[field.options.key]);
        const cached = this.cached;
        if (cached && values.every((value, index) => Object.is(value, cached.values[index]))) return cached.definition;
        const resolved = Object.fromEntries(Object.keys(metadata.config).map((group) => [group, {}])) as Record<string, Record<string, TypeDescriptor<Value>>>;
        for (const { group, key, field } of selections) resolved[group][key] = field.resolve(this.properties[field.options.key]);
        const definition = build(resolved as ResolvedConfig<Configuration>);
        this.cached = { values, definition };
        return definition;
      }
      get inputs(): FunctionDefinition<Inputs, Outputs>["inputs"] {
        return this.definition().inputs;
      }
      get outputs(): FunctionDefinition<Inputs, Outputs>["outputs"] {
        return this.definition().outputs;
      }
      process(inputs: Inputs): Outputs {
        return processFunction(this.title, this.definition(), inputs);
      }
      override syncInputs(): void {
        const properties: Values = this.properties;
        for (const [key, port] of Object.entries(this.definition().inputs)) {
          if (!port.syncDefault) continue;
          const descriptor = resolveDescriptor(port.type);
          try {
            descriptor.read(properties[key], port.label);
          } catch {
            properties[key] = descriptor.defaultValue();
          }
        }
      }
      override evaluate(_output: string, resolve: ResolveInput): Outputs {
        return evaluateFunction(this.title, this.definition(), resolve);
      }
      override dataValue<Key extends keyof Outputs & string>(output: Key, resolve: ResolveInput): Outputs[Key] {
        if (!Object.hasOwn(this.outputs, output)) throw new Error(`Unknown ${this.title} output: ${output}`);
        return this.evaluate(output, resolve)[output];
      }
    };
  };
}
