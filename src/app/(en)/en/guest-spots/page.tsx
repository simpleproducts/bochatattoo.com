import type { Metadata } from "next";
import {
  GuestSpotsPage,
  guestSpotsMetadata,
} from "@/components/GuestSpotsPage";
import { getDictionary } from "@/i18n";

const locale = "en" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = guestSpotsMetadata(locale);

export default function GuestSpotsEn() {
  return <GuestSpotsPage dict={dict} locale={locale} />;
}
