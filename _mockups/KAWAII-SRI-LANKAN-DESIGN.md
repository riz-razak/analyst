# Kawaii × Sri Lankan Design System

## Core Kawaii Principles
- **Rounded forms**: Soft, pillowy shapes — no sharp edges. Border-radius generously (16px–32px+).
- **Pastel palette**: Soft pinks, lavenders, mint greens, peach, sky blue — never harsh.
- **Gentle motion**: Float, bob, breathe animations (ease-in-out, 2–4s cycles). Nothing jarring.
- **Minimalism with warmth**: Clean layouts that feel cozy, not sterile.
- **Playful typography**: Mix rounded sans-serifs with hand-drawn or serif accents.
- **Micro-interactions**: Hover states that feel alive — scale, glow, wobble.
- **Emotional connection**: Elements should feel friendly, approachable, almost alive.

## Sri Lankan Aesthetic Fusion
- **Colour accents from Sri Lankan motifs**: Saffron/turmeric gold (#F4A623), temple red (#C0392B), ocean teal (#1ABC9C), lotus pink (#E91E8C), palm green (#27AE60), cinnamon brown (#8B6914)
- **Patterns**: Subtle kandyan art-inspired borders, lotus motifs, traditional kolam-dot patterns as decorative elements
- **Nature references**: Tropical leaves, lotus flowers, ocean waves as floating SVG decorations
- **Cultural warmth**: Rich, spice-toned gradients layered over kawaii pastels

## Animation Guidelines
- `float`: translateY(±8px) over 3–4s, ease-in-out, infinite
- `breathe`: scale(0.98–1.02) over 4s, ease-in-out
- `fadeInUp`: opacity 0→1, translateY(30px→0) over 0.8s
- `shimmer`: background-position shift for gradient text effects
- `wobble`: slight rotate(±2deg) on hover
- Stagger child animations by 0.1–0.15s each

## Typography
- Headings: Rounded serif (Playfair Display) or soft sans (Nunito, Quicksand)
- Body: Inter or Nunito at weight 300–400
- Monospace: JetBrains Mono for accents/tags

## Component Patterns
- Cards with 20–32px border-radius, soft shadows, hover lift
- Gradient text for headings (pastel → Sri Lankan accent)
- Floating decorative SVGs (lotus, leaves) with slow drift animation
- Profile images in soft circle with subtle glow border
- Buttons with rounded pill shape, gentle hover scale + glow

## Light Mode Palette (Primary)
- Background: #FFF8F3 (warm white)
- Card: #FFFFFF with soft peach shadow
- Text primary: #2D1B0E (warm dark)
- Text secondary: #6B5744
- Accent gradient: #F4A623 → #E91E8C (saffron to lotus)

## Dark Mode Palette (Secondary)
- Background: #1A1118 (deep plum-black)
- Card: #2A1F28
- Text primary: #F5E6D8
- Accent gradient: #FFD700 → #FF6B9D
