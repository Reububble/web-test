/**
 * Execute saved Web Test graph files from Deno scripts and command-line applications.
 *
 * {@link runPipelineFile} reads and validates a serialized graph, executes its main
 * flow and queued events, and closes its browser provider before settling.
 * {@link PipelineOptions} configures the provider, deadline, cancellation signal,
 * and log callback. Unhandled graph errors reject the returned promise.
 *
 * @example
 * ```ts
 * import { runPipelineFile } from "@reububble/web-test/pipeline";
 *
 * await runPipelineFile("pipeline.json", {
 *   timeout: 30_000,
 *   log: (message) => console.info(message),
 * });
 * ```
 *
 * @module
 */
import { parseValue } from "web-test/value.ts";
import type { BrowserLifecycle } from "web-test/runtime/browser_launcher.ts";

import { BrowserSession } from "web-test/runtime/browser.ts";
import { GraphRun } from "web-test/runtime/graph_run.ts";
import { Graph } from "web-test/graph.ts";
/** Browser ownership, cancellation, deadline, and logging options for a saved graph run. */
export interface PipelineOptions {
  /** Browser provider chosen by the caller. The pipeline owns its lifecycle. */
  browser?: BrowserLifecycle;
  /** Execution deadline in milliseconds; omitted for no deadline. */
  timeout?: number;
  /** Abort execution and close the pipeline's browser. */

  signal?: AbortSignal;
  /** Receive messages emitted by Log nodes. Defaults to console.log. */

  log?: (message: string) => void;
}
/**
 * Run a saved JSON graph and close its browser provider on completion or failure.
 *
 * @param file Path to a graph file encoded with the Web Test value codec.
 * @param options Provider, timeout, cancellation signal, and log callback.
 * @returns A promise that resolves after the main flow and queued events finish.
 * @throws If the file is invalid, execution fails, the deadline expires, or the run is aborted.
 */
export async function runPipelineFile(file: string, options: PipelineOptions = {}): Promise<void> {
  const graph = Graph.deserialize(parseValue(await Deno.readTextFile(file)));
  const session = new BrowserSession(options.browser);
  let failure: Error | undefined, completed = false;
  const log = options.log ?? console.log;
  const run = new GraphRun(graph, session, (event) => {
    if (event.type === "error") failure = new Error(event.error);
    if (event.type === "run-end" && !event.listening) completed = true;
    if (event.type === "log") log(event.message);
  }, { stopListeningOnCompletion: true });
  const controller = new AbortController();
  const abort = () => {
    controller.abort(options.signal?.reason ?? new Error("Execution interrupted."));
    run.stop();
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = options.timeout === undefined ? undefined : setTimeout(() => {
    controller.abort(new Error(`Pipeline timed out after ${options.timeout} ms.`));
    run.stop();
  }, options.timeout);
  try {
    if (options.signal?.aborted) abort();
    controller.signal.throwIfAborted();
    await run.start();
    controller.signal.throwIfAborted();
    if (failure) throw failure;
    if (!completed) throw new Error("Pipeline did not run to completion.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    await run.cancel();
    await session.close();
  }
}
