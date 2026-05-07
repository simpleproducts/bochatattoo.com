import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_TTL,
  createSessionCookie,
  passwordsMatch,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  if (!passwordsMatch(password, expected)) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", "1");
    if (from !== "/admin") url.searchParams.set("from", from);
    return NextResponse.redirect(url, 303);
  }

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
