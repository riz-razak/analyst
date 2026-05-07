# WarenYan + rizrazak.com — Design Rules

These rules apply across all Riz Razak projects: `yan` (WarenYan Ops), `analyst` (rizrazak.com), and any future repos under this umbrella.

## Core Palette: Bawa Earth

All pages use the Bawa Earth light palette. No exceptions.

```
--bg: #FAFAF8           (warm off-white, not cold #F5F5F7)
--surface-solid: #FFFFFF
--surface-hover: #F0EDE8
--border: #E5E1DA        (warm sand, not cold gray)
--text: #1A1A2E          (deep warm black)
--text-secondary: #4A4A5A
--text-tertiary: #6B6B7B
--accent: #2D6A4F        (Bawa green)
--earth: #C4A35A         (Bawa gold)
--red: #D4644A           (coral, not neon)
--orange: #E88D2A        (warm amber)
--green: #34C759
--blue: #3A7BD5
```

The palette is warm, earthy, grounded. It reflects Sri Lanka, not Silicon Valley.

## Absolute No-Go List

These are banned across all pages. No negotiation, no "just a little."

1. **No dark mode.** Pages are light-only. Do not add `prefers-color-scheme: dark` media queries. Do not add dark mode toggles. Do not add dark mode stubs "for later."

2. **No glassmorphism.** No `backdrop-filter: blur()`. No `saturate()`. No frosted glass. No translucent panels. Backgrounds are solid colors from the Bawa Earth palette.

3. **No AI-glow aesthetic.** This means:
   - No gradient backgrounds that shift from dark to light
   - No neon accent colors (#00FF00, #FF00FF, electric blue)
   - No glowing borders or box-shadows with colored light
   - No "holographic" or iridescent effects
   - No particle effects, floating dots, or ambient animations
   - No "terminal green on black" hacker aesthetic

4. **No cold grays.** Apple's #F5F5F7, #AEAEB2, rgba(0,0,0,0.06) are banned. Use the warm Bawa Earth equivalents above.

5. **No gratuitous animation.** Transitions are functional only (hover states, view switches). Max 0.15s. No easing curves that draw attention to themselves. No "smooth scroll" that takes 800ms.

6. **No trendy UI patterns that sacrifice clarity:**
   - No floating action buttons
   - No hamburger menus on desktop
   - No infinite scroll where pagination works
   - No skeleton loaders for content that loads in <200ms
   - No toast notifications that disappear before reading

## Typography

- Primary font: Inter (with system fallbacks)
- Monospace: SF Mono / Consolas / Liberation Mono
- No decorative fonts. No handwriting fonts. No serif fonts for body text.
- Body: 13px. Headings: 22px max. Don't go bigger than the content warrants.

## Layout Principles

- Content is the interface. The design should disappear behind the information.
- White space is structural, not decorative. Don't add padding to "look modern."
- Cards have solid white backgrounds, 1px warm borders, and subtle shadows. That's it.
- Tables are the correct UI for tabular data. Don't turn tables into card grids.

## Status & State Colors

Status indicators use semantic colors directly — no neon, no glow:

```
Live/On Track:  --green (#34C759) on --green-subtle background
Warning/Watch:  --orange (#E88D2A) on --orange-subtle background
Deviation/Error: --red (#D4644A) on --red-subtle background
Planned/Neutral: --earth (#C4A35A) on --earth-subtle background
```

## Common AI-Generation Traps to Avoid

When using AI to generate code, watch for these patterns and reject them:

1. **Dark mode creep** — AI defaults to dark themes because training data is full of them. Always specify light-only.
2. **Blur/glass fetish** — AI loves `backdrop-filter`. It looks "modern" in isolation but makes everything harder to read.
3. **Over-componentization** — Don't wrap every line of text in a styled container. Plain HTML with good CSS is fine.
4. **Gratuitous SVG icons** — If a text label works, use text. Don't replace "Live" with a pulsing green dot.
5. **Portfolio aesthetic** — These are working tools, not portfolio pieces. Optimize for scanning speed, not "wow factor."
6. **Contrast sacrifice for aesthetics** — If text is hard to read, the design is broken. WCAG AA minimum (4.5:1 for body text).
7. **Feature faking** — Don't label something "Live" if it doesn't have data. Be honest about what's built and what's planned.

## Enforcement

This file lives at the root of each repo. Any PR that introduces items from the No-Go List should be rejected. When in doubt, the rule is: would this look at home on a Geoffrey Bawa building's information plaque? If not, simplify.
