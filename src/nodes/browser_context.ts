import type { ElementHandle, Page } from "puppeteer";
import type { PortValuesByType } from "web-test/nodes/type_descriptor.ts";

/** Reports unsupported browser actions, invalid action inputs, or expired element references. */
export class InvalidAction extends Error {}

/** Session-owned browser resources available to a node's process function. */
export interface BrowserContext {
  /** Open or reuse the session's automated browser page; launches lazily if necessary. */
  getPage(): Promise<Page>;
  /** Expire every retained element reference and release its browser handle. */
  clearElements(): Promise<void>;
  /** Retain an element under an output key and return its transferable reference, or null. */
  saveElement(element: ElementHandle<Element> | null, key: string): Promise<PortValuesByType["element"]>;
  /** Replace the handles retained for an output key and return ordered transferable element references. */
  saveElements(elements: ElementHandle<Element>[], key: string): Promise<PortValuesByType["element"][]>;
  /** Resolve a nullable element reference, throwing when its shape is invalid or it has expired. */
  element(value: unknown): ElementHandle<Element> | null;
  /** Close the current browser and expire its element references while keeping the provider reusable. */
  reset(acceptInsecureCerts?: boolean): Promise<void>;
}

/** Browser resources, node identity, and optional cancellation supplied to a browser-node process. */
export interface BrowserProcessContext {
  /** Session-owned browser resources available to the current node process. */
  browser: BrowserContext;
  /** The originating graph node's identifier, used to associate action outputs with their owner. */
  nodeId: string;
  /** An optional signal that aborts the current action or run. */
  signal?: AbortSignal;
}
