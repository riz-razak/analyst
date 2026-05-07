# Component Specification — The Analyst Homepage

Every React component needed for the production build, with props, state, CSS classes, and behavior.

---

## Component Tree

```
<App>
  <Nameplate>
    <LocationDropdown />
    <BrandLockup />
    <ViewSwitcher />
    <HamburgerButton />
  </Nameplate>
  <MenuPanel />
  <AccountabilityTicker />

  {view === 'mag' && (
    <MagazineView>
      <Hero>
        <HeroCard />
      </Hero>
      <RotatingStrip />
      <BodyGrid>
        <MainContent>
          <FilterBar />
          <CategoryColumns>
            <ArticleCard /> (×9)
          </CategoryColumns>
          <Pagination />
        </MainContent>
        <Sidebar>
          <TrendingSection />
          <ToolsIntelSection>
            <IntelCard />
            <ToolFeatureCard />
            <ToolInlineItem /> (×4)
          </ToolsIntelSection>
        </Sidebar>
      </BodyGrid>
    </MagazineView>
  )}

  {view === 'fyp' && (
    <FYPView>
      <FilterBar />
      <FYPCard /> (×n)
      <Pagination />
    </FYPView>
  )}

  <Footer />
</App>
```

---

## 1. Nameplate

**File:** `src/components/Nameplate.jsx`
**CSS classes:** `.nameplate`, `.nameplate__left`, `.nameplate__brand`, `.nameplate__right`, `.np-dot`

### Props
```typescript
interface NameplateProps {
  location: string                       // "Colombo, Sri Lanka"
  date: string                           // "Thursday, 12 March 2026 · 14:30 IST"
  currentView: 'mag' | 'fyp'
  onViewChange: (view: 'mag' | 'fyp') => void
  onLocationChange: (location: string) => void
  onMenuOpen: () => void
}
```

### Behavior
- Location click toggles dropdown (local state: `dropdownOpen`)
- Click outside closes dropdown
- Date/time: auto-updating or static (decide at build time)

---

## 2. LocationDropdown

**File:** `src/components/LocationDropdown.jsx`
**CSS classes:** `.loc-dropdown`, `.loc-opt`, `.loc-opt--active`

### Props
```typescript
interface LocationDropdownProps {
  isOpen: boolean
  current: string
  locations: string[]                    // ["Colombo, Sri Lanka", "London, United Kingdom", ...]
  onSelect: (location: string) => void
  onClose: () => void
}
```

### Behavior
- Absolute positioned below location text
- Active item highlighted with canopy text + 500 weight
- Hover: surface-hover bg

---

## 3. ViewSwitcher

**File:** `src/components/ViewSwitcher.jsx`
**CSS classes:** `.view-sw`, `.view-sw__opt`, `.view-sw__opt--active`, `.view-sw__grid`, `.view-sw__feed`

### Props
```typescript
interface ViewSwitcherProps {
  current: 'mag' | 'fyp'
  onChange: (view: 'mag' | 'fyp') => void
}
```

### Implementation notes
- Two buttons side-by-side in a segmented control
- SVG mask icons for grid (Magazine) and stacked-cards (FYP)
- Active state: jungle bg, white text
- Icons use CSS mask with data URI SVGs — see mockup lines 53-54

---

## 4. MenuPanel

**File:** `src/components/MenuPanel.jsx`
**CSS classes:** `.menu-overlay`, `.menu-panel`, `.menu-close`, `.menu-label`, `.menu-link`, `.menu-link--acct`, `.menu-link__sub`, `.menu-toggle-row`, `.menu-toggle`

### Props
```typescript
interface MenuPanelProps {
  isOpen: boolean
  onClose: () => void
  onLanguageToggle: () => void
  onDarkModeToggle: () => void
  languageActive: boolean               // true = Sinhala, false = English
  darkModeActive: boolean
}
```

### Sections
1. Navigate: Home, Dossiers, Tools & Dashboards, About The Analyst
2. Accountability: MP Accountability Tracker, Corrections & Retractions, Submit Evidence
3. Preferences: Language toggle, Dark mode toggle
4. Legal: Privacy Policy, Terms of Use, AI Safety & Ethics

### Behavior
- Overlay click closes menu (stopPropagation on panel)
- Menu slides from right: `translateX(100%) → translateX(0)`
- Toggle switches: `.menu-toggle.on` shifts `::after` pseudo-element
- Links hover: ochre color + 6px left padding

---

## 5. AccountabilityTicker

**File:** `src/components/AccountabilityTicker.jsx`
**Hook:** `src/hooks/useAccountabilityTicker.js`
**CSS classes:** `.acct-ticker`, `.acct-ticker--gone`, `.acct-strip`, `.acct-strip--internal`, `.acct-strip__dot`, `.acct-strip__type`, `.acct-strip__sep`, `.acct-strip__title`, `.acct-strip__meta`, `.acct-strip--flip-out`, `.acct-strip--flip-in`

### Props
```typescript
interface AccountabilityAlert {
  type: 'external' | 'internal'
  label: string                          // "Accountability" | "Correction" | "Retraction"
  title: string
  meta: string                           // "Filed 24 Feb" | "10 Mar" | "Ongoing"
  url?: string
}

interface AccountabilityTickerProps {
  alerts: AccountabilityAlert[]
  isVisible: boolean                     // false when FYP view active
  onClick?: (alert: AccountabilityAlert) => void
}
```

### Hook: useAccountabilityTicker
```typescript
function useAccountabilityTicker(alerts: AccountabilityAlert[]) {
  // Returns: { currentIndex, isCollapsed, triggerFlip }
  // Manages: 15s rotation timer, auto-dismiss after all shown
  // Single alert: 60s then collapse
  // Multiple: rotate all, then collapse
}
```

### Visual variants
- **External:** red pulsing dot, red-urgent type label
- **Internal:** ochre static dot, ochre type label

---

## 6. Hero

**File:** `src/components/Hero.jsx`
**CSS classes:** `.hero`, `.hero__img`, `.hero__grad`

### Props
```typescript
interface HeroProps {
  imageUrl: string                       // or gradient class for placeholder
  children: React.ReactNode              // HeroCard
}
```

### Layout
- 440px height, position relative, overflow visible (card hangs below)
- Full-bleed image
- Gradient overlay: left 55%, jungle→transparent

---

## 7. HeroCard

**File:** `src/components/HeroCard.jsx`
**CSS classes:** `.hero__card`, `.hero__card-title`, `.hero__card-excerpt`, `.hero__card-meta`, `.mk`, `.mk__k`, `.mk__v`, `.mk__v--hi`, `.kicker`, `.tag`, `.tg`, `.tt`, `.tw`

### Props
```typescript
interface HeroCardProps {
  kicker: string                         // "Featured Investigation"
  title: string
  excerpt: string
  metadata: {
    author: string
    published: string
    readTime: string
    sources: string                      // "3 independent"
    sourcesHighlight?: boolean           // true → terracotta color
  }
  tags: Array<{ label: string; variant: 'green' | 'terracotta' | 'ochre' }>
  onClick?: () => void
}
```

### Layout
- Absolute positioned: bottom -40px, left 48px, 500px wide
- White bg, border, rounded corners, shadow-lift
- Metadata: 2-column grid
- Tags: flex row with 5px gap

---

## 8. RotatingStrip

**File:** `src/components/RotatingStrip.jsx`
**Hook:** `src/hooks/useStripRotation.js`
**CSS classes:** `.strip`, `.strip__rule`, `.strip__slot`, `.strip__item`, `.strip__item--flip-out`, `.strip__item--flip-in`, `.strip__thumb`, `.strip__kicker`, `.strip__kicker--tool`, `.strip__kicker--intel`, `.strip__title`, `.strip__meta`, `.strip__progress`

### Props
```typescript
interface StripCard {
  gradient: string                       // CSS class for placeholder
  imageUrl?: string                      // production: actual image
  kicker: string
  kickerVariant?: 'default' | 'intel' | 'tool'
  title: string
  meta: string
  url?: string
}

interface RotatingStripProps {
  sets: StripCard[][]                    // Array of 3-card arrays
  interval?: number                      // Default 15000ms
  stagger?: number                       // Default 120ms
  flipDuration?: number                  // Default 350ms
}
```

### Hook: useStripRotation
```typescript
function useStripRotation(sets, interval, stagger, flipDuration) {
  // Returns: { currentSet, isFlipping, progressWidth, pause, resume }
  // Manages: setInterval for rotation, staggered setTimeout for per-card flip
  // Exposes: pause/resume for hover behavior
  // Handles: progress bar animation (CSS transition on width)
}
```

### Animation CSS
```css
@keyframes cardFlipOut {
  0% { transform: rotateX(0); opacity: 1; }
  100% { transform: rotateX(90deg); opacity: 0; }
}
@keyframes cardFlipIn {
  0% { transform: rotateX(-90deg); opacity: 0; }
  100% { transform: rotateX(0); opacity: 1; }
}
```

Container: `perspective: 600px` on `.strip__slot`
Element: `backface-visibility: hidden` on `.strip__item`

---

## 9. FilterBar

**File:** `src/components/FilterBar.jsx`
**CSS classes:** `.filter-bar`, `.filter-bar__label`, `.filter-bar__tabs`

### Props
```typescript
interface FilterBarProps {
  label: string                          // "Dossiers" or "For You"
  filters: string[]                      // ["All", "This Week", "This Month"]
  active: string
  onChange: (filter: string) => void
}
```

---

## 10. CategoryColumns

**File:** `src/components/CategoryColumns.jsx`
**CSS classes:** `.cols`, `.cols__rule`, `.col`, `.cat-head`, `.cat-head__title`, `.cat-head__badge`, `.cat-head__badge--chr`, `.cat-head__badge--algo`

### Props
```typescript
interface CategoryColumn {
  title: string                          // "Latest" | "Governance & Power" | etc.
  badge: { label: string; variant: 'chronological' | 'algorithmic' }
  articles: ArticleData[]
}

interface CategoryColumnsProps {
  columns: CategoryColumn[]              // Always 3
}
```

---

## 11. ArticleCard

**File:** `src/components/ArticleCard.jsx`
**CSS classes:** `.art`, `.art__thumb`, `.art__title`, `.art__excerpt`, `.art__meta`

### Props
```typescript
interface ArticleCardProps {
  title: string
  excerpt?: string                       // Optional — not all cards show excerpt
  meta: string                           // "25 Feb · 20 min"
  thumbnail?: string                     // Optional — first card in column has thumbnail
  gradient?: string                      // Placeholder gradient class
  onClick?: () => void
}
```

---

## 12. Pagination

**File:** `src/components/Pagination.jsx`
**CSS classes:** `.pagination`, `.pg` (active page)

### Props
```typescript
interface PaginationProps {
  current: number
  total: number
  onPageChange: (page: number) => void
}
```

---

## 13. TrendingSection

**File:** `src/components/TrendingSection.jsx`
**CSS classes:** `.sec-label`, `.sb-item`, `.sb-thumb`, `.sb-title`, `.sb-meta`

### Props
```typescript
interface TrendingItem {
  title: string
  reads: string                          // "4.2k reads"
  thumbnail?: string
  gradient?: string
  url?: string
}

interface TrendingSectionProps {
  items: TrendingItem[]
}
```

---

## 14. IntelCard

**File:** `src/components/IntelCard.jsx`
**CSS classes:** `.intel-card`, `.intel-card__label`, `.intel-card__figure`, `.intel-card__desc`, `.intel-card__change`, `.intel-card__change--up`, `.intel-card__change--down`

### Props
```typescript
interface IntelCardProps {
  label: string                          // "Breaking Figure · Editor Pinned"
  figure: string                         // "$94.20"
  description: string
  change?: {
    direction: 'up' | 'down'
    text: string                         // "+$3.40 (3.7%) today"
  }
  onClick?: () => void
}
```

---

## 15. ToolFeatureCard

**File:** `src/components/ToolFeatureCard.jsx`
**CSS classes:** `.tool-feature`, `.tool-feature__pinned`, `.tool-feature__name`, `.tool-feature__desc`, `.tool-feature__meta`, `.tool-feature__badge`, `.tool-feature__badge--live`

### Props
```typescript
interface ToolFeatureCardProps {
  name: string                           // "Hormuz Oracle"
  description: string
  href: string
  pinned?: boolean
  badges: Array<{ label: string; variant?: 'live' | 'default' }>
}
```

---

## 16. ToolInlineItem

**File:** `src/components/ToolInlineItem.jsx`
**CSS classes:** `.tool-inline`, `.tool-inline__dot`, `.tool-inline__dot--live`, `.tool-inline__dot--pinned`, `.tool-inline__name`, `.tool-inline__tag`

### Props
```typescript
interface ToolInlineItemProps {
  name: string
  status: 'live' | 'pinned' | 'default'
  tag: string                            // "Live" | "New"
  href?: string
}
```

---

## 17. FYPView

**File:** `src/components/FYPView.jsx`
**CSS classes:** `.fyp-view`

### Props
```typescript
interface FYPViewProps {
  articles: FYPArticle[]
  filter: string
  onFilterChange: (filter: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}
```

### Layout
- `max-width: 720px`, centered
- FilterBar + FYPCard list + Pagination

---

## 18. FYPCard

**File:** `src/components/FYPCard.jsx`
**CSS classes:** `.fyp-card`, `.fyp-card__img`, `.fyp-card__body`, `.fyp-card__kicker`, `.fyp-card__title`, `.fyp-card__excerpt`, `.fyp-card__meta`, `.fyp-card__tags`

### Props
```typescript
interface FYPCardProps {
  imageUrl?: string
  gradient?: string
  kicker: string
  kickerColor?: string                   // Override for intel (ochre) or figure (canopy)
  title: string
  excerpt: string
  meta: string[]                         // ["Riz Razak", "8 Mar 2026", "18 min read"]
  tags: Array<{ label: string; variant: 'green' | 'terracotta' | 'ochre' }>
  onClick?: () => void
}
```

---

## 19. Footer

**File:** `src/components/Footer.jsx`
**CSS classes:** `.footer`, `.footer__top`, `.footer__brand`, `.footer__tagline`, `.footer__links`, `.footer__link`, `.footer__divider`, `.footer__bottom`, `.footer__copy`, `.footer__stats`, `.footer__stat`, `.footer__stat-val`, `.np-dot-sm`

### Props
```typescript
interface FooterProps {
  stats?: {
    dossiers: number
    reads: string                        // "42k"
    exclusives: number
    toolsLive: number
  }
}
```

---

## CSS Organization

All magazine-specific styles go in `src/styles/magazine.css`, imported alongside `global.css`.

The CSS from `magazine-v7-full.html` is the exact production CSS — extract it verbatim, just organize into sections with clear comments matching the component names above.

### Tag Variants (shared atoms)
```css
.tag    { /* base: surface bg, stone text */ }
.tg     { /* green: canopy bg/text */ }
.tt     { /* terracotta: terracotta bg/text */ }
.tw     { /* ochre: ochre bg/text */ }
```

### Gradient Placeholders (temporary)
```css
.g1 through .g12  { /* gradient fills for dev/placeholder thumbnails */ }
```
These can be removed once real images are integrated.
