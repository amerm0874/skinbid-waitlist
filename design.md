# SkinBid — Design

Visual job: event billboard product. Not a red neon 3D clone. Not a generic SaaS gradient.

---

## Direction

- Dark, dry, physical.
- One accent. High contrast.
- Body = inventory. Slots like seats on a map.
- Sharp corners. Tight type. Almost no blur.

**Steal from:** race bibs, stadium LED boards, shipping labels.  
**Do not steal:** hyrox.marclou.com red cage + 3D scan.

---

## Tokens

```
bg:        #0B0B0C
surface:   #141416
line:      #2A2A2E
text:      #F2F2F0
muted:     #9A9A94
accent:    #C8F24E
danger:    #FF4D2E
font-display: "Bebas Neue" or "Oswald"
font-body:    "Geist" or "Inter"
font-mono:    "Geist Mono"
radius: 4px
max-width: 1120px
```

---

## Page structure (one scroll)

### 1. Nav
- Wordmark: `SKINBID`
- Right: `For athletes` `#athletes` · `For brands` `#brands` · `Get early access`
- No extra mark

### 2. Hero
- Eyebrow: `EVENT-DAY BODY SLOTS`
- H1: `Sell the skin. Keep the medal.`
- Sub: `List logo slots on your body for any event. Brands pay SkinBid. You wear a temp tattoo for one day. You get paid after we check the photos.`
- Primary: `I’m an athlete`
- Ghost: `I’m a brand`
- Micro: `Waitlist — first events open when we have enough athletes.`

Right: flat SVG body, 6 pins (L arm, R arm, chest, ribs, L quad, R quad). Two fake marks `ACME` / `VOLT`. Four `OPEN`. Caption: `Example inventory. Not live.`

### 3. How it works
Heading: `Four steps. No decks.`

1. `List the event` — date, photo, slots, price. Any sport.
2. `Brand pays SkinBid` — money is held. Not sent to you yet.
3. `Wear it on the day` — temp tattoo in the bought zone.
4. `Proof, then payout` — photos + posts. We check. You get 80%. We keep 20%. Fail the proof, brand is refunded.

### 4. Mock inventory
Heading: `What an event page looks like`

```
MAYA R.  ·  OPEN EVENT  ·  12 OCT
```

| Zone | Status | Example |
|---|---|---|
| R arm | Sold | VOLT |
| Chest | Open | $800 |
| L arm | Open | $600 |
| L quad | Open | $400 |
| R quad | Open | $400 |
| Ribs | Closed | Event cap |

Footnote: `Example prices. Each event’s rules cap where a logo can go. Payout after proof.`

### 5. Split audiences

**Athletes**
- Title: `Turn an event into a line item`
- Bullets: any sport · one-day tattoo · brand money held until you deliver · you get 80%
- CTA: `Join as athlete`

**Brands**
- Title: `Buy a body at a real start line`
- Bullets: any event · logo on skin + photos · you pay us, not a stranger · refund if they don’t deliver
- CTA: `Join as brand`

### 6. Waitlist form
Heading: `Get in before the first events list`  
Toggle: `Athlete` / `Brand`

Athlete: email, event name, date, handle  
Brand: email, website, budget  

Button: `Request early access`  
Success: `You’re on the list. First events open when we have enough athletes.`

### 7. Fine print
`Temporary tattoos only. Not affiliated with any organizer. Money is held until the event is done and proof is approved. 20% fee on payout.`

### 8. Footer
`SkinBid` · `Waitlist` · `hey@skinbid.com`

---

## Copy deck

H1: `Sell the skin. Keep the medal.`  
Sub: `List logo slots on your body for any event. Brands pay SkinBid. You wear a temp tattoo for one day. You get paid after we check the photos.`  
How: `Four steps. No decks.`  
Submit: `Request early access`  
Success: `You’re on the list. First events open when we have enough athletes.`

Banned: reimagine, unlock, seamless, empower, next-gen, ecosystem, game-changing.

---

## Layout rules

- Mobile first. Diagram under copy on small screens.
- Padding: 72px desktop / 48px mobile.
- Buttons: 44px, lime fill, black text, no shadow.
- Inputs: dark surface, lime focus ring.

## Assets
- SVG body wireframe + 6 pins. No photo shoot.
- Fake wordmarks as text in rectangles. No real logos.

## QA
- iPhone: H1 + form work
- Both roles submit
- Title: `SkinBid — Event-day body slots`
- Favicon: lime rectangle, S
