#!/usr/bin/env node
/**
 * Generates the VAPID key pair the admin push notifications are signed with and
 * prints the four environment variables, ready to paste.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs                  # prints env lines
 *   node scripts/generate-vapid-keys.mjs bocha@example.com # …with that VAPID_SUBJECT
 *
 * NOT idempotent, and the one script here that is not: every run mints a NEW
 * identity. Replacing keys that are already deployed invalidates nothing stored
 * — the subscriptions in the private bucket stay valid — but every push signed
 * with the new pair is REFUSED by the push services those subscriptions were
 * created against, because a subscription is bound to the public key that
 * created it. The symptom is a 403 per send and a phone that stopped buzzing,
 * and the cure is for each device to opt out and back in. Generate once, keep
 * them, and treat the private key like any other secret in .env.local.
 *
 * WHAT THE TWO ENCODINGS ARE, since they are not interchangeable:
 *   - the PUBLIC key is the RAW P-256 point: 65 bytes, uncompressed, 0x04-prefixed.
 *     That exact form is what `k=` in the Authorization header carries and what
 *     `applicationServerKey` in the browser's pushManager.subscribe() wants.
 *   - the PRIVATE key is PKCS#8 DER, which is what crypto.subtle.importKey()
 *     takes and therefore what src/lib/push.ts imports at send time.
 * Both are printed base64url and unpadded — the form the header uses, and the
 * form that survives a .env file without quoting.
 *
 * The pair is round-tripped before anything is printed: the private key is
 * re-imported exactly the way push.ts imports it, used to sign, and the
 * signature verified against the public key. A key that cannot make it back
 * through that is never offered for pasting.
 */
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

/** RFC 8292's contact claim. A bare address is normalised the way push.ts does. */
const DEFAULT_SUBJECT = "info@bochatattoo.com";

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function subjectFrom(raw) {
  const value = (raw || DEFAULT_SUBJECT).trim();
  if (value.startsWith("mailto:") || value.startsWith("https://")) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return `mailto:${value}`;
  console.error(
    `"${value}" is not a usable VAPID_SUBJECT — it must be a mailto: URL, an ` +
      "https: URL, or a bare email address.",
  );
  process.exit(1);
}

/**
 * Sign and verify with the pair as src/lib/push.ts would, and assert the
 * signature is the raw 64-byte r||s that JOSE's ES256 expects. A DER signature
 * comes back 70-72 bytes and is the single most common way a VAPID
 * implementation ends up refused by every push service; this fails loudly here
 * instead.
 */
async function selfTest(publicKey, pkcs8) {
  const imported = await subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode("vapid-self-test");
  const signature = new Uint8Array(
    await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, imported, data),
  );
  if (signature.length !== 64) {
    throw new Error(
      `ES256 signature is ${signature.length} bytes, expected the raw 64-byte r||s.`,
    );
  }
  const verified = await subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    data,
  );
  if (!verified) throw new Error("The generated pair does not verify its own signature.");
}

async function main() {
  const subject = subjectFrom(process.argv[2]);

  const pair = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable — the whole point of this script is to print them
    ["sign", "verify"],
  );

  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));

  // The browser rejects an applicationServerKey that is not exactly this shape,
  // with an error that names neither the length nor the prefix.
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error(
      `Public key is ${raw.length} bytes starting 0x${raw[0].toString(16)}; ` +
        "expected 65 bytes of uncompressed point starting 0x04.",
    );
  }

  await selfTest(pair.publicKey, pkcs8);

  const publicKey = base64url(raw);
  const privateKey = base64url(pkcs8);

  console.log("# Web Push (VAPID) — paste into .env.local and your host's env.");
  console.log("# The public key is printed twice on purpose: the server signs with");
  console.log("# one and the browser subscribes with the other, and they MUST match.");
  console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
  console.log(`VAPID_SUBJECT=${subject}`);
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
  console.log("");
  console.log("# Keep VAPID_PRIVATE_KEY secret and never prefix it NEXT_PUBLIC_.");
  console.log("# Re-running this mints a NEW identity: every device already");
  console.log("# subscribed stops receiving pushes until it opts out and back in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
