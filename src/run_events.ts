import type { GraphEvent } from "web-test/graph.ts";
/** Graph-run lifecycle events combined with node progress, logs, screenshots, errors, and listener status. */
export type RunEvent =
  | { type: "stopped" }
  | GraphEvent
  | { type: "run-start" }
  | { type: "run-end"; listening: boolean }
  | { type: "screenshot"; screenshot: Uint8Array }
  | { type: "log"; message: string; level: string; timestamp: Temporal.Instant }
  | { type: "error"; error: string };
