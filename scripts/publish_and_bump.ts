import { decodeContent, encodeContent, environment, GitHub } from "release/github.ts";
import { nextVersion, packageVersion, publishAndBump, updateVersion, type VersionBump } from "release/version.ts";

if (environment("GITHUB_REF") !== "refs/heads/main" || environment("GITHUB_EVENT_NAME") !== "workflow_dispatch") {
  throw new Error("Publish and bump must be manually dispatched from main.");
}
const [mode, increment] = Deno.args;
if (!["publish-and-bump", "finish-bump"].includes(mode) || !["patch", "minor", "major"].includes(increment)) throw new Error("Invalid release inputs.");
const github = new GitHub(environment("RELEASE_TOKEN"), environment("GITHUB_REPOSITORY"));
const source = environment("GITHUB_SHA");
if (!/^[0-9a-f]{40}$/.test(source)) throw new Error("Invalid release commit.");
const version = packageVersion(await Deno.readTextFile("deno.jsonc"));
const next = nextVersion(version, increment as VersionBump);
const tag = `v${version}`;
type Manifest = { content: string; sha: string };

async function currentManifest(): Promise<Manifest> {
  const manifest = await github.request<Manifest>("contents/deno.jsonc?ref=main");
  if (packageVersion(decodeContent(manifest.content)) !== version) throw new Error("main's version has changed. Start a new release run from main.");
  return manifest;
}

async function recordTag(): Promise<void> {
  try {
    await github.request("git/refs", "POST", { ref: `refs/tags/${tag}`, sha: source });
  } catch (error) {
    const existing = await github.request<{ object: { sha: string } }>(`git/ref/tags/${tag}`).catch(() => undefined);
    if (existing?.object.sha !== source) throw error;
  }
}

await currentManifest();
await publishAndBump(mode as "publish-and-bump" | "finish-bump", {
  async publish() {
    const main = await github.request<{ sha: string }>("commits/main");
    if (main.sha !== source) throw new Error("main advanced during validation. Start a new release run to publish its latest commit.");
    const result = await new Deno.Command(Deno.execPath(), { args: ["task", "publish:release"], stdout: "inherit", stderr: "inherit" }).spawn().status;
    if (!result.success) throw new Error("JSR publishing failed. No version bump was committed.");
  },
  recordPublication: recordTag,
  async verifyPublication() {
    const published = await fetch(`https://jsr.io/@reububble/web-test/${version}_meta.json`);
    await published.body?.cancel();
    if (!published.ok) throw new Error(`Cannot confirm @reububble/web-test@${version} on JSR. Refusing to bump without a publication.`);
    const existing = await github.request<{ object: { type: string; sha: string } }>(`git/ref/tags/${tag}`).catch(() => undefined);
    if (existing) {
      let target = existing.object;
      for (let depth = 0; target.type === "tag" && depth < 10; depth++) {
        target = (await github.request<{ object: { type: string; sha: string } }>(`git/tags/${target.sha}`)).object;
      }
      if (target.type !== "commit") throw new Error("The existing release tag does not resolve to a commit.");
      const comparison = await github.request<{ status: string }>(`compare/${target.sha}...${source}`);
      if (!["ahead", "identical"].includes(comparison.status)) throw new Error("The published tag is not an ancestor of main.");
    } else console.log(`${version} exists on JSR but ${tag} is absent. Finishing the version bump without inventing a source tag.`);
  },
  async bump() {
    const manifest = await currentManifest();
    const content = updateVersion(decodeContent(manifest.content), version, next);
    const result = await github.request<{ commit: { sha: string } }>("contents/deno.jsonc", "PUT", {
      branch: "main",
      sha: manifest.sha,
      content: encodeContent(content),
      message: `chore: prepare ${next} after publishing ${version}`,
    });
    const message = `${version} is published; main now prepares ${next} in ${result.commit.sha}.`;
    console.log(message);
    const summary = Deno.env.get("GITHUB_STEP_SUMMARY");
    if (summary) await Deno.writeTextFile(summary, `${message}\n`, { append: true });
  },
});
