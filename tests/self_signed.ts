// Generate fresh local-only TLS fixtures without external tools or dependencies.
const concat = (...items: Uint8Array[]) => {
  const result = new Uint8Array(items.reduce((n, item) => n + item.length, 0));
  let offset = 0;
  for (const item of items) {
    result.set(item, offset);
    offset += item.length;
  }
  return result;
};
const der = (tag: number, ...content: Uint8Array[]) => {
  const bytes = concat(...content);
  const length: number[] = [];
  for (let value = bytes.length; value; value >>>= 8) length.unshift(value & 255);
  return concat(new Uint8Array([tag, ...(bytes.length < 128 ? [bytes.length] : [128 + length.length, ...length])]), bytes);
};
const sequence = (...items: Uint8Array[]) => der(48, ...items);
const oid = (bytes: number[]) => der(6, new Uint8Array(bytes));
const text = (value: string) => new TextEncoder().encode(value);
const pem = (label: string, bytes: Uint8Array) =>
  `-----BEGIN ${label}-----\n${btoa(String.fromCharCode(...bytes)).match(/.{1,64}/g)!.join("\n")}\n-----END ${label}-----\n`;
export async function selfSignedCertificate(ca = true, issuer?: { cert: string; key: string }, hostname = "localhost"): Promise<{ cert: string; key: string }> {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const algorithm = sequence(oid([42, 134, 72, 134, 247, 13, 1, 1, 11]), der(5));
  const distinguishedName = (commonName: string) => sequence(der(49, sequence(oid([85, 4, 3]), der(12, text(commonName)))));
  const name = distinguishedName(ca ? "Web Test CA" : "Web Test localhost test");
  const signingKey = issuer
    ? await crypto.subtle.importKey(
      "pkcs8",
      Uint8Array.from(atob(issuer.key.replace(/-----[^\n]+-----|\s/g, "")), (character) => character.charCodeAt(0)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    )
    : keys.privateKey;
  const date = (milliseconds: number) => der(23, text(new Date(milliseconds).toISOString().slice(2).replace(/[-:T]/g, "").replace(/\.\d{3}/, "")));
  const serial = crypto.getRandomValues(new Uint8Array(16));
  serial[0] &= 127;
  serial[0] ||= 1;
  const constraints = sequence(oid([85, 29, 19]), der(1, new Uint8Array([255])), der(4, ca ? sequence(der(1, new Uint8Array([255]))) : sequence()));
  const names = sequence(oid([85, 29, 17]), der(4, sequence(der(130, text(hostname)), der(135, new Uint8Array([127, 0, 0, 1])))));
  const tbs = sequence(
    der(160, der(2, new Uint8Array([2]))),
    der(2, serial),
    algorithm,
    issuer ? distinguishedName("Web Test CA") : name,
    sequence(date(Date.now() - 86400000), date(Date.now() + 86400000 * 30)),
    name,
    new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey)),
    der(163, sequence(constraints, names)),
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, tbs));
  return {
    cert: pem("CERTIFICATE", sequence(tbs, algorithm, der(3, new Uint8Array([0]), signature))),
    key: pem("PRIVATE KEY", new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey))),
  };
}
