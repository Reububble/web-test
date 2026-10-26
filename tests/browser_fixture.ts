import { BrowserLauncher } from "web/runtime/browser_launcher.ts";

/** Test setup deliberately selects Firefox; library runtime code has no browser preference. */
export function testBrowserLauncher(): BrowserLauncher {
  const executablePath = Deno.env.get("FIREFOX_PATH") || Deno.env.get("PUPPETEER_EXECUTABLE_PATH") ||
    (Deno.build.os === "windows" ? `${Deno.env.get("ProgramFiles") || "C:\\Program Files"}\\Mozilla Firefox\\firefox.exe` : undefined);
  return new BrowserLauncher({ browser: "firefox", protocol: "webDriverBiDi", headless: true, ...(executablePath === undefined ? {} : { executablePath }) });
}
