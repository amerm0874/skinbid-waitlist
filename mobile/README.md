# SkinBid Mobile

A React Native (Expo) companion app for [SkinBid](../README.md), built as an
independent project inside this repo — it does not modify the Next.js site
and can be deployed on its own timeline. It talks to the **same Supabase
project** as the web app, so accounts, events, bids, and profiles are shared
between web and mobile automatically.

## Stack

- Expo SDK 57, Expo Router (file-based routing, `src/app/`)
- TypeScript, React 19
- `@supabase/supabase-js` directly (no custom backend) — same anon-key/RLS
  model as the web app's browser client
- No 3D/model-viewer — the web app's body-cage picker isn't ported; zones are
  shown as a flat list instead (see "Not ported" below)

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # then fill in the same values as ../.env.local's
                        # NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator/emulator.
`npx expo start --web` also works for quick iteration in a browser.

### Google sign-in

Google OAuth reuses the same Supabase provider config as the web app, but the
mobile app completes the flow with an in-app browser and a deep link instead
of a `/auth/callback` HTTP route (see `src/lib/oauth.ts`). For it to work,
add this redirect URL in the Supabase dashboard under **Authentication → URL
Configuration → Redirect URLs**:

```
skinbid://auth/callback
```

(This is additive — it does not change or remove the web app's existing
`https://www.skinbid.me/auth/callback` entry.)

## What's fully native

Everything that only needs the anon-key Supabase client and RLS, ported
1:1 from the web app's `lib/` (see file headers for exact source):

- Email/password + Google sign-in, sign-up, sign-out
- Onboarding (athlete: country/DOB/gender/sport/socials/PayPal; brand:
  name/website/category/logo)
- Browse: live athlete listings + the official race catalog
- Public athlete profile (`/a/[handle]` → `athlete/[handle]`)
- Event detail: zones, current leader, countdown to the 48h auction close,
  bid history
- Race detail page
- Me dashboard (athlete's event + zones; brand's bids)
- Notifications (list + mark read)
- Settings (edit profile, upload photo/logo)
- List a race (`new.tsx`) — creates the event + 12 zone rows as a **draft**
- Proof upload (3 required photos + optional post link)
- About / Contact / Privacy / Terms (static copy, ported verbatim)

## What intentionally opens the web app instead

A few flows are **not** reimplemented natively, on purpose — they run on a
service-role key or a payment-provider secret that must never ship inside a
mobile client bundle. Duplicating that logic here would mean either exposing
secrets or silently drifting from the site's real business rules. Instead,
these screens show real data natively and hand off the actual action to
`https://www.skinbid.me` in an in-app browser (`src/lib/webActions.ts`):

| Flow | Why it stays on web |
| --- | --- |
| Placing a paid bid | Creates a Whop checkout using `WHOP_API_KEY` (server-only) |
| Uploading a winning logo/mark | Bundled with the same moderation checks as the web upload flow; kept in one place for now |
| Admin proof review (approve/reject) | Triggers payouts + refunds via the Supabase service-role key |
| Waitlist inbox | Admin-only, service-role reads |
| Outreach email to a brand | Sent server-side via Resend (`RESEND_API_KEY`) |
| Going live from a draft event | Requires a completed 3D body scan — the scanning pipeline isn't ported |

Everything in that list still requires the person to be signed in and
properly authorized on the actual site — nothing here is a workaround for
auth or admin checks, it's just where the code already lives.

## Not ported

- The 3D body-cage viewer (`components/cage/EventCage.tsx`, Google
  `<model-viewer>`) — zones are a flat list instead. Creating a 3D avatar
  (the body-scan capture flow) isn't available on mobile at all yet.
- Magic-link login (the web app's `sendLoginLink()` helper exists but isn't
  wired into its own login UI either)

## Project layout

```
src/
  app/            Expo Router routes (screens)
  components/     Shared UI (Button, Card, TextField, SelectField, ...)
  lib/            Supabase client, ported business logic, data queries, session
  constants/      Theme (mirrors app/globals.css's dark palette)
```
