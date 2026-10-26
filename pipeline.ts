import { parseValue } from "web/value.ts";
import type { BrowserLifecycle } from "web/runtime/browser_launcher.ts";
/** Run graphs exported by Web Test Studio, with failure propagation and browser cleanup. @module */

import { BrowserSession } from "web/runtime/browser.ts";
import { GraphRun } from "web/runtime/graph_run.ts";
import { Graph } from "web/graph.ts";
/** Controls for executing a graph exported by Web Test Studio. */

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
/**  * Run an exported JSON pipeline, rejecting on failure, timeout or cancellation.  * The pipeline owns its browser and always closes it before settling.  */

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
