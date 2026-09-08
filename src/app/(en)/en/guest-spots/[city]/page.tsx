import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GuestSpotCityPage,
  guestSpotCityMetadata,
} from "@/components/GuestSpotCityPage";
import { ENABLED_GUEST_SPOTS } from "@/config/guest-spots";
import { getDictionary } from "@/i18n";

const locale = "en" as const;
const dict = getDictionary(locale);

type Props = { params: Promise<{ city: string }> };

/** The slug is shared by both languages, so this list matches the ES route's. */
export function generateStaticParams(): { city: string }[] {
  return ENABLED_GUEST_SPOTS.map((spot) => ({ city: spot.slug }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { city } = await params;
  const spot = ENABLED_GUEST_SPOTS.find((s) => s.slug === city);
  if (!spot) return {};
  return guestSpotCityMetadata(spot, locale);
}

export default async function GuestSpotCityEn({ params }: Props) {
  const { city } = await params;
  const spot = ENABLED_GUEST_SPOTS.find((s) => s.slug === city);
  if (!spot) notFound();
  return <GuestSpotCityPage dict={dict} locale={locale} spot={spot} />;
}
