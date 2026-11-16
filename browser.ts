/**
 * Browser sessions and caller-configured browser providers for Deno automation.
 *
 * {@link createBrowserSession} returns an {@link AutomationSession} that launches
 * lazily on its first browser operation. Supply a {@link BrowserLauncher} with
 * Puppeteer options, or implement {@link BrowserLifecycle} to own browser startup.
 * Actions return named outputs and PNG screenshots through {@link ActionResult}.
 *
 * Close the session in a `finally` block. Importing this module starts no browser
 * or server; browser installation and executable configuration are the caller's responsibility.
 *
 * @example
 * ```ts
 * import { BrowserLauncher, createBrowserSession } from "@reububble/web-test/browser";
 *
 * const session = createBrowserSession(new BrowserLauncher({ headless: true }));
 * try {
 *   const page = await session.getPage();
 *   await page.goto("https://example.com");
 * } finally {
 *   await session.close();
 * }
 * ```
 *
 * @module
 */
import { BrowserSession } from "web-test/runtime/browser.ts";
import type { BrowserLifecycle } from "web-test/runtime/browser_launcher.ts";
import type { Page } from "puppeteer";
import type { Value } from "web-test/nodes/base.ts";

export { BrowserLauncher } from "web-test/runtime/browser_launcher.ts";
export type { BrowserLaunchOptions, BrowserLifecycle } from "web-test/runtime/browser_launcher.ts";
/** The browser page used by an automation session. */
export type { Page } from "puppeteer";
/** Runtime values carried by pipeline ports and browser actions. */
export type { JsonValue, Value } from "web-test/nodes/base.ts";

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
