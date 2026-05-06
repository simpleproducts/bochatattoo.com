import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function verifyTurnstile(
  token: string,
  ip: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Not configured — skip verification

  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.append("remoteip", ip);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not-configured" }, { status: 500 });
  }

  let email = "";
  let honeypot = "";
  let token = "";
  try {
    const body = (await req.json()) as {
      email?: unknown;
      website?: unknown;
      token?: unknown;
    };
    if (typeof body.email === "string") email = body.email.trim().toLowerCase();
    if (typeof body.website === "string") honeypot = body.website;
    if (typeof body.token === "string") token = body.token;
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Pretend success and drop.
  if (honeypot) return NextResponse.json({ ok: true });

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid-email" }, { status: 400 });
  }

  // Cloudflare Turnstile (only enforced if TURNSTILE_SECRET_KEY is set)
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!token) {
      return NextResponse.json({ error: "missing-token" }, { status: 400 });
    }
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      null;
    const ok = await verifyTurnstile(token, ip);
    if (!ok) {
      return NextResponse.json({ error: "challenge-failed" }, { status: 403 });
    }
  }

  const listId = process.env.BREVO_LIST_ID
    ? Number(process.env.BREVO_LIST_ID)
    : undefined;

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      ...(listId ? { listIds: [listId] } : {}),
      updateEnabled: true,
    }),
  });

  if (res.ok) return NextResponse.json({ ok: true });

  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (data.code === "duplicate_parameter") {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: data.code || "brevo-error" },
    { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
  );
}
