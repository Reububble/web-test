import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { Graph, inputs, outputs } from "web/graph.ts";
import { defineNode } from "web/nodes/define_node.ts";
import type { ControlProcess, ControlStep } from "web/nodes/control_node.ts";
import { WhileNode } from "web/nodes/while.ts";

function loopNode(onClose: () => void = () => {}, onStop: () => void = () => {}) {
  return defineNode({
    type: "conditional",
    title: "Generator Loop",
    control: ["loop", "next"],
    inputs: { condition: { label: "Condition", type: "boolean", default: true } },
    outputs: { done: { label: "Done", type: "boolean" }, broken: { label: "Broken", type: "boolean" } },
    process: {
      *start({ condition }) {
        try {
          while (condition) ({ condition } = yield { control: "loop" as const, done: false, broken: false });
          return { control: "next" as const, done: true, broken: false };
        } finally {
          onClose();
        }
      },
      stop() {
        onStop();
        return { control: "next" as const, done: true, broken: true };
      },
    },
  });
}

/** Compiled authoring checks for process arguments, state, defaults and control names. */
export function controlNodeTypeChecks(): void {
  const node = new WhileNode(0, 0);
  const _input: "boolean" = node.inputs.condition.type;
  const _flow: "flow" = node.inputs.break.type;
  const _output: "number" = node.outputs.index.type;
  node.process.break({ condition: true }, { output: { index: 0 } });
  // @ts-expect-error Data inputs retain their descriptor's type.
  node.process.break({ condition: "true" }, { output: { index: 0 } });
  // @ts-expect-error The invocation's output state is typed.
  node.process.break({ condition: true }, { output: { index: "0" } });
  // @ts-expect-error Input ports have known names.
  node.inputs.typo;
  // @ts-expect-error Output ports have known names.
  node.outputs.typo;
  // @ts-expect-error Input properties retain their declared names.
  node.properties.typo = true;
  // @ts-expect-error The control field only accepts declared control outputs.
  const _wrongControl: ControlStep<"each" | "done", { index: number }> = { control: "typo", index: 0 };
  // @ts-expect-error Returned data outputs must match their declared types.
  const _wrongOutput: ControlProcess<{ condition: boolean }, { index: number }, "done"> = () => ({ control: "done", index: "0" });
  const _stateCheck: ControlProcess<{ condition: boolean }, { index: number }, "done"> = (_inputs, state) => {
    // @ts-expect-error Handlers cannot mutate previously published output state.
    state.output.index++;
    return { control: "done", index: 0 };
  };
  const badDefault = {
    type: "while",
    title: "Bad Default",
    control: ["done"],
    inputs: { condition: { label: "Condition", type: "boolean", default: "false" } },
    outputs: { index: { label: "Index", type: "number" } },
    process: { flow: () => ({ control: "done", index: 0 }) },
  } as const;
  // @ts-expect-error Defaults must match the selected descriptor.
  defineNode(badDefault);
}

Deno.test("generic control processes await branches and resume with freshly resolved inputs", async () => {
  const graph = new Graph(), Loop = loopNode();
  const loop = new Loop(0, 0), body = graph.add("log", 0, 0), done = graph.add("log", 0, 0);
  graph.nodes.push(loop);
  assertEquals(inputs(loop).map(({ key }) => key), ["start", "stop", "condition"]);
  assertEquals(outputs(loop).map(({ key }) => key), ["loop", "next", "done", "broken"]);
  graph.connect(loop.id, "loop", body.id, "flow");
  graph.connect(loop.id, "next", done.id, "flow");
  const visits: string[] = [];
  for (let run = 0; run < 2; run++) {
    let iterations = 0;
    loop.properties.condition = true;
    await graph.run(async (node) => {
      if (node.id === body.id) {
        assertEquals(graph.results.get(loop.id), { done: false, broken: false });
        await new Promise((resolve) => setTimeout(resolve, 1));
        loop.properties.condition = ++iterations < 3;
        visits.push("body");
      } else visits.push("next");
      return {};
    });
    assertEquals(graph.results.get(loop.id), { done: true, broken: false });
  }
  assertEquals(visits, ["body", "body", "body", "next", "body", "body", "body", "next"]);
});

Deno.test("interrupts unwind graph Finally, close the suspended generator, then run their returned branch once", async () => {
  const order: string[] = [];
  const graph = new Graph(), Loop = loopNode(() => order.push("generator finally"), () => order.push("stop"));
  const loop = new Loop(0, 0),
    handler = graph.add("try_catch_finally", 0, 0),
    body = graph.add("log", 0, 0),
    cleanup = graph.add("log", 0, 0),
    done = graph.add("log", 0, 0),
    skipped = graph.add("log", 0, 0);
  graph.nodes.push(loop);
  graph.connect(loop.id, "loop", handler.id, "flow");
  graph.connect(handler.id, "try", body.id, "flow");
  graph.connect(body.id, "next", loop.id, "stop");
  graph.connect(handler.id, "finally", cleanup.id, "flow");
  graph.connect(handler.id, "next", skipped.id, "flow");
  graph.connect(loop.id, "next", done.id, "flow");
  await graph.run((node) => {
    order.push(node.id === body.id ? "body" : node.id === cleanup.id ? "graph finally" : node.id === done.id ? "next" : "skipped");
    return Promise.resolve({});
  });
  assertEquals(order, ["body", "graph finally", "generator finally", "stop", "next"]);
  assertEquals(graph.results.get(loop.id), { done: true, broken: true });
});

Deno.test("an outer interrupt closes inner generators without taking their completion branches", async () => {
  const order: string[] = [];
  const Outer = loopNode(() => order.push("outer cleanup")), Inner = loopNode(() => order.push("inner cleanup"));
  const graph = new Graph(),
    outer = new Outer(0, 0),
    inner = new Inner(0, 0),
    body = graph.add("log", 0, 0),
    done = graph.add("log", 0, 0),
    innerDone = graph.add("log", 0, 0);
  graph.nodes.push(outer, inner);
  graph.connect(outer.id, "loop", inner.id, "start");
  graph.connect(inner.id, "loop", body.id, "flow");
  graph.connect(body.id, "next", outer.id, "stop");
  graph.connect(inner.id, "next", innerDone.id, "flow");
  graph.connect(outer.id, "next", done.id, "flow");
  await graph.run((node) => {
    order.push(node.id === body.id ? "body" : node.id === done.id ? "done" : "inner done");
    return Promise.resolve({});
  });
  assertEquals(order, ["body", "inner cleanup", "outer cleanup", "done"]);
});

Deno.test("branch failures and cancellation close generators without taking completion", async () => {
  for (const cancel of [false, true]) {
    let closed = 0;
    const Loop = loopNode(() => closed++), loop = new Loop(0, 0), graph = new Graph(), controller = new AbortController();
    const body = graph.add("log", 0, 0), done = graph.add("log", 0, 0);
    graph.nodes.push(loop);
    graph.connect(loop.id, "loop", body.id, "flow");
    graph.connect(loop.id, "next", done.id, "flow");
    await assertRejects(
      () =>
        graph.run(
          (node) => {
            assertEquals(node.id, body.id);
            if (cancel) {
              controller.abort(new Error("Canceled"));
              return Promise.resolve({});
            }
            throw new Error("Body failed");
          },
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal,
        ),
      Error,
      cancel ? "Canceled" : "Body failed",
    );
    assertEquals(closed, 1);
  }
});

Deno.test("data-only generator yields remain cancellable and discard cleanup control yields", async () => {
  let closed = 0;
  const controller = new AbortController();
  const Generator = defineNode({
    type: "conditional",
    title: "Publishing",
    control: ["next"],
    inputs: {},
    outputs: { index: { label: "Index", type: "number" } },
    process: {
      *flow() {
        const timer = setTimeout(() => controller.abort(new Error("Canceled")), 30);
        try {
          for (let index = 0; index < Number.MAX_SAFE_INTEGER; index++) yield { index };
          return { index: -1 };
        } finally {
          clearTimeout(timer);
          closed++;
          yield { control: "next" as const, index: -1 };
        }
      },
    },
  });
  const graph = new Graph(), node = new Generator(0, 0), done = graph.add("log", 0, 0);
  graph.nodes.push(node);
  graph.connect(node.id, "next", done.id, "flow");
  await assertRejects(
    () =>
      graph.run(
        () => {
          throw new Error("Cleanup yields must not run a branch");
        },
        undefined,
        undefined,
        undefined,
        undefined,
        controller.signal,
      ),
    Error,
    "Canceled",
  );
  assertEquals(closed, 1);
});

Deno.test("ordinary control handlers finish directly and invalid steps fail runtime validation", async () => {
  const Action = defineNode({
    type: "conditional",
    title: "Action",
    control: ["next"],
    inputs: {},
    outputs: { index: { label: "Index", type: "number" } },
    process: { start: () => ({ control: "next" as const, index: 42 }) },
  });
  const graph = new Graph(), action = new Action(0, 0), done = graph.add("log", 0, 0);
  graph.nodes.push(action);
  graph.connect(action.id, "next", done.id, "flow");
  let completions = 0;
  await graph.run(() => {
    assertEquals(graph.results.get(action.id), { index: 42 });
    completions++;
    return Promise.resolve({});
  });
  assertEquals(completions, 1);
  assertThrows(() => action.validateStep({ control: "typo", index: 0 }), Error, "Unknown Action control output");
  assertThrows(() => action.validateStep({ control: "next" as const, index: "0" }), Error, "finite number");
  assertThrows(() => action.validateStep({ control: "next" as const }), Error, "unexpected data outputs");
  assertThrows(() => action.validateStep({ control: "next" as const, index: 0, extra: true }), Error, "unexpected data outputs");
});
