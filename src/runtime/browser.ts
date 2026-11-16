import type { Browser, ConsoleMessage, ElementHandle, Page } from "puppeteer";
import type { NodeType, Value } from "web-test/nodes/base.ts";
import { createNode, nodeClasses } from "web-test/nodes/index.ts";
import { DeclarativeNode } from "web-test/nodes/declarative_node.ts";
import { type BrowserContext, InvalidAction } from "web-test/nodes/browser_context.ts";
import type { PortValuesByType } from "web-test/nodes/type_descriptor.ts";
import { BrowserLauncher, type BrowserLifecycle } from "web-test/runtime/browser_launcher.ts";
export { InvalidAction } from "web-test/nodes/browser_context.ts";
/** Serializes browser actions and owns a lazily launched page, console subscriptions, and element references. */
export class BrowserSession {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private ready: Promise<Page> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private configuration = { acceptInsecureCerts: false };
  private elements = new Map<string, { handle: ElementHandle<Element>; key: string }>();
  private consoleListeners = new Set<(values: Record<string, Value>) => void>();
  private consoleQueue: Promise<void> = Promise.resolve();
  /** Create a lazy browser session with a supplied provider or Puppeteer's default launch settings. */
  constructor(private launcher: BrowserLifecycle = new BrowserLauncher()) {}
  /** Subscribe to ordered page-console records and return a function that unsubscribes. */
  onConsole(listener: (values: Record<string, Value>) => void): () => void {
    this.consoleListeners.add(listener);
    return () => {
      this.consoleListeners.delete(listener);
    };
  }
  /** Read console arguments immediately and deliver normalized records in page-event order. */
  private captureConsole(page: Page, message: ConsoleMessage): void {
    const listeners = [...this.consoleListeners];
    if (!listeners.length) return;
    const location = message.location();
    const values: Record<string, Value> = {
      message: message.text(),
      level: message.type(),
      url: page.url(),
      source: location.url ?? "",
      line: location.lineNumber === undefined ? 0 : location.lineNumber + 1,
      column: location.columnNumber === undefined ? 0 : location.columnNumber + 1,
      timestamp: Temporal.Now.instant(),
    };
    // Start reading handles now; preserve the order of console events on delivery.
    const args = Promise.all(
      message.args().map(async (arg): Promise<Value> => {
        try {
          const value = await arg.jsonValue();
          return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? String(item) : item) ?? "null");
        } catch {
          return arg.toString();
        }
      }),
    );
    // page.url() can still describe the previous document during navigation logs.
    const pageUrl = page.evaluate(() => globalThis.location.href).catch(() => page.url());
    this.consoleQueue = this.consoleQueue.then(async () => {
      values.args = await args;
      values.url = await pageUrl;
      if (page !== this.page) return;
      for (const listener of listeners) if (this.consoleListeners.has(listener)) listener(values);
    }).catch(() => {});
  }
  /** Open or reuse the session's automated browser page; launches lazily if necessary. */
  async getPage(): Promise<Page> {
    if (this.browser?.connected && this.page && !this.page.isClosed()) return this.page;
    if (this.ready) return this.ready;
    this.ready = (async () => {
      await this.reset();
      this.browser = await this.launcher.launch(this.configuration.acceptInsecureCerts);
      this.page = await this.browser.newPage();
      const page = this.page;
      page.on("console", (message) => this.captureConsole(page, message));
      await this.page.setViewport({ width: 1024, height: 576 });
      return this.page;
    })().finally(() => {
      this.ready = undefined;
    });
    return await this.ready;
  }
  /** Return a copy of the session's current certificate-handling configuration. */
  settings(): { acceptInsecureCerts: boolean } {
    return { ...this.configuration };
  }
  /** Queue a certificate-policy change, closing the browser only when the setting changes. */
  configureCertificate(acceptInsecureCerts: boolean): Promise<void> {
    const configure = async () => {
      if (this.configuration.acceptInsecureCerts === acceptInsecureCerts) return;
      // Finish an in-flight action or launch before closing its browser.
      await this.ready?.catch(() => {});
      await this.reset();
      this.configuration = { ...this.configuration, acceptInsecureCerts };
    };
    const result = this.queue.then(configure);
    this.queue = result.catch(() => {});
    return result;
  }
  /** Expire every retained element reference and release its browser handle. */
  async clearElements(): Promise<void> {
    const handles = [...this.elements.values()];
    this.elements.clear();
    await Promise.all(handles.map((item) => item.handle.dispose().catch(() => {})));
  }
  /** Retain an element under an output key and return its transferable reference, or null. */
  async saveElement(handle: ElementHandle<Element> | null, key: string): Promise<PortValuesByType["element"]> {
    const references = await this.saveElements(handle ? [handle] : [], key);
    return references[0] ?? null;
  }
  /** Replace the handles retained for an output key and return ordered transferable element references. */
  async saveElements(handles: ElementHandle<Element>[], key: string): Promise<PortValuesByType["element"][]> {
    for (const [id, item] of this.elements) {
      if (item.key === key) {
        this.elements.delete(id);
        await item.handle.dispose().catch(() => {});
      }
    }
    if (this.elements.size + handles.length > 1024) {
      await Promise.all(handles.map((handle) => handle.dispose().catch(() => {})));
      throw new Error("Too many retained element outputs. Navigate to reset them.");
    }
    return handles.map((handle) => {
      const elementId = crypto.randomUUID();
      this.elements.set(elementId, { handle, key });
      return { elementId };
    });
  }
  /** Resolve a nullable element reference, throwing when its shape is invalid or it has expired. */
  element(value: unknown): ElementHandle<Element> | null {
    if (value === null) return null;
    if (!value || typeof value !== "object" || !("elementId" in value) || typeof value.elementId !== "string") {
      throw new InvalidAction("Element input must come from an element output.");
    }
    const entry = this.elements.get(value.elementId);
    if (!entry) throw new InvalidAction("This element reference expired. Run its query again after navigation.");
    return entry.handle;
  }
  /** Execute a delegated node action with its validated named properties. */
  execute(type: unknown, properties: unknown, nodeId = "standalone", signal?: AbortSignal): Promise<{ output: Record<string, Value>; screenshot: Uint8Array }> {
    const execute = async () => {
      signal?.throwIfAborted();
      if (typeof type !== "string" || !Object.hasOwn(nodeClasses, type)) throw new InvalidAction("Unsupported browser action.");
      const node = createNode(type as NodeType, 0, 0);
      if (!(node instanceof DeclarativeNode) || !node.browserAction) throw new InvalidAction("Unsupported browser action.");
      let abort: (() => void) | undefined;
      const perform = async () => {
        if (!properties || typeof properties !== "object" || Array.isArray(properties)) throw new InvalidAction("Properties must be an object.");
        node.properties = properties as Record<string, Value>;
        const browser: BrowserContext = {
          getPage: () => this.getPage(),
          clearElements: () => this.clearElements(),
          saveElement: (element, key) => this.saveElement(element, key),
          saveElements: (elements, key) => this.saveElements(elements, key),
          element: (reference) => this.element(reference),
          reset: async (acceptInsecureCerts) => {
            await this.ready?.catch(() => {});
            await this.reset(acceptInsecureCerts);
          },
        };
        const output = await node.runBrowser({ browser, nodeId, signal });
        signal?.throwIfAborted();
        // A reset must leave the browser closed instead of launching for a screenshot.
        if (!node.captureScreenshot) return { output, screenshot: new Uint8Array() };
        const page = await this.getPage();
        signal?.throwIfAborted();
        const screenshot = await page.screenshot({ type: "png", encoding: "binary" });
        return { output, screenshot };
      };
      const action = perform();
      try {
        if (!signal) return await action;
        return await Promise.race([
          action,
          new Promise<never>((_, reject) => {
            abort = () => reject(signal.reason);
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) abort();
          }),
        ]);
      } finally {
        if (abort) signal?.removeEventListener("abort", abort);
        if (signal?.aborted) {
          // Closing the page interrupts navigation, selectors and pending scripts.
          await this.ready?.catch(() => {});
          if (node.interruptBrowser) await this.reset();
          await action.catch(() => {});
        }
      }
    };
    const result = this.queue.then(execute);
    this.queue = result.catch(() => {});
    return result;
  }
  /** Close the current browser and expire its element references while keeping the provider reusable. */
  async reset(acceptInsecureCerts?: boolean): Promise<void> {
    await this.clearElements();
    await this.launcher.reset();
    this.browser = undefined;
    this.page = undefined;
    if (acceptInsecureCerts !== undefined) this.configuration = { ...this.configuration, acceptInsecureCerts };
  }
  /** Release owned resources and wait for cleanup to finish. */
  async close(): Promise<void> {
    await this.queue;
    await this.ready?.catch(() => {});
    await this.reset();
    await this.launcher.close();
    this.configuration = { acceptInsecureCerts: false };
  }
}
