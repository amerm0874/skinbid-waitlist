# HANDOFF — Cursor UI polish → Codex

For Codex. Continue from a clean `main` with zero extra context. Do not push unless asked. This work did **not** use branch `cursor/ui-polish`; the user later ordered all UI work on `main`.

## 1. Branch and commits

**Branch:** `main` (ahead of `origin/main`; **not pushed**)

| Hash | Description |
|---|---|
| `c9064ea1ce905f2d038627a5ba4c0ddc7d0d758b` | `wip(codex): checkpoint before cursor ui work` — your unfinished tree (API, lib, supabase, mobile, product UI, Playwright PNGs). |
| `d3979c1bd53ae7c8be96f31adb4894b56c593de0` | `ui: raise product contrast, match landing wordmark, and fix mobile overflow` |
| `29be3201da9b4fabbeea3c796156a044b3662e9e` | `ui: polish athlete discovery cards without prices` |
| `758319b41356591bc176b988385e308ca17e0f64` | `ui: clarify athlete and brand next-step guides` |
| `d449d9f525cbb91b920d1e64bff31135f2fde1c6` | `copy: rewrite product empty, bid, and proof strings` |
| *(this file)* | `ui: add Codex HANDOFF` |

Checkpoint scan before that commit:

- `.env*` is gitignored (`.gitignore` `.env*` + `!.env.example`). `.env.local` and `mobile/.env` stay ignored.
- No real `sk-`, `whsec_`, `eyJhbGci…` JWTs, or service-role **values** in changed/untracked files. `service_role` hits are SQL role names / env var *names* / placeholders.
- Untracked files over 5 MB: **none**. Largest untracked was ~0.51 MB.

## 2. Files this UI pass changed, and why

Only product presentational CSS/copy. No API, lib server, supabase, landing, auth, payments, or package.json.

| File | Why |
|---|---|
| `components/product/product-studio.css` | Dark-mode AA: stronger `--line` via `color-mix` of existing muted+bg; disabled buttons no longer fade below readable contrast; lime focus ring; sport-badge was white-on-white; condensed Bebas `SKINBID` wordmark (tracking `0.06em`, landing radius 4px on actions); portrait discovery cards; overflow-x clip; 768/375 breakpoints. |
| `components/product/profile-studio.css` | Media/placement grids collapse at 768 and 375; error color for `.media-status.is-error`; min-width 0 on cards. |
| `components/product/LiveSlotCard.tsx` | Portrait card content: name, race, city/date, CTA “View athlete”. Sport badge only. **No prices.** |
| `components/product/AccountGuide.tsx` | Hierarchy (number, title, detail, underlined action). **Same hrefs:** `/me#athlete-media`, `/me#placements`, `/new`, `/settings`, `/events`, `/me#account-activity`. |
| `components/product/EmptyState.tsx` | Default link “Browse races”. |
| `components/product/EventsCatalog.tsx` | Search empty/placeholder copy. |
| `components/product/EventStage.tsx` | Display-only: “Leading bid” / “Highest bid” / “Bid placed”. No bid/geometry logic. |
| `components/product/ZoneStatusControls.tsx` | Display-only: “Leading bid” / “Awarded” / “Has a bid”. Toggle/save behavior unchanged. |
| `components/product/AthleteMediaSetup.tsx` | Error class on failure-like status text. Upload/preview flow unchanged. |
| `app/me/page.tsx` | Brand bid labels: held → “Leading bid”, won → “Placement awarded”, refunded → “Outbid”. Empty: “You haven’t placed a bid yet.” |
| `app/a/[handle]/page.tsx` | Empty: “This athlete has no race open for sponsorship.” Video note: Skinbid does **not** verify identity. |
| `app/races/[id]/page.tsx` | Empty CTA “Browse other races”. |
| `app/proof/[id]/page.tsx` | Heading “Race-day proof”. |
| `app/proof/[id]/ProofForm.tsx` | Clearer errors/success. Does not say a brand won a bid. |

## 3. What was verified (exact results)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Exit **0**, no output. |
| `npm run build` | Exit **0**. Next.js 16.3.4 compiled, TypeScript finished, 59/59 pages. |
| `node scripts/check-photo-placements.cjs` | `PASS: manual coordinates, no automatic slots, front/back mapping, shoulders hidden, closed slots hidden.` |
| `node scripts/check-launch-flows.cjs` | `PASS: media auth, role, origin, consent, missing-key, upload validation, ownership, duplicate job, two-photo preparation, partial failure, approval separation and auth callback recovery contracts. SQL assertions are static, not live migration tests.` |
| ESLint on changed TS/TSX only | Exit **0**. **0 errors.** Warnings: `@next/next/no-img-element` in `AthleteMediaSetup.tsx` (lines 99, 112), `app/a/[handle]/page.tsx` (line 118), `LiveSlotCard.tsx` (line 53). CSS files ignored by ESLint. |

Browser (existing `next dev` on `http://localhost:3000`, logged-in brand “jojo”):

- `/events`, `/races/c-hyrox-test-lisbon-2026-09-28`, `/a/mmohamedamerrr`, `/e/demo`, `/me`
- Widths **375** and **768**: `scrollWidth - innerWidth` ≤ 0 (no horizontal overflow). Offenders list empty.
- Wordmark is Bebas Neue condensed `SKINBID`.
- Discovery cards: portrait, name, race, place, “View athlete”, **no price**.
- `/me` brand guide hrefs unchanged. Bid tickets show “Leading bid” / “Outbid”, never “Won” for a held bid.
- Clicked athlete card → `/a/mmohamedamerrr`. Toggled Front/Back on `/e/demo`.

## 4. What was NOT finished, and why

- **`@next/next/no-img-element` in media editor / media setup / account.** Skipped. Previews are signed Supabase/user URLs (and `<img ref>` load detection in `ZoneSlotPlacer.tsx`). Switching to `next/image` needs `remotePatterns` / `unoptimized` and can change cache, object-fit, and onLoad timing. Not purely presentational.
- **Athlete account guide** was restyled in code; live browser session was a **brand** account, so athlete `/me` media+placement studio was not click-tested logged-in as an athlete.
- **`/proof/[id]`** not exercised (needs an athlete event id). Copy-only.
- **`lib/athlete-status.ts`** still has terse athlete CTAs `"Event"` and `"Upload proof."` (lines 49–52, 75). That file is lib/status logic; left for you.
- **`/athletes`** is outside the allowed route list. Cards on it still pick up `LiveSlotCard` CSS/markup. The page chrome was not edited.
- Landing, auth, `/app/api`, `lib/*` server, `supabase/`, payments, OpenRouter, placement save/lock, `package.json` — not touched.

## 5. Needs Codex

1. **Owner video hide exists in API, not in UI.** `app/api/athlete-media/route.ts` lines **60–65** (`action === "remove-video"` sets `video_shared: false`). `components/product/AthleteMediaSetup.tsx` (~lines 96–103) only replace-via-file-input. No hide/delete control. Wire a button if athletes should unpublish intro video without re-upload.
2. **Proof is per event, not per zone.** `app/proof/[id]/ProofForm.tsx` lines **168–169**. Ticket shows event name only. If payout needs zone-level proof, schema + UI.
3. **Inconsistent winner vs bid language (data).** UI now says “Leading bid” for `held` and “Placement awarded” / “Highest bid” for closed/won. Sources still mix `held`/`won`/`occupied`:
   - `app/me/page.tsx` `bidStatusLabel` (~100) and `BRAND_BID_STATUSES`
   - `components/product/ZoneStatusControls.tsx` `leadStatus` (~22, 147–150, 275–285)
   - `components/product/EventStage.tsx` ~334, 397–399, 509–511
   - `lib/athlete-status.ts` `hasWonZone` treats `held` after close as won (~179 in `app/me/page.tsx` caller)
   Confirm when `held` becomes `won` (cron `app/api/cron/close-auctions`) so UI cannot call a live bid a win.
4. **Legacy 3D still in the tree.** `lib/feature-flags.ts` line **9** `SHOW_3D_BODY = false`. `components/product/EventStage.tsx` **689–700** still mounts `EventCage` when true. `components/product/AthleteBody.tsx` lines **5–18** dynamic-imports `components/cage/EventCage.tsx`. `app/me/page.tsx` still branches on `SHOW_3D_BODY` (~525–538). `app/new/NewEventForm.tsx` and `app/api/events/route.ts` also gate on it. Do not delete; just know two stages exist.
5. **Demo `/e/demo` pads vs empty rail.** Browser: lime boxes on the photo, rail copy “No placements are available for this event yet.” (`EventStage.tsx` line **751**). Overlay geometry vs `saleRows` look out of sync for the demo athlete. Check `PUBLIC_BODY` rects vs demo zone rows (`lib/body-photos.ts`, `lib/demo-event.ts`, `lib/athlete-zone-rects.ts`).
6. **`AthleteMediaSetup` configured=false empty.** Line **93** “Photo setup is being connected.” Means `media.configured` is false (likely missing table/env). Confirm `supabase/athlete-media.sql` is applied and `OPENROUTER_API_KEY` only gates generate, not upload.
7. **Mobile app copy still says “Won”.** `mobile/src/app/event/[slug]/index.tsx` ~136 `Pill label="Won"`. Out of web UI scope.
8. **`.playwright-mcp/` is in git** from the checkpoint (~100 PNGs). Consider gitignoring going forward; do not delete Codex evidence without asking.

## 6. Risks (conflict with your backend work)

- **`EventStage.tsx` and `ZoneStatusControls.tsx` are shared.** Only string literals / disabled *labels* changed. `pickZone`, fetch, `leadStatus` comparisons, `occupied` guards are untouched. Re-merge carefully if you still edit those files.
- **`.product .live-body-slot { display: none }`** in `product-studio.css`. If you put prices back on discovery cards, this CSS will hide them. Intentional (product rule: no prices on cards).
- **CSS class names logic may depend on:** `live-body-card`, `account-guide`, `account-guide-action`, `media-status`, `is-error`, `slot-ticket-open.is-held|is-won|is-refunded`, `photo-zone`, `studio-zone-list`, `cta-press`. Do not rename from API/job code.
- **`--radius` on `.product` is 4px** (landing). Cards still 8px. If you assumed 8px everywhere, buttons look tighter.
- **`--line` is `color-mix(in srgb, var(--muted) 42%, var(--bg))`**, not `#30343a`. Contrast only; no JS reads this.
- Checkpoint commit already contains **your** API/lib/sql/mobile. This UI sits on top of that. Rebase/cherry-pick onto another main will conflict on the same product files you had dirty.

## 7. Merge instructions

Nothing was pushed. `main` is locally: `origin/main` → `3eac7ea` then checkpoint `c9064ea` then four UI commits + this HANDOFF.

Files most likely to conflict with your remaining work (they were in your dirty tree **and** this UI pass):

1. `components/product/EventStage.tsx`
2. `components/product/ZoneStatusControls.tsx`
3. `app/me/page.tsx`
4. `app/a/[handle]/page.tsx`
5. `components/product/LiveSlotCard.tsx`
6. `components/product/AccountGuide.tsx`
7. `components/product/AthleteMediaSetup.tsx`
8. `components/product/product-studio.css`
9. `components/product/profile-studio.css`
10. `app/races/[id]/page.tsx`

Lower risk (UI-only, you were less likely to keep editing): `EmptyState.tsx`, `EventsCatalog.tsx`, `ProofForm.tsx`, `app/proof/[id]/page.tsx`.

**Suggested merge:** keep working on `main` from `HEAD`. If you need to split: checkpoint `c9064ea` is your backend WIP; UI is the four `ui:`/`copy:` commits after it. Do not revert the checkpoint. Prefer merging UI CSS by taking **theirs+ours** on `product-studio.css` rather than dropping contrast/`live-body-slot { display: none }`.

Do not `git push --force`. Do not publish events without `avatars.ready` and a real `glb_url`.
