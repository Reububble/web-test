import type { Graph, Value } from "web-test/graph.ts";
import type { RunEvent } from "web-test/run_events.ts";
export type { RunEvent } from "web-test/run_events.ts";
import type { BrowserSession } from "web-test/runtime/browser.ts";
import { DeclarativeNode } from "web-test/nodes/declarative_node.ts";
// Each graph run owns its flow-attached listeners and serial event queue.
export class GraphRun {
  private stopped = false;
  private listeners = new Map<string, { nodeId: string; unsubscribe: () => void }>();
  private pending: { nodeId: string; values: Record<string, Value> }[] = [];
  private busy = false;
  private subscriptionsClosed = false;
  private controller = new AbortController();
  private execution?: Promise<void>;
  constructor(
    private graph: Graph,
    private session: Pick<BrowserSession, "execute" | "onConsole" | "getPage">,
    private send: (event: RunEvent) => void,
    private options: { stopListeningOnCompletion?: boolean } = {},
  ) {}
  private get listening(): boolean {
    return this.listeners.size > 0;
  }
  private removeListener(listener: { listenerId: string }): boolean {
    const entry = this.listeners.get(listener.listenerId);
    if (!entry) return false;
    this.listeners.delete(listener.listenerId);
    entry.unsubscribe();
    return true;
  }
  private detachAll(discardPending: boolean): void {
    for (const entry of this.listeners.values()) entry.unsubscribe();
    this.listeners.clear();
    if (discardPending) this.pending = [];
  }
  private async attach(node: DeclarativeNode): Promise<Record<string, Value>> {
    if (this.subscriptionsClosed) throw new Error("Cannot attach a listener after the main flow has completed in a finite run.");
    for (const [listenerId, entry] of this.listeners) if (entry.nodeId === node.id) this.removeListener({ listenerId });
    const listener = { listenerId: crypto.randomUUID() };
    const entry = { nodeId: node.id, unsubscribe: () => {} };
    this.listeners.set(listener.listenerId, entry);
    try {
      entry.unsubscribe = node.subscribe(this.session, (values) => {
        if (this.stopped || !this.listeners.has(listener.listenerId)) return;
        if (this.pending.length >= 100) {
          this.fail(new Error("Console event queue filled. Check for a logging loop."));
          return;
        }
        this.pending.push({ nodeId: node.id, values: { ...values, listener } });
        this.drain();
      });
      if (!this.listeners.has(listener.listenerId)) entry.unsubscribe();
      await node.prepare(this.session);
      return { listener };
    } catch (error) {
      this.removeListener(listener);
      throw error;
    }
  }
  stop(reason?: string): void {
    if (this.stopped) return;
    this.stopped = true;
    this.controller.abort(new Error("Execution stopped."));
    this.detachAll(true);
    if (reason) this.send({ type: "error", error: reason });
  }
  async cancel(): Promise<void> {
    this.stop();
    await this.execution?.catch(() => {});
    this.send({ type: "stopped" });
  }
  async start(): Promise<void> {
    try {
      this.busy = true;
      this.send({ type: "run-start" });
      if (!this.stopped) await this.execute();
      this.busy = false;
      if (this.options.stopListeningOnCompletion) {
        // Freeze the queue when the main branch ends, then finish captured events.
        this.subscriptionsClosed = true;
        this.detachAll(false);
      }
      await this.drain(false);
      if (!this.stopped) this.send({ type: "run-end", listening: this.listening });
    } catch (error) {
      this.fail(error);
    }
  }
  private fail(error: unknown): void {
    if (this.stopped) return;
    this.send({ type: "error", error: error instanceof Error ? error.message : String(error) });
    this.stop();
  }
  private async drain(reportCompletion = true): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      while (!this.stopped && this.pending.length) {
        this.send({ type: "run-start" });
        await this.execute(this.pending.shift()!);
      }
      if (!this.stopped && reportCompletion && !this.options.stopListeningOnCompletion) this.send({ type: "run-end", listening: this.listening });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }
  private execute(event?: { nodeId: string; values: Record<string, Value> }): Promise<void> {
    const execution = this.graph.run(
      async (node, properties) => {
        if (this.stopped) throw new Error("Execution stopped.");
        if (node instanceof DeclarativeNode && node.eventTrigger) return await this.attach(node);
        if (node.type === "log") {
          const message = String(properties.message ?? "");
          const level = String(properties.level);
          const timestamp = Temporal.Now.instant();
          this.send({ type: "log", message, level, timestamp });
          return { message, timestamp };
        }
        const result = await this.session.execute(node.type, properties, node.id, this.controller.signal);
        if (!this.stopped) this.send({ type: "screenshot", screenshot: result.screenshot });
        return result.output;
      },
      () => {
        if (this.stopped) throw new Error("Execution stopped.");
      },
      () => {},
      event,
      (event) => {
        if (!this.stopped) this.send(event);
      },
      this.controller.signal,
      this.graph.macros,
      { removeListener: (listener) => this.removeListener(listener) },
    );
    this.execution = execution;
    return execution.finally(() => {
      if (this.execution === execution) this.execution = undefined;
    });
  }
}
