/** Check documentation on package entrypoints and locally defined exported symbols. */
type Documentation = { doc?: string; tags?: { kind: string }[] };
type Location = { filename: string; line: number; byteIndex?: number };
type Member = { name?: string; location?: Location; jsDoc?: Documentation; accessibility?: string };
type Declaration = Member & {
  kind: string;
  declarationKind?: string;
  def?: { properties?: Member[]; methods?: Member[]; constructors?: Member[]; callSignatures?: Member[]; constructSignatures?: Member[] };
};
type Module = { module_doc?: Documentation; symbols?: { name: string; declarations: Declaration[] }[] };

const root = new URL("../", import.meta.url);
const config = JSON.parse(await Deno.readTextFile(new URL("deno.jsonc", root))) as { exports: Record<string, string> };
const entrypoints = Object.values(config.exports).map((path) => new URL(path, root).href);

async function sourceFiles(directory: URL): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isDirectory) files.push(...await sourceFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.name.endsWith(".ts")) files.push(new URL(entry.name, directory).href);
  }
  return files;
}

const result = await new Deno.Command(Deno.execPath(), {
  args: ["doc", "--json", ...entrypoints, ...await sourceFiles(new URL("src/", root))],
  cwd: root,
  stdout: "piped",
  stderr: "piped",
}).output();
if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
const documentation = JSON.parse(new TextDecoder().decode(result.stdout)) as { version: number; nodes: Record<string, Module> };
if (documentation.version !== 2) throw new Error(`Unsupported deno doc JSON version: ${documentation.version}`);

const missing: string[] = [];
for (const entrypoint of entrypoints) {
  const doc = documentation.nodes[entrypoint]?.module_doc;
  if (!doc?.doc?.trim() || !doc.tags?.some((tag) => tag.kind === "module")) missing.push(`${entrypoint}: missing module documentation`);
}

const checked = new Set<string>();
let symbols = 0, members = 0;
function check(member: Member, name: string): boolean {
  const location = member.location;
  if (!location?.filename.startsWith(root.href) || member.accessibility === "private") return false;
  const key = `${location.filename}:${location.byteIndex}:${name}`;
  if (checked.has(key)) return false;
  checked.add(key);
  if (!member.jsDoc?.doc?.trim()) missing.push(`${location.filename}:${location.line}: ${name} is missing symbol documentation`);
  return true;
}

for (const module of Object.values(documentation.nodes)) {
  for (const symbol of module.symbols ?? []) {
    for (const declaration of symbol.declarations) {
      // Re-exports use the documentation on their source declaration, checked in its own module.
      if (declaration.kind === "reference" || declaration.declarationKind !== "export") continue;
      if (check(declaration, symbol.name)) symbols++;
      if (!["class", "interface"].includes(declaration.kind)) continue;
      for (const group of ["properties", "methods", "constructors", "callSignatures", "constructSignatures"] as const) {
        for (const member of declaration.def?.[group] ?? []) {
          if (check(member, `${symbol.name}.${member.name ?? group}`)) members++;
        }
      }
    }
  }
}
if (!symbols) throw new Error("No local exported symbols were found in deno doc output.");
if (missing.length) throw new Error(missing.join("\n"));
console.log(`Documentation covers ${entrypoints.length} entrypoints, ${symbols} exported declarations, and ${members} public members.`);
