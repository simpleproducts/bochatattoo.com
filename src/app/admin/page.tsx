import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * /admin is the calendar.
 *
 * Signing in, or typing the bare /admin, lands on the schedule rather than on
 * the image library — that is the screen the studio opens every day. The
 * gallery keeps its own URL at /admin/gallery and its own tab.
 *
 * requireAdmin() runs first so an unauthenticated visitor is bounced to the
 * login page instead of being redirected to a protected URL and bounced from
 * there, which would put /admin/calendar in their address bar for no reason.
 */
export default async function AdminPage() {
  await requireAdmin();
  redirect("/admin/calendar");
}
