# SkinBid — PRD

**One-liner:** Athletes sell temporary logo slots on their body for a race. Brands bid. Platform takes 20%.

**Today’s job:** ship a waitlist landing. No auction. No payments. No accounts.

---

## Decision lock

| Item | Decision |
|---|---|
| Product | Two-sided marketplace. Landing talks to both. |
| Today | Waitlist only (athlete + brand). |
| Language | English. Global. |
| Face | Not Mohamed’s body. He is the builder. |
| Name | SkinBid |
| Take rate (later) | 20% |
| First wedge | HYROX / CrossFit / running athletes with an audience + indie/SaaS brands |

Do not mention COVE on this page.

---

## Problem

Amateur athletes already wear brands on race day. The deal is email + PDF + hope.

Marc Lou proved the format (body slots + doubling auction + race-day tattoo) can pull attention. That was a personal stunt. There is no checkout for the next 1,000 athletes.

Brands that cannot afford a pro athlete still want a photo of their logo on a body at a real event.

---

## Users

**Athlete (supply)**
- Has a race in the next 90 days
- Already posts training / race content
- Wants $500–$5,000, not a “partnership deck”
- Floor: ~5k followers or a real race field (HYROX, marathon, CrossFit throwdown)
- Random gym bro with 200 followers is out of scope

**Brand (demand)**
- Indie SaaS, supplements, wearables, training apps
- Buys distribution stunts, not TV
- Needs: slot, price, date, proof pack
- Will not wire money to a stranger on Instagram

---

## Landing goal (v0)

1. Athlete enters email + race date + follower count.
2. Brand enters email + site + budget range.
3. We can tell which side is hotter in 7 days.

**Success this week:** 50 athlete emails or 15 brand emails. Either is a signal. Both near zero = kill.

---

## Page must answer

- What is being sold? (a body slot on race day, temporary tattoo, proof photos/posts)
- Who it’s for? (athletes with a race + brands that want the photo)
- How it works? (list race → brands bid → tattoo on day → send proof → get paid)
- What they get if they join now? (early access, first races featured)
- What it is *not*? (not permanent ink, not an agency, not only HYROX)

---

## In scope today

- One landing URL
- Hero + how it works + mock inventory card + two waitlist forms
- Separate athlete vs brand fields (same form, role toggle)
- Mobile-first
- Analytics (Plausible or simple page view + submit)

## Out of scope today

- Live bidding
- Stripe / Paymob
- Auth, dashboards, 3D body, tattoo printing
- Athlete onboarding flow
- Messaging Marc or scraping his page
- App Store / mobile app

---

## Later (not this page)

1. Athlete creates a race page (photo, 6 slots, floor price, event rules).
2. Brand pays to bid or buy-now.
3. Doubling auction *or* fixed price. Start fixed. Doubling is a gimmick that needs an audience.
4. Proof pack: 5 photos + 2 tagged posts.
5. Payout minus 15%.

HYROX and most organizers cap logo tattoos (usually arms + chest/leg). The product must show allowed zones per event later. Do not promise 10 slots on every race.

---

## Risks

- No inventory → brands bounce.
- No audience on the athlete → $0 bids. Filter for reach on the form.
- Clone of Marc’s red 3D page → looks like a knockoff. Different visual.
- Two-sided copy on one hero → confused. Primary voice = athlete. Brand is second block.

---

## Copy constraints

- Direct. No “reimagine sponsorship.”
- Do not claim partnership with HYROX or Marc Lou.
- Can reference the *category* (“race-day body slots”) without his name in the hero.
- CTA: “Join the waitlist” — not “Start bidding.”
