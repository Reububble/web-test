import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";
import { rm } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { tmpdir } from "node:os";
/** Launch settings whose lifecycle fields are owned by BrowserLauncher. */
export type BrowserLaunchOptions = Omit<LaunchOptions, "userDataDir" | "signal" | "acceptInsecureCerts">;
/** A browser provider supplied by the embedding application's setup. */
export interface BrowserLifecycle {
  launch(acceptInsecureCerts?: boolean): Promise<Browser>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
// Own the profile: Puppeteer's automatic cleanup can run before process exit.
export class BrowserLauncher implements BrowserLifecycle {
  private profile: string | undefined;
  private browser: Browser | undefined;
  private controller: AbortController | undefined;
  private launching: Promise<Browser> | undefined;
  constructor(
    private options: BrowserLaunchOptions = {},
    private start: (options: LaunchOptions) => Promise<Browser> = (options) => puppeteer.launch(options),
  ) {}
  launch(acceptInsecureCerts = false): Promise<Browser> {
    if (this.browser?.connected) return Promise.resolve(this.browser);
    if (this.launching) return this.launching;
    this.launching = this.open(acceptInsecureCerts).finally(() => {
      this.launching = undefined;
    });
    return this.launching;
  }
  private async open(acceptInsecureCerts: boolean): Promise<Browser> {
    const timeout = this.options.timeout ?? 30000;
    for (let attempt = 0;; attempt++) {
      this.profile ??= await Deno.makeTempDir({ prefix: "web-test-browser-" });
      const controller = new AbortController();
      const deadline = Promise.withResolvers<Browser>();
      const timer = timeout === 0 ? undefined : setTimeout(() => {
        const error = new Error(`Browser startup timed out after ${timeout} ms.`);
        error.name = "TimeoutError";
        controller.abort();
        deadline.reject(error);
      }, timeout);
      try {
        this.browser = await Promise.race([
          this.start({
            ...this.options,
            userDataDir: this.profile,
            timeout,
            signal: controller.signal,
            acceptInsecureCerts,
          }),
          deadline.promise,
        ]);
        this.controller = controller;
        return this.browser;
      } catch (error) {
        // Abort terminates the process Puppeteer started, including failed handshakes.
        controller.abort();
        try {
          await this.removeProfile();
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], "Browser startup failed and its profile could not be cleaned up.");
        }
        const transient = error instanceof Error && (error.name === "TimeoutError" || /session\.new timed out/.test(error.message));
        if (attempt || !transient) throw error;
        console.warn("Browser startup timed out; retrying once with a fresh profile.");
      } finally {
        clearTimeout(timer);
      }
    }
  }
  async reset(): Promise<void> {
    await this.launching?.catch(() => {});
    const browser = this.browser;
    if (!browser) return;
    const process = browser.process();
    const exited = process && process.exitCode === null && process.signalCode === null
      ? new Promise<void>((resolve) => process.once("exit", () => resolve()))
      : Promise.resolve();
    try {
      await browser.close();
    } finally {
      // A protocol disconnect alone does not guarantee that the browser has exited.
      if (process && process.exitCode === null && process.signalCode === null) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([exited, new Promise<void>((resolve) => timer = setTimeout(resolve, 1000))]);
        } finally {
          clearTimeout(timer);
        }
      }
      if (process && process.exitCode === null && process.signalCode === null) {
        // Puppeteer's abort handler terminates this browser's entire process tree.
        this.controller?.abort();
      }
      await exited;
      this.browser = undefined;
      this.controller = undefined;
    }
  }
  async close(): Promise<void> {
    try {
      await this.reset();
    } finally {
      await this.removeProfile();
    }
  }
  private async removeProfile(): Promise<void> {
    if (!this.profile) return;
    const path = await Deno.realPath(this.profile);
    const tempRoot = await Deno.realPath(tmpdir());
    if (dirname(path).toLowerCase() !== tempRoot.toLowerCase() || !basename(path).startsWith("web-test-browser-")) {
      throw new Error("Refusing to remove an unexpected browser profile path.");
    }
    await rm(path, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    this.profile = undefined;
  }
}
