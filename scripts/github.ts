/** Minimal authenticated GitHub API client shared by trusted release and version-policy automation. */
export class GitHub {
  constructor(private token: string, private repository: string) {
    if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("A GitHub token and owner/repository are required.");
  }

  /** Make a repository API request without exposing credentials in error messages. */
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${this.repository}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status} ${result.message ?? response.statusText}`);
    return result as T;
  }
}

/** Read a required workflow variable, failing before a publication if configuration is incomplete. */
export function environment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing workflow configuration: ${name}`);
  return value;
}

/** Encode UTF-8 repository contents for GitHub's Contents API. */
export function encodeContent(text: string): string {
  return btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(""));
}

/** Decode GitHub's base64 repository contents without corrupting non-ASCII metadata. */
export function decodeContent(content: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, "")), (character) => character.charCodeAt(0)));
}
