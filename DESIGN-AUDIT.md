# SkinBid design audit

Rubric: `.cursor/skills/skinbid-design/SKILL.md` only. No restyle in this pass.

Job: a brand must see a **body** and a **price** in three seconds. SaaS dashboard first = fail.

Creative (invent): `/e/[slug]`, `/events` cards, `/a/[handle]` only. Gravity: Marc cage as stage, StockX as bid list.

Dead (no invent): `/login` `/onboarding` `/new` `/proof` `/admin` plus unlisted ops screens (`/me`). Keep existing `.product` forms.

Landing (`/`) is locked. Not scored as Creative.

---

## Route walk

### `/` — Locked (not Creative, not Dead)

Frozen Vercel photo landing. Hero copy first (“Your next race already has ad space.”), then lime press CTAs, then a photo in a press plate. Body exists as marketing art, not as inventory. No live price.

**3-second:** Fail (marketing copy + CTA). Expected. Do not touch.

---

### `/login` — Dead

ProductShell + `page-title` “Log in” + muted lead + `form-shell` (email, password, full-width lime “Sign in”, Create account, optional Google, login-link text).

**3-second:** Fail. First glance is a heading and a lime button. Correct for Dead. Do not campaign-theme.

---

### `/onboarding` — Dead

Same stack. “Set your role” / “Brand details” + lead + form. Athlete/Brand `seg` toggle, then fields. Brand path: native `<select>` with empty **Pick one**. Athlete path: country `<select>` with empty **Pick one**.

**3-second:** Fail. Lime “Save profile” / “Save brand”. Correct for Dead.

---

### `/new` — Dead

“List one event” / “Scan required” / “Event is live” + long lead + `form-shell`. Name, slug, datetime, city, sport, 12 `zone-toggle` chips in a 2–3 column grid, likeness Yes/No, capture file fields, optional `.glb`, lime “Save draft” / “Publish event”.

**3-second:** Fail. Form and lime button. Zone chips are a control grid, not inventory. Correct for Dead.

---

### `/events` — Creative

`slot-board-head` kicker “Live” (13px muted) + optional “List” text. Empty: one muted line + Events link. Live: `slot-ticket` rows — zone, **44px mono price**, event name, date · city, “N zones open”.

**3-second:** **Pass on phone** (zone + number before the event name). **Fail from 640px** — `.slot-board` becomes a **2-column card grid**. Card grid is an explicit fail.

StockX list is started (price-first tape). Cage-as-stage is absent (no body, no still, no stage). Desktop grid is cheap collection UI, not a last-sale list.

---

### `/e/[slug]` — Creative

`ProductShell flush`: sticky product nav still on, then full-viewport `event-cage` + overlay `event-hud`.

Ask box (top-left, opaque `--bg` panel): zone, **40–52px mono price**, lead, countdown, athlete, event · time, Copy link.

Floor (phone: bottom strip max 36vh; desktop: 240px right column): horizontal/vertical zone tape (price + zone name; **lead hidden**), then bid dock (status, lime 44px bid, optional logo file field, owner close, proof link, bid log, rules).

Cage: lime wire box, grid, GLB, zone edge boxes, logo/brand sprites. Loading: empty `.event-cage` until the client bundle + GLB land.

**3-second:** **Pass once the body is up** — zone + giant number sit on the cage. **Fail in the first load** — HUD chrome over black, no body. **Fail if the eye hits the dock first** (phone: lime “Start at $100” / “Bid $…” is a fat plate on the body).

This is the only screen that already is a cage with a HUD. It is also the screen most at risk of becoming a second site: site nav + opaque panels + form + lime CTA covering the stage. Bid log is StockX; it is **hidden on mobile**.

---

### `/a/[handle]` — Creative

If live: same `slot-ticket` as `/events` (zone + 44px price first). Then `athlete-bib` (18px name, country · sport, social, Copy link). Then `athlete-aeo` (~80-word explainer).

If empty: “No live event.” + Events link, then the bib and the essay.

**3-second:** **Pass with a live event** (ticket is zone + number). **Fail with no live event** (empty copy, then a profile). The blurb is marketing copy. The bib is athlete LinkedIn, not a cage and not a bid list.

---

### `/me` — Dead (unlisted ops)

Athlete: “Your event” display title + lead + `bib` card (Live/Draft, name, date, city · sport) + lime “Event” / “Finish listing” + Proof + Cancel + `me-zone` rows with ghost Close/Reopen.

Brand: “Your bids” + `event-grid` of `bib` cards (2–3 columns from 640/1024). Price is in the meta line, not first.

**3-second:** Fail. Dashboard title, lead, card, lime button. Empty uses the one-line + Events pattern (good). Do not invent here.

---

### `/proof` (`/proof/[id]`) — Dead

“Proof” title, event name in mono accent, lead, then three file fields + optional URL + lime “Submit proof”. Pending/approved: `bib` status card.

**3-second:** Fail. Form. Correct for Dead.

---

### `/admin` — Dead

“Admin” title + lead. Two sections: draft events (`bib` + `.glb` file + lime “Ready GLB”), pending proofs (`bib` + thumbs + lime Approve / danger Reject). Empty proofs: one line + Events.

**3-second:** Fail. Ops board. Correct for Dead.

---

## What looks like a cheap SaaS dashboard

Present on Creative screens (this is the damage):

- **Product nav on `/e` `/events` `/a`:** SKINBID image mark, Events / New / Outreach / Me, truncated email, Sign out. That is app chrome. `/e` is supposed to be a HUD on a body, not another logged-in site.
- **`/events` at ≥640px:** 2-column card grid of bordered surface tiles.
- **`/a` below the ticket:** profile block + 80-word AEO paragraph. Athlete LinkedIn + help center, not a board.
- **`/e` bid dock:** full form on the stage (file input, field-label, fine print, owner tools, “Upload proof”). Lime 44px button as the hero of the dock.
- **`/e` HUD panels:** solid `--bg` + 1px line boxes, not marks on the cage. Phone floor eats up to 36vh of the body.
- **Wordmark:** PNG (`/skinbid-wordmark.png`), not SKINBID as text.
- **Empty tickets** sit in a bordered `bib` (`.empty-bib`) — a card for a one-line state.

On Dead screens (do not restyle; listed so Creative work does not copy them):

- `/me` `page-title` + `page-lead` + `bib` + lime CTA + zone table.
- Brand `/me` `event-grid`.
- `/admin` section headings + card list + Approve.
- `/new` zone-toggle chip grid.

---

## What already matches StockX list + cage-as-stage

**StockX list (keep, push further on Creative only):**

- `slot-ticket`: muted zone → huge tabular price → name → date. Phone `/events` and live `/a` already read as a last-sale row, not a blog card.
- `/e` zone tape: price then zone name, selected row, closed dimmed. Desktop tape is a vertical last-price list.
- `/e` bid log: brand · amount · time · held/won. That is the tape. It is the right object; it is missing on the phone.
- Floor $100 / +$100 and countdown as mono numbers, not badges.
- `/events` header is a kicker (“Live”), not a dashboard H1.

**Cage-as-stage (keep on `/e`):**

- Full-viewport cage behind the UI. Lime wire volume, floor grid, named zone boxes on the figure.
- Ask HUD leads with zone + number, athlete name as a small meet line — not a page title.
- `/e` is `flush` (no product footer, no `site-wrap` article). Closest to “overlay on the body.”
- Logos/brand labels sit on the zone, not in a sidebar gallery.

**System already in place (do not add a second one):**

- `.product` only. Dark surface, thin lines, radius 4, lime 44px / black label, no glass, no blur, no shadow stacks.
- Empty states: one muted line + link to `/events`.

---

## Form problems

Dead screens keep these forms. Fix as form, not campaign.

| Where | Problem |
|---|---|
| `/onboarding` country | Native `<select>` empty option **“Pick one”**. Combobox with no value. |
| `/onboarding` brand category | Same **Pick one** empty `<select>`. |
| `/onboarding` PayPal | Label is a paragraph (“PayPal email. This is where we send…”). Not a short field name. |
| `/new` zones | Group is a `<p class="field-label">`, not `<fieldset>` / `<legend>`. Toggles are unlabeled as a set. |
| `/new` likeness | Segmented buttons, not a named control group beyond the legend — OK-ish; still two unlabeled-as-radio buttons. |
| `/new` `/proof` `/admin` file inputs | Visible `field-label` exists. Native file control still shows “No file chosen” with no chosen-file line of our own. |
| `/e` logo upload | Labeled. Lives on a Creative HUD — a form on the stage. |
| `/login` | Email / Password labeled. Google and “Email me a login link” are extra actions under the lime submit. |
| `/e` cage | Canvas has no accessible name. Zone picking is pointer-only. |

No Creative screen should grow a new combobox. `/events` and `/a` have no forms except Copy link.

---

## Ranked fix list

**P0 = Creative screens only (`/e`, `/events`, `/a`).** Dead screens: no invent, no campaign theme.

1. **`/e` — body in the first three seconds.** Cage is the stage. Do not leave the first paint as nav + opaque HUD + empty black. The GLB (or a still of it) has to win the glance. Loading placeholder that is not the body fails the job.

2. **`/e` — HUD on the body, not a second site.** Sticky Events / New / Outreach / Me / email / Sign out makes `/e` a dashboard. Ask + tape should read as marks on the cage. Opaque floor/ask slabs and a lime bid plate covering the figure are the failure mode.

3. **`/e` — StockX tape visible on the phone.** Bid log is the list; it is `display: none` under 768px. Zone-row lead is `display: none` at all widths. The list should be last price / last bid, not a hidden desktop extra. Rules, logo file field, and owner tools are not the first glance.

4. **`/events` — kill the card grid.** ≥640px 2-column `slot-ticket` tiles fail the 3-second test (card grid). Keep price-first rows as a list (StockX last sales), not a collection grid. Do not add dashboard titles or lime List buttons.

5. **`/a` — ticket is the page; profile is not.** Live: keep zone + number first. Drop the LinkedIn bib + 80-word AEO as the second beat (marketing copy = fail). Empty: one muted line + `/events`, not a bio. Invent here is the slot, not the athlete resume.

6. **`/events` cards — body or zone, then number.** Tickets already do zone + number. They still have no body. Creative allowance is to put the figure (still or crop) in the row so the list is inventory, not a SaaS table of event names.

---

P1+ (not P0; do not restyle Dead into the campaign):

- Wordmark as text SKINBID (system). PNG is on every Creative header today.
- Dead form-only: replace **Pick one** empty selects; shorten the PayPal label; fieldset the `/new` zone group.
- `/me` `/admin` `/proof` stay forms and boards. Do not cage-theme them.

---

## Scoreboard

| Route | Class | 3-second | Notes |
|---|---|---|---|
| `/` | Locked | Fail | Photo landing. Frozen. |
| `/login` | Dead | Fail | Form + lime. Correct. |
| `/onboarding` | Dead | Fail | Pick one ×2. |
| `/new` | Dead | Fail | Long form + zone chips. |
| `/events` | Creative | Pass phone / Fail ≥640 | Price-first tickets; card grid on desktop. |
| `/e/[slug]` | Creative | Pass with body / Fail on load & phone dock | Cage + ask number exist; chrome eats the stage. |
| `/a/[handle]` | Creative | Pass if live / Fail if empty | Ticket good; bib + AEO is LinkedIn. |
| `/me` | Dead | Fail | Dashboard. |
| `/proof` | Dead | Fail | Form. |
| `/admin` | Dead | Fail | Ops cards. |
