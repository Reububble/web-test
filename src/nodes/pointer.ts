import type { Page } from "puppeteer";
import { defineNode } from "web-test/nodes/define_node.ts";
import type { DataValues, DeclarativeNodeConstructor } from "web-test/nodes/declarative_node.ts";
import { browserNumber } from "web-test/nodes/browser_support.ts";
import { InvalidAction } from "web-test/nodes/browser_context.ts";
import { type TypeDescriptor, typeDescriptor } from "web-test/nodes/type_descriptor.ts";

type PointerType = "mouse" | "touch";
const pointerType: TypeDescriptor<PointerType> = {
  ...typeDescriptor("text"),
  defaultValue: () => "mouse",
  read(value) {
    if (value !== "mouse" && value !== "touch") throw new InvalidAction("Pointer type must be mouse or touch.");
    return value;
  },
};
// State belongs to the page, so actions in different nodes share a gesture and resets discard it.
const active = new WeakMap<Page, Set<PointerType>>();
const inputs: {
  readonly flow: { readonly label: "Flow"; readonly type: "flow" };
  readonly x: { readonly label: "X"; readonly type: TypeDescriptor<number> };
  readonly y: { readonly label: "Y"; readonly type: TypeDescriptor<number> };
  readonly pointerType: { readonly label: "Pointer Type"; readonly type: TypeDescriptor<PointerType> };
} = {
  flow: { label: "Flow", type: "flow" },
  x: { label: "X", type: browserNumber(0) },
  y: { label: "Y", type: browserNumber(0) },
  pointerType: { label: "Pointer Type", type: pointerType },
} as const;
const endInputs: Pick<typeof inputs, "flow" | "pointerType"> = { flow: inputs.flow, pointerType: inputs.pointerType };
const releaseInputs: Pick<typeof inputs, "flow"> = { flow: inputs.flow };
const outputs: { readonly next: { readonly label: "Next"; readonly type: "flow" } } = { next: { label: "Next", type: "flow" } };

async function pointer(page: Page, action: "down" | "move" | "up" | "release", type: PointerType, x = 0, y = 0): Promise<void> {
  const pressed = active.get(page) ?? new Set<PointerType>();
  active.set(page, pressed);
  // Puppeteer has no public BiDi input session. Keep its internal frame bridge isolated here;
  // the Firefox integration test guards compatibility. Own the source IDs and input state
  // instead of mixing Puppeteer's input handles with input.releaseActions.
  const frame = page.mainFrame() as unknown as { browsingContext?: { performActions(actions: unknown[]): Promise<void>; releaseActions(): Promise<void> } };
  const context = frame.browsingContext;
  if (!context) throw new InvalidAction("Native pointer actions require a WebDriver BiDi browser.");
  if (action === "release") {
    await context.releaseActions();
    pressed.clear();
    return;
  }
  if (action === "down" && pressed.has(type)) throw new InvalidAction(`The ${type} pointer is already down.`);
  if ((action === "up" || (type === "touch" && action === "move")) && !pressed.has(type)) {
    throw new InvalidAction(`The ${type} pointer must be down first.`);
  }
  const actions: Record<string, unknown>[] = [];
  if (action === "down" || action === "move") actions.push({ type: "pointerMove", x: Math.round(x), y: Math.round(y), duration: 0 });
  if (action === "down") actions.push({ type: "pointerDown", button: 0 });
  if (action === "up") actions.push({ type: "pointerUp", button: 0 });
  await context.performActions([{ type: "pointer", id: `web-test-${type}`, parameters: { pointerType: type }, actions }]);
  if (action === "down") pressed.add(type);
  if (action === "up") pressed.delete(type);
}

/** Press the primary mouse button or start a single touch at viewport coordinates. */
export const PointerDownNode: DeclarativeNodeConstructor<typeof inputs, typeof outputs, DataValues<typeof inputs>> = defineNode({
  kind: "browser",
  type: "pointer_down",
  title: "Pointer Down",
  inputs,
  outputs,
  properties: () => ({ x: 500, y: 300, pointerType: "mouse" as PointerType }),
  async process({ x, y, pointerType }, { browser }) {
    await pointer(await browser.getPage(), "down", pointerType, x, y);
    return {};
  },
});

/** Move the mouse or an active touch in viewport CSS pixels, preserving pressed state. */
export const PointerMoveNode: DeclarativeNodeConstructor<typeof inputs, typeof outputs, DataValues<typeof inputs>> = defineNode({
  kind: "browser",
  type: "pointer_move",
  title: "Pointer Move",
  inputs,
  outputs,
  properties: () => ({ x: 500, y: 300, pointerType: "mouse" as PointerType }),
  async process({ x, y, pointerType }, { browser }) {
    await pointer(await browser.getPage(), "move", pointerType, x, y);
    return {};
  },
});

/** Release the primary mouse button or end the active touch at its current position. */
export const PointerUpNode: DeclarativeNodeConstructor<typeof endInputs, typeof outputs, DataValues<typeof endInputs>> = defineNode({
  kind: "browser",
  type: "pointer_up",
  title: "Pointer Up",
  inputs: endInputs,
  outputs,
  properties: () => ({ pointerType: "mouse" as PointerType }),
  async process({ pointerType }, { browser }) {
    await pointer(await browser.getPage(), "up", pointerType);
    return {};
  },
});

/** Release all held browser inputs and clear their state through BiDi input.releaseActions. */
export const ReleaseInputsNode: DeclarativeNodeConstructor<typeof releaseInputs, typeof outputs, DataValues<typeof releaseInputs>> = defineNode({
  kind: "browser",
  type: "release_inputs",
  title: "Release Inputs",
  inputs: releaseInputs,
  outputs,
  properties: () => ({}),
  help: "Release all held pointer and keyboard inputs using WebDriver BiDi. This may emit pointerup and click; it does not synthesize pointercancel.",
  async process(_inputs, { browser }) {
    await pointer(await browser.getPage(), "release", "mouse");
    return {};
  },
});
