import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_TTL,
  createSessionCookie,
  passwordsMatch,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

// Per-IP brute-force throttle. In-memory means it's per-instance only —
// Vercel may run multiple — but combined with the response delay below it
// raises the cost enough to make a serious attack impractical against a
// strong password.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const FAILURE_DELAY_MS = 1_000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function ipFromHeaders(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function bumpAttempt(ip: string): { allowed: boolean } {
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur || now - cur.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return { allowed: true };
  }
  cur.count++;
  if (cur.count > MAX_ATTEMPTS) return { allowed: false };
  return { allowed: true };
}

function clearAttempt(ip: string) {
  attempts.delete(ip);
}

export async function POST(req: Request) {
  const ip = ipFromHeaders(req);
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const requestedFrom = String(form.get("from") ?? "/admin");
  // Only allow same-origin redirects.
  const from = requestedFrom.startsWith("/") && !requestedFrom.startsWith("//")
    ? requestedFrom
    : "/admin";

  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expected || !secret) {
    return NextResponse.json(
      { error: "admin-not-configured" },
      { status: 503 },
    );
  }

  const { allowed } = bumpAttempt(ip);
  if (!allowed) {
    return new NextResponse("Too many attempts. Wait a minute.", {
      status: 429,
    });
  }

  if (!passwordsMatch(password, expected)) {
    // Slow down brute force: any failed attempt waits a second before responding.
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS));
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", "1");
    if (from !== "/admin") url.searchParams.set("from", from);
    return NextResponse.redirect(url, 303);
  }
  clearAttempt(ip);

  const cookie = await createSessionCookie(secret);
  const res = NextResponse.redirect(new URL(from, req.url), 303);
  res.cookies.set(ADMIN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL,
  });
  return res;
}
