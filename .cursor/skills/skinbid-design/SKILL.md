---
name: skinbid-design
description: Visual system for SkinBid product and cage HUD. Use when designing, restyling, or reviewing any SkinBid page, overlay, empty state, button, type, or 3D chrome. Also use for design spikes on /e /events /a /me /new /login. Do not use for payment providers, SQL, or Polar.
---

# SkinBid design

One site. Two speeds.

## Job
A brand must see a body and a price in three seconds. If they see a SaaS dashboard first, the screen failed.

## Locked
Never edit app/page.tsx, components/landing/**, or :root.
Landing stays the Vercel production photo page.
Product styles only under .product.
No second palette, second display font, glass, blur, or shadow stacks.
No music. No 3D lighting pass. English. Race-bib voice. No “reimagine”.

## System
Wordmark SKINBID as text. Lime 44px button, black label, radius 4.
Dark surface, thin lines, mono numbers. Phone first.
/e overlay is a HUD on the body, not a second site.
Empty states: one muted line + link to /events.

## Creative (required)
Invent on /e/[slug], /events cards, /a/[handle] only.
Gravity: Marc cage as the stage, StockX as the bid list.
Not Anvara. Not athlete LinkedIn. Not SponsorMyBody waitlist.

## Dead (no creativity)
/login /onboarding /new /proof /admin /terms /privacy /waitlist
Keep existing .product forms. Do not campaign-theme them.

## Pass / fail
Pass: first glance is body or zone + number.
Fail: first glance is a lime button, card grid, or marketing copy.
