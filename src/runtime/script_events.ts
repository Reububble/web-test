export type AsyncOutcome = "completed" | "failed" | "canceled";
export type ScriptEvent =
  | { type: "run-start"; runId: string }
  | { type: "async-start"; runId: string; blockId: string; invocationId: string }
  | { type: "async-end"; runId: string; blockId: string; invocationId: string; outcome: AsyncOutcome }
  | { type: "screenshot"; runId: string; screenshot: Uint8Array }
  | { type: "run-end"; runId: string }
  | { type: "log"; runId: string; level: string; message: string }
  | { type: "stopped"; runId: string }
  | { type: "error"; runId: string; error: string };

export type ScriptWorkerMessage =
  | { type: "async-start"; blockId: string; invocationId: string }
  | { type: "async-end"; blockId: string; invocationId: string; outcome: AsyncOutcome }
  | { type: "action"; callId: number; action: string; properties: Record<string, unknown> }
  | { type: "complete" }
  | { type: "log"; level: string; message: string }
  | { type: "error"; error: string };
