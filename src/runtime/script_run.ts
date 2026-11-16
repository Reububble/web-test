import type { BrowserSession } from "web-test/runtime/browser.ts";
import type { AsyncOutcome, ScriptEvent, ScriptWorkerMessage } from "web-test/runtime/script_events.ts";
import { scriptActions } from "web-test/runtime/script_actions.ts";
import { parseValue, stringifyValue } from "web-test/value.ts";

/** Evaluate JavaScript in a permissionless Deno subprocess and route browser operations through the session. */
export class ScriptRun {
  readonly runId: string;
  private process?: Deno.ChildProcess;
  private input?: WritableStreamDefaultWriter<Uint8Array>;
  private controller = new AbortController();
  private done = Promise.withResolvers<void>();
  private active = new Map<string, string>();
  private pending = new Set<Promise<void>>();
  private finishing = false;
  private started = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private code: string,
    private session: Pick<BrowserSession, "execute">,
    private send: (event: ScriptEvent) => void,
    private options: { runId?: string; timeout?: number } = {},
  ) {
    this.runId = options.runId ?? crypto.randomUUID();
  }

  start(): Promise<void> {
    if (this.started || this.finishing) return this.done.promise;
    this.started = true;
    this.send({ type: "run-start", runId: this.runId });
    try {
      this.process = new Deno.Command(Deno.execPath(), {
        args: ["run", "--quiet", "--no-prompt", "--no-config", "--no-lock", new URL("./script_worker.ts", import.meta.url).href],
        stdin: "piped",
        stdout: "piped",
        stderr: "null",
      }).spawn();
      this.input = this.process.stdin.getWriter();
      this.readMessages();
      this.timer = setTimeout(() => this.finish("error", "JavaScript execution timed out."), this.options.timeout ?? 30000);
      this.post({ type: "run", code: this.code });
    } catch (error) {
      this.finish("error", error instanceof Error ? error.message : String(error));
    }
    return this.done.promise;
  }

  private post(message: object): void {
    this.input?.write(new TextEncoder().encode(`${stringifyValue(message)}\n`)).catch((error) => {
      if (!this.finishing) this.finish("error", String(error));
    });
  }

  private async readMessages(): Promise<void> {
    try {
      let buffer = "";
      for await (const chunk of this.process!.stdout.pipeThrough(new TextDecoderStream())) {
        buffer += chunk;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          this.receive(parseValue(line) as ScriptWorkerMessage);
        }
      }
      if (!this.finishing) this.finish("error", "JavaScript evaluator exited unexpectedly.");
    } catch (error) {
      if (!this.finishing) this.finish("error", String(error));
    }
  }

  cancel(): Promise<void> {
    this.finish("stopped");
    return this.done.promise;
  }

  private receive(message: ScriptWorkerMessage): void {
    if (this.finishing) return;
    if (message.type === "async-start") {
      this.active.set(message.invocationId, message.blockId);
      this.send({ ...message, runId: this.runId });
    } else if (message.type === "async-end") {
      if (!this.active.delete(message.invocationId)) return;
      this.send({ ...message, runId: this.runId });
    } else if (message.type === "action") {
      const call = this.executeAction(message.callId, message.action, message.properties);
      this.pending.add(call);
      call.finally(() => this.pending.delete(call));
    } else if (message.type === "log") this.send({ ...message, runId: this.runId });
    else if (message.type === "error") this.finish("error", message.error);
    else if (message.type === "complete") this.finish("run-end");
  }

  private async executeAction(callId: number, action: string, properties: Record<string, unknown>): Promise<void> {
    try {
      if (!Object.values(scriptActions).some((definition) => definition.action === action)) throw new Error("Unsupported browser action.");
      const result = await this.session.execute(action, properties, `script-${this.runId}-${callId}`, this.controller.signal);
      if (this.finishing) return;
      this.send({ type: "screenshot", runId: this.runId, screenshot: result.screenshot });
      this.post({ type: "result", callId, output: result.output });
    } catch (error) {
      if (!this.finishing) this.post({ type: "result", callId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async finish(type: "run-end" | "stopped" | "error", error?: string): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;
    clearTimeout(this.timer);
    try {
      this.process?.kill("SIGKILL");
    } catch {
      // The evaluator may already have exited.
    }
    this.controller.abort(new Error(error ?? "Execution stopped."));
    const outcome: AsyncOutcome = type === "stopped" ? "canceled" : "failed";
    for (const [invocationId, blockId] of this.active) this.send({ type: "async-end", runId: this.runId, invocationId, blockId, outcome });
    this.active.clear();
    await Promise.allSettled([...this.pending]);
    await this.process?.status;
    await this.input?.abort().catch(() => {});
    if (type === "error") this.send({ type, runId: this.runId, error: error ?? "JavaScript execution failed." });
    else this.send({ type, runId: this.runId });
    this.done.resolve();
  }
}
