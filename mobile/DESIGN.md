# SkinBid Mobile — Design System

This is the source of truth for how the app looks, moves, and reads. Any
screen, component, or copy you add, edit, or delete should follow this.
If you're changing the design itself, edit this file in the same change so
it never drifts from the code.

Everything here already exists in the codebase — this document explains the
tokens and components, it doesn't introduce new ones. When in doubt, grep for
the primitive before writing a new one.

## 1. Brand

Dark-only, no light mode — mirrors the web app (`app/globals.css`), which
never toggles either. Voice is blunt and numbers-first: short sentences,
concrete dollar amounts, no hype. See §7.

## 2. Color tokens

`src/constants/theme.ts` → `Colors`. Never hardcode a hex value in a screen
or component — import the token. (`grep -rn "#[0-9a-fA-F]\{3,6\}"` outside
`theme.ts` should always come back empty.)

| Token | Hex | Use for |
| --- | --- | --- |
| `background` | `#0b0b0c` | Screen background |
| `backgroundElement` | `#151516` | Cards, inputs, rows |
| `backgroundSelected` | `#1d1d1f` | Pressed/selected state fill |
| `border` | `#2a2a2e` | Hairline borders |
| `text` | `#f5f5f0` | Primary text |
| `textSecondary` | `#9a9a94` | Secondary/meta text, placeholders |
| `accent` | `#c8f24e` | Primary CTA fill, active states, key numbers — **one per screen's focal action**, don't sprinkle it |
| `accentInk` | `#0b0b0c` | Text/icon *on top of* `accent` |
| `danger` | `#ff6b5e` | Errors, destructive actions |
| `success` | `#7fe0a8` | Won/held/approved states |

Roughly 60% background/element neutrals, 30% text, 10% accent — if a screen
has more green on it than that, it's probably overusing the accent.

## 3. Typography

`ThemedText` (`src/components/themed-text.tsx`), `type` prop. Don't reach for
raw `Text` + manual `fontSize` — add a `type` to `ThemedText` if you need a
size that doesn't exist yet, rather than inlining a style.

| Type | Size/weight | Use for |
| --- | --- | --- |
| `display` | 34 / 700 | Screen H1 ("Welcome back", "List your race") |
| `title` | 24 / 700 | Section headers ("Zones", "Live now") |
| `subtitle` | 18 / 600 | Card headlines, athlete/event names |
| `default` | 16 / 400 | Body text |
| `small` | 13 / 400 | Meta text, secondary lines |
| `smallBold` | 13 / 700 | Labels, list-row titles, pill text |
| `link` | 15 / 400, accent | Inline links |
| `code` | 12 / mono | Uppercase micro-labels ("BIDDING CLOSES IN") |

One font family (system), that's it. For a big standalone number (countdown,
bid price), don't use `code` — it's sized for labels. Use an inline style
with `Fonts.mono` at the size you need (see the event countdown for the
pattern) rather than adding another `ThemedText` type just for one number.

## 4. Spacing, radius, shadow

`Spacing` / `Radius` / `Shadow` in `theme.ts`. Every gap/padding/margin comes
from `Spacing` (4/8/16/24/32/64 — an 8pt grid); every `borderRadius` from
`Radius`. No bare numbers for layout.

- Card internal padding: `Spacing.three` (16) normally, `Spacing.four` (24)
  for a hero/glass card.
- Gap between related items: `Spacing.two`. Gap between unrelated sections:
  `Spacing.three` or `Spacing.four`.
- `Shadow.card` on every elevated surface (`Card`, `LiveSlotCard`, `RaceRow`)
  — tinted black, not a flat gray box-shadow. `Shadow.accentGlow` only on the
  primary button (it's meant to read as *the* action on screen).

## 5. Components — use these, don't reinvent them

All in `src/components/`.

**`ui.tsx`**
- `Screen` — safe-area + scroll wrapper for auth/simple screens.
- `Button` — `variant`: `primary` (accent, one per screen), `outline`,
  `ghost`. Built on `Tap`, so it already has press-animation + haptic.
- `Card` — the standard bordered/shadowed surface.
- `TextField`, `Pill`, `Divider`.
- `EmptyState` — icon + title + optional body + optional CTA. Every empty
  list needs one of these, never a bare "No X yet" text node. Pick an
  `Ionicons` name that matches the content (`flash-outline` for no live
  listings, `notifications-outline` for no notifications, etc.).

**`select-field.tsx`** — `SelectField`, a full-screen modal picker (with
search for long lists like countries). This is the only picker pattern in
the app — don't add a native `<Picker>` or a dropdown menu.

**`glass.tsx`** — `GlassSurface`. Real Liquid Glass on iOS 26
(`expo-glass-effect`), blur elsewhere (`expo-blur`), solid tint as the last
resort. **Use sparingly** — the tab bar, and one hero card per screen at
most (event countdown, athlete's live-event card, profile header). If
everything is glass, nothing reads as elevated.

**`animated.tsx`** — see §6.

**`live-slot-card.tsx`, `race-row.tsx`** — the list-row patterns for
browse/race screens. Reuse these; don't build a new row style for a listing.

**`legal-section.tsx`** — the title+body block for static legal/info pages
(About, Privacy, Terms). Reuse it for any new static-copy page rather than
hand-rolling a `View`+`ThemedText` pair.

## 6. Animation — `src/components/animated.tsx`

| Primitive | For | Notes |
| --- | --- | --- |
| `Tap` | Any pressable surface (buttons, rows, chips, toggles) | Spring-scale to 0.96 + light haptic. `haptic={false}` for low-weight actions (list-row navigation, expand/collapse) — reserve haptic feedback for actions that commit to something. |
| `Reveal` | List rows on load | Staggered `FadeInDown`, capped at 8 items deep so a long list doesn't feel slow. |
| `useShake` | Form validation failure | Nudge + error haptic. Wrap the field/section, call `shake()` right after setting the error. |
| `SuccessCheck` | A completed flow's peak moment (proof submitted, draft created) | Animated check + success haptic. Don't use it for routine saves (settings) — save that feeling for things the user was working toward. |
| `Switch` | On/off toggles | **Presentational only, no `onPress` of its own** — wrap it in `Tap` for the tap target (see `ToggleRow` in `app/new.tsx`). Giving it its own handler too double-fires. |

**The one hard rule:** never wrap a screen's primary interactive content
(a login form, the submit button, anything the user must be able to act on
immediately) in an `entering=` animation. `Reveal`/`FadeIn*` are for
decorative or secondary content — headers, list rows, hero images — where a
few hundred ms of delay is a nicety, not a blocker. This bit us once
already: wrapping the login/signup form fields in `FadeInUp` left them
invisible for a couple of seconds on first paint. Decorative elements (the
greeting text, a screen title) can carry `FadeInDown` freely; the form
controls underneath should mount at full opacity immediately.

## 7. Copywriting voice

Match the web app's voice — short, concrete, a little dry. Numbers over
adjectives. Contractions are fine and expected.

**Do:**
- "Floor's $100."
- "Your body's still ad-free" (empty state, not "You have no events")
- "One step left: your 3D body scan."
- "Athlete or brand? Pick one — you can't switch later."

**Don't:**
- "Oops! Something went wrong. Please try again later. 😅"
- "Congratulations on taking the first step in your SkinBid journey!"
- Generic empty states ("No data available")
- Corporate hedging ("We apologize for any inconvenience")

When porting a screen from the web app, check if the web copy already
exists (`about.tsx`, `privacy.tsx`, `terms.tsx` are ported verbatim) before
writing new copy — reuse it rather than paraphrasing.

## 8. Icons

`@expo/vector-icons` → `Ionicons` only. Don't add another icon set. Prefer
the `-outline` variant for empty states and secondary actions, filled for
active/selected states (tab bar) and primary glyphs.

## 9. Layout conventions

- **Tab screens** (`(tabs)/*`) sit under a floating glass tab bar
  (`(tabs)/_layout.tsx`). Their scroll content must add
  `paddingBottom: TAB_BAR_CLEARANCE` or the last item hides behind it. Stack
  screens pushed on top of a tab (event detail, athlete profile, settings,
  etc.) don't need this — the tab bar isn't visible there.
- **Stack screen titles**: set via `<Stack.Screen options={{ title }} />`
  either in the root `_layout.tsx` (static title) or inline in the screen
  component (dynamic title, e.g. the event/athlete name once loaded) — don't
  build a custom header.
- **Avatar sizes**: 64px for compact contexts (profile tab header, list
  rows), 96px for a hero context (public athlete profile, onboarding).
  Circular (`borderRadius: size / 2`) for people; `Radius.lg` (rounded
  square) for events/brand logos.
- One `Tap`-derived control per row — never nest two pressables (see the
  `Switch` note above). If a row needs both "tap the row" and "tap this one
  button inside it" behavior, make the inner element a `Button`/`Tap` and
  make sure the outer row isn't also wrapped in one.

## 10. Before you add a screen

1. Wrap it in `ThemedView` (full custom layout) or `Screen` (simple
   form/auth layout) — never a bare `View` with a manual background color.
2. Pull copy from the web app if it exists; otherwise write it in the voice
   above.
3. Use `EmptyState`, `Card`, `Pill`, `Button`, `TextField`/`SelectField` —
   don't restyle a raw primitive that already has a design-system version.
4. If it's a list, wrap rows in `Reveal`; if it's a tab screen, add
   `TAB_BAR_CLEARANCE`.
5. Run `npx tsc --noEmit` and `npx expo-doctor` before calling it done.
