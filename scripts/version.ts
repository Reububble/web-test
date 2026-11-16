/** The stable semantic-version component advanced after a successful publication. */
export type VersionBump = "patch" | "minor" | "major";

/** Validate a stable package version without silently accepting leading zeros or unsafe integers. */
export function versionParts(version: string): [number, number, number] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Expected a stable semantic version, received ${version}`);
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error("Version components must be safe integers.");
  return parts as [number, number, number];
}

/** Calculate the next stable version, resetting the less significant components. */
export function nextVersion(version: string, bump: VersionBump): string {
  const parts = versionParts(version);
  const index = ["major", "minor", "patch"].indexOf(bump);
  if (index < 0) throw new Error(`Unsupported version increment: ${bump}`);
  parts[index]++;
  for (let following = index + 1; following < parts.length; following++) parts[following] = 0;
  const result = parts.join(".");
  versionParts(result);
  return result;
}

/** Read and validate this repository's package identity and stable version. */
export function packageVersion(text: string): string {
  const config = JSON.parse(text);
  if (config.name !== "@reububble/web-test" || typeof config.version !== "string") throw new Error("Unexpected package identity or missing version.");
  versionParts(config.version);
  return config.version;
}

/** Replace only the package version, preserving unrelated fields, indentation, and line endings. */
export function updateVersion(text: string, expected: string, next: string): string {
  if (packageVersion(text) !== expected) throw new Error("The package version changed during this release. Refusing to overwrite it.");
  versionParts(next);
  const matches = [...text.matchAll(/("version"\s*:\s*")([^"\r\n]+)(")/g)];
  if (matches.length !== 1 || matches[0][2] !== expected) throw new Error("Expected exactly one package version field.");
  return text.replace(/("version"\s*:\s*")([^"\r\n]+)(")/, (_match, prefix, _version, suffix) => `${prefix}${next}${suffix}`);
}

/** Reject effective version changes in ordinary pull requests, without trusting commit author names. */
export function checkVersionPolicy(base: string, head: string): void {
  if (packageVersion(base) !== packageVersion(head)) {
    throw new Error("Only the Publish and bump workflow may update the version on main. Restore deno.jsonc's base version.");
  }
}

/** Side effects needed to publish a snapshot and then prepare main's next version. */
export interface ReleaseOperations {
  publish(): Promise<void>;
  recordPublication(): Promise<void>;
  verifyPublication(): Promise<void>;
  bump(): Promise<void>;
}

/** Publish before recording a release or changing main; recovery never republishes a version. */
export async function publishAndBump(mode: "publish-and-bump" | "finish-bump", operations: ReleaseOperations): Promise<void> {
  if (mode === "publish-and-bump") {
    await operations.publish();
    await operations.recordPublication();
  } else if (mode === "finish-bump") await operations.verifyPublication();
  else throw new Error(`Unsupported release operation: ${mode}`);
  await operations.bump();
}
