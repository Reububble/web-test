import { BaseNode, type DataType, type NodeType, type ResolveInput, type Value } from "web-test/nodes/base.ts";
import { type PortValuesByType, resolveDescriptor, type TypeDescriptor } from "web-test/nodes/type_descriptor.ts";
import { copyValue } from "web-test/value.ts";

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

/** Named input/output schemas and the synchronous process that computes a pure function node's outputs. */
export interface FunctionDefinition<Inputs extends Values, Outputs extends Values> {
  /** Resolve and validate inputs only when their properties are read by the process. */
  lazyInputs?: boolean;
  /** The typed handler or named handlers that compute outputs for the node. */
  process(inputs: Inputs): Outputs;
  /** Named input-port schemas used to validate and resolve incoming values. */
  inputs: InputPorts<NoInfer<Inputs>>;
  /** Named output-port schemas used to validate published values. */
  outputs: OutputPorts<NoInfer<Outputs>>;
}

/** Create independent default input values from a pure function definition's port descriptors. */
export function functionDefaults<Inputs extends Values, Outputs extends Values>(definition: FunctionDefinition<Inputs, Outputs>): Inputs {
  return Object.fromEntries(
    Object.entries(definition.inputs).map(([key, port]) => [
      key,
      copyValue(port.default === undefined ? resolveDescriptor(port.type).defaultValue() : port.default),
    ]),
  ) as Inputs;
}

/** Validate input values, run a pure function, and validate its complete named output record. */
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

/** Resolve a pure function's named graph inputs and evaluate its validated output record. */
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

/** A synchronous data-only node with typed input/output records and validated output evaluation. */
export interface FunctionNode<Inputs extends Values, Outputs extends Values> extends BaseNode {
  /** Named input-port schemas used to validate and resolve incoming values. */
  readonly inputs: InputPorts<Inputs>;
  /** Named output-port schemas used to validate published values. */
  readonly outputs: OutputPorts<Outputs>;
  /** Saved node properties, including default values for unconnected inputs. */
  properties: Inputs;
  /** The typed handler or named handlers that compute outputs for the node. */
  process(inputs: Inputs): Outputs;
  /** Resolve and validate one requested data output from the node's current inputs. */
  dataValue<Key extends keyof Outputs & string>(output: Key, resolve: ResolveInput): Outputs[Key];
}
/** Constructs an independent pure function node at the supplied workspace coordinates. */
export interface FunctionNodeConstructor<Inputs extends Values, Outputs extends Values> {
  /** Construct a new node at the supplied horizontal and vertical workspace coordinates. */
  new (x: number, y: number): FunctionNode<Inputs, Outputs>;
  /** The node's display title used by editors and validation errors. */
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
