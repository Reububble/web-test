import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { checkVersionPolicy, nextVersion, packageVersion, publishAndBump, updateVersion } from "release/version.ts";
import { decodeContent, encodeContent } from "release/github.ts";

const manifest = (version: string) => JSON.stringify({ name: "@reububble/web-test", version, license: "MIT" });

Deno.test("Release increments stable versions and rejects unsafe or ambiguous components", () => {
  assertEquals(nextVersion("0.1.9", "patch"), "0.1.10");
  assertEquals(nextVersion("0.1.9", "minor"), "0.2.0");
  assertEquals(nextVersion("0.1.9", "major"), "1.0.0");
  for (const version of ["01.2.3", "1.2", "1.2.3-beta.1", "1.2.3+build", "-1.2.3", "9007199254740991.0.0"]) {
    assertThrows(() => nextVersion(version, "major"), Error);
  }
});

Deno.test("Version policy rejects changes without a commit-author exception", () => {
  const base = manifest("0.1.0");
  checkVersionPolicy(base, JSON.stringify({ ...JSON.parse(base), description: "A normal package change" }));
  assertThrows(() => checkVersionPolicy(base, manifest("0.1.1")), Error, "Only the Publish and bump workflow");
  assertThrows(() => checkVersionPolicy(base, manifest("0.0.9")), Error);
  assertThrows(() => checkVersionPolicy(base, JSON.stringify({ version: "0.1.0" })), Error, "package identity");
});

Deno.test("Bump preserves formatting, Unicode, and unrelated manifest fields", () => {
  const original = '{\r\n  "name": "@reububble/web-test",\r\n  "version": "0.1.0",\r\n  "description": "更新 ✓"\r\n}\r\n';
  const updated = updateVersion(original, "0.1.0", "0.2.0");
  assertEquals(updated, original.replace('"0.1.0"', '"0.2.0"'));
  assertEquals(packageVersion(updated), "0.2.0");
  assertEquals(decodeContent(encodeContent(updated)), updated);
  assertThrows(() => updateVersion(updated, "0.1.0", "0.1.1"), Error, "changed during this release");
});

Deno.test("Publication precedes tagging and bumping; publishing failure never bumps", async () => {
  const calls: string[] = [];
  const operations = {
    publish: () => {
      calls.push("publish");
      return Promise.resolve();
    },
    recordPublication: () => {
      calls.push("tag");
      return Promise.resolve();
    },
    verifyPublication: () => {
      calls.push("verify");
      return Promise.resolve();
    },
    bump: () => {
      calls.push("bump");
      return Promise.resolve();
    },
  };
  await publishAndBump("publish-and-bump", operations);
  assertEquals(calls, ["publish", "tag", "bump"]);
  calls.length = 0;
  await assertRejects(
    () =>
      publishAndBump("publish-and-bump", {
        ...operations,
        publish: () => {
          calls.push("publish");
          return Promise.reject(new Error("JSR failed"));
        },
      }),
    Error,
    "JSR failed",
  );
  assertEquals(calls, ["publish"]);
});

Deno.test("Recovery verifies publication without republishing and never bumps after verification failure", async () => {
  const calls: string[] = [];
  const operations = {
    publish: () => {
      calls.push("publish");
      return Promise.resolve();
    },
    recordPublication: () => {
      calls.push("tag");
      return Promise.resolve();
    },
    verifyPublication: () => {
      calls.push("verify");
      return Promise.resolve();
    },
    bump: () => {
      calls.push("bump");
      return Promise.resolve();
    },
  };
  await publishAndBump("finish-bump", operations);
  assertEquals(calls, ["verify", "bump"]);
  calls.length = 0;
  await assertRejects(
    () =>
      publishAndBump("finish-bump", {
        ...operations,
        verifyPublication: () => Promise.reject(new Error("Not published")),
      }),
    Error,
    "Not published",
  );
  assertEquals(calls, []);
});
