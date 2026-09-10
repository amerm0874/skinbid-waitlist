# SkinBid — Product rules

Locked with Mohamed [2026-09-09].  
Public site today = waitlist. This file is the product behind that waitlist.

---

## Core

Athlete rents a body zone for one event day.  
Brand puts a mark on that zone: temp tattoo or sticker, per the deal.  
Every slot is an auction. There is no fixed-price buy-now.  
SkinBid holds the money. Athlete is paid only after the event and approved proof.  
Athlete 80%. SkinBid 20%. Fail or no-show → brand refunded.

Not a sponsorship agency. Not a permanent tattoo shop. Not an influencer marketplace.

---

## Two accounts

### Athlete

Public profile + avatar + verification video + upcoming events + body slots.

**Must have**

- Display name
- Country
- Email
- Age (18+ for now. Minors parked.)
- One social (Instagram or X)
- Avatar (in the product MVP — method below)
- Verification video (required, not optional)
- Upcoming event: name, date, city, sport
- Body slots on that event: 12 zones open or closed. Brand starts the bid.
- Payout method (when we pay — pick one later)

**Why the video exists**  
Prove the body on camera is the same body as the avatar. No video → profile does not go live.

**Useful, not day one**

- Past results / titles
- Extra socials
- More than one upcoming event
- Slot size notes

**Kill**

- Full biography
- Follower count as a required field
- In-app chat
- Monthly video duty (one verification video to publish; refresh only if the body/avatar changes)

### Brand

**Must have**

- Brand name
- Website
- Email
- Logo file (PNG/SVG)
- One line: who they are

**Useful, not day one**

- Niche
- Budget range
- Brand guidelines
- Preferred sports or regions

**Kill**

- Team seats
- Campaign graphs
- In-app inbox

---

## Discovery and outreach

No messages inside the product.

Brand path: search / open an event → bid on a slot (pay SkinBid).

Athlete path: finds a brand that fits → asks SkinBid to email that brand.  
The email is sent **from SkinBid**, in SkinBid’s name, on behalf of the athlete.  
It says who the athlete is, which event, which zones are open.  
Brand replies to SkinBid / comes to the site and bids.  
Athlete never gets the brand’s raw inbox as a chat thread.

---

## Auction (only way to take a slot)

Zones are named body parts, not free drawing. Every paired part is Left and Right.

Default set (12): Chest L/R, Shoulder L/R, Bicep L/R, Forearm L/R, Back L/R, Thigh L/R.

Athlete can close a zone (kit, organizer, religion, taste). They do not invent new zone names in v1.

Rules:

- Athlete lists zones as open. They do not type a price.
- Brand starts the auction: first bid on a zone (floor **$100**).
- Brand pays SkinBid to sit as current high bid. That slot shows their name.
- Next bid must be at least **+$100**.
- Outbid → previous brand is refunded in full. Slot name switches to the new brand.
- SkinBid holds every live bid.
- Auction closes **48 hours before event start** (athlete timezone).
- Highest bid at close wins. Winner stays held until proof.
- No bids at close → slot dies with the event. Athlete gets $0 on that zone.

Paying is not “buy now.” Paying is taking the current lead. Someone can still take it from you until T–48h.

---

## Money

1. Brand bids. Money hits SkinBid.
2. SkinBid holds 100%.
3. If outbid: that brand is refunded 100%. Next brand is now held.
4. After close: only the winning bid stays held.
5. Event day: athlete wears the mark in that zone.
6. Athlete uploads proof.
7. SkinBid approves or rejects.
8. Approve → athlete 80%, SkinBid 20%.
9. Reject / no-show → winning brand refunded 100%. Athlete $0.

No payout on listing. No payout when a bid is placed. Race + proof first.

---

## Timing

| Clock | Rule |
|---|---|
| Event date window | **4 days to 3 months** from the moment of listing |
| Auction open | From publish until T–48h |
| Auction close | 48 hours before event start |
| Why 48h | Athlete prints the tattoo/sticker. Needs time after the winner is locked |
| Wear window | Event day |
| Proof due | 48 hours after the event ends |
| Review | SkinBid, 48 hours after proof |
| Payout | After approval only |

Athlete prints the physical tattoo or sticker from the winner’s logo file.  
Brand does not mail product by default.

Athlete can list the next event as soon as they have a date inside the 4-day–3-month window. One live event at a time for the first version.

---

## After a brand wins

Winner sends (or already uploaded at bid):

- Final logo file (PNG, transparent)
- Tattoo vs sticker, if the athlete offers both
- Post rules if any (tag + photos)

Logo print size is capped per zone. Wrist ≠ chest.  
SkinBid / athlete does not invent the mark.

---

## Proof

- 2 photos of the mark on the correct zone, event day, face or bib visible
- 1 photo in the event (start line, course, ring, venue)
- Link to the post if the deal included a post

Reject: wrong zone, missing mark, other day, heavy crop, stolen photos.

---

## Content and bodies

- Banned marks: political, pornographic, hate.
- Two competing brands cannot share the same body on the same event. Same category as a live/winning bid → other zones on that athlete lock to that category. Different categories can share a body.
- Under 18: parked. First version is 18+.
- Organizer bans logos on the day → brand refunded. Athlete $0 on that slot.
- Currency: USD to start.

Still unwritten, needed before first paid slot: max cm width per zone, chargebacks.

Cancel: athlete or organizer cancels → brand refunded 100%. Athlete $0.
Winner out after close: no.

Likeness (locked):

- Buying a slot buys the mark on event day + the proof photos of that day.
- Brand may **not** reuse the athlete’s face/body in other ads, other events, or always-on campaigns unless the athlete opted in at listing.
- Opt-in is a yes/no on the event. Yes does not mean free. Brand and athlete agree a separate appearance price. No price agreed → no reuse.

---

## Athlete page (look)

Every athlete event page is the same stage:

- Photoreal 3D body of that athlete (real skin, not a cartoon, not AI face-swap)
- Standing in a shared neon cage scene
- Brand rotates the body and taps a zone
- Winning logos stick on the mesh as decals
- Music: athlete picks a track for the page (after avatar works). Default = muted / one SkinBid bed.

Do not copy Marc’s red-cyan art direction as a brand. Copy the product: real body + cage + slots.

---

## Avatar — how Marc did his, and what we copy

Marc said it in public [2026-09-08]:

1. Wife scanned him in **Polycam**.
2. ~**300 photos** from different angles. He stood still.
3. Export from Polycam → **Blender** cleanup.
4. File displayed on the site as a **GLB** in **Three.js** (`/models/marc-….glb`, Draco).
5. Logos are overlays on that mesh. Auction slots sit on named body parts.

That process is one-person handmade. SkinBid cannot send every athlete into Blender.

### What the athlete sends us (this is the product capture)

Need a second person with a phone. Athlete does not scan themselves.

**Setup**

- Indoor, even light. No harsh sun behind them.
- Empty floor. One color wall if possible.
- Athlete stands still, feet shoulder-width, arms slightly off the torso so the sides of the chest are visible.
- Kit that shows the six zones. Bare chest OK if that is race kit. No hoodie. No nudes.

**Capture (friend walks, athlete freezes)**

- Polycam Photo mode, or the same job as a slow orbit video we process.
- Three laps around the body: knee height, waist height, face height.
- Front, sides, back, and 45° in between. Include the top of shoulders and the outside of both thighs.
- Overlap shots. Target **150–300 photos**, or one continuous **60–90s** video doing those three laps.
- Athlete does not talk, sway, or check the phone.

**Plus a 10s proof clip** (separate): face + full body, say their name. Stops a stolen Polycam file.

**Upload to SkinBid.** They do not open Blender. They do not export GLB themselves.

### What we do

1. Reconstruct a photoreal mesh / splat from that capture.
2. Clean floor and room out. Keep the body.
3. Drop the body into the shared cage scene.
4. Place the six zone hit-areas on the mesh.
5. Publish. No 3D → profile stays draft, they recapture.

Rebuild the avatar only if the body or the kit on race day will look nothing like the scan.

### Kill

- Two-photo AI body as the public avatar
- Game avatars
- Asking athletes to learn Blender
- A different cage per athlete in v1

---

## What the public site is today

Waitlist only. No accounts, no auction engine, no payments on the landing.

Waitlist fields stay:

- Athlete: email, event name, event date, social
- Brand: email, website, budget
