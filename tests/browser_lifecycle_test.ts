import { assert, assertEquals, assertRejects } from "@std/assert";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type { Browser, LaunchOptions } from "puppeteer";
import { BrowserLauncher } from "web/runtime/browser_launcher.ts";
Deno.test("browser launch options come from the caller without a browser or protocol fallback", async () => {
  const browser = { connected: true, process: () => null, close: () => Promise.resolve() } as unknown as Browser;
  for (const setup of [{}, { browser: "chrome", protocol: "cdp", executablePath: "custom-browser", headless: false, timeout: 2500 }] as LaunchOptions[]) {
    let launched: LaunchOptions | undefined;
    const launcher = new BrowserLauncher(setup, (options) => {
      launched = options;
      return Promise.resolve(browser);
    });
    try {
      await launcher.launch(true);
      assertEquals(launched?.browser, setup.browser);
      assertEquals(launched?.protocol, setup.protocol);
      assertEquals(launched?.executablePath, setup.executablePath);
      assertEquals(launched?.headless, setup.headless);
      assertEquals(launched?.timeout, setup.timeout ?? 30000);
      assertEquals(launched?.acceptInsecureCerts, true);
    } finally {
      await launcher.close();
    }
  }
});
Deno.test("Browser teardown waits for process exit before removing its owned profile", async () => {
  let profile = "";
  const process = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null });
  const stopping = Promise.withResolvers<void>();
  const browser = {
    connected: true,
    process: () => process as unknown as ChildProcess,
    close: async () => {
      assert((await Deno.stat(profile)).isDirectory);
    },
  } as unknown as Browser;
  const launcher = new BrowserLauncher({}, (options) => {
    profile = options.userDataDir!;
    options.signal!.addEventListener("abort", () => stopping.resolve(), { once: true });
    return Promise.resolve(browser);
  });
  await launcher.launch();
  const closing = launcher.close();
  await stopping.promise;
  try {
    assert((await Deno.stat(profile)).isDirectory, "Keep the profile until the process has exited");
  } finally {
    process.exitCode = 0;
    process.emit("exit", 0, null);
    await closing;
  }
  await assertRejects(() => Deno.stat(profile), Deno.errors.NotFound);
});
Deno.test("Browser retries a timed-out handshake once, aborting and removing the failed profile", async () => {
  const attempts: LaunchOptions[] = [];
  const browser = { connected: true, process: () => null, close: () => Promise.resolve() } as unknown as Browser;
  const launcher = new BrowserLauncher({}, async (options) => {
    attempts.push(options);
    if (attempts.length === 1) throw new Error("session.new timed out");
    assert(attempts[0].signal!.aborted);
    await assertRejects(() => Deno.stat(attempts[0].userDataDir!), Deno.errors.NotFound);
    return browser;
  });
  try {
    assertEquals(await launcher.launch(true), browser);
    assertEquals(attempts.length, 2);
    assert(attempts[0].userDataDir !== attempts[1].userDataDir);
    assertEquals(attempts[1].acceptInsecureCerts, true);
    assertEquals(attempts[1].timeout, 30000);
    assertEquals(attempts[1].protocolTimeout, undefined, "Startup deadline preserves the timeout for long browser actions");
  } finally {
    await launcher.close();
  }
});
Deno.test("Browser startup does not retry configuration errors and cleans up failed launches", async () => {
  let attempts = 0, profile = "";
  const launcher = new BrowserLauncher({}, (options) => {
    attempts++;
    profile = options.userDataDir!;
    return Promise.reject(new Error("Executable not found"));
  });
  await assertRejects(() => launcher.launch(), Error, "Executable not found");
  assertEquals(attempts, 1);
  await assertRejects(() => Deno.stat(profile), Deno.errors.NotFound);
  await launcher.close();
});
Deno.test("Browser stops retrying after a second failed handshake", async () => {
  const profiles: string[] = [];
  const launcher = new BrowserLauncher({}, (options) => {
    profiles.push(options.userDataDir!);
    return Promise.reject(new Error("session.new timed out"));
  });
  await assertRejects(() => launcher.launch(), Error, "session.new timed out");
  assertEquals(profiles.length, 2);
  for (const profile of profiles) await assertRejects(() => Deno.stat(profile), Deno.errors.NotFound);
  await launcher.close();
});
