/** The terminal result of one tracked async invocation: completed, failed, or canceled. */
export type AsyncOutcome = "completed" | "failed" | "canceled";
/** JavaScript-run lifecycle, log, screenshot, error, and per-invocation async progress events. */
export type ScriptEvent =
  | { type: "run-start"; runId: string }
  | { type: "async-start"; runId: string; blockId: string; invocationId: string }
  | { type: "async-end"; runId: string; blockId: string; invocationId: string; outcome: AsyncOutcome }
  | { type: "screenshot"; runId: string; screenshot: Uint8Array }
  | { type: "run-end"; runId: string }
  | { type: "log"; runId: string; level: string; message: string }
  | { type: "stopped"; runId: string }
  | { type: "error"; runId: string; error: string };

/** Messages emitted by the isolated evaluator to request actions or report logs and invocation progress. */
export type ScriptWorkerMessage =
  | { type: "async-start"; blockId: string; invocationId: string }
  | { type: "async-end"; blockId: string; invocationId: string; outcome: AsyncOutcome }
  | { type: "action"; callId: number; action: string; properties: Record<string, unknown> }
  | { type: "complete" }
  | { type: "log"; level: string; message: string }
  | { type: "error"; error: string };
