import type { ElementHandle, JSHandle } from "puppeteer";
import type { Value } from "web-test/nodes/base.ts";
import { isJson, matchesType, readScriptPorts } from "web-test/script_schema.ts";
import { isValue, parseValue, stringifyValue } from "web-test/value.ts";
import { type BrowserContext, InvalidAction } from "web-test/nodes/browser_context.ts";
import { number, text } from "web-test/nodes/browser_support.ts";
/** Execute a typed input/output script in the automated page, enforce its timeout, and retain returned element handles. */
export async function runScript(context: BrowserContext, fields: Record<string, unknown>, nodeId: string): Promise<Record<string, Value>> {
  const code = text(fields, "code");
  let inputs, outputs;
  try {
    inputs = readScriptPorts(fields.inputPorts);
    outputs = readScriptPorts(fields.outputPorts);
  } catch (error) {
    throw new InvalidAction((error as Error).message);
  }
  const timeout = number(fields, "timeout", 1, 60000);
  const values: (Value | ElementHandle<Element>)[] = inputs.map((port) => {
    const value = fields[`arg_${port.name}`];
    if (!matchesType(value, port.type)) throw new InvalidAction(`Input ${port.name} must be ${port.type}.`);
    return port.type === "element" ? context.element(value) : value as Value;
  });
  const page = await context.getPage();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let handle: JSHandle<unknown> | undefined;
  const inputHandles: JSHandle[] = [];
  try {
    const arguments_: (Value | JSHandle)[] = [];
    for (const [index, port] of inputs.entries()) {
      const value = values[index];
      if (port.type !== "element" && !isJson(value)) {
        const input = await page.evaluateHandle(parseValue, stringifyValue(value));
        inputHandles.push(input);
        arguments_.push(input);
      } else arguments_.push(value);
    }
    handle = await Promise.race([
      page.evaluateHandle(
        async (source, names, ...values) => {
          const input = Object.fromEntries(names.map((name, index) => [name, values[index]]));
          const output = {};
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          await new AsyncFunction("input", "output", `"use strict";\n${source}`)(input, output);
          return output;
        },
        code,
        inputs.map((port) => port.name),
        ...arguments_,
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error(`JavaScript exceeded its ${timeout} ms timeout. The automation browser was reset.`));
        }, timeout);
      }),
    ]);
    const properties = await handle.getProperties();
    const result: Record<string, Value> = {};
    try {
      for (const port of outputs) {
        const property = properties.get(port.name);
        if (!property) throw new Error(`Script must assign output.${port.name}.`);
        if (port.type === "element") {
          const element = property.asElement();
          if (!element) {
            const value = await property.jsonValue();
            if (value !== null) throw new Error(`Output ${port.name} must be a DOM element or null.`);
          }
          result[port.name] = await context.saveElement(element as ElementHandle<Element> | null, `${nodeId}:${port.name}`);
        } else {
          const value = parseValue(await property.evaluate(stringifyValue));
          if (!matchesType(value, port.type) || !isValue(value)) throw new Error(`Output ${port.name} must be a serializable ${port.type} value.`);
          result[port.name] = value;
        }
      }
      return result;
    } finally {
      // Saved DOM handles are owned by BrowserSession until replacement or navigation.
      for (const [name, property] of properties) {
        if (!outputs.some((port) => port.name === name && port.type === "element" && property.asElement())) await property.dispose();
      }
    }
  } finally {
    clearTimeout(timer);
    await handle?.dispose().catch(() => {});
    await Promise.all(inputHandles.map((input) => input.dispose().catch(() => {})));
    if (timedOut) await context.reset();
  }
}
