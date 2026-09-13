# SkinBid audit

## P0 fixes (12 September 2026)

Did not touch `app/page.tsx`, `components/landing`, or `:root`. No Polar keys. No 80/20 payout. No Vercel cron.

1. **Bids RLS** — `bids_insert_brand` now allows insert only when `brand_id = auth.uid()`, role is a completed brand (name + website + category), the zone is `open`, the event is `live`, and `status = 'pending'`. Athletes and draft events cannot insert. Service role still writes `held` after checkout.
2. **PayPal not public** — `anon` / `authenticated` cannot select, insert, or update `profiles.payout_rail` / `payout_account`. Own PayPal lives on `athlete_payouts` (own-row RLS). `/a/[handle]` never selected those columns; public profile queries still do not. Re-run `supabase/schema.sql` in the Supabase SQL editor for this to apply live.
3. **`/inbox`** — Cookie `waitlist_inbox=1` does nothing. Password unlock is gone. The route requires a logged-in `ADMIN_EMAILS` user (same as `/admin`). Others go to `/login` or `/events`. `/inbox` is disallowed in `robots.ts`.
4. **Terms cancel copy** — `/terms` now says cancel is blocked after a held or won bid, matching `/api/events/cancel`.

---

**Date:** 12 September 2026  
**Scope:** repo vs product rules. Body below is the original audit; P0 items 2–4 in “Dangerous bugs” are addressed by the fixes above. Polar-off held bids and 80/20 money movement were out of this pass.

## Spec sources

| File | In repo? | Used as |
|---|---|---|
| `rules.md` | Yes | Product lock (auction, money, capture, accounts, kill list) |
| `capture.md` | **Missing** (`artifacts/capture.md` also missing) | Inferred from `rules.md` avatar section + `lib/capture.ts` + the `/new` scan spec |
| `pages.md` | **Missing** | Inferred from `rules.md` + existing App Router pages |
| `qa.md` | **Missing** | Inferred from the contradiction list in this audit request |
| `landing-lock.md` | **Missing** | `.cursor/rules/landing.mdc` + `.cursor/rules/publish.mdc` |

Drop the four missing files into the repo (or `artifacts/`) if you want later audits to cite them line-for-line.

---

## What matches the rules

### Draft vs placeholder (publish lock)

- No ready GLB → insert/update is `draft`. App: `app/api/events/route.ts`. DB trigger: `events_keep_draft_without_glb` in `supabase/schema.sql`.
- `placeholder.glb` is not a ready avatar (`lib/event-create.ts`, schema `avatar_has_ready_glb`).
- `/events` lists `status = live` and then drops athletes without a ready GLB.
- `/e/[slug]` 404s for draft, cancelled, or missing ready GLB — including the athlete. No owner bypass.
- `placeholder.glb` is assigned only when `slug === "demo"` (`app/e/[slug]/page.tsx`). Real pages use `avatar.glb_url`.
- Admin GLB publish rejects placeholder (`app/api/admin/glb/route.ts`).
- Sitemap omits drafts and demo (`lib/public-listings.ts`, `app/sitemap.ts`).

### Payout rail PayPal-only (destination field)

- Onboarding stores `payout_rail = 'PayPal'` and a PayPal email (`app/onboarding/OnboardingForm.tsx`, `lib/config.ts`).
- DB check: `payout_rail` is null or `'PayPal'` only (`supabase/schema.sql`).
- `/new` and cancel require `athleteHasPayout`.
- No Stripe Connect, no athlete Polar/Dodo payout UI.

### Landing lock

- `git diff origin/main -- app/page.tsx` is empty.
- `components/landing/**` has no diff vs `origin/main`.
- `:root` tokens were not restyled for product. New product CSS is under `.product` in `app/globals.css`.
- `/` is marketing. Product chrome is `ProductShell` (`.product`). Terms/privacy are linked from the product footer, not the landing.

### 12 L/R zones

Exact set in `lib/zones.ts` and the DB check:

Chest L/R, Shoulder L/R, Bicep L/R, Forearm L/R, Back L/R, Thigh L/R.

Create always inserts all 12. Athletes can close zones; they cannot invent names. Event page pads missing rows to 12.

### T–48h (clock math)

- `AUCTION_CLOSE_HOURS = 48` (`lib/config.ts`).
- `isAuctionClosed` = now > event start − 48h (`lib/auction.ts`).
- Bid POST refuses after close and settles the event.
- `/e/[slug]` settles on load if live and past T–48h.
- Zone reopen after T–48h is blocked in DB (`zones_guard_status`).
- Event date window is 4 days–90 days.

### 80/20 (stated, not paid)

- Constants exist: `ATHLETE_SHARE = 0.8`, `PLATFORM_SHARE = 0.2`.
- Terms copy states 80/20 (`app/terms/page.tsx`).
- Schema has `ledger` with `athlete_cents` / `platform_cents`.
- **No code path writes the ledger or moves 80/20.** Approve explicitly does not (`app/api/admin/route.ts`: “Do not write the ledger or move money.”).

### No in-app chat

- No DM/inbox product. `/outreach` emails **SkinBid** (`SITE.email`), not the brand’s raw inbox.
- Copy: “No in-app chat.”
- `/inbox` is a waitlist email list, not athlete↔brand chat.

### Auction shape (partial)

- Auction only. No buy-now.
- Floor $100, step +$100 (`FLOOR_CENTS`, `BID_STEP_CENTS`, DB `amount_cents >= 10000`).
- Athlete does not type a price.
- Closed zone cannot receive bids (API + DB trigger).
- Category lock on Bid POST: same brand cannot take a second zone; same `brand_category` on another held/won zone blocks (`lib/category-lock.ts`).
- One active `draft|live` event per athlete.
- Likeness yes/no on `/new`.
- Demo does **not** write bids (`acceptsBids` false; API rejects `demo` / `demo-*` zone ids).
- Capture videos do not set `avatars.ready`. Only `.glb` upload does (`lib/event-form.ts`).
- Proof API asks for 3 files (“2 zone photos and 1 venue photo”).
- Banned-logo keyword check on PNG upload (`lib/logo.ts`).
- Currency is USD cents.

---

## What contradicts

### 1. Bid without payment — **P0**

`rules.md`: brand pays SkinBid to sit as high bid. SkinBid holds every live bid.

**Code:** if `POLAR_ACCESS_TOKEN` is empty, `POST /api/bids` inserts `status: "held"` with no checkout (`app/api/bids/route.ts`). UI still bids and shows “Payments open soon” (`EventStage.tsx`).

Outbid in that mode is a status flip only (`refundPayment: false`). No money moved, no money to refund.

`.env.example` ships Polar keys empty. Local/prod without the token is a free auction.

When Polar **is** on: insert `pending` → checkout → webhook `order.paid` → `held`. That path matches the rule.

### 2. 80/20 never executes — **P0 before first paid slot**

Approve: proof → `approved`. Bids stay `won`. `payable` is never set `true`. `ATHLETE_SHARE` is unused outside `lib/config.ts`.

Reject: bids → `refunded` in the table. **No Polar refund.** Comment: “No payout call.”

`rules.md`: approve → athlete 80% / SkinBid 20%; reject / no-show → brand refunded 100%.

### 3. Proof reject / cancel vs money

| Spec | Code |
|---|---|
| Athlete/organizer cancel → brand refunded 100% | `/api/events/cancel` **refuses** if any held/won bid (“Cancel is blocked after a bid.”) |
| Terms: “Cancel before the auction closes and the brand is refunded” | Same: cannot cancel once a held bid exists, even Polar-off (unpaid) holds |
| Winner cannot walk after close | No winner-walk API (match) |
| Reject → refund brand | Status only; Polar refund missing |

### 4. T–48h is not scheduled

`vercel.json` is `{}`. No cron entry for `/api/cron/close-auctions`.

Winners are marked `won` only if someone hits the event page, a bid is attempted after close, or an external cron calls the endpoint with `CRON_SECRET`.

Loser rows at close are set `failed`, not `refunded`, and are not Polar-refunded. Usually only one `held` remains after outbid; leftover multi-held is a hole.

Athlete timezone is not stored. Close uses `events.date` as timestamptz from `datetime-local` → UTC. “Athlete timezone” in `rules.md` is not implemented.

### 5. Polar webhook skips category lock

Bid POST checks `categoryHoldsOtherZone`. `app/api/webhooks/polar/route.ts` `holdPaidBid` does **not**. Two Drink brands can pay two zones; the second webhook can still hold.

### 6. Capture vs `rules.md` / capture spec

| Spec | Code |
|---|---|
| 150–300 photos or 60–90s orbit **required** to send us a body | Capture is **optional**. Empty orbit + empty name clip is allowed; event is created as draft |
| Photo count 150–300 | Not checked. Any number of images passes |
| 10s name clip (stolen-scan proof) | Optional. Not a publish gate |
| No video → profile does not go live | `/a/[handle]` exists with no verification video. Live event only needs GLB |
| We reconstruct the mesh | Copy says “We build the GLB.” No photogrammetry job. Status stays `uploaded` |
| Athlete does not export GLB | Optional GLB on `/new` **does** set `avatars.ready` and can publish |

Optional GLB is useful for Marc-style handmade files. It contradicts “they do not export GLB themselves” if that is the only path.

### 7. Age 18+

Client-only on onboarding (`isAdult`). **Not stored.** A logged-in user can upsert `profiles` via RLS and skip the form.

### 8. Brand must-haves

| Must have | Code |
|---|---|
| Logo PNG/SVG | PNG optional. No SVG. `brandOnboardingComplete` does not require logo |
| One line: who they are | **Missing** field |
| Website, name, email | Name + website yes. Email is Auth only |

### 9. Waitlist fields (`rules.md` “stay”)

| Role | Spec | `/waitlist` form |
|---|---|---|
| Athlete | email, event name, event date, social | name, email, social, **sport**. No event name/date |
| Brand | email, website, budget | name, email, social. No website, no budget |

Landing `/` has no waitlist fields (lock). Drift is on `/waitlist`, not `/`.

### 10. Terms vs cancel implementation

Terms promise refund-on-cancel before close. Product blocks cancel after any held/won bid. Pick one and make both match.

### 11. Likeness price

Column `appearance_price_cents` exists. `/new` sends likeness yes/no only. Spec: opt-in is not free; no price agreed → no reuse. No price field, no brand-side agreement.

### 12. Dodo leftover vs Polar

Bid checkout is Polar. `lib/dodo.ts` and `POST /api/webhooks/dodo` still exist. Polar hold also writes `dodo_payment_id` / `dodo_checkout_id`. Confusing and a second hold path if Dodo keys are set.

### 13. Music / tattoo vs sticker / max cm

Rules: music after avatar works (default muted). Not built — acceptable defer.  
Tattoo vs sticker, post rules, max cm per zone: unwritten in product. Rules flag max cm as still unwritten.

---

## Missing routes or fields

### Routes that exist (product)

`/`, `/waitlist`, `/events`, `/e/[slug]`, `/e/demo`, `/a/[handle]`, `/login`, `/onboarding`, `/new`, `/me`, `/proof/[id]`, `/admin`, `/outreach`, `/terms`, `/privacy`, `/about`, `/contact`, `/inbox`

APIs: `/api/events`, `/api/events/cancel`, `/api/zones`, `/api/bids`, `/api/bids/logo`, `/api/proofs`, `/api/admin`, `/api/admin/glb`, `/api/outreach`, `/api/waitlist`, `/api/webhooks/polar`, `/api/webhooks/dodo`, `/api/cron/close-auctions`

### Missing vs `rules.md`

| Gap | Notes |
|---|---|
| Verification video as publish gate | Name clip is optional capture, not a profile/event gate |
| `profiles.age` / `date_of_birth` | 18+ not persisted |
| Brand tagline | — |
| Required brand logo + SVG | PNG optional only |
| Athlete timezone | — |
| Tattoo vs sticker on bid/win | — |
| Appearance price UI | Column unused by form |
| Proof due (48h after event) | No deadline, no `done` status writer |
| Review SLA (48h after proof) | Admin queue only |
| Ledger write + PayPal payout | Constants + table only |
| Event `status = done` | Type exists; never written |
| Music picker | Explicitly later |
| In-app chat | Correctly absent |
| `robots.ts` disallow `/inbox` | Inbox is crawlable |
| Unique `handle` column | `/a/[handle]` is derived from social/name; collisions possible |

`WAITLIST_ONLY` hide-list misses `/terms`, `/privacy`, `/inbox`, and APIs `proofs`, `zones`, `webhooks`, `cron`. Fine while `WAITLIST_ONLY=false`.

---

## Dangerous bugs

### P0 — Bid held without payment

Empty `POLAR_ACCESS_TOKEN` → `held` with no charge. Occupies the slot, emails “placed a bid”, blocks athlete cancel. Public contradiction of “brand pays SkinBid.”

### P0 — RLS bid insert bypasses the API

`bids_insert_brand`: `brand_id = auth.uid()` only. No role check, no live-event check, no Polar, no floor increment, no category lock, no T–48h.

Any logged-in user (including an athlete) can insert `status: 'held'` on a **draft** zone through the anon client. API is not the only writer.

No unique “one held per zone” index. Multiple `held` rows are possible.

### P0 — Waitlist inbox cookie is not a secret

`/inbox` on Vercel opens if cookie `waitlist_inbox=1` (`lib/waitlist-inbox.ts`). Password form sets that literal value. Anyone can set the cookie and read waitlist emails (name, email, social).

Locally (`!VERCEL`) the list is open with no password.

### P0 — Public PayPal emails

`profiles_select` is `using (true)` for anon. `payout_account` is on that row. Anyone can read athlete PayPal addresses.

### P1 — Polar on, still unpaid holes

- Webhook does not re-check category lock.
- Proof reject does not refund Polar.
- Close-auction leftovers marked `failed` without refund.
- Athlete `uploadGlb` does not check GLB magic bytes (admin UI does). A renamed file can set `ready` and publish a broken live event.

### P1 — T–48h without cron

No `vercel.json` cron. Unvisited live events stay `live` past close until a request hits close logic. Slot can still look open in listings.

### P1 — Age / role RLS

- `events_insert_athlete` does not require `profiles.role = athlete`. A brand account can insert events as `athlete_id = self`.
- `avatars_own_write` lets the athlete set `ready` without going through `/api/admin/glb`.
- Age not in DB.

### P2 — Demo

Demo does **not** write bids. API and UI both refuse. Not a demo-writes-bids bug.

### P2 — Dodo webhook

If `DODO_PAYMENTS_WEBHOOK_KEY` is set, `payment.succeeded` can mark a bid `held` without the Polar path. Dead code that still writes money-status.

### Draft listed?

**No** on `/events`, sitemap, or `/e/[slug]`. Matches publish rules.

RLS still lets the owner `select` their draft; the page 404s anyway.

---

## Env keys expected vs used

From `.env.example` and `process.env` in app code (not `node_modules`).

| Key | Example | Used? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | yes | `lib/config.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | yes | alias |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | yes | admin client; bidding 503s without it |
| `SUPABASE_SECRET_KEY` | yes | yes | alias |
| `WAITLIST_ONLY` | yes (`false`) | yes | `proxy.ts` |
| `POLAR_ACCESS_TOKEN` | yes (empty) | yes | **empty = free held bids** |
| `POLAR_WEBHOOK_SECRET` | yes | yes | |
| `POLAR_PRODUCT_ID` | yes | yes | optional; auto-creates product |
| `DODO_PAYMENTS_API_KEY` | yes | yes | leftover refund helper, unused by Bid POST |
| `DODO_PAYMENTS_WEBHOOK_KEY` | yes | yes | leftover webhook |
| `DODO_PAYMENTS_ENV` / `ENVIRONMENT` | yes | yes | leftover |
| `DODO_BID_PRODUCT_ID` | yes | **never read** | dead |
| `RESEND_API_KEY` | yes | yes | missing → log, no crash |
| `RESEND_FROM` | yes | yes | |
| `ADMIN_EMAILS` | yes | yes | empty list = no admins (safe) |
| `CRON_SECRET` | yes | yes | cron auth; also inbox password fallback |
| `WAITLIST_INBOX_KEY` | yes | yes | |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | commented | yes | `app/layout.tsx` |
| `SUPABASE_URL` | no | yes | server alias |
| `SUPABASE_ANON_KEY` | no | yes | server alias |
| `VERCEL` | no (platform) | yes | waitlist + inbox behavior |
| `STRIPE_*` | — | none | |
| PayPal API | — | none | email field only |

---

## Ordered fix list

### P0 — money and secrets

1. **Refuse held without payment.** If Polar is off, do not insert `held`. Keep the page up; keep Bid disabled or pending-only. Remove the fallback in `app/api/bids/route.ts` (~lines 209–261).
2. **Tighten `bids` RLS.** Insert only if `profiles.role = brand`, event is `live`, zone is `open`, and preferably only `pending` (service role promotes to `held` after webhook). Add a partial unique index: one `held|won` per `zone_id`.
3. **Sign the inbox cookie** (or session). Stop treating `waitlist_inbox=1` as auth. Do not fall back to `CRON_SECRET` as the inbox password on a public URL.
4. **Stop selecting `payout_account` for anon.** Column grant / view without payout fields for `profiles_select`.
5. **Proof reject must Polar-refund** winning `held|won` bids. Same for a real cancel-with-refund path if you keep the terms sentence.

### P1 — auction correctness

6. Re-run category lock inside Polar `holdPaidBid`. Refund and fail if locked.
7. Schedule `GET/POST /api/cron/close-auctions` (Vercel cron) with a real `CRON_SECRET`. At close, refund any extra `held` (not only mark `failed`).
8. Write ledger 80/20 on approve; set `payable`; define the manual PayPal step if automation is later. Do not tell terms “athlete gets 80%” until this exists.
9. Persist 18+ (`age` or `born_on`) and check it server-side on onboarding upsert. RLS: events insert requires athlete role.
10. Require Polar webhook secret in prod; delete or hard-disable `/api/webhooks/dodo` and `DODO_BID_PRODUCT_ID`.
11. Magic-byte check on athlete `uploadGlb`, same as admin.

### P2 — spec gaps (after money is real)

12. Capture: either require orbit + name clip before draft, or change copy so skip is allowed. Enforce 150–300 stills when photos are used.
13. Verification video required before `/a/[handle]` is “live” / before publish — or strike that sentence from `rules.md`.
14. Brand: required logo (PNG, SVG later), required one-line bio.
15. Waitlist fields: athlete event name + date; brand website + budget — **on `/waitlist` only**, not `/`.
16. Appearance price when likeness = yes. Hide reuse if price is null.
17. Align cancel: either refund-and-cancel before T–48h (rules + terms) or change terms to “cancel blocked after a bid.”
18. Store athlete timezone; close T–48h in that zone.
19. Proof: bind files to zone; enforce 2 mark + 1 venue; due 48h after event; then `done`.
20. Unique athlete `handle`. Disallow `/inbox` in `robots.ts`.
21. Add `capture.md`, `pages.md`, `qa.md`, `landing-lock.md` to the repo so the next audit is not guessing.

### Do not

- Edit `app/page.tsx`, `components/landing/**`, or `:root`.
- Restyle product to “fix” this list.
- Treat Polar-off held bids as a feature.

---

## QA checklist (from missing `qa.md`)

| Check | Result |
|---|---|
| Draft not on `/events` | Pass |
| `/e/[slug]` draft 404, even owner | Pass |
| `placeholder.glb` only `/e/demo` | Pass |
| Demo does not write bids | Pass |
| Landing / `:root` / landing components untouched vs `origin/main` | Pass (`app/page.tsx`, `components/landing`; `:root` not restyled) |
| Payout rail PayPal-only | Pass (field). Fail (no payout) |
| Bid requires payment | **Fail** if Polar token empty |
| 12 L/R zones | Pass |
| T–48h | Pass (math). Fail (no cron) |
| 80/20 | Fail (copy/constants only) |
| No chat | Pass |
| 18+ | Fail (not stored) |
| Verification video | Fail (not required) |

**Bottom line:** publish/draft/GLB and the 12-zone auction shell match the lock. Money does not: a bid can be `held` with $0, 80/20 never runs, and RLS plus `/inbox` leak data. Fix payment + RLS before the first real brand.
