import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GuestSpotCityPage,
  guestSpotCityMetadata,
} from "@/components/GuestSpotCityPage";
import { ENABLED_GUEST_SPOTS } from "@/config/guest-spots";
import { getDictionary } from "@/i18n";

const locale = "es" as const;
const dict = getDictionary(locale);

type Props = { params: Promise<{ ciudad: string }> };

/**
 * ENABLED_GUEST_SPOTS, not GUEST_SPOTS: a city retired with `enabled: false`
 * stops being generated here, disappears from the hub and leaves the sitemap in
 * the same edit. Anything else leaves a page in the index telling people Bocha
 * visits a city he no longer travels to.
 */
export function generateStaticParams(): { ciudad: string }[] {
  return ENABLED_GUEST_SPOTS.map((spot) => ({ ciudad: spot.slug }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { ciudad } = await params;
  const spot = ENABLED_GUEST_SPOTS.find((s) => s.slug === ciudad);
  // The page below answers 404 for this slug; a 404 needs no canonical, and
  // emitting one would advertise a URL that does not resolve.
  if (!spot) return {};
  return guestSpotCityMetadata(spot, locale);
}

export default async function GuestSpotCity({ params }: Props) {
  const { ciudad } = await params;
  const spot = ENABLED_GUEST_SPOTS.find((s) => s.slug === ciudad);
  if (!spot) notFound();
  return <GuestSpotCityPage dict={dict} locale={locale} spot={spot} />;
}
