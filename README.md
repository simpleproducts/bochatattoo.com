This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Bookings

The admin calendar (`/admin/calendar`) and the private client link
(`/book/<token>`) store everything in a **second, private R2 bucket** — booking
records hold names, phone numbers and bank transfer receipts, and the existing
`R2_BUCKET` is world-readable at `NEXT_PUBLIC_IMAGES_BASE_URL`.

### Deploy prerequisites

These are out of the repo and block the feature. Do them before the first deploy:

1. **Create the private bucket** in the same Cloudflare R2 account. It reuses the
   `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` credentials.
2. **Do not enable its r2.dev public URL, and do not bind a custom domain.**
   Nothing anonymous may ever read it. Confirm with a `curl` from outside that no
   public URL resolves for it — before and after announcing the feature.
3. **Verify the sender** at <https://app.brevo.com/senders>. `BREVO_SENDER_EMAIL`
   must be a verified sender or every transactional send returns 400. No CORS
   rule is needed: the browser only ever talks to `bochatattoo.com`.
4. Set `R2_PRIVATE_BUCKET`, `BOOKING_TOKEN_SECRET`, `BREVO_SENDER_EMAIL`,
   `BOOKING_NOTIFY_EMAIL`, `NEXT_PUBLIC_SITE_URL` and
   `NEXT_PUBLIC_STUDIO_TIMEZONE` locally and on Vercel. See `.env.example` for
   what each one does. The first two hard-fail (the calendar renders a config
   panel naming them); the mail ones only skip sending.

### Smoke test

`scripts/booking-smoke.mjs` is the only automated check in the project. It drives
one throwaway booking through the whole flow and asserts the things that fail
silently: two simultaneous submits leaving exactly one consent record and one
pair of emails, two simultaneous receipt uploads leaving one blob and one
confirmation pair, a file whose magic bytes contradict its declared content-type
being refused with 415, and a rotated link killing the old token.

```bash
pnpm dev                                          # in another terminal
node scripts/booking-smoke.mjs --password "$ADMIN_PASSWORD"
node scripts/booking-smoke.mjs --cookie ba_admin=...   # or an existing session
```

Run it from the repo root. It creates one booking, deletes it again in a
`finally`, and never touches a booking it did not create. It refuses any target
that is not localhost unless you pass `--force`. If the local server has Brevo
configured, a run really does send mail — to `BOOKING_NOTIFY_EMAIL` and to the
`--email` address, which defaults to a reserved `example.com` sink. Exit code is
non-zero if any assertion fails.

## TODO:
- [ ] Add contact form?
- [x] Subcripcion mail form and newsletter management.
- [x] Config info@bochatattoo.com on bocha's gmail