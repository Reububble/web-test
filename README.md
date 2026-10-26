# Web Test

Browser automation and graph execution for Deno. This repository contains the shared graph nodes, serialization, macro files, browser session lifecycle, and
pipeline runner migrated from `Desktop/deno/auto`. It is a library: reusable browser execution lives in `src/runtime/`, while CLI argument parsing, process
startup, and HTTP handling belong to `web-test-server`.

```ts
import { BrowserLauncher, createBrowserSession, runPipelineFile } from "@local/web-test";

const launchOptions = { browser: "chrome", protocol: "cdp", headless: true } as const;
const session = createBrowserSession(new BrowserLauncher(launchOptions));
try {
  const page = await session.getPage();
  await page.goto("https://example.com");
} finally {
  await session.close();
}

await runPipelineFile("pipeline.json", { timeout: 30000, browser: new BrowserLauncher(launchOptions) });
```

Run with `deno run -A`. The browser is launched lazily; importing the library does not start a server or browser. The public entry points are `mod.ts`,
`browser.ts`, and `pipeline.ts` under the local package name `@local/web-test`. `@local/web-test/runtime` exposes browser sessions, browser lifecycle, graph
execution, and events for integrations. `@local/web-test/pipeline` runs exported pipeline files without a CLI. Consumers use these public exports instead of
importing the library's source directories. The parent development workspace resolves this package locally, including dependencies declared with a `jsr:`
specifier.

The embedding application chooses the browser, protocol, and executable through `BrowserLauncher` options. Without a provider, Puppeteer's default launch
settings apply. Custom `BrowserLifecycle` providers can supply their own launch, reset, and close operations. The pipeline owns and closes its supplied
provider. Puppeteer's configuration can also select a browser through environment variables supplied by the embedding application or development workspace. The
library performs no browser-specific executable discovery. Library browser tests choose their browser in a self-contained test fixture and do not import server
code.

Run `deno task test` for library tests, or `deno task test:library` from the parent development workspace.

Runtime `Value` supports `Temporal.Instant`, including nested arrays and records. Timestamp ports use the `instant` type. `JsonValue` remains restricted to
ordinary JSON data. Use `stringifyValue` and `parseValue` from `@local/web-test` (also exported by `@local/web-test/runtime`) at file, storage and network
boundaries. Instants encode as `{ "$type": "instant", "epochSeconds": 1792728000,
"nanoseconds": 123456789 }`, preserving nanosecond precision. Objects
containing their own `$type` field are escaped by the encoder and restored by the decoder. Ordinary ISO strings remain strings. Use the codec as a pair rather
than native JSON methods when exchanging runtime values.

`copyValue` copies mutable arrays and plain records while sharing immutable instants. Runtime and editor code do not use `structuredClone`.

`defineFunctionNode` takes a definition and returns a node class in one call. It infers input and output records from the process function. Annotate the
process's input object and let its returned record determine the output types. [String At](src/nodes/string_at.ts) is the first example:
`process({ text, index }: { text: string; index: number })` calls `text.at(index)` and returns `{ text, found }` after handling `undefined`.

Input and output ports are records keyed by their unique names. Their metadata and defaults must match the process's inferred types. The factory requires
metadata for every process input/output and rejects mismatched or undeclared ports. It validates external values at runtime and publishes the output record
together. All registered nodes use factories and named port records. Graph/editor helpers project these records into lists where rendering requires them.

Configurable functions use `defineNode({ type, title, help, config })(build)`. [Array At](src/nodes/array_at.ts) declares its item-type selection with
`TypeConfig`; the builder receives selected descriptors and uses a generic `T` to connect its `T[]` input to its `T` output. `ArrayDescriptor` validates every
item before `process` runs. Changing configuration rebuilds the ports and process together. Saved graphs store the selected type name, not descriptor instances.
An instance whose configuration can change exposes the union of possible item values; the generic builder preserves the element relationship while authoring the
process.

Port types also accept `OptionalDescriptor`, for example `type: new OptionalDescriptor("number")` paired with a process input of `Optional<number>`. Optional
values use `null`, and their ports expose the existing optional-input metadata to the editor. Descriptors supply defaults when omitted; simple string port types
continue to use explicit defaults.

Control nodes use `defineNode({ control, inputs, outputs, process, ...metadata })`, where `process` is a record of named control-input handlers.
[While](src/nodes/while.ts) is a generator-based example. Handler arguments and returned data are typed from the port descriptors; `control` accepts only
declared control-output names. Ports for the control inputs and outputs are generated from the handler names and `control` list. The first handler is the entry
point unless `entry` selects another; other handlers interrupt an active invocation.

Yielding `{ control, ...outputs }` publishes the outputs, awaits that branch, and resumes with freshly resolved inputs. Yielding only data outputs publishes
them and resumes without running a branch, allowing While to publish its updated index before checking a condition that depends on it. Returning a record
finishes the invocation and takes its final control branch once. Each step supplies every required data output, and `state.output` exposes the most recent
record as read-only state. Outputs marked `deferred: true` are absent until published, so an array collector's completed result cannot be read inside Each.
Ordinary outputs have fresh defaults before initial input resolution; deferred outputs allow the process to snapshot feedback from its previous invocation
before publishing the new invocation's first step.

Interrupts unwind the active branch through graph Finally blocks, close the suspended generator, then invoke the selected handler. Nested invocations close as
they unwind; their completion branches do not run. Generator cleanup also runs on errors and cancellation, and cleanup yields never schedule branches.
Cancellation continues to skip graph Catch/Finally branches so Stop remains responsive. The executor yields to I/O between generator steps, including data-only
yields and branches with no connection. Branch errors enter generators through `.throw()`, allowing Try/Catch/Finally to implement its behavior in its own
definition. `refreshBranches: false` preserves branch results for an entire invocation; loops use the default of clearing stale branch results before each
yielded branch. Ordinary handlers returning a control result do not clear downstream results. Configured control nodes put `control` alongside `config` in the
first call, then return their typed port schemas and process handlers from the builder; see Array Map and Array Reduce.

Stateful and externally executed nodes use `defineNode({ kind, inputs, outputs, properties, ... })`. `kind: "data"` infers process arguments and results from
the port descriptors. Inputs resolve on access, supporting lazy selection and variadic inputs. A process can return an output record atomically or provide a
record of handlers, one per output, as File Read does to keep Loaded available before choosing a file. Static defaults are checked against input types.

`properties()` supplies saved defaults, while optional `state()` creates private per-instance editor state. Port schemas may be functions of that typed context.
`syncInputs`, `removeInput`, and `setMacros` hooks keep dynamic schemas and editor choices synchronized. State is never serialized.

`kind: "browser"` defines a typed `process(inputs, context)` alongside its ports. The context supplies `browser`, `nodeId`, and `signal`, plus the node's
properties and state. `browser` opens the page, resolves and retains element references, clears references on navigation, and resets the session. Node modules
use only type imports from Puppeteer, keeping the shared definitions usable in the editor. The session looks up browser nodes through the existing node registry
and owns action serialization, screenshots, cancellation, and cleanup. `screenshot: false` clears the preview without opening a page, as Reset Browser requires.
`interruptBrowser: false` lets Delay cancel its timer without closing the browser. Other browser actions capture a screenshot and reset the browser when
interrupted. Browser input and output records are validated against their port descriptors at execution.

`kind: "local"` delegates execution to the supplied runtime service. `kind: "action"` defines a typed process with execution services; Run Macro calls a
subgraph through its `call` service, sharing execution and cancellation with the caller. Its `removeListener` service detaches a listener reference.
`kind: "event"` defines subscription and preparation hooks. Flow into Console Listener attaches the subscription and returns a `listener` value through its
Listener port; Next continues the main workflow. Matching messages run On message with fresh event data. GraphRun owns these subscriptions and serializes
callbacks after the current flow finishes. Re-entering a listener replaces its previous subscription. Remove Listener detaches it, preventing new messages;
already captured callbacks finish processing. Stop and failure release every subscription and discard pending callbacks. Finite pipeline runs detach listeners
when main flow finishes and drain already captured callbacks before reporting completion. `kind: "annotation"` defines passive editor nodes.

Sequence uses the control factory's dynamic `control(properties)` and `syncOutputs(properties, connected)` hooks to keep connected flow outputs followed by one
spare. Its generator yields connected branches in order. `refreshBranches: false` keeps data from earlier branches available to later branches, including
listener references used by Remove Listener. The editor synchronizes dynamic output rows after connections change.
