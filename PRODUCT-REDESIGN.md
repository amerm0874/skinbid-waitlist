# Product redesign — September 2026

> Historical iteration notes. For the current dark theme, OpenRouter photo pipeline and launch blockers, use [LAUNCH-AUDIT.md](./LAUNCH-AUDIT.md). Earlier light-theme and “AI unimplemented” statements below are superseded.

## Scope

Web product only. Landing page and mobile app were not changed in this redesign. No deployment, payment, account mutation, or database migration was performed.

## Design decisions

The athlete and the placement are the focus. A white interface, cool grey supporting surfaces, ink typography, and restrained blue selection states replace the product’s neon treatment. A dark photo studio gives the body imagery a distinct place without making every screen dark. Product styles are scoped under `.product` in `components/product/product-studio.css`.

Typography uses the existing Inter for interface and headlines, with the condensed wordmark retained. Layout is left-aligned. Motion responds to selection, image hover, buttons, and account menus; reduced-motion preferences disable transitions and animations.

## Implemented

- Events: clearer introduction, three-step explanation, calendar-style race rows, secondary athlete discovery, and useful empty-state actions.
- Navigation: persistent Events and Athletes links, including on the placement screen.
- Race: a single primary journey through athlete selection instead of a competing standalone placement button.
- Athlete: desktop portrait/details layout, race details, available placements, price and primary action grouped together. Body photo is a fallback when no profile photo exists.
- Public athlete placements now reflect configured photo rectangles, rather than advertising every database zone.
- Placement studio: persistent list and pricing beside the image; selecting a rear placement automatically displays the rear photo. The selected placement is highlighted in both list and image. Details no longer cover the athlete.
- Photo loading failure has an explicit message. Absent views are disabled.
- Bid controls: adjustable bid for occupied placements, clear checkout wording, and existing login/payment guards retained.
- Athlete editor: click to position a default-size box, or drag to set its dimensions. Selection is disabled while a save is pending; interrupted pointer actions clear the draft.
- Logo page no longer calls a paid leading bid a winning placement before the auction ends.
- Shared product buttons, inputs, menus, focus states and countdown hierarchy updated.

## Verification completed

- Production build passed, including TypeScript and generation of 58 static pages.
- Targeted lint on redesigned routes/components and public-athlete loader: no errors; one image-optimization warning on the athlete portrait.
- Browser: event discovery → athlete profile → actual event placements rendered.
- Browser: selecting a back placement switched to the back photo and highlighted the corresponding rectangle.
- Browser: actual configured Abs placement displayed its $100 bid button.
- Browser: clicking that bid button as a signed-out visitor redirected to `/login?role=brand&next=%2Fe%2Faudit-two-race`, preserving the return destination without submitting a bid.
- Browser: production desktop had no horizontal overflow or framework error overlay.
- Browser: actual production event at 390px width had no horizontal overflow after the countdown layout correction.
- No changes to the landing-page or mobile-app paths in the redesign.

## Not verified / not implemented

- A real paid checkout, webhook confirmation, and authenticated logo upload were not exercised. Do not call the payment flow release-verified.
- Authenticated athlete upload/save was reviewed in code but not tested by changing the user’s data.
- AI photo normalization remains unimplemented; this redesign does not claim otherwise.
- Full-repository lint still contains errors outside the targeted redesign checks.
- Test-named races/athletes exist in the connected data; production content needs review before launch. No test records were deleted.
- Discovery-card pricing and inventory should receive a full data-consistency audit across all listing sources before release.

## Preview

Run `npm run build`, then `npm run start -- -p 3101`. Preview `/events`, `/athletes`, and `/e/demo`. The runtime needs network access for Supabase-backed records. No changes have been published to Vercel.

## Follow-up: athlete-owned placements

- Removed default rectangle overrides from event pages, including the demo. Unconfigured legs/chest/back positions are not guessed. The demo now shows an unconfigured photo rather than fictitious purchasable positions.
- Actual events, `/me`, and `/new` now use the athlete’s uploaded photos instead of hardcoded body images for special event slugs.
- Hidden shoulder placements in the editor and owner controls, and rejected shoulder placement saves/bids. Existing database records and paid logos were not deleted.
- Discovery cards and athlete profiles only advertise configured photo placements. Bid creation also rejects an unconfigured placement. New publication requires a positioned placement.
- Unified empty placement styling to a blue translucent box. Uploaded sponsor logos retain their original artwork colors.
- Used the uploaded front body photo as the fallback portrait in discovery, account navigation, and the athlete’s account, without overwriting a custom profile photo.
- Newest body-photo upload wins even when the file extension changes.
- Added navy/blue/teal brand treatments to header, date tiles, availability, guidance, and placement states. Landing remains unchanged.
- Regression checks: `node scripts/check-photo-placements.cjs` covers manual coordinates, no implicit positions, front/back mapping, hidden shoulders, and closed slots.

### What the user does

Athlete: complete profile → choose race → upload front/back photos → select a named placement → click to place or drag to size it → publish. Saved placements can be repositioned; replacing a photo means the athlete should review its placements again. No AI photo normalization is currently running.

Brand: complete brand profile → choose race and athlete → select one of that athlete’s configured placements → bid and pay → upload logo → preview on the photo. Payment establishes a bid; the auction winner is determined at the deadline, not at initial checkout.

## Follow-up: discovery cards, calendar and account guides

- Removed placement labels and prices such as “Abs $300” from athlete discovery cards. Actual bid amounts, checkout and account bid history remain unchanged.
- Cards now focus on portrait, sport, athlete name, race/date/location and an explicit “View athlete” action.
- Restored the existing upcoming official-event catalogue alongside live sponsorship races. Events already represented in the live section are not duplicated in the calendar. No external events were fabricated or inserted into the database.
- Calendar-only events do not show a sponsorship auction countdown when they have no participating athletes.
- Added reusable three-step athlete and brand guides to `/me` and `/settings`, with links to profile settings, the relevant setup/discovery route and account activity.
- Static-render checks confirmed both guides render three steps with the expected links.
