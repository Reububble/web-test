import { testBrowserLauncher } from "tests/browser_fixture.ts";
import { assertEquals, assertRejects } from "@std/assert";
import { BrowserSession } from "web-test/runtime/browser.ts";
import { selfSignedCertificate } from "tests/self_signed.ts";
Deno.test("insecure certificate launch settings control local TLS trust", async () => {
  const fixture = await selfSignedCertificate(false);
  const tls = Deno.serve(
    { hostname: "127.0.0.1", port: 0, cert: fixture.cert, key: fixture.key, onListen() {} },
    () => new Response("<title>Local TLS</title>", { headers: { "Content-Type": "text/html" } }),
  );
  const session = new BrowserSession(testBrowserLauncher());
  const url = "https://localhost:" + tls.addr.port;
  try {
    await assertRejects(() => session.execute("navigate", { url }));
    await session.configureCertificate(true);
    assertEquals((await session.execute("navigate", { url })).output.title, "Local TLS");
    await session.configureCertificate(false);
    await assertRejects(() => session.execute("navigate", { url }));
  } finally {
    await session.close();
    await tls.shutdown();
  }
});
