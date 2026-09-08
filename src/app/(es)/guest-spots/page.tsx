import type { Metadata } from "next";
import {
  GuestSpotsPage,
  guestSpotsMetadata,
} from "@/components/GuestSpotsPage";
import { getDictionary } from "@/i18n";

const locale = "es" as const;
const dict = getDictionary(locale);

// Copy, canonical and hreflang all come from the component so the two language
// halves of this page cannot drift apart in the head while agreeing in the body.
export const metadata: Metadata = guestSpotsMetadata(locale);

export default function GuestSpots() {
  return <GuestSpotsPage dict={dict} locale={locale} />;
}
