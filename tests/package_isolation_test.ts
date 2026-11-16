import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertEquals } from "@std/assert";

Deno.test("package entry points and script subprocess work outside the development workspace", async () => {
  const directory = await Deno.makeTempDir({ prefix: "web-test-package-" });
  try {
    const root = new URL("../", import.meta.url);
    const config = JSON.parse(await Deno.readTextFile(new URL("deno.jsonc", root)));
    for (const file of new Set(["deno.jsonc", ...Object.values(config.exports) as string[]])) {
      await cp(fileURLToPath(new URL(file, root)), `${directory}/${file}`);
    }
    await cp(fileURLToPath(new URL("src/", root)), `${directory}/src`, { recursive: true });
    await Deno.writeTextFile(
      `${directory}/consumer.ts`,
      `import { createBrowserSession, runPipelineFile } from "@reububble/web-test";
import { BrowserLauncher } from "@reububble/web-test/browser";
import type { PipelineOptions } from "@reububble/web-test/pipeline";
import { ScriptRun, type ScriptEvent } from "@reububble/web-test/runtime";
import { scriptActions } from "@reububble/web-test/script";

const options: PipelineOptions = {};
if (!BrowserLauncher || !runPipelineFile || !scriptActions.delay || options.timeout) throw new Error("Missing package exports.");
await createBrowserSession().close();
const events: ScriptEvent[] = [];
const run = new ScriptRun("console.info('isolated package');", {
  execute() { throw new Error("This script should not launch a browser."); },
}, (event) => events.push(event));
await run.start();
const error = events.find((event) => event.type === "error");
if (error?.type === "error") throw new Error(error.error);
if (events.at(-1)?.type !== "run-end" || !events.some((event) => event.type === "log" && event.message === "isolated package")) {
  throw new Error("Isolated script execution failed.");
}
`,
    );
    const result = await new Deno.Command(Deno.execPath(), {
      args: ["run", "--check", "-A", "--no-lock", "--config=deno.jsonc", "consumer.ts"],
      cwd: directory,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});
