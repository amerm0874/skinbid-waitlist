# SkinBid — PRD / MVP

**One-liner:** Athlete rents a body zone for one event. Brand auctions it. SkinBid holds the money. After the race and approved proof, athlete 80%, SkinBid 20%.

Build the product app. Waitlist is out of scope.

Source of truth for rules: `rules.md`.

---

## Decision lock

| Item | Decision |
|---|---|
| Name | SkinBid |
| Language | English. Global. |
| Face | Not Mohamed’s body. He is the builder. |
| Take | 20% |
| Who lists | Any athlete, 18+, dated event, any sport |
| Who buys | Any brand |
| How a slot is taken | Auction only. No buy-now. |
| First bid | Brand starts. Floor $100. Then +$100. |
| Auction close | 48h before event start |
| Event window | 4 days–3 months from listing |
| Hold | Brand pays SkinBid. Held until proof. |
| Payout | After event + approved proof only |
| Payments | Dodo Payments. Not Stripe. |
| Data / auth | Supabase |
| Avatar | Photoreal 3D GLB in a shared neon cage |
| Zones | 12: Chest / Shoulder / Bicep / Forearm / Back / Thigh × L/R |
| Competitors | Same category cannot share one body on one event |
| Chat | None. SkinBid sends email on behalf of athlete. |
| Likeness reuse | Off unless athlete opts in + separate appearance price |
| Cancel | Full refund to brand. Athlete $0 |
| Winner walks after close | No |

Do not mention COVE.

---

## Money flow

1. Brand bids. Pays Dodo. Webhook → row in Supabase `held`.
2. Outbid → Dodo refund of previous payment. New bid held.
3. Close T–48h. Winner stays held.
4. Athlete prints the mark. Wears it event day.
5. Athlete uploads proof.
6. Mohamed approves.
7. Approve → ledger: athlete 80%, SkinBid 20%. Payout from SkinBid’s Dodo balance (Dodo is MoR; no Stripe Connect split).
8. Fail / no-show / cancel → Dodo refund 100% to brand.

---

## MVP cut

### Ship — product MVP (technical first)

- Supabase auth (athlete / brand)
- Event + 12 zones
- Capture upload (orbit photos or 60–90s video + 10s name clip)
- 3D page: GLB in shared cage, tap zone, bid
- Dodo checkout + webhook + refund
- Hold / outbid / close-at-T–48h
- Proof upload + admin approve
- Resend: athlete→brand outreach from SkinBid

### After it works — creative

- Cage polish, lighting, decal placement
- Page music picker
- Motion / idle
- Brand category list UI

---

## Out of MVP

Blender in the athlete’s hands. In-app chat. Fixed price. Minors. Team seats. Campaign graphs. Stripe.
