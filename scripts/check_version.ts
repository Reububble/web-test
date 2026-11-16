import { environment, GitHub } from "release/github.ts";
import { checkVersionPolicy } from "release/version.ts";

const base = environment("BASE_SHA"), head = environment("HEAD_SHA"), pull = environment("PR_NUMBER");
if (![base, head].every((sha) => /^[0-9a-f]{40}$/.test(sha)) || !/^\d+$/.test(pull)) throw new Error("Invalid pull-request references.");
const github = new GitHub(environment("GITHUB_TOKEN"), environment("GITHUB_REPOSITORY"));
let failure: string | undefined;
try {
  // Fetch objects only. Never check out, import, or execute pull-request code in this trusted workflow.
  const fetched = await new Deno.Command("git", { args: ["fetch", "--no-tags", "origin", `refs/pull/${pull}/head`], stderr: "piped" }).output();
  if (!fetched.success) throw new Error(new TextDecoder().decode(fetched.stderr));
  const manifests = await Promise.all([base, head].map(async (sha) => {
    const result = await new Deno.Command("git", { args: ["show", `${sha}:deno.jsonc`], stdout: "piped", stderr: "piped" }).output();
    if (!result.success) throw new Error(`Cannot read the package manifest at ${sha}`);
    return new TextDecoder().decode(result.stdout);
  }));
  checkVersionPolicy(manifests[0], manifests[1]);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
}
// pull_request_target runs against the trusted base. Explicitly report the required check on the PR head.
await github.request("check-runs", "POST", {
  name: "Version policy",
  head_sha: head,
  status: "completed",
  conclusion: failure ? "failure" : "success",
  output: {
    title: failure ? "Version change rejected" : "Package version is unchanged",
    summary: failure ?? "Only the release workflow changes main's version.",
  },
});
if (failure) throw new Error(failure);
console.log("Version policy passed.");
