# Skinbid — launch audit

Updated 15 September 2026. This is the current assessment; PRODUCT-REDESIGN.md records earlier iterations, including a now-superseded light theme.

## Decision

**Not ready for a public, paid launch.** The local product UI and media implementation are substantially improved, but the new media database/storage migration is not installed and production deployment, real OAuth, real AI output and payment lifecycle are not release-verified. A successful build is not proof that those services work.

## Requirements from the conversation

| Request | Current implementation | Remaining acceptance check |
| --- | --- | --- |
| Landing and app should feel like one brand | Product uses charcoal surfaces, lime actions, mint support tones and the existing condensed Skinbid wordmark; landing preserved | Compare both on the same production deployment, including login and onboarding |
| Dark mode | Scoped dark product palette, inputs, navigation, calendar, profile and placement controls | Authenticated screenshots across athlete and brand accounts; contrast/accessibility pass on every state |
| Fix returning to old landing after Google login | Root `?code=` / `?token_hash=` is forwarded to `/auth/callback` before landing/session logic; local origins are preserved | Supabase callback allowlist and real round trip on localhost and production. A callback on a different origin cannot recover another origin's PKCE verifier |
| Avatar at the top of athlete account | Profile identity and avatar precede the setup sections | Real avatar upload and refresh; no forced overwrite of existing user portraits |
| Front and back side by side below identity | One full-width placement workspace, paired uncropped images and separate inspector | Authenticated save/reload and public rendering of the same geometry |
| Athlete positions placements manually | Named dropdown, click/draw, drag, resize, keyboard nudges and percentage controls; explicit save/discard | Real persisted save; active-bid locking and concurrent checkout need database tests |
| Wrong leg/chest placements | No inferred purchasable positions; actual saved coordinates and correct photo side are used | Athlete must correct any old inaccurate coordinates. Do not silently move a paid sponsor |
| Remove shoulders | Hidden from editor/public photo placements and rejected by relevant placement/bid guards | Review legacy inventory; records and existing payments were not deleted |
| Black and white patches | Empty placement overlays have one translucent selected-state treatment | Baked-in patches in old source images cannot be removed by CSS. Upload clean originals; real logos retain their own colors |
| Two clear photos and introduction video | Private original uploads, front/back and video cards, ownership/processing/public-video consent, upload limits and previews | Install storage/schema, then test actual uploads and refresh on an athlete account |
| Consistent AI imagery | OpenRouter image API with pinned Google image model; fixed studio specification, 2:3 output, exact 1024×1536 JPEG, front used as back's style reference | Test real athlete inputs for identity, clothing, body scale and background consistency; prompts cannot guarantee identical results |
| Review before publication | Original/candidate comparisons, explicit approval; generation never directly publishes | Real approval transaction, active-race rejection and placement reset |
| Video proves it is the athlete | Public introduction video lets brands compare the real person | No automated identity-verification claim or badge. Add owner-facing hide/delete controls and retention policy before public uploads |
| Better status/copy | “Almost done”, clearer next actions, placement availability controls and upload/review guidance | Full notification/email/error-copy review remains; not every legacy string was rewritten |
| Better athlete cards, remove Abs $300 | Discovery focuses on portrait, athlete, race and CTA; bid amounts remain in actual bidding | Validate all live inventory/price sources against the database |
| Restore events | Existing official event catalogue alongside live sponsorship races | Curate test-named records and confirm live dates/registration details; no test data deleted |
| Guide each account | Athlete and brand next-step guides | Run both from brand-new profiles and ensure each step leads to the correct screen |
| Brand → event → athlete → placement → paid bid → logo | Existing checkout/return/logo flow retained with configured placements | End-to-end Whop sandbox test, webhook replay, loser refund, winner/logo authorization and proof flow |
| 3D and mobile later | Photo-first browser experience; mobile app not changed | Audit remaining legacy 3D payment/API entry points before declaring 3D fully unavailable |

## What was checked

- OpenRouter key added only to ignored `.env.local`; read-only `/api/v1/key` returned HTTP 200. No credential printed. This does **not** prove available balance or a successful paid image request. No key was added to Vercel.
- `node scripts/check-launch-flows.cjs`: passed offline API contracts for authentication, role, origin, consent, absent key, upload type/path ownership, duplicate claim, two sequential image requests, partial failure and approval separation. Provider/database are mocked. SQL checks are static only.
- `node scripts/check-photo-placements.cjs`: passed manual geometry, no automatic slots, side mapping, hidden shoulders and closed slots.
- `npx tsc --noEmit`: passed after the OpenRouter switch.
- Final `npm run build`: passed after removing the temporary fixture, including TypeScript and 59 generated route outputs. `/design-preview` is not in the build.
- Targeted ESLint on media API/helpers, editor, media setup and account page: zero errors, three image-optimization warnings. Whole-repository lint was not made clean.
- Local browser: dark `/events` rendered without horizontal overflow or a framework error overlay. Placement fixture displayed both views side by side, cached image overlays loaded, arrow-key movement changed horizontal position from 44% to 44.5%, and unsaved changes disabled switching placements. An unauthenticated save was rejected while retaining the draft. This was a local fixture, not a saved real athlete edit.
- No real user photos were sent to the image provider during tests. No payment was made. No production deployment, migration or catalogue deletion was performed.

## Blockers, in release order

### 1. Apply and verify the Supabase migration

Run `supabase/athlete-media.sql` after the base schema and `supabase/athlete-zone-rects.sql`, using authorized SQL access. Read-only checks found `athlete_media` and `athlete_media_jobs` missing (PGRST205), and private buckets `athlete-media` and `athlete-videos` absent. Having a service-role REST key does not itself provide SQL execution access.

The migration includes owner-read RLS, server-only mutations, private buckets, signed-upload architecture, row-locked job claims, two preparations per athlete per 24 hours, approval/reset transaction and paid-placement geometry locks. Exercise those functions and triggers on staging, including concurrent bid/position changes, before production. Do not infer installed schema from successful HEAD requests.

### 2. Deploy the same version and configure production

- Set `OPENROUTER_API_KEY` server-side on Vercel. Never use a `NEXT_PUBLIC_` prefix. The current local key was exposed in chat; rotate it before production use.
- Ensure Supabase server/public URLs and keys point to the same intended project; service-role key remains server-only. Public browser variables must exist in Production before the build, not only Preview.
- `WAITLIST_ONLY` must be unset or `false` for the product launch.
- Set the production site origin to `https://www.skinbid.me`; verify Supabase Site URL and allowlist exact `/auth/callback` URLs for production and local development. Do not rely on cross-origin fallback to Site URL.
- Inspect Vercel production alias/deployment and compare landing → login → `/me`. These local changes have not been deployed.
- Production Whop, webhook, cron and email credentials/delivery have not been verified. A list of environment variable names is not proof that the integration works.
- Local presence-only checks found `WHOP_WEBHOOK_SECRET`, `CRON_SECRET` and `RESEND_API_KEY` absent. No database connection URL, Supabase access token or database password was configured locally, so the migration cannot be executed through the available local SQL credentials. This says nothing about whether those settings exist on Vercel.

### 3. Run two real account journeys

Athlete: Google sign-in → athlete profile/avatar → two full-body originals + 5–60 second introduction → explicit consent → generate → inspect both candidates → approve → manually place front/back slots → save/reload → choose race → publish → inspect public profile as a different visitor.

Brand: Google sign-in → brand profile → event → athlete → actual configured placement → checkout → webhook-confirmed paid bid → leave/reopen → correct leading/winning status → authorized logo upload → accurate placement preview. Also test declined checkout, duplicate callback/webhook, auction closure, losing-bid refund and race-day proof review.

Important product distinction: **paying to place a bid is not winning the auction**. Winner messaging and logo eligibility must agree with the chosen auction rules. Do not launch with one screen promising a win while another still accepts higher bids.

### 4. Close operational gaps

- `after()` has a 300-second route budget but is not a durable queue. Jobs are persisted, requests are not automatically retried, and interrupted work becomes retryable after six minutes. Confirm this fits the deployed plan; add durable execution before scaling. Provider usage/cost is saved when returned.
- Video duration is validated in the browser, while server checks size and file headers; this is not server-side media decoding or identity verification. Add abuse moderation, owner hide/delete UI, deletion/retention procedures and accurate privacy disclosures for OpenRouter/Google processing.
- Approval resets placement geometry; it is explicitly consented and blocked during live/closed races. Original files and prior generation records remain stored. Define a safe retention/cleanup process before accumulating uploads.
- Auction-closing cron is currently scheduled once daily (`0 5 * * *`). Confirm settlement timing against the advertised auction deadline and test missing/late cron execution; change the schedule only with hosting-plan compatibility checked.
- Remove or hide test catalogue entries after confirming exact records with the founder. Keep legitimate athletes/events and financial records intact.
- Verify race cancellation/refunds, support contact, privacy/terms, notification delivery and admin proof review with actual accounts. Their existence in source is not release verification.

## AI implementation reference

Direct REST integration uses OpenRouter's [Image API documentation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation): pinned `google/gemini-3.1-flash-image`, Google AI Studio provider without fallback, input image references and returned base64 output. Each original stays private; the second request references the generated front of the same athlete. Canonical resizing pads rather than crops/stretches. The fixed prompt is versioned as `skinbid-studio-v2`. Identity/body preservation still requires human review.

## Release gate

Launch only after migration checks pass, the intended build is deployed, both authenticated journeys pass, one real consented photo pair is approved without identity changes, and the payment/refund/webhook lifecycle is proven in the payment provider's test setup. Until then this is a local implementation, not a production-ready marketplace.
