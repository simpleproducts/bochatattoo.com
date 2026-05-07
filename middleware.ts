import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_TTL,
  createSessionCookie,
  verifySessionCookie,
} from "@/lib/admin-auth";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return new NextResponse("Admin not configured: ADMIN_SESSION_SECRET missing", {
      status: 503,
    });
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const result = await verifySessionCookie(cookie, secret);

  if (!result.valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sliding renewal: if the session has less than 24h left, refresh it.
  const res = NextResponse.next();
  const remaining = result.exp - Math.floor(Date.now() / 1000);
  if (remaining < 24 * 60 * 60) {
    const fresh = await createSessionCookie(secret);
    res.cookies.set(ADMIN_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_TTL,
    });
  }
  return res;
}
