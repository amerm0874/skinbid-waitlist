# SkinBid — Plan

Creativity last. Stack and data first.

---

## Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| App | Next.js App Router, TypeScript | One repo, routes, API |
| UI | Tailwind | Fast. Design tokens in `design.md` |
| Host | Vercel | Next default |
| Auth + DB + files | **Supabase** | Auth, Postgres, Storage. Egypt-friendly |
| Payments | **Dodo Payments** | Stripe is not available in Egypt. MoR. Checkout sessions + refunds + webhooks |
| 3D | Three.js + GLTF + Draco | Same path Marc used (`*.glb`) |
| Email | Resend | Outreach emails from SkinBid |
| Analytics | Vercel Analytics or DataFast | Later |

No Stripe. No waitlist landing in this build.

### Dodo reality (do not pretend it is Stripe Connect)

- Brand pays SkinBid’s Dodo account.
- Hold = a status on our bid row, not a Dodo escrow product.
- Outbid / fail = `refunds.create({ payment_id })`.
- Athlete 80% = our ledger, then a payout we trigger from SkinBid’s Dodo balance / bank. Dodo pays *us*. We pay athletes.

Packages: `dodopayments`, Next adaptor `@dodopayments/nextjs` if we use their webhook helper. Env: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=test_mode`.

### Supabase tables (minimum)

`profiles` — role athlete|brand, name, country, social, category (brands), likeness_opt_in  
`events` — athlete_id, name, date, city, sport, slug, status  
`zones` — event_id, name (enum of 12), open|closed  
`bids` — zone_id, brand_id, amount_cents, dodo_payment_id, status (held|refunded|won|failed)  
`captures` — athlete_id, storage paths, process status  
`avatars` — athlete_id, glb_url, ready bool  
`proofs` — event_id, files, status  
Storage buckets: `captures`, `avatars`, `logos`, `proofs`.

---

## Phase 0 — Repo + keys

Next.js on Vercel. Supabase project. Dodo test keys. Placeholder GLB in `/public/placeholder.glb`.
Home is an event feed, not a waitlist.

---

## Phase 1 — Accounts + events (technical)

1. Supabase Auth (email magic link)
2. Profile create: athlete vs brand
3. Brand must pick **one category** from a fixed list (competitor lock)
4. Athlete creates one event inside the 4-day–3-month window
5. 12 zones default open. Athlete can close some
6. Likeness opt-in yes/no on the event

No visual invention here. Admin tables can look ugly.

---

## Phase 2 — Capture → GLB (technical)

1. Upload spec: 150–300 stills **or** 60–90s orbit video + 10s name clip
2. Files land in Supabase Storage
3. Job flag `captures.status = processing|ready|failed`
4. Reconstruction can be manual for the first athletes (download, Polycam/Blender, upload GLB). Automate later
5. No ready GLB → event page stays draft

Do not spend Phase 2 on cage lighting.

---

## Phase 3 — Event page + auction + Dodo (technical)

1. `/e/[slug]` loads GLB in the shared cage scene. Tap zone.
2. Brand bid → server checks floor $100 / +$100 / category lock / auction still open
3. Create Dodo checkout session. Metadata: `bid_id`, `zone_id`, `brand_id`
4. Webhook `payment.succeeded` → bid `held`. If a previous held bid exists → refund it
5. Cron or edge: at T–48h mark winner, expire the rest
6. Proof upload + `/admin` approve/reject
7. Approve → ledger 80/20. Reject → Dodo refund

---

## Phase 4 — Email outreach (technical)

Athlete picks a brand → Resend sends from SkinBid, about that athlete + event + open zones. No inbox product.

---

## Phase 5 — Creative (only after 0–4 work)

Last. Do not start here.

- Neon cage look (shared scene file, not one per athlete)
- Logo decals sitting on the mesh
- Idle / rotate feel
- Athlete music picker
- Landing preview clip of a real cage page
- Copy pass

---

## Cursor instruction (waitlist only — paste this)

```
Build SkinBid waitlist from prd.md, plan.md, design.md, rules.md.

Next.js App Router + TypeScript + Tailwind + Vercel.
Waitlist rows insert into Supabase table `waitlist`. No Stripe. No Dodo charge yet. No Three.js on this page.

One route `/`. English. Mobile first.
Follow design.md tokens, sections, and copy exactly.

Form: role toggle athlete/brand.
Athlete: email, event name, event date, social.
Brand: email, website, budget (<$500 / $500–2k / $2k+), category text field.
Button: Request early access
Success: You’re on the list. First events open when we have enough athletes.

Do not add extra routes, a blog, auth, 3D, or payments.
```

---

## Mohamed

- Dodo + Supabase accounts today
- Domain later. `*.vercel.app` is fine
- Do not pause COVE unless waitlist wins in 14 days
- First GLBs can be handmade. Do not block Phase 3 on a full reconstruction API
