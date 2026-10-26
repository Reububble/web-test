import { BaseNode, type DataType, type NodeType, type ResolveInput, type Value } from "web/nodes/base.ts";
import { type PortValuesByType, resolveDescriptor, type TypeDescriptor } from "web/nodes/type_descriptor.ts";
import { copyValue } from "web/value.ts";

type Values = Record<string, Value>;
type InputPort<T extends Value> =
  & (
    | { label: string; type: TypeDescriptor<T>; default?: T }
    | {
      [Type in DataType]: PortValuesByType[Type] extends T ? { label: string; type: Type; default: PortValuesByType[Type] } : never;
    }[DataType]
  )
  & { syncDefault?: boolean };
type OutputPort<T extends Value> =
  | { label: string; type: TypeDescriptor<T> }
  | {
    [Type in DataType]: [T] extends [PortValuesByType[Type]] ? { label: string; type: Type } : never;
  }[DataType];
type InputPorts<Inputs extends Values> = { readonly [Key in keyof Inputs]: InputPort<Inputs[Key]> };
type OutputPorts<Outputs extends Values> = { readonly [Key in keyof Outputs]: OutputPort<Outputs[Key]> };
type DataPorts = Readonly<Record<string, { label: string; type: DataType | TypeDescriptor<Value> }>>;

export interface FunctionDefinition<Inputs extends Values, Outputs extends Values> {
  lazyInputs?: boolean;
  process(inputs: Inputs): Outputs;
  inputs: InputPorts<NoInfer<Inputs>>;
  outputs: OutputPorts<NoInfer<Outputs>>;
}

export function functionDefaults<Inputs extends Values, Outputs extends Values>(definition: FunctionDefinition<Inputs, Outputs>): Inputs {
  return Object.fromEntries(
    Object.entries(definition.inputs).map(([key, port]) => [
      key,
      copyValue(port.default === undefined ? resolveDescriptor(port.type).defaultValue() : port.default),
    ]),
  ) as Inputs;
}

export function processFunction<Inputs extends Values, Outputs extends Values>(
  title: string,
  definition: FunctionDefinition<Inputs, Outputs>,
  inputs: Inputs,
): Outputs {
  const validate = (values: Values, ports: DataPorts): void => {
    for (const [key, port] of Object.entries(ports)) {
      if (!Object.hasOwn(values, key)) throw new Error(`${title} is missing ${port.label}.`);
      resolveDescriptor(port.type).read(values[key], `${title} ${port.label}`);
    }
  };
  let checked = inputs;
  if (definition.lazyInputs) {
    checked = Object.defineProperties(
      {},
      Object.fromEntries(
        Object.entries(definition.inputs).map(([key, port]) => [
          key,
          { enumerable: true, get: () => resolveDescriptor(port.type).read(inputs[key], `${title} ${port.label}`) },
        ]),
      ),
    ) as Inputs;
  } else validate(inputs, definition.inputs);
  const result = definition.process(checked);
  validate(result, definition.outputs);
  if (Object.keys(result).length !== Object.keys(definition.outputs).length) throw new Error(`${title} returned unexpected output ports.`);
  return result;
}

export function evaluateFunction<Inputs extends Values, Outputs extends Values>(
  title: string,
  definition: FunctionDefinition<Inputs, Outputs>,
  resolve: ResolveInput,
): Outputs {
  // Validate untrusted graph values before invoking the typed process.
  const inputs = definition.lazyInputs
    ? Object.defineProperties(
      {},
      Object.fromEntries(Object.keys(definition.inputs).map((key) => [key, { enumerable: true, get: () => resolve(key) }])),
    ) as Inputs
    : Object.fromEntries(Object.keys(definition.inputs).map((key) => [key, resolve(key)])) as Inputs;
  return processFunction(title, definition, inputs);
}

export interface FunctionNode<Inputs extends Values, Outputs extends Values> extends BaseNode {
  readonly inputs: InputPorts<Inputs>;
  readonly outputs: OutputPorts<Outputs>;
  properties: Inputs;
  process(inputs: Inputs): Outputs;
  dataValue<Key extends keyof Outputs & string>(output: Key, resolve: ResolveInput): Outputs[Key];
}
export interface FunctionNodeConstructor<Inputs extends Values, Outputs extends Values> {
  new (x: number, y: number): FunctionNode<Inputs, Outputs>;
  readonly title: string;
}

/** Infer a pure function node's input/output records from its process function and return its class. */
export function defineFunctionNode<Inputs extends Values, Outputs extends Values>(
  definition: FunctionDefinition<Inputs, Outputs> & {
    type: NodeType;
    title: string;
    help?: string;
  },
): FunctionNodeConstructor<Inputs, Outputs> {
  return class extends BaseNode implements FunctionNode<Inputs, Outputs> {
    static readonly title = definition.title;
    readonly title = definition.title;
    readonly type = definition.type;
    override readonly dataOnly = true;
    override readonly help = definition.help ?? "";
    readonly inputs = definition.inputs;
    readonly outputs = definition.outputs;
    declare properties: Inputs;
    constructor(x: number, y: number) {
      super(x, y, functionDefaults(definition));
    }
    process(inputs: Inputs): Outputs {
      return processFunction(this.title, definition, inputs);
    }
    override evaluate(_output: string, resolve: ResolveInput): Outputs {
      return evaluateFunction(this.title, definition, resolve);
    }
    override dataValue<Key extends keyof Outputs & string>(output: Key, resolve: ResolveInput): Outputs[Key] {
      if (!Object.hasOwn(definition.outputs, output)) throw new Error(`Unknown ${definition.title} output: ${output}`);
      return this.evaluate(output, resolve)[output];
    }
  };
}
