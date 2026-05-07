import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { bumpAdminEpoch } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Bump the server-side epoch — invalidates every outstanding cookie, not
  // just the one we're clearing here. Best-effort: if R2 is unreachable we
  // still log the user out client-side.
  try {
    await bumpAdminEpoch();
  } catch (err) {
    console.error("logout: bumpAdminEpoch failed", err);
  }
  const res = NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
