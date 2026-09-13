# SkinBid security audit

Date: 12 Sep 2026. Scope: product code and `supabase/schema.sql`. Landing was not edited. No restyle. No new features.

Re-run `supabase/schema.sql` in the Supabase SQL editor after pulling this. RLS and column grants in the repo do nothing until they are applied.

## What this pass changed

| Item | Change |
| --- | --- |
| Unpaid `held` bids in production | `app/api/bids/route.ts` returns **503** when Polar is unset and `NODE_ENV=production`. Local `next dev` can still insert held. |
| Unauthenticated / client bid writes | `supabase/schema.sql` **revokes insert/update/delete** on `bids` from `anon` and `authenticated`. Only the service role (API + webhooks) writes bids. |
| Client service-role helper | Removed `getSupabaseServiceKey()` from `lib/supabase/env.ts` (that file is imported by the browser client). Service role stays in `lib/supabase/admin.ts`. |
| Public PayPal | Column revoke now includes `public` as well as `anon` / `authenticated` (`supabase/schema.sql`). PayPal lives on `athlete_payouts`, own-row only. |
| Anon DOB | `revoke select (dob, age)` from `anon` in `supabase/schema.sql`. Logged-in users can still `select dob` on other rows (P1). |
| Proof path bind | `app/api/proofs/route.ts` accepts only `{userId}/{eventId}/{zone-1\|zone-2\|venue}.{jpg\|jpeg\|png\|webp}`. |
| Outreach flood | `app/api/outreach/route.ts` rate-limits 8 POSTs / 10 min / user. |
| Open redirect | `lib/launch.ts` `safeNextPath` also rejects `\`. |

---

## P0

### 1. Unpaid `held` bids when Polar is off — **fixed in production**

`POST /api/bids` used the service role to insert `status: held` when `POLAR_ACCESS_TOKEN` was empty (`app/api/bids/route.ts`). An authenticated brand could win a zone with no checkout.

Now production returns 503 unless Polar is configured. Dev still allows unpaid held for local testing.

**Apply:** set `POLAR_ACCESS_TOKEN` + `POLAR_WEBHOOK_SECRET` on Vercel. Do not ship `WAITLIST_ONLY=false` without Polar.

### 2. Unauthenticated bid insert — **API already blocked; RLS hardened**

| Path | Result |
| --- | --- |
| `POST /api/bids` with no session | 401 `Log in as a brand.` (`app/api/bids/route.ts`) |
| Demo slug / `demo-` zone ids | 400, GET returns `[]` |
| Draft events | API requires `status = live` + ready GLB |
| Direct Supabase insert as `anon` | Policy is `to authenticated`; grants now **revoke insert** from `anon` |

A logged-in completed brand could previously insert `pending` rows via the JS client and skip the API rate limit. Insert is now revoked from `authenticated` too. Re-run schema.sql.

### 3. Public PayPal — **schema already isolated; revoke tightened**

| Who | PayPal (`payout_account`) |
| --- | --- |
| Anon | No. Column revoke on `profiles`; `athlete_payouts` revoke all from `anon`. |
| Other users | No. `athlete_payouts_own` is `athlete_id = auth.uid()`. |
| Owner | Yes, own row (`lib/payout.ts`, onboarding). |
| Admin UI | Does not load PayPal. |
| App listings | `lib/public-listings.ts` selects `name, country, social` only. |

If production was never migrated, old `profiles.payout_account` may still be selectable. **Run schema.sql.** Then confirm in SQL:

```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'profiles' and column_name in ('payout_account', 'payout_rail');
```

Expect no `anon` / `authenticated` / `public` select.

### 4. Service role in the client bundle — **not present; helper removed**

| File | Key |
| --- | --- |
| `lib/supabase/client.ts` | Anon / publishable only |
| `lib/supabase/env.ts` | URL + anon. **No service-role reader.** |
| `lib/supabase/admin.ts` | Service role. Server-only. |
| `lib/supabase/server.ts` | Anon + cookies |

Next.js does not inline `SUPABASE_SERVICE_ROLE_KEY` into client bundles (no `NEXT_PUBLIC_` prefix). `.env.example` uses placeholders. `.env.local` is gitignored and **not tracked**. Keep it that way. If that file was ever committed or pasted, rotate the service role key in Supabase.

### 5. Proof storage path bind — **fixed**

`POST /api/proofs` previously stored whatever strings the client sent. An athlete could attach another user’s `{uid}/{eventId}/zone-1.jpg` and admin signed URLs would show the wrong photos (`app/admin/page.tsx`).

The route now requires the caller’s uid, the owned event id, and the three slot names.

---

## Checklist

### RLS (as in `supabase/schema.sql`)

| Table | Select | Insert / update | Notes |
| --- | --- | --- | --- |
| **profiles** | All rows (`using (true)`). Anon cannot select `dob`/`age` after this pass. `payout_*` revoked. | Own row | DOB still readable by any logged-in user. |
| **athlete_payouts** | Own row | Own row | PayPal. Anon revoked. |
| **events** | Non-draft, or own draft | `athlete_id = auth.uid()` | No `role = athlete` check (P1). |
| **zones** | All | Event owner | Same role gap. |
| **bids** | All | **Revoked** from anon/authenticated | Service role only. Policy `bids_insert_brand` kept as belt-and-suspenders. |
| **proofs** | Event athlete | Event athlete | Path check is in the API, not RLS. |
| **captures** | Own | Own | |
| **avatars** | All | Own `athlete_id` | Client can set any `glb_url` string (P1). |
| **waitlist** | No select policy (deny) | Public insert | Inbox uses service role. |
| **ledger** / **email_sends** | No client policies | Service role | |

### Storage buckets (`supabase/schema.sql`)

| Bucket | Public | Write | Read |
| --- | --- | --- | --- |
| `captures` | no | First folder = `auth.uid()` | Own folder |
| `proofs` | no | Same | Own folder |
| `avatars` | yes | Same | Anyone |
| `logos` | yes | Same | Anyone |

Path traversal on objects is limited by `(storage.foldername(name))[1] = auth.uid()::text`. `../` does not become another user’s prefix.

### Who can read PayPal / DOB / email

| Field | Anon | Other users | Owner | Admin |
| --- | --- | --- | --- | --- |
| PayPal | No (after schema apply) | No | Yes (`athlete_payouts`) | Service role could; UI does not |
| DOB / age | No (after schema apply) | **Yes if logged in** (`profiles_select`) | Yes | Service role |
| Auth email | No (not on `profiles`) | No | Own session (`getSessionUser`) | `/inbox` waitlist emails; Resend lookups in `lib/email.ts` |

### Who can insert/update bids (drafts + demo)

- **Anon:** no (API 401 + revoke insert).
- **Athlete:** API 403 `Only brands bid.`
- **Incomplete brand:** API 403.
- **Completed brand:** `POST /api/bids` only. Production needs Polar checkout; webhook sets `held`.
- **Draft event:** API 400 `Event is not live.`
- **Demo:** slug `DEMO_SLUG` and `demo-` / `missing-` zone ids rejected (`app/api/bids/route.ts`, `lib/demo-event.ts`, `lib/zone-bids.ts`).
- **Client JS insert:** revoked after schema apply.
- **Updates to held/won/refunded:** no authenticated update policy; webhooks + `lib/close-auctions.ts` use admin.

### Admin routes gated by `ADMIN_EMAILS`

| Surface | Gate |
| --- | --- |
| `app/admin/page.tsx` | `isAdminEmail(user.email)` else `/events` |
| `app/api/admin/route.ts` | 403 `Admin only.` |
| `app/api/admin/glb/route.ts` | 403 |
| `app/inbox/page.tsx` | same as admin |

`lib/auth.ts` `isAdminEmail` is an exact match on the comma-separated env list. Empty list → nobody is admin (fail closed). Emails are not a UI toggle.

### `/auth/callback` open redirect (`?next=`, `?role=`)

`app/auth/callback/route.ts` uses `safeReturnPath` then `new URL(destination, requestUrl.origin)`.

`lib/launch.ts` `safeNextPath`: must start with `/`, not `//`, no `://`, no `\`. `safeReturnPath` also blocks `/`, `/login`, `/signup`, `/auth/callback`, and `error=` in the query.

`?role=` is `parseRole` in `lib/config.ts` (`athlete` \| `brand` only). It does not grant admin.

Logged-in `/login?next=` goes through `destinationAfterAuth` → same sanitizer.

### Google OAuth state / PKCE / localhost vs 127.0.0.1

`lib/auth-client.ts` `signInWithOAuth` uses the Supabase JS client (PKCE + state are library-managed). `redirectTo` is same-origin `/auth/callback`.

`isBadOAuthState` in `lib/launch.ts` fails closed to `/login?error=signin`.

Mixing `http://localhost:3000` and `http://127.0.0.1:3000` breaks cookies / `bad_oauth_state`. It is not a privilege bypass. Add **both** to Supabase Auth URL config (see `.env.example`). Do not mix them in one session.

### File upload: type, size, path

| Upload | Type | Size | Path |
| --- | --- | --- | --- |
| GLB admin | `.glb` name + magic `glTF` in `app/admin/AdminBoard.tsx`; `lib/glb.ts` | 80 MB | `{athleteId}/avatar.glb` only (`avatarGlbPath`) |
| GLB athlete | Name/size in `lib/event-form.ts`; **no magic check** | 80 MB | Same fixed path |
| Proof photos | Client `image/*` + 12 MB (`app/proof/[id]/ProofForm.tsx`). API path allow-list. **No magic bytes on the server.** | 12 MB | `{uid}/{eventId}/zone-1\|zone-2\|venue.ext` |
| Logos | PNG signature + 2 MB (`app/api/bids/logo/route.ts`) | 2 MB | `{brandId}/logo.png` |
| Captures | Client video/image + size (`lib/capture.ts`) | 512 / 20 / 80 MB | `{uid}/{captureId}/…` |

### Webhooks Polar / Resend

| Endpoint | Signature |
| --- | --- |
| `app/api/webhooks/polar/route.ts` | `parsePolarWebhook` requires `POLAR_WEBHOOK_SECRET`; invalid → 401 (`lib/polar.ts`) |
| `app/api/webhooks/dodo/route.ts` | `standardwebhooks` verify; missing key → 401. **Weaker hold path** (no live/open/amount checks). |
| Resend | Outbound only (`lib/email.ts`). No inbound webhook to verify. |

Cron: `app/api/cron/close-auctions/route.ts` requires `CRON_SECRET`. Empty secret → 401. Do not leave `.env.example`’s `change-me` in production.

### Secrets in repo or client

- Tracked: `.env.example` placeholders only.
- Gitignored: `.env*` except `.env.example` (`.gitignore`).
- Client: `NEXT_PUBLIC_SUPABASE_*` (anon) and `NEXT_PUBLIC_SITE_URL` / Plausible domain. Expected.
- Do not put `SUPABASE_SERVICE_ROLE_KEY`, Polar, Resend, or `ADMIN_EMAILS` on `NEXT_PUBLIC_*`.

### XSS (names, handles, event copy)

User strings render as React text (`app/a/[handle]/page.tsx`, event pages). `components/seo/JsonLd.tsx` escapes `<` in JSON-LD. Outreach HTML escapes `&` and `<` (`app/api/outreach/route.ts`, `lib/email.ts`).

`lib/handle.ts` `socialLink` only emits `http(s):` hrefs. `javascript:` does not match. A stored `https://evil.com` social URL is a phishing link, not DOM XSS.

Handles are stripped to `[a-z0-9._]` (`normalizeHandle`).

### CSRF on cookie auth

State-changing routes are **POST** (bids, profile, proofs, admin, outreach, waitlist, logos). Session cookies come from `@supabase/ssr` (default **SameSite=Lax**). Cross-site credentialed POST from a random origin should not send the cookie. No custom CSRF token.

### Rate limits

| Route | Limit |
| --- | --- |
| `POST /api/bids` | 20 / 10 min / user |
| `POST /api/profile` | 20 / 10 min / user |
| `POST /api/outreach` | 8 / 10 min / user (this pass) |
| `POST /api/waitlist` | IP-based (`lib/config.ts`) |
| `POST /api/bids/logo` | 12 / 10 min |
| Login / signup | **None in app.** Relies on Supabase Auth throttling. |
| `lib/rate-limit.ts` | In-memory per instance. Not global on Vercel. |

### `/inbox` or waitlist cookie bypass

**None.** `app/inbox/page.tsx` requires a logged-in `ADMIN_EMAILS` user. Waitlist has no select policy. `WAITLIST_INBOX_KEY` cookie unlock is gone.

`supabase/waitlist-rls.sql` is insert-only for anon. Do not use that file as a waitlist reader; use `/inbox`.

---

## P1 (not fixed this pass)

1. **Authenticated DOB dump.** `profiles_select` is `using (true)`. Any logged-in client can `select dob, age, name`. Fix: public view without dob, own-row select on `profiles`.
2. **Event/zone/avatar RLS has no `role = athlete`.** A brand can insert an event as `athlete_id = auth.uid()` via the JS client. APIs check role; RLS does not.
3. **Athlete can set `avatars.glb_url` to any URL** (`lib/event-form.ts` / client upsert) and mark `ready`.
4. **Dodo webhook** holds bids from metadata without Polar’s live/open/amount checks (`app/api/webhooks/dodo/route.ts`). Disable Dodo in production.
5. **Admin proof reject** marks bids `refunded` in the DB only (`app/api/admin/route.ts`). Polar charges are not refunded there.
6. **Public bid log** includes `pending` (`lib/zone-bids.ts` `loadLastZoneBids`).
7. **GLB athlete upload** has no magic-byte check (admin UI does).
8. **Proof / capture MIME** is client-trusted aside from logo PNG bytes.

## P2

- Login has no app-level rate limit.
- Rate limiter is per server instance.
- Polar client is hardcoded `server: "sandbox"` (`lib/polar.ts`) — confirm before live money.
- `CRON_SECRET=change-me` in `.env.example` must be replaced.
- `socialLink` allows any `https://` host.
- Athlete GLB / capture type checks are client-side.

---

## Verify after apply

1. Paste the updated `supabase/schema.sql` in Supabase SQL editor → Run.
2. As anon, `select payout_account from profiles` and `select * from athlete_payouts` must fail.
3. As anon, `select dob from profiles` must fail.
4. As anon, `insert into bids` must fail.
5. Production: `POST /api/bids` without Polar → 503.
6. Production: logged-out `POST /api/bids` → 401.
7. Non-admin `/admin` and `/inbox` → redirect to `/events` or `/login`.
8. `/auth/callback?next=https://evil.com` → same-origin login/onboarding, not evil.com.
