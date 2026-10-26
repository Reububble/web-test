import type { ElementHandle, Page } from "puppeteer";
import type { PortValuesByType } from "web/nodes/type_descriptor.ts";

export class InvalidAction extends Error {}

/** Session-owned browser resources available to a node's process function. */
export interface BrowserContext {
  getPage(): Promise<Page>;
  clearElements(): Promise<void>;
  saveElement(element: ElementHandle<Element> | null, key: string): Promise<PortValuesByType["element"]>;
  saveElements(elements: ElementHandle<Element>[], key: string): Promise<PortValuesByType["element"][]>;
  element(value: unknown): ElementHandle<Element> | null;
  reset(acceptInsecureCerts?: boolean): Promise<void>;
}

export interface BrowserProcessContext {
  browser: BrowserContext;
  nodeId: string;
  signal?: AbortSignal;
}
