/** Browser automation and exported pipeline execution for Deno. @module */
import { BrowserSession } from "web/runtime/browser.ts";
import type { BrowserLifecycle } from "web/runtime/browser_launcher.ts";
import type { Page } from "puppeteer";
import type { Value } from "web/nodes/base.ts";

export { BrowserLauncher } from "web/runtime/browser_launcher.ts";
export type { BrowserLaunchOptions, BrowserLifecycle } from "web/runtime/browser_launcher.ts";
/** The browser page used by an automation session. */
export type { Page } from "puppeteer";
/** Runtime values carried by pipeline ports and browser actions. */
export type { JsonValue, Value } from "web/nodes/base.ts";

/** A completed browser action and its screenshot. */
export interface ActionResult {
  /** Named action outputs. */
  output: Record<string, Value>;
  /** PNG bytes; empty when resetting a browser. */
  screenshot: Uint8Array;
}

/** Public session lifecycle and browser-action API. */
export interface AutomationSession {
  /** Open or reuse this session's browser page. */
  getPage(): Promise<Page>;
  /** Execute a supported action, serialising it with other session actions. */
  execute(type: string, properties: Record<string, Value>, nodeId?: string, signal?: AbortSignal): Promise<ActionResult>;
  /** Close the current browser and clear retained element references. */
  reset(acceptInsecureCerts?: boolean): Promise<void>;
  /** Close the browser and release its resources. Safe before launch. */
  close(): Promise<void>;
}

/** Create a session with a caller-supplied provider, or Puppeteer's default launch settings. Launching is lazy. */
export function createBrowserSession(launcher?: BrowserLifecycle): AutomationSession {
  return new BrowserSession(launcher);
}
