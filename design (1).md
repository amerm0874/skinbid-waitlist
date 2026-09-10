# SkinBid — Design

Two surfaces. Do not mix them in one build step.

1. Waitlist `/` — ship first. Flat. No live 3D.
2. Event page `/e/[slug]` — photoreal body in a shared neon cage. Phase 5 polish.

---

## Direction

- Dark, dry, physical.
- One accent. High contrast.
- Body = inventory.
- Sharp corners. Tight type. Almost no blur.

**Waitlist steal:** race bibs, LED boards, shipping labels.  
**Event page steal:** Marc’s *product* (real scanned body + cage + logos on skin).  
**Do not steal:** Marc’s exact cyan/red palette, his face, his wordmark.

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

Buttons: 44px, lime fill, black text, no shadow.  
Inputs: surface, lime focus ring.

---

## `/` Waitlist (Phase 0 — no creativity beyond this page)

One scroll. English. Mobile first.

### Nav
`SKINBID` · `Get early access`

### Hero
- Eyebrow: `EVENT-DAY BODY SLOTS`
- H1: `Sell the skin. Keep the medal.`
- Sub: `List logo slots on your body for any event. Brands pay SkinBid. You wear a temp tattoo for one day. You get paid after we check the photos.`
- Primary: `I’m an athlete`
- Ghost: `I’m a brand`
- Micro: `Waitlist — first events open when we have enough athletes.`
- Right / below: still of a torso with two fake marks. Caption `Preview. Not live.`  
  No Three.js. No SVG wireframe body. No looping 3D until we have a real GLB.

### How it works
`Four steps. No decks.`

1. `List the event` — date, capture, 12 zones. Any sport.
2. `Brand starts the auction` — first bid $100+. Money hits us.
3. `Wear it on the day` — you print the mark. Auction already closed 48h out.
4. `Proof, then payout` — we check. You get 80%. Fail → brand refunded.

### Money strip
`Brand pays SkinBid. We hold it. Highest bid at T–48h wins. You get 80% after proof.`

### Form
Heading: `Get in before the first events list`  
Toggle: Athlete / Brand

Athlete: email, event name, date, handle  
Brand: email, website, budget, category  

Button: `Request early access`  
Success: `You’re on the list. First events open when we have enough athletes.`

### Footer
`Temporary tattoos only. Not affiliated with any organizer. Money is held until proof is approved. 20% fee on payout. Auction. hey@skinbid.com`

Banned words: reimagine, unlock, seamless, empower, next-gen, ecosystem, game-changing.

---

## `/e/[slug]` Event page (build after waitlist)

Technical first: GLB loads, orbit works, 12 zones clickable, bid sheet works.

### Stage
- Shared cage scene (one file for every athlete)
- Athlete GLB centered on a pad
- Drag to rotate. Scroll to zoom
- 12 hit areas. Occupied zone shows the current brand mark as a decal
- Empty zone shows a thin lime outline on hover

### Overlay (keep thin)
- Top left: athlete name · event · date
- Top right: countdown to auction close
- Bottom: selected zone · current bid · `Bid +$100` (or `Start at $100` if empty)
- Click bid → Dodo checkout. Do not invent a custom card form

### After Phase 4 works — creative last
- Cage lighting pass
- Better decal wrap
- Optional music (athlete pick). Default muted
- Do not block checkout on any of this

---

## Zone labels (exact)

Chest L, Chest R, Shoulder L, Shoulder R, Bicep L, Bicep R, Forearm L, Forearm R, Back L, Back R, Thigh L, Thigh R.

---

## QA waitlist
- iPhone: H1 + form work
- Both roles insert a Supabase row
- Title: `SkinBid — Event-day body slots`
- Favicon: lime rectangle, S
