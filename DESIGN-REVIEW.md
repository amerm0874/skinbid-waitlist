# SkinBid design review

Rubric: `.cursor/skills/skinbid-design/SKILL.md` only. Impeccable not in this workspace.

Job: a brand must see a **body** and a **price** in three seconds. SaaS dashboard first = fail.

Pass: first glance is body or zone + number.
Fail: first glance is a lime button, card grid, or marketing copy.

Creative (invent): `/e/[slug]`, `/events` cards, `/a/[handle]` only.
Dead (no invent): `/login` `/onboarding` `/new` `/proof` `/admin` `/me`. Keep `.product` forms.
Landing (`/`): locked. Do not edit `app/page.tsx` or `components/landing/**`.

Method: Playwright against `http://localhost:3000`. Viewport first-glance shots at **390×844** and **1280×800**. Not faked. Logged out.

Blocked this pass (login gate, same form as `/login`):

- `/onboarding` → `/login?next=/onboarding`
- `/new` → `/login?next=/new`
- `/me` → `/login?next=/me`

`/a/[handle]` not walked.

---

## `/` — Locked

**390 first glance:** Wordmark, “I’m an athlete / I’m a brand”, serif headline “Your next race already has ad space.”, two lime CTAs. Body viewer starts at y=906 — below the 844 fold. Sport ticker at the bottom edge.

**1280 first glance:** Same copy, left-aligned, most of the frame empty black. Lime CTAs. Ticker. Body viewer starts at y=800 — exactly the fold. Next.js “1 Issue” badge sits on the ticker.

**Working:** Hero, nav, ticker, and the below-fold 3D section all render.

**Cheap:** First seconds are a press headline, not inventory. Expected for a frozen photo landing.

**One-line fix:** Do not touch.

**3-second:** Fail (marketing copy + CTA). Locked. Not Creative.

---

## `/login` — Dead

**390 first glance:** Product nav (Events · New · Outreach · Log in), “Log in”, muted lead, email, password, full-width lime “Sign in”. Then Create account, Google, magic link. Footer Terms / Privacy.

**1280 first glance:** Same stack, form ~512px on the left, rest of the frame empty black.

**Working:** Fields, Sign in, Google, login link, Create account. Redirects from gated routes keep `?next=`.

**Cheap:** Four logged-out nav items including **Outreach**. Three sign-in paths. Lime “Sign in” is the loudest object.

**One-line fix:** Hide Outreach when logged out; keep one primary Sign in. Do not campaign-theme.

**3-second:** Fail. Correct for Dead.

---

## `/events` — Creative

**390 first glance:** Product nav, 13px muted “Live”, then “No published events yet. Events”. Vast black. Footer.

**1280 first glance:** Same void, wider. Tiny kicker, circular empty line, nothing else.

**Working:** Empty state renders. Demo is correctly **not** on this board (`placeholder.glb` stays on `/e/demo` only). No live events in this environment, so the live ticket row was not on screen.

**Cheap:** EmptyState always links to `/events` — a loop on the events page. “Live” is too quiet; the page reads as an empty admin index. CSS still turns `.slot-board` into a **2-column card grid from 640px** (`globals.css`). Card grid is an explicit fail when tickets exist. Cage-as-stage is absent even in the empty frame (no still, no body, no tape).

**One-line fix:** Empty: one muted line + link to `/e/demo`. Live: keep a single-column price tape; kill the 640px two-column grid.

**3-second:** Fail. No body, no number. Empty board looks like a SaaS dashboard.

---

## `/e/demo` — Creative

**390 first glance (GLB up):** Sticky product nav still on. Lime wire cage. Gray body with zone boxes. Top-left ask: Chest L · **$100** · open · countdown · A. RIVER · Copy link. Bottom dock: horizontal zone tape, then fat lime **Preview only** covering the legs. Next.js **N** on the dock. Phone price is 36px (spec 40–52). Bid log hidden (by design).

**1280 first glance (GLB up):** Body is the stage. Ask $100 at 52px. Right column 240px: twelve `$100` zone rows, Open, lime Preview only, “No bids on this zone yet.”, rules paragraph. Site nav (Events · New · Outreach · Log in) still a second header on the cage.

**Cold reload this pass:** Cached GLB appeared with the HUD. First-paint-without-body was not caught here; treat “HUD on black until the client + GLB land” as still a load risk.

**Working:** Cage, GLB, zone hit boxes, ask, tape, countdown, Copy link, disabled preview bid.

**Cheap:** Product chrome on the cage (nav + Outreach). Opaque ask + floor panels make a second site. Phone lime plate sits on the body. Desktop tape is twelve identical $100 rows (settings list, not StockX last sales). Rules copy in the dock.

**One-line fix:** Flush `/e`: hide product nav; keep ask + tape on the body; do not put a lime CTA on the figure until a brand can bid.

**3-second:** Pass once the body is up (zone + number on the cage). Fail if the eye hits the phone dock first. Fail if nav + right rail read as the product and the body as a widget.

---

## `/onboarding` `/new` `/me` — Dead, blocked

Logged out, all three bounce to `/login?next=…`. Same first glance as `/login`. Forms not scored.

**Working:** Gate works.

**Cheap:** Cannot judge the forms this pass.

**One-line fix:** None until logged in. Do not campaign-theme those forms when they are visible.

---

## Verdict

| Route | 3-second | Notes |
| --- | --- | --- |
| `/` | Fail (locked) | Copy + lime. Body below the fold at 390 and 1280. |
| `/login` | Fail (dead, correct) | Heading + lime Sign in. Outreach in logged-out nav. |
| `/events` | Fail | Empty SaaS void. Demo not linked. 2-col grid waiting at 640px. |
| `/e/demo` | Pass after GLB | Only screen that is already a cage. Nav + lime dock are how it becomes a second site. |
| `/onboarding` `/new` `/me` | Not scored | Login wall. |

The only Creative surface that already does the job is `/e/demo`, and only after the body is on screen. `/events` is the cheap hole: a brand opening Live sees no body and no price.
