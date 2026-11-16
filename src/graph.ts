import { copyValue } from "web-test/value.ts";
import { acceptsPortType, type BaseNode, listPorts, type NodeType, type Port, type PortType, type Value } from "web-test/nodes/base.ts";
import { createNode, nodeClasses, type NodeInstance } from "web-test/nodes/index.ts";
import { ControlNode, type ControlStep, ControlTransfer } from "web-test/nodes/control_node.ts";
import { DeclarativeNode } from "web-test/nodes/declarative_node.ts";
export { titles } from "web-test/nodes/index.ts";
export type { NodeType, Port, PortType, Value } from "web-test/nodes/base.ts";
/** The common runtime node contract stored by a graph. */
export type GraphNode = BaseNode;
/** List a node's named input ports, projecting descriptors into editor-facing type and optionality metadata. */
export const inputs = (node: BaseNode): Port[] => listPorts(node.inputs);
/** List a node's named output ports, projecting descriptors into editor-facing type and optionality metadata. */
export const outputs = (node: BaseNode): Port[] => listPorts(node.outputs);
/** Return whether the node evaluates through data dependencies without requiring a flow connection. */
export const isDataNode = (node: BaseNode) => node.dataOnly;
/** A typed graph edge between named ports, with optional editor routing handles. */
export interface Connection {
  /** The stable identifier used by saved graph records and connections. */
  id: string;
  /** The source node identifier for this connection. */
  from: string;
  /** The source node's named output port. */
  output: string;
  /** The destination node identifier for this connection. */
  to: string;
  /** The destination port or control-input name. */
  input: string;
  /** The saved node identifier or resolved runtime port type tag. */
  type: PortType;
  /** Optional editor coordinates used to route the connection visually. */
  handles?: { x: number; y: number }[];
}
/** A previously observed output value with its graph run number and observation timestamp. */
export interface KnownValue {
  /** The runtime output value captured for inspection. */
  value: Value;
  /** The graph execution number in which this value was observed. */
  run: number;
  /** The instant when this output value was observed. */
  updatedAt: Temporal.Instant;
}
/** Version-one graph data containing saved node properties, connections, and optional macro definitions. */
export interface SerializedGraph {
  /** The saved graph format version; currently always one. */
  version: 1;
  /** Reusable graph definitions available to macro-call nodes. */
  macros?: MacroDefinition[];
  /** The graph's node instances with their saved positions and properties. */
  nodes: { id: string; type: NodeType; xPos: number; yPos: number; properties: Record<string, Value> }[];
  /** Connections between the graph's named node ports. */
  links: Connection[];
}
/** A reusable named graph identified by a stable macro ID. */
export interface MacroDefinition {
  /** The stable identifier used by saved graph records and connections. */
  id: string;
  /** The unique port identifier or user-facing saved name. */
  name: string;
  /** The serialized graph body of the reusable macro. */
  graph: SerializedGraph;
}
/** Node-start, node-end, and traversed-connection events emitted during graph execution. */
export type GraphEvent = { type: "node-start"; nodeId: string } | {
  type: "node-end";
  nodeId: string;
  values: Record<string, Value>;
  known: Record<string, KnownValue>;
} | { type: "connection"; linkId: string };
/** Stores typed nodes, connections, macros, and inspection values, and executes structured graph control flow. */
export class Graph {
  /** Reusable graph definitions available to macro-call nodes. */
  macros: MacroDefinition[] = [];
  /** The graph's node instances with their saved positions and properties. */
  nodes: BaseNode[] = [];
  /** Connections between the graph's named node ports. */
  links: Connection[] = [];
  /** Output records available during the current execution, keyed by node identifier. */
  results: Map<string, Record<string, Value>> = new Map();
  /** Previously observed node outputs and their timestamps, retained for inspection. */
  lastKnown: Map<string, Record<string, KnownValue>> = new Map();
  private runNumber = 0;
  private emit?: (event: GraphEvent) => void;
  /** Copy the graph into version-one saved data without transient execution state. */
  serialize(): SerializedGraph {
    return copyValue({
      version: 1,
      nodes: this.nodes.map(({ id, type, xPos, yPos, properties }) => ({ id, type, xPos, yPos, properties })),
      links: this.links,
      ...(this.macros.length ? { macros: this.macros } : {}),
    });
  }
  /** Copy selected nodes and their internal connections into a graph positioned relative to its top-left corner. */
  copySelection(nodeIds: Set<string>): Graph {
    const saved = this.serialize();
    const nodes = saved.nodes.filter((node) => nodeIds.has(node.id));
    if (!nodes.length) throw new Error("Select at least one block to create a macro.");
    const included = new Set(nodes.map((node) => node.id));
    const links = saved.links.filter((link) => included.has(link.from) && included.has(link.to));
    const handles = links.flatMap((link) => link.handles ?? []);
    const left = Math.min(...nodes.map((node) => node.xPos), ...handles.map((handle) => handle.x));
    const top = Math.min(...nodes.map((node) => node.yPos), ...handles.map((handle) => handle.y));
    for (const node of nodes) {
      node.xPos += 30 - left;
      node.yPos += 30 - top;
    }
    for (const handle of handles) {
      handle.x += 30 - left;
      handle.y += 30 - top;
    }
    return Graph.deserialize({ version: 1, nodes, links });
  }
  /** Validate saved graph data and rebuild its nodes, dynamic ports, connections, and macros. */
  static deserialize(value: unknown): Graph {
    const fail = (): never => {
      throw new Error("Invalid graph file.");
    };
    if (!value || typeof value !== "object") return fail();
    const data = value as SerializedGraph;
    if (data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.links)) return fail();
    const graph = new Graph();
    if (data.macros !== undefined) {
      if (!Array.isArray(data.macros)) return fail();
      const macroIds = new Set<string>();
      for (const macro of data.macros) {
        if (
          !macro || typeof macro.id !== "string" || !/^macro_[\w-]+$/.test(macro.id) || macroIds.has(macro.id) || typeof macro.name !== "string" ||
          !macro.name.trim() || !macro.graph || (macro.graph.macros !== undefined && (!Array.isArray(macro.graph.macros) || macro.graph.macros.length))
        ) return fail();
        macroIds.add(macro.id);
        graph.macros.push({ id: macro.id, name: macro.name, graph: Graph.deserialize(macro.graph).serialize() });
      }
    }
    const ids = new Set<string>();
    for (const item of data.nodes) {
      if (
        !item || typeof item.id !== "string" || !/^node_[\w-]+$/.test(item.id) || ids.has(item.id) || !Object.hasOwn(nodeClasses, item.type) ||
        !Number.isFinite(item.xPos) || !Number.isFinite(item.yPos) || !item.properties || typeof item.properties !== "object" || Array.isArray(item.properties)
      ) return fail();
      ids.add(item.id);
      const node = graph.add(item.type, item.xPos, item.yPos);
      node.id = item.id;
      node.properties = copyValue(item.properties);
    }
    const linkIds = new Set<string>();
    for (const link of data.links) {
      if (
        !link || typeof link.id !== "string" || !/^link_[\w-]+$/.test(link.id) || linkIds.has(link.id) || !ids.has(link.from) || !ids.has(link.to) ||
        typeof link.output !== "string" || typeof link.input !== "string" ||
        (link.handles !== undefined &&
          (!Array.isArray(link.handles) ||
            !link.handles.every((handle) =>
              handle && typeof handle === "object" && !Array.isArray(handle) && Number.isFinite(handle.x) && Number.isFinite(handle.y)
            ))) ||
        !["flow", "text", "boolean", "number", "json", "element", "array", "instant", "listener"].includes(link.type)
      ) return fail();
      linkIds.add(link.id);
    }
    // Dynamic ports need the complete set of connections before synchronizing.
    graph.links = copyValue(data.links);
    const occupied = new Set<string>();
    const edges = new Set<string>();
    for (const link of graph.links) {
      const slot = link.type === "flow" ? `flow:${link.from}:${link.output}` : `data:${link.to}:${link.input}`;
      const edge = JSON.stringify([link.from, link.output, link.to, link.input]);
      if (occupied.has(slot) || edges.has(edge)) return fail();
      occupied.add(slot);
      edges.add(edge);
    }
    const visited = new Set<string>(), visiting = new Set<string>();
    const ordered: BaseNode[] = [];
    const visit = (id: string): void => {
      if (visiting.has(id)) return;
      if (visited.has(id)) return;
      visiting.add(id);
      for (const link of graph.links.filter((l) => l.to === id && l.type !== "flow")) visit(link.from);
      visiting.delete(id);
      visited.add(id);
      ordered.push(graph.node(id));
    };
    for (const node of graph.nodes) visit(node.id);
    graph.validateCycles();
    for (const node of ordered) {
      node.syncInputs(
        (key) => graph.links.some((link) => link.to === node.id && link.input === key),
        (key) => graph.value(node, key),
        (key) => graph.links.some((link) => link.from === node.id && link.output === key),
      );
    }
    graph.prune();
    if (graph.links.length !== data.links.length) return fail();
    return graph;
  }
  /** Construct and append a built-in node, preserving its concrete type when the node type is known. */
  add<Type extends NodeType>(type: Type, x: number, y: number): NodeInstance<Type> {
    const node = createNode(type, x, y);
    this.nodes.push(node);
    return node;
  }
  /** Find a node by ID or throw if it no longer exists. */
  node(id: string): BaseNode {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error("Block no longer exists.");
    return node;
  }
  /** Connect compatible named ports, replacing a data input's source or a flow output's destination when occupied. */
  connect(from: string, output: string, to: string, input: string): void {
    const source = outputs(this.node(from)).find((p) => p.key === output);
    const target = inputs(this.node(to)).find((p) => p.key === input);
    if (!source || !target || !acceptsPortType(source.type, target.type)) {
      throw new Error("Connect ports with matching types. JSON inputs also accept text, boolean, number, and array outputs.");
    }
    if (this.links.some((l) => l.from === from && l.output === output && l.to === to && l.input === input)) return;
    // Data inputs have one source; flow outputs have one destination. Data outputs can fan out.
    const retained = this.links.filter((l) =>
      !(target.type !== "flow" && l.to === to && l.input === input) && !(source.type === "flow" && l.from === from && l.output === output)
    );
    const proposed = [...retained, { id: `link_${crypto.randomUUID()}`, from, output, to, input, type: source.type }];
    this.validateCycles(proposed);
    this.links = proposed;
    this.syncInputs();
  }
  /** Reject cycles in data dependencies while permitting supported flow-control cycles. */
  validateCycles(links = this.links): void {
    const check = (nodes: BaseNode[], edges: Connection[], message: string) => {
      const included = new Set(nodes.map((node) => node.id));
      const visited = new Set<string>(), visiting = new Set<string>();
      const visit = (id: string): void => {
        if (visiting.has(id)) throw new Error(message);
        if (visited.has(id)) return;
        visiting.add(id);
        for (const link of edges) if (link.from === id && included.has(link.to)) visit(link.to);
        visiting.delete(id);
        visited.add(id);
      };
      for (const node of nodes) visit(node.id);
    };
    // Flow cycles are interruptible; only cycles of data-only computations are invalid.
    check(this.nodes.filter((node) => node.dataOnly), links.filter((link) => link.type !== "flow"), "Circular data dependency.");
  }
  /** Delete selected nodes and edges, including all connections incident to removed nodes. */
  remove(nodeIds: Set<string>, linkIds: Set<string> = new Set()): void {
    this.nodes = this.nodes.filter((n) => !nodeIds.has(n.id));
    this.links = this.links.filter((l) => !linkIds.has(l.id) && !nodeIds.has(l.from) && !nodeIds.has(l.to));
    for (const id of nodeIds) {
      this.results.delete(id);
      this.lastKnown.delete(id);
    }
    this.syncInputs();
  }
  /** Remove connections incident to the selected node identifiers. */
  disconnect(nodeIds: Set<string>): void {
    this.links = this.links.filter((l) => !nodeIds.has(l.from) && !nodeIds.has(l.to));
    this.syncInputs();
  }
  /** Rebuild dynamic port schemas and defaults from the graph's current properties and connections. */
  syncInputs(): void {
    for (const node of this.nodes) {
      node.syncInputs(
        (key) =>
          this.links.some((link) =>
            link.to === node.id && link.input === key && inputs(node).some((input) => input.key === key && acceptsPortType(link.type, input.type))
          ),
        (key) => this.value(node, key, new Set(), true),
        (key) => this.links.some((link) => link.from === node.id && link.output === key),
      );
    }
    this.prune();
  }
  /** Resolve an input from its connected output or saved default, detecting circular data dependencies. */
  value(node: BaseNode, input: string, seen: Set<string> = new Set(), allowLast = false): Value {
    const link = this.links.find((l) => l.to === node.id && l.input === input && l.type !== "flow");
    if (!link) return node.properties[input];
    this.emit?.({ type: "connection", linkId: link.id });
    const source = this.node(link.from);
    if (seen.has(source.id)) throw new Error("Circular data dependency.");
    const nextSeen = new Set(seen).add(source.id);
    if (source.dataOnly) {
      this.emit?.({ type: "node-start", nodeId: source.id });
      const values = source.evaluate(link.output, (key) => this.value(source, key, nextSeen, allowLast));
      if (this.emit) {
        this.remember(source, values);
        this.emit({ type: "node-end", nodeId: source.id, values, known: this.lastKnown.get(source.id)! });
      }
      return values[link.output];
    }
    const values = this.results.get(source.id);
    const result = values && Object.hasOwn(values, link.output)
      ? values[link.output]
      : (allowLast ? this.lastKnown.get(source.id)?.[link.output]?.value : undefined);
    if (result === undefined) {
      if (source.id === node.id && !source.dataOnly && Object.hasOwn(node.properties, input)) return node.properties[input];
      throw new Error(`${source.title} must run before its ${link.output} output is used.`);
    }
    return result;
  }
  /** Read a node's current or last-known output value without performing a browser action. */
  inspect(node: BaseNode, output: string): KnownValue | undefined {
    if (node.dataOnly) {
      try {
        const values = node.evaluate(output, (key) => this.value(node, key, new Set(), true));
        const updatedAt = Temporal.Now.instant();
        const known = { ...this.lastKnown.get(node.id) };
        for (const [key, value] of Object.entries(values)) known[key] = { value, run: 0, updatedAt };
        this.lastKnown.set(node.id, known);
        return known[output];
      } catch {
        /* Preserve the last successfully computed value. */
      }
    }
    return this.lastKnown.get(node.id)?.[output];
  }
  /** Record the latest values with this run's number and observation time for editor inspection. */
  private remember(node: BaseNode, values: Record<string, Value>): void {
    const known = { ...this.lastKnown.get(node.id) };
    for (const [key, value] of Object.entries(values)) known[key] = { value: copyValue(value), run: this.runNumber, updatedAt: Temporal.Now.instant() };
    this.lastKnown.set(node.id, known);
  }
  /** Remove connections whose ports no longer exist or whose types are no longer compatible. */
  prune(): void {
    this.links = this.links.filter((link) => {
      const sourceNode = this.nodes.find((n) => n.id === link.from), targetNode = this.nodes.find((n) => n.id === link.to);
      const source = sourceNode && outputs(sourceNode).find((p) => p.key === link.output);
      const target = targetNode && inputs(targetNode).find((p) => p.key === link.input);
      return source?.type === link.type && !!target && acceptsPortType(source.type, target.type);
    });
  }
  /** Execute the graph's flow with supplied action callbacks, progress reporting, cancellation, macros, and runtime services. */
  async run(
    execute: (node: BaseNode, properties: Record<string, Value>) => Promise<Record<string, Value>>,
    onStep: (node: BaseNode) => void = () => {},
    onUpdated: () => void = () => {},
    event?: { nodeId: string; values: Record<string, Value> },
    emit?: (event: GraphEvent) => void,
    signal?: AbortSignal,
    macros: MacroDefinition[] = this.macros,
    services?: { removeListener(listener: { listenerId: string }): boolean },
  ): Promise<void> {
    this.emit = emit;
    try {
      if (!event) this.results.clear();
      else {
        // Keep startup values, but never reuse stale results from an earlier callback.
        const cleared = new Set<string>([event.nodeId]);
        const clear = (id: string): void => {
          if (cleared.has(id)) return;
          cleared.add(id);
          this.results.delete(id);
          for (const link of this.links) if (link.type === "flow" && link.from === id) clear(link.to);
        };
        for (const link of this.links) if (link.type === "flow" && link.from === event.nodeId && link.output === "event") clear(link.to);
      }
      this.validateCycles();
      this.runNumber++;
      const actions = this.nodes.filter((n) => !n.dataOnly);
      const isInterrupt = (node: BaseNode, input: string): boolean => node instanceof ControlNode && node.interrupts.includes(input);
      const roots = actions.filter((n) => !this.links.some((l) => l.type === "flow" && l.to === n.id && !isInterrupt(n, l.input)));
      if (!event && roots.length === 0) {
        const reachesAll = (node: BaseNode): boolean => {
          const seen = new Set<string>();
          const visit = (id: string): void => {
            if (seen.has(id)) return;
            seen.add(id);
            for (const link of this.links.filter((link) => link.type === "flow" && link.from === id)) visit(link.to);
          };
          visit(node.id);
          return actions.every((action) => seen.has(action.id));
        };
        const entry = actions.find(reachesAll);
        if (entry) roots.push(entry);
      }
      if (event) {
        const trigger = this.node(event.nodeId);
        if (!trigger.eventTrigger) throw new Error("Expected a trigger block.");
        this.results.set(trigger.id, copyValue(event.values));
        this.remember(trigger, event.values);
      } else if (roots.length !== 1) {
        throw new Error(actions.length === 0 ? "Add a flow block to run." : "Connect flow blocks into a workflow with one starting block.");
      }
      const report = (node: BaseNode, output: string): void => {
        this.remember(node, Object.fromEntries(outputs(node).filter((p) => p.type === "flow").map((p) => [p.key, p.key === output])));
        onUpdated();
        emit?.({ type: "node-end", nodeId: node.id, values: this.results.get(node.id) ?? {}, known: this.lastKnown.get(node.id) ?? {} });
      };
      type FlowTarget = { node: BaseNode; input: string };
      const next = (node: BaseNode, output: string): FlowTarget | undefined => {
        const link = this.links.find((l) => l.type === "flow" && l.from === node.id && l.output === output);
        if (link) emit?.({ type: "connection", linkId: link.id });
        return link ? { node: this.node(link.to), input: link.input } : undefined;
      };
      const walk = async (start: FlowTarget | undefined, ancestors = new Set<string>()): Promise<void> => {
        let target = start;
        while (target) {
          const current = target.node;
          signal?.throwIfAborted();
          if (isInterrupt(current, target.input)) {
            if (!ancestors.has(current.id)) {
              throw new Error(
                `${
                  target.input === "break" ? "Break requires an active loop" : "Control input requires an active invocation"
                }. Connect it from an active branch.`,
              );
            }
            throw new ControlTransfer(current.id, target.input);
          }
          if (ancestors.has(current.id)) throw new Error("A structured branch must end without wiring flow back to its loop or Try / Catch / Finally block.");
          // Every flow step yields to socket I/O so even synchronous cycles can stop.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          signal?.throwIfAborted();
          onStep(current);
          emit?.({ type: "node-start", nodeId: current.id });
          const active: BaseNode = current;
          let output: string = active.flowOutput((key) => this.value(active, key));
          if (active instanceof ControlNode) {
            const nested = new Set(ancestors).add(active.id);
            const branchNodes = new Set<string>();
            const visit = (id: string): void => {
              if (nested.has(id) || branchNodes.has(id)) return;
              branchNodes.add(id);
              for (const link of this.links.filter((link) => link.type === "flow" && link.from === id)) visit(link.to);
            };
            for (const link of this.links.filter((link) => link.type === "flow" && link.from === active.id)) visit(link.to);
            const state = {
              output: active.initialOutput(),
              connected: (control: string) => this.links.some((link) => link.from === active.id && link.output === control && link.type === "flow"),
            };
            if (Object.keys(state.output).length) this.results.set(active.id, state.output);
            let invocation = active.invoke(target.input, (key) => this.value(active, key), state);
            if (invocation.scoped) { for (const id of branchNodes) this.results.delete(id); }
            let pending: IteratorResult<ControlStep, ControlStep> | undefined;
            let finished = false;
            try {
              while (true) {
                // Even a generator yielding no connected branch must remain cancellable.
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                signal?.throwIfAborted();
                const result = pending ?? invocation.next();
                pending = undefined;
                const step = active.validateStep(result.value);
                state.output = step.values;
                this.results.set(active.id, step.values);
                this.remember(active, step.values);
                if (result.done) {
                  output = step.control ?? "";
                  finished = true;
                  break;
                }
                if (step.control === undefined) continue;
                if (active.refreshBranches) { for (const id of branchNodes) this.results.delete(id); }
                emit?.({ type: "node-start", nodeId: active.id });
                report(active, step.control);
                try {
                  await walk(next(active, step.control), nested);
                  signal?.throwIfAborted();
                } catch (error) {
                  signal?.throwIfAborted();
                  if (error instanceof ControlTransfer && error.nodeId === active.id) {
                    invocation.close();
                    invocation = active.invoke(error.input, (key) => this.value(active, key), state);
                  } else pending = invocation.throw(error);
                }
              }
            } finally {
              if (!finished) invocation.close();
            }
          } else if (active instanceof DeclarativeNode && ["browser", "local", "action", "event"].includes(active.kind)) {
            const values = await active.run((key) => this.value(active, key), {
              execute,
              removeListener: (listener) => {
                if (!services) throw new Error("Listener removal requires a graph runtime.");
                return services.removeListener(listener);
              },
              call: async (macroId) => {
                const macro = macros.find((definition) => definition.id === macroId);
                if (!macro) throw new Error("Select an existing macro to run.");
                const called = Graph.deserialize(macro.graph);
                if (called.nodes.some((node) => node.eventTrigger)) {
                  throw new Error(`Macro ${macro.name} contains a console trigger. Call a graph with an ordinary starting flow block instead.`);
                }
                await called.run(execute, () => {}, () => {}, undefined, undefined, signal, macros, services);
              },
            });
            signal?.throwIfAborted();
            this.results.set(active.id, values);
            this.remember(active, values);
          } else if (current.browserAction || current.localAction) {
            const properties = { ...current.properties };
            for (const input of inputs(current).filter((p) => p.type !== "flow")) properties[input.key] = this.value(current, input.key);
            const values = await execute(current, properties);
            signal?.throwIfAborted();
            this.results.set(current.id, values);
            this.remember(current, values);
          }
          report(current, output);
          target = next(current, output);
        }
      };
      const root = event ? this.node(event.nodeId) : roots[0];
      if (event) report(root, "event");
      await walk(event ? next(root, "event") : { node: root, input: root instanceof ControlNode ? root.entry : "flow" });
    } finally {
      this.emit = undefined;
    }
  }
}
