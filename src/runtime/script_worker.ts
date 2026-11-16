import type { ScriptWorkerMessage } from "./script_events.ts";
import { scriptActions } from "./script_actions.ts";
import { parseValue, stringifyValue } from "../value.ts";

const send = (message: ScriptWorkerMessage) => console.log(stringifyValue(message));
let nextCall = 0, nextInvocation = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const tasks = new Set<Promise<unknown>>();
const browser = Object.freeze({
  ...Object.fromEntries(
    Object.entries(scriptActions).map(([method, definition]) => [method, (...values: unknown[]) => {
      const callId = ++nextCall;
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject });
        const properties = Object.fromEntries(definition.inputs.map((name, index) => [name, values[index] ?? null]));
        if (definition.action === "script") {
          const args = properties.arguments;
          if (args && typeof args === "object") { for (const [key, value] of Object.entries(args)) properties[`arg_${key}`] = value; }
          delete properties.arguments;
        }
        send({ type: "action", callId, action: definition.action, properties });
      });
    }]),
  ),
  track<T>(blockId: string, action: () => Promise<T>): Promise<T> {
    const invocationId = String(++nextInvocation);
    send({ type: "async-start", blockId, invocationId });
    const task = (async () => {
      let outcome: "completed" | "failed" = "failed";
      try {
        const result = await action();
        outcome = "completed";
        return result;
      } finally {
        send({ type: "async-end", blockId, invocationId, outcome });
      }
    })();
    tasks.add(task);
    task.finally(() => tasks.delete(task)).catch(() => {});
    return task;
  },
});

async function receive(data: { type: string; callId: number; error?: string; code: string; output?: unknown }): Promise<void> {
  if (data.type === "result") {
    const call = pending.get(data.callId);
    if (!call) return;
    pending.delete(data.callId);
    if (data.error) call.reject(new Error(data.error));
    else call.resolve(data.output);
    return;
  }
  if (data.type !== "run") return;
  try {
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const logger = Object.freeze(Object.fromEntries(["log", "info", "warn", "error", "debug"].map((level) => [level, (...values: unknown[]) => {
      const message = values.map((value) => {
        if (typeof value === "string") return value;
        try {
          return stringifyValue(value);
        } catch {
          return String(value);
        }
      }).join(" ");
      send({ type: "log", level, message });
    }])));
    await new AsyncFunction("browser", "console", `"use strict";\n${data.code}`)(browser, logger);
    while (tasks.size) await Promise.all([...tasks]);
    send({ type: "complete" });
  } catch (error) {
    send({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }
}

let buffer = "";
for await (const chunk of Deno.stdin.readable.pipeThrough(new TextDecoderStream())) {
  buffer += chunk;
  let newline: number;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    receive(parseValue(line) as Parameters<typeof receive>[0]);
  }
}
