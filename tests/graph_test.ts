import { assert, assertRejects, assertThrows, fail } from "@std/assert";
import { Graph, inputs, type Value } from "web-test/graph.ts";
Deno.test("concatenation keeps exactly one spare input and stable connected keys", () => {
  const graph = new Graph();
  const concat = graph.add("string_concat", 0, 0);
  const literal = graph.add("text_literal", 0, 0);
  assert(inputs(concat).length === 1, "Empty concatenator starts with one input");
  concat.properties.part_1 = "Hello ";
  graph.syncInputs();
  literal.properties.value = "world";
  graph.connect(literal.id, "text", concat.id, "part_2");
  assert(inputs(concat).length === 3, "Two filled inputs get a spare");
  assert(concat.dataValue("text", (key) => graph.value(concat, key)) === "Hello world", "Joins in order");
  concat.properties.part_1 = "";
  graph.syncInputs();
  assert(inputs(concat).length === 2 && inputs(concat)[0].key === "part_2", "Clearing an interior input preserves the connected key");
  assert(graph.links[0].input === "part_2", "Connection stays on its original field");
  graph.disconnect(new Set([literal.id]));
  assert(inputs(concat).length === 1, "Disconnecting empty inputs leaves one spare");
});
Deno.test("format creates named inputs, preserves shared names, escapes braces and prunes obsolete links", () => {
  const graph = new Graph();
  const format = graph.add("string_format", 0, 0);
  const literal = graph.add("text_literal", 0, 0);
  literal.properties.value = "Robin";
  graph.connect(literal.id, "text", format.id, "arg_name");
  format.properties.template = "hello {name}, {greeting}! {name} {{literal}}";
  graph.syncInputs();
  format.properties.arg_greeting = "how are you";
  assert(inputs(format).map((input) => input.label).join() === "Template,name,greeting", "Names appear once in template order");
  assert(
    format.dataValue("text", (key) => graph.value(format, key)) === "hello Robin, how are you! Robin {literal}",
    "Substitutes every occurrence and literal braces",
  );
  format.properties.template = "{name}: {new_name}";
  graph.syncInputs();
  assert(graph.links.length === 1 && !Object.hasOwn(format.properties, "arg_greeting"), "Keeps matching inputs and removes obsolete values");
  format.properties.template = "No placeholders";
  graph.syncInputs();
  assert(inputs(format).length === 1 && (graph.links.length as number) === 0, "Removing names prunes their connections");
  graph.connect(literal.id, "text", format.id, "template");
  literal.properties.value = "Connected {person}";
  graph.syncInputs();
  format.properties.arg_person = "template";
  assert(format.dataValue("text", (key) => graph.value(format, key)) === "Connected template", "Connected templates also generate named inputs");
});
Deno.test("Log executes in flow with resolved strings and exposes its result", async () => {
  const graph = new Graph();
  const concat = graph.add("string_concat", 0, 0);
  concat.properties.part_1 = "Logged text";
  graph.syncInputs();
  const log = graph.add("log", 0, 0);
  const next = graph.add("log", 0, 0);
  graph.connect(concat.id, "text", log.id, "message");
  graph.connect(log.id, "next", next.id, "flow");
  graph.connect(log.id, "message", next.id, "message");
  const calls: string[] = [];
  await graph.run((node, fields) => {
    calls.push(node.id);
    assert(fields.message === "Logged text", "Log receives the resolved text");
    return Promise.resolve({ message: fields.message, timestamp: "2026-10-06T00:00:00Z" });
  });
  assert(calls.join() === [log.id, next.id].join(), "Log continues through Next");
});
Deno.test("console listeners attach through flow and seed fresh event branches without repeating startup", async () => {
  const graph = new Graph();
  const startup = graph.add("navigate", 0, 0);
  const trigger = graph.add("console_trigger", 0, 0);
  const script = graph.add("script", 0, 0);
  graph.connect(trigger.id, "event", script.id, "flow");
  graph.connect(trigger.id, "next", startup.id, "flow");
  graph.connect(trigger.id, "message", script.id, "arg_text");
  assert(inputs(trigger).some((port) => port.key === "flow"), "Listener has a flow input");
  const calls: string[] = [];
  await graph.run((node) => {
    calls.push(node.id);
    return Promise.resolve({});
  });
  assert(calls.join() === [trigger.id, startup.id].join(), "Main flow attaches the listener before startup");
  for (const message of ["first", "second"]) {
    calls.length = 0;
    await graph.run(
      (node, fields) => {
        calls.push(node.id);
        assert(fields.arg_text === message, "Event supplies fresh data to its branch");
        return Promise.resolve({ result: fields.arg_text });
      },
      () => {},
      () => {},
      { nodeId: trigger.id, values: { message, level: "log", args: [message] } },
    );
    assert(calls.join() === script.id, "Event must not rerun startup flow");
    assert(graph.inspect(trigger, "message")?.value === message, "Event outputs remain inspectable");
  }
  graph.remove(new Set([startup.id]));
  await graph.run(() => {
    return Promise.resolve({ listener: { listenerId: "attached" } });
  });
});
Deno.test("unconnected outputs retain history while execution requires fresh values", async () => {
  const graph = new Graph();
  const branch = graph.add("conditional", 0, 0);
  const scrape = graph.add("extract_text", 0, 0);
  const script = graph.add("script", 0, 0);
  graph.connect(branch.id, "true", scrape.id, "flow");
  graph.connect(branch.id, "false", script.id, "flow");
  branch.properties.condition = true;
  await graph.run(() => Promise.resolve({ text: "First value", success: true }));
  assert(graph.inspect(scrape, "text")?.value === "First value", "Unconnected output should be inspectable");
  branch.properties.condition = false;
  graph.connect(scrape.id, "text", script.id, "arg_text");
  await assertRejects(() => graph.run(() => Promise.resolve({})), Error, "", "A skipped block's historical value must not feed the new run");
  assert(graph.inspect(scrape, "text")?.value === "First value", "Inspection should retain the old value");
});
Deno.test("dynamic ports prune incompatible links; null element outputs remain usable", async () => {
  const graph = new Graph();
  const query = graph.add("query_selector", 0, 0);
  const getter = graph.add("text_content", 0, 0);
  graph.connect(query.id, "next", getter.id, "flow");
  graph.connect(query.id, "element", getter.id, "element");
  await graph.run((node, fields) => {
    if (node.id === query.id) return Promise.resolve({ element: null, success: false });
    assert(fields.element === null, "Not found should pass a null element");
    return Promise.resolve({ text: "", success: false });
  });
  const script = graph.add("script", 0, 0);
  graph.connect(getter.id, "text", script.id, "arg_text");
  script.properties.inputPorts = [{ name: "text", type: "number" }];
  graph.prune();
  assert(!graph.links.some((link) => link.to === script.id), "Changed port type should remove the incompatible connection");
});
Deno.test("text from scrape and literals feeds Comparison, then If takes the correct branch", async () => {
  const graph = new Graph();
  const scrape = graph.add("extract_text", 0, 0);
  const literal = graph.add("text_literal", 0, 0);
  literal.properties.value = "Hello";
  const compare = graph.add("comparison", 0, 0);
  const branch = graph.add("conditional", 0, 0);
  const yes = graph.add("navigate", 0, 0);
  const no = graph.add("navigate", 0, 0);
  graph.connect(scrape.id, "next", branch.id, "flow");
  graph.connect(scrape.id, "text", compare.id, "valueA");
  graph.connect(literal.id, "text", compare.id, "valueB");
  graph.connect(compare.id, "result", branch.id, "condition");
  graph.connect(branch.id, "true", yes.id, "flow");
  graph.connect(branch.id, "false", no.id, "flow");
  for (const [text, expected] of [["Hello", yes.id], ["Other", no.id]]) {
    const calls: string[] = [];
    await graph.run((node) => {
      calls.push(node.id);
      return Promise.resolve<Record<string, Value>>(node.type === "extract_text" ? { text, success: true } : {});
    });
    assert(calls.join() === [scrape.id, expected].join(), "Only the chosen branch should execute");
  }
  assert(inputs(branch).filter((p) => p.type !== "flow").every((p) => p.type === "boolean"), "If must be boolean-only");
});
Deno.test("scrape success and boolean literals drive If; values reset between runs", async () => {
  const graph = new Graph();
  const scrape = graph.add("extract_text", 0, 0);
  const branch = graph.add("conditional", 0, 0);
  const yes = graph.add("click", 0, 0), no = graph.add("click", 0, 0);
  graph.connect(scrape.id, "next", branch.id, "flow");
  graph.connect(scrape.id, "success", branch.id, "condition");
  graph.connect(branch.id, "true", yes.id, "flow");
  graph.connect(branch.id, "false", no.id, "flow");
  for (const success of [true, false]) {
    const calls: string[] = [];
    await graph.run((node) => {
      calls.push(node.id);
      return Promise.resolve<Record<string, Value>>(node.type === "extract_text" ? { text: "", success } : {});
    });
    assert(calls[1] === (success ? yes.id : no.id), "Scrape success should choose the branch");
  }
  const bool = graph.add("boolean_literal", 0, 0);
  bool.properties.value = true;
  graph.connect(bool.id, "boolean", branch.id, "condition");
  assert(graph.value(branch, "condition") === true, "Boolean literal should replace the scrape input");
});
Deno.test("typed links replace occupied inputs, fan out, reject cycles, and clean up on deletion", () => {
  const graph = new Graph();
  const a = graph.add("text_literal", 0, 0), b = graph.add("text_literal", 0, 0);
  const navigate = graph.add("navigate", 0, 0), scrape = graph.add("extract_text", 0, 0);
  a.properties.value = "first";
  b.properties.value = "second";
  graph.connect(a.id, "text", navigate.id, "url");
  graph.connect(a.id, "text", scrape.id, "selector");
  graph.connect(b.id, "text", navigate.id, "url");
  assert(graph.links.length === 2 && graph.value(navigate, "url") === "second", "One source per input and data fan-out");
  const branch = graph.add("conditional", 0, 0);
  assertThrows(() => graph.connect(a.id, "text", branch.id, "condition"), "Text cannot drive a boolean input");
  graph.connect(a.id, "text", b.id, "value");
  assertThrows(() => graph.connect(b.id, "text", a.id, "value"), "Data cycles must be rejected");
  graph.connect(navigate.id, "next", scrape.id, "flow");
  graph.connect(scrape.id, "next", navigate.id, "flow");
  graph.remove(new Set([a.id, navigate.id]));
  assert((graph.links.length as number) === 0, "Selected block deletion removes all attached links");
});
Deno.test("Comparison supports fan-out from the same literal and evaluates operators", () => {
  const graph = new Graph();
  const literal = graph.add("text_literal", 0, 0), compare = graph.add("comparison", 0, 0), branch = graph.add("conditional", 0, 0);
  literal.properties.value = "same";
  graph.connect(literal.id, "text", compare.id, "valueA");
  graph.connect(literal.id, "text", compare.id, "valueB");
  graph.connect(compare.id, "result", branch.id, "condition");
  assert(graph.value(branch, "condition") === true, "Reusing a source is not a cycle");
  compare.properties.operator = "not_equals";
  assert(graph.value(branch, "condition") === false, "Not-equal comparison");
  compare.properties.operator = "contains";
  assert(graph.value(branch, "condition") === true, "Contains comparison");
});
