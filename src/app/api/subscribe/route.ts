import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not-configured" }, { status: 500 });
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid-email" }, { status: 400 });
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

  // Brevo returns 201 on create, 204 on update. Both are success.
  // duplicate_parameter (already exists) is also fine — treat as success.
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
