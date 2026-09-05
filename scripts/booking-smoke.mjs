#!/usr/bin/env node
/**
 * Concurrency smoke test for the booking feature — the only automated check
 * this project has. It covers the three failures that are silent and rare:
 *
 *   - two /submit posts racing        → one consent record, one pair of emails
 *   - two /receipt posts racing       → one blob, one receipt, one pair of emails
 *   - bytes that disagree with the declared content-type → 415
 *   - the SAME receipt re-sent after green → 200, nothing re-sent, nothing
 *     re-counted; a DIFFERENT one → 409, because a green receipt is evidence
 *   - a booking seeded with an email and no handle → completable without one
 *
 * Usage (from the repo root, against a running server):
 *   node scripts/booking-smoke.mjs --password "$ADMIN_PASSWORD"
 *   node scripts/booking-smoke.mjs http://localhost:3000 --cookie ba_admin=...
 *
 *   --url <origin>         default http://localhost:3000 (a bare positional works too)
 *   --cookie <value>       an existing admin session; skips the login round trip
 *   --password <pw>        logs in first; falls back to ADMIN_PASSWORD from .env.local
 *   --email <addr>         address the fake client submits (default a reserved sink)
 *   --terms-version <v>    override the value read out of src/lib/booking-terms.ts
 *   --force                allow a target that is not localhost
 *
 * It creates ONE booking, drives it end to end and deletes it in a finally. It
 * never reads, edits or deletes a booking it did not create. It refuses a
 * non-localhost target without --force because a booking that reaches green
 * mails both the studio and the client, and a smoke test that mails real
 * clients from production is worse than no smoke test.
 *
 * Three things a reader would otherwise trip over:
 *
 *   - THE 415 CASE RUNS BEFORE THE RECEIPT RACE. The ladder does read, sniff
 *     and digest the bytes first — that is what lets an identical re-upload
 *     short-circuit — but bytes it refuses to store can never match the key on
 *     the record, so on a green booking they fall through to 409 booking-locked
 *     and the magic-byte gate is never reached. That refusal also COSTS AN
 *     UPLOAD ATTEMPT, which is why the counter assertion after the race expects
 *     one more than the number of receipts that committed.
 *
 *   - THE EMAIL ASSERTIONS ARE TRI-STATE. `emails` holds one slot per kind, so
 *     "exactly one" is not something the record can be counted for. What is
 *     decisive is that the whole block is UNCHANGED after a repeat request — a
 *     second send moves a timestamp, or moves `lastError.at` when Brevo is
 *     unconfigured. When the server sends no mail at all the presence checks
 *     are skipped rather than failed; the unchanged-block check still runs, and
 *     it is the one that actually proves the second request did not re-send.
 *
 *   - THE ORPHAN-BLOB CHECK TALKS TO R2 DIRECTLY, because an orphan is by
 *     definition an object no API response mentions. It needs the R2 creds from
 *     .env.local and only runs against localhost, where the local env is the
 *     server's env; otherwise it is skipped.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

const DEFAULT_URL = "http://localhost:3000";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const ADMIN_COOKIE = "ba_admin";
const TERMS_FILE = "src/lib/booking-terms.ts";
/** RFC 2606 reserved: it can never be a real person's inbox. */
const DEFAULT_EMAIL = "booking-smoke@example.com";

// Tiny env loader. Reads .env first, then .env.local (which overrides).
async function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const value = m[2].replace(/^['"]|['"]$/g, "");
      if (file === ".env.local" || !process.env[m[1]]) {
        process.env[m[1]] = value;
      }
    }
  }
}

function parseArgs(argv) {
  const opts = { url: DEFAULT_URL, email: DEFAULT_EMAIL, force: false };
  const flags = {
    "--url": "url",
    "--cookie": "cookie",
    "--password": "password",
    "--email": "email",
    "--terms-version": "termsVersion",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      opts.force = true;
    } else if (flags[arg]) {
      const value = argv[++i];
      if (!value) {
        console.error(`${arg} needs a value.`);
        process.exit(1);
      }
      opts[flags[arg]] = value;
    } else if (!arg.startsWith("-")) {
      opts.url = arg;
    } else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  return opts;
}

/* ────────────────────────── assertions ────────────────────────── */

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, state: ok ? "pass" : "fail", detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

function skip(name, why) {
  results.push({ name, state: "skip", detail: why });
  console.log(`· ${name} — skipped: ${why}`);
}

function report() {
  const failed = results.filter((r) => r.state === "fail");
  const skipped = results.filter((r) => r.state === "skip");
  const passed = results.length - failed.length - skipped.length;
  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped.`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) {
      console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }
  process.exit(failed.length ? 1 : 0);
}

/* ────────────────────────── http ────────────────────────── */

let BASE;
let COOKIE = "";
/**
 * A fresh loopback address per run. Both public booking routes rate-limit per
 * IP out of an in-memory map (book-receipt is 6 per 10 minutes and one run
 * spends 5), and on localhost every run otherwise collapses onto the same
 * "unknown" bucket — so a second run inside the window would fail on the
 * limiter instead of on anything this script is testing. Only a fallback header
 * is being set: on Vercel the platform sets x-real-ip, which ipFromHeaders()
 * prefers, so this cannot be used to dodge the limiter in production.
 */
const RUN_IP = `127.0.${1 + (randomBytes(1)[0] % 250)}.${1 + (randomBytes(1)[0] % 250)}`;

async function call(path, init = {}) {
  return fetch(new URL(path, BASE), {
    ...init,
    redirect: "manual",
    headers: {
      // assertAdminApi() rejects a mutating admin request whose Origin does not
      // match Host; node's fetch never sends one on its own.
      origin: BASE.origin,
      "x-forwarded-for": RUN_IP,
      ...(COOKIE ? { cookie: COOKIE } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function callJson(path, init) {
  const res = await call(path, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function postJson(path, data) {
  return callJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

function describe({ status, body }) {
  return `HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`;
}

/** Key order is not guaranteed across reads; the comparison must not care. */
function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`)
    .join(",")}}`;
}

/* ────────────────────────── fixtures ────────────────────────── */

/**
 * A minimal but structurally valid PDF 1.4 — one page, one text run — built
 * here rather than committed as a fixture. Offsets are measured as the string
 * grows, so the xref table is real; the nonce keeps every run's bytes (and so
 * the content-addressed key) distinct.
 */
function makePdf(nonce) {
  const content = `BT /F1 12 Tf 20 40 Td (booking smoke test ${nonce}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  const size = objects.length + 1;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  // Every xref entry is exactly 20 bytes, trailing space included.
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function receiptForm(bytes, filename, contentType) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  form.append("locale", "es");
  return form;
}

/* ────────────────────────── setup ────────────────────────── */

async function readTermsVersion() {
  try {
    const source = await readFile(TERMS_FILE, "utf8");
    const m = source.match(/TERMS_VERSION\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {
    // Falls through to the same message: the file is the only source for it.
  }
  console.error(
    `Could not read TERMS_VERSION from ${TERMS_FILE}.\n` +
      "Run this from the repo root, or pass --terms-version.",
  );
  process.exit(1);
}

async function resolveCookie(opts) {
  if (opts.cookie) {
    return opts.cookie.includes("=") ? opts.cookie : `${ADMIN_COOKIE}=${opts.cookie}`;
  }
  const password = opts.password || process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(
      "No admin session. Pass --cookie, or --password, or set ADMIN_PASSWORD in .env.local.",
    );
    process.exit(1);
  }

  const res = await call("/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password, from: "/admin" }),
  });
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  const session = cookies
    .map((c) => c.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`)))
    .find(Boolean);
  if (!session) {
    console.error(`Login failed (HTTP ${res.status}). Wrong password, or the server is not configured.`);
    process.exit(1);
  }
  return `${ADMIN_COOKIE}=${session[1]}`;
}

/**
 * The receipt keys R2 actually holds for one booking. An orphan is by
 * definition an object nothing in the API mentions, so this is the only place
 * it can be seen. Returns null when it cannot look — the caller skips.
 */
async function listReceiptKeys(id) {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_PRIVATE_BUCKET,
  } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PRIVATE_BUCKET) {
    return null;
  }
  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_PRIVATE_BUCKET,
        Prefix: `bookings/receipts/${id}/`,
      }),
    );
    return (out.Contents ?? []).map((o) => o.Key);
  } catch (err) {
    console.log(`  (R2 list failed: ${err.message})`);
    return null;
  }
}

/* ────────────────────────── the run ────────────────────────── */

async function main() {
  await loadEnv();
  const opts = parseArgs(process.argv.slice(2));

  try {
    BASE = new URL(opts.url);
  } catch {
    console.error(`"${opts.url}" is not a URL.`);
    process.exit(1);
  }

  const isLocal = LOCAL_HOSTS.has(BASE.hostname);
  if (!isLocal && !opts.force) {
    console.error(
      `Refusing to run against ${BASE.origin}.\n` +
        "This creates a real booking and can mail a real client. Pass --force if you mean it.",
    );
    process.exit(1);
  }
  if (!isLocal) {
    console.log(`! ${BASE.origin} is not localhost. Real emails may be sent.\n`);
  }

  const termsVersion = opts.termsVersion || (await readTermsVersion());
  COOKIE = await resolveCookie(opts);

  // Only inferable when the local env IS the server's env. null means "unknown",
  // which downgrades a missing email log line from a failure to a skip.
  const mailConfigured = isLocal
    ? Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL)
    : null;
  const ownerMailConfigured =
    mailConfigured === null ? null : mailConfigured && Boolean(process.env.BOOKING_NOTIFY_EMAIL);
  const mailWhy =
    mailConfigured === null
      ? "cannot tell whether the server sends mail"
      : "the server has no Brevo config";

  function checkEmail(label, log, kind, expected) {
    if (log?.[kind]) {
      check(`${label}: one ${kind} logged`, true);
    } else if (expected) {
      check(`${label}: one ${kind} logged`, false, `emails = ${JSON.stringify(log)}`);
    } else {
      skip(`${label}: one ${kind} logged`, mailWhy);
    }
  }

  const start = new Date(Date.now() + 7 * 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  const startsAt = start.toISOString();
  const endsAt = new Date(start.getTime() + 2 * 3_600_000).toISOString();
  const nonce = randomBytes(6).toString("hex");

  console.log(`booking smoke · ${BASE.origin} · terms ${termsVersion} · ip ${RUN_IP}\n`);

  let bookingId = null;
  try {
    /* 1 — create ------------------------------------------------------- */
    const created = await postJson("/api/admin/bookings", {
      startsAt,
      endsAt,
      seed: { name: `Smoke ${nonce}`, email: opts.email },
      adminNotes: `booking-smoke.mjs ${new Date().toISOString()}`,
    });
    const appointment = created.body?.appointment;
    check(
      "1 create: 201 with an appointment",
      created.status === 201 && Boolean(appointment?.id),
      describe(created),
    );
    if (!appointment?.id) throw new Error("nothing to test without a booking");
    bookingId = appointment.id;
    check("1 create: starts pending", appointment.status === "pending", appointment.status);

    const getRecord = async () => {
      const read = await callJson(`/api/admin/bookings/${bookingId}`);
      if (read.status !== 200) throw new Error(`admin read: ${describe(read)}`);
      return read.body.appointment;
    };

    /* 2 — the private link --------------------------------------------- */
    const token = appointment.token;
    const link = appointment.links?.es ?? "";
    check(
      "2 link: response carries a private link built from the token",
      typeof token === "string" && token.length > 0 && link.endsWith(`/book/${token}`),
      `token=${token} link=${link}`,
    );
    const view = await callJson(`/api/booking/${token}`);
    check("2 link: resolves to a public view", view.status === 200 && view.body?.ok === true, describe(view));

    /* 3 — two simultaneous submits ------------------------------------- */
    const details = {
      name: `Smoke Client ${nonce}`,
      email: opts.email,
      instagram: "booking.smoke",
      phone: "+54 11 5555 5555",
      note: "Fired by scripts/booking-smoke.mjs.",
      locale: "es",
      acceptTerms: true,
      termsVersion,
    };
    const submits = await Promise.all([
      postJson(`/api/booking/${token}/submit`, details),
      postJson(`/api/booking/${token}/submit`, details),
    ]);
    check(
      "3 submit race: both requests return 200",
      submits.every((r) => r.status === 200 && r.body?.ok === true),
      submits.map(describe).join(" | "),
    );

    const afterRace = await getRecord();
    check(
      "3 submit race: terms accepted exactly once",
      Boolean(afterRace.client?.termsAcceptedAt) &&
        afterRace.client.termsVersion === termsVersion,
      JSON.stringify(afterRace.client),
    );
    check(
      "3 submit race: both writes committed (submitAttempts === 2)",
      afterRace.counters?.submitAttempts === 2,
      `submitAttempts = ${afterRace.counters?.submitAttempts}`,
    );
    checkEmail("3 submit race", afterRace.emails, "clientSubmitted", mailConfigured);
    checkEmail("3 submit race", afterRace.emails, "ownerSubmitted", ownerMailConfigured);

    // The decisive half: a repeat submit must edit the details and send nothing.
    const editedName = `Smoke Client ${nonce} edited`;
    const repeat = await postJson(`/api/booking/${token}/submit`, {
      ...details,
      name: editedName,
    });
    check("3 repeat submit: returns 200", repeat.status === 200, describe(repeat));
    const afterRepeat = await getRecord();
    check(
      "3 repeat submit: the write ran (name edited, submitAttempts === 3)",
      afterRepeat.client?.name === editedName && afterRepeat.counters?.submitAttempts === 3,
      `name=${afterRepeat.client?.name} submitAttempts=${afterRepeat.counters?.submitAttempts}`,
    );
    check(
      "3 repeat submit: consent not re-stamped",
      afterRepeat.client?.termsAcceptedAt === afterRace.client?.termsAcceptedAt &&
        afterRepeat.client?.submittedAt === afterRace.client?.submittedAt,
      `${afterRace.client?.termsAcceptedAt} → ${afterRepeat.client?.termsAcceptedAt}`,
    );
    check(
      "3 repeat submit: nothing re-sent (email log unchanged)",
      stableJson(afterRepeat.emails) === stableJson(afterRace.emails),
      `${stableJson(afterRace.emails)} → ${stableJson(afterRepeat.emails)}`,
    );

    // The booking above was seeded with an email and NO handle — the exact case
    // that used to make instagram mandatory. It is optional now (a deliberate
    // relaxation: the old rule left a client with no Instagram account unable
    // to finish, and the page offers no way past the field), so an empty handle
    // has to be accepted rather than answered with missing-contact.
    const noHandle = await postJson(`/api/booking/${token}/submit`, {
      ...details,
      name: editedName,
      instagram: "",
    });
    check(
      "3 no handle: a booking seeded with an email only completes without instagram",
      noHandle.status === 200 && noHandle.body?.ok === true,
      describe(noHandle),
    );
    const afterNoHandle = await getRecord();
    check(
      "3 no handle: the write ran (handle cleared, submitAttempts === 4)",
      !afterNoHandle.client?.instagram && afterNoHandle.counters?.submitAttempts === 4,
      `instagram=${afterNoHandle.client?.instagram} submitAttempts=${afterNoHandle.counters?.submitAttempts}`,
    );

    /* 4 — a lie about the content type ---------------------------------- */
    // Before the receipt race on purpose: the ladder does sniff first now, but
    // bytes it refuses to store can never match the key on the record, so once
    // the booking is green they fall through to 409 booking-locked and this
    // gate is never reached.
    const notAPdf = Buffer.from(
      `<!doctype html><title>not a pdf</title><p>${nonce}`,
      "utf8",
    );
    const lied = await callJson(`/api/booking/${token}/receipt`, {
      method: "POST",
      body: receiptForm(notAPdf, "totally-a-receipt.pdf", "application/pdf"),
    });
    check(
      "4 magic bytes: HTML declared as application/pdf is refused with 415",
      lied.status === 415 && lied.body?.error === "unsupported-type",
      describe(lied),
    );

    /* 5 — two simultaneous receipts, same bytes -------------------------- */
    const pdf = makePdf(nonce);
    const digest = sha256(pdf);
    const receipts = await Promise.all([
      callJson(`/api/booking/${token}/receipt`, {
        method: "POST",
        body: receiptForm(pdf, "transfer.pdf", "application/pdf"),
      }),
      callJson(`/api/booking/${token}/receipt`, {
        method: "POST",
        body: receiptForm(pdf, "transfer.pdf", "application/pdf"),
      }),
    ]);
    check(
      "5 receipt race: both requests return 200",
      receipts.every((r) => r.status === 200 && r.body?.ok === true),
      receipts.map(describe).join(" | "),
    );

    const afterReceipts = await getRecord();
    check(
      "5 receipt race: exactly one receipt attached, and it is our file",
      afterReceipts.receipt?.sha256 === digest &&
        afterReceipts.receipt?.bytes === pdf.length &&
        afterReceipts.receipt?.contentType === "application/pdf" &&
        afterReceipts.receipt?.ext === "pdf",
      JSON.stringify(afterReceipts.receipt),
    );
    check(
      // Three, not two: the refused 415 at step 4 costs an attempt as well.
      // A rejected upload that did not count would leave the durable ceiling
      // guarding only the path that was never the problem.
      "5 receipt race: both writes committed, and the 415 counted (uploadAttempts === 3)",
      afterReceipts.counters?.uploadAttempts === 3,
      `uploadAttempts = ${afterReceipts.counters?.uploadAttempts}`,
    );
    check(
      "5 receipt race: booking is confirmed",
      afterReceipts.status === "confirmed",
      afterReceipts.status,
    );
    checkEmail("5 receipt race", afterReceipts.emails, "ownerConfirmed", ownerMailConfigured);
    checkEmail("5 receipt race", afterReceipts.emails, "clientConfirmed", mailConfigured);

    const served = await call(`/api/admin/bookings/${bookingId}/receipt`);
    const servedBytes = Buffer.from(await served.arrayBuffer());
    check(
      "5 receipt race: the admin route serves back exactly those bytes",
      served.status === 200 && sha256(servedBytes) === digest,
      `HTTP ${served.status}, ${servedBytes.length} bytes`,
    );

    const keys = isLocal ? await listReceiptKeys(bookingId) : null;
    if (keys) {
      check(
        "5 receipt race: no orphan blob (one object under the receipts prefix)",
        keys.length === 1 && keys[0].endsWith(`${digest.slice(0, 16)}.pdf`),
        keys.join(", ") || "none",
      );
    } else {
      skip(
        "5 receipt race: no orphan blob",
        isLocal ? "no R2 credentials in .env.local" : "target is not localhost",
      );
    }

    // The lost-response retry. A phone that drops its connection after the
    // server committed re-picks the SAME file, and the content-addressed key
    // makes that request a no-op: it must answer 200 with the view the client
    // never received, not the green lock's refusal, which they cannot act on
    // and which no reload of the page would have produced.
    const retried = await callJson(`/api/booking/${token}/receipt`, {
      method: "POST",
      body: receiptForm(pdf, "transfer.pdf", "application/pdf"),
    });
    check(
      "5 after green: the same bytes re-sent short-circuit to 200 with the view",
      retried.status === 200 &&
        retried.body?.ok === true &&
        retried.body?.view?.receipt?.bytes === pdf.length,
      describe(retried),
    );

    // The other half of the same rung: a green receipt is evidence, so swapping
    // it is the admin's DELETE and not a POST from whoever still holds the
    // link. The refusal carries the view so the client can be shown their
    // finished booking instead of an upload error.
    const swapped = makePdf(`${nonce}-swap`);
    const locked = await callJson(`/api/booking/${token}/receipt`, {
      method: "POST",
      body: receiptForm(swapped, "another.pdf", "application/pdf"),
    });
    check(
      "5 after green: DIFFERENT bytes are refused with 409 booking-locked",
      locked.status === 409 && locked.body?.error === "booking-locked",
      describe(locked),
    );
    check(
      "5 after green: the 409 carries the current view",
      locked.body?.view?.status === "confirmed" &&
        locked.body?.view?.receipt?.bytes === pdf.length,
      JSON.stringify(locked.body?.view ?? null).slice(0, 200),
    );

    const afterLocked = await getRecord();
    check(
      "5 after green: nothing re-sent (email log unchanged)",
      stableJson(afterLocked.emails) === stableJson(afterReceipts.emails),
      `${stableJson(afterReceipts.emails)} → ${stableJson(afterLocked.emails)}`,
    );
    check(
      "5 after green: the receipt on file is untouched",
      afterLocked.receipt?.sha256 === digest,
      `${digest} → ${afterLocked.receipt?.sha256}`,
    );
    check(
      // Neither request is an attempt at anything: one would have written the
      // bytes already on the record, the other was refused before the PUT.
      "5 after green: neither request counted an attempt (uploadAttempts === 3)",
      afterLocked.counters?.uploadAttempts === 3,
      `uploadAttempts = ${afterLocked.counters?.uploadAttempts}`,
    );

    const keysAfterLocked = isLocal ? await listReceiptKeys(bookingId) : null;
    if (keysAfterLocked) {
      check(
        "5 after green: the refused swap wrote no blob",
        keysAfterLocked.length === 1 && keysAfterLocked[0].endsWith(`${digest.slice(0, 16)}.pdf`),
        keysAfterLocked.join(", ") || "none",
      );
    } else {
      skip(
        "5 after green: the refused swap wrote no blob",
        isLocal ? "no R2 credentials in .env.local" : "target is not localhost",
      );
    }

    /* 6 — rotate the link ----------------------------------------------- */
    const rotated = await postJson(`/api/admin/bookings/${bookingId}/link`, {});
    const newToken = rotated.body?.appointment?.token;
    check(
      "6 rotate: 200 with a different token",
      rotated.status === 200 && typeof newToken === "string" && newToken !== token,
      describe(rotated),
    );
    const dead = await callJson(`/api/booking/${token}`);
    check(
      "6 rotate: the old token 404s with invalid-link",
      dead.status === 404 && dead.body?.error === "invalid-link",
      describe(dead),
    );
    const alive = await callJson(`/api/booking/${newToken}`);
    check(
      "6 rotate: the new token still resolves",
      alive.status === 200 && alive.body?.ok === true,
      describe(alive),
    );
  } catch (err) {
    // fetch() hides "the server is not running" behind a bare "fetch failed",
    // and undici buries the real reason one or two levels down in `cause`.
    const cause = err.cause;
    const why = cause?.message || cause?.code || cause?.errors?.[0]?.message;
    check(
      "run completed without an unexpected error",
      false,
      why ? `${err.message}: ${why}` : err.message,
    );
  } finally {
    /* 7 — clean up, whatever happened above ----------------------------- */
    if (bookingId) {
      try {
        const removed = await callJson(`/api/admin/bookings/${bookingId}`, {
          method: "DELETE",
        });
        check(
          "7 cleanup: the booking is deleted",
          removed.status === 200 && removed.body?.ok === true,
          describe(removed),
        );
        const gone = await callJson(`/api/admin/bookings/${bookingId}`);
        check("7 cleanup: it is really gone", gone.status === 404, describe(gone));
        const leftovers = LOCAL_HOSTS.has(BASE.hostname)
          ? await listReceiptKeys(bookingId)
          : null;
        if (leftovers) {
          check(
            "7 cleanup: the receipt blob went with it",
            leftovers.length === 0,
            leftovers.join(", "),
          );
        }
      } catch (err) {
        check("7 cleanup: the booking is deleted", false, `${err.message} (booking ${bookingId} is still there)`);
      }
    }
  }

  report();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
