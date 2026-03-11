/**
 * SpineNav — Dossier Navigation Module
 * analyst.rizrazak.com/_shared/dossier-spine-nav.js
 *
 * ═══════════════════════════════════════════════════════════════════════
 * MODULE NAME:  SpineNav
 * INVOKE:       window.SpineNav
 * VERSION:      1.0.0
 *
 * USAGE (zero-config / auto-discovery):
 *   1. Add <link rel="stylesheet" href="/_shared/dossier-spine-nav.css">
 *   2. Add <script src="/_shared/dossier-spine-nav.js"></script>
 *   3. Add data-nav-label="Label" and data-nav-year="2004–2009"
 *      and data-nav-era="#4a7c59" to your <section> elements
 *   → SpineNav builds everything automatically
 *
 * USAGE (manual JSON config):
 *   <script type="application/json" id="spine-nav-config">
 *   {
 *     "mode": "vertical",
 *     "fabLabel": "Sections",
 *     "fabCollapseDelay": 3500,
 *     "panelHeading": "Navigation",
 *     "sections": [
 *       { "id": "evidence", "label": "Evidence", "year": "2004–2009", "era": "#4a7c59" }
 *     ],
 *     "story": [
 *       { "at": 0.04, "text": "The story begins" }
 *     ]
 *   }
 *   </script>
 *
 * CONFIG OPTIONS:
 *   mode             — "vertical" (default) | "horizontal"
 *   fabLabel         — Text on mobile FAB (default: "Sections")
 *   fabCollapseDelay — ms before FAB label retracts (default: 3500)
 *   panelHeading     — Heading in mobile overlay panel (default: "Navigation")
 *   sections[]       — Array of { id, label, year, era }
 *   story[]          — Array of { at (0–1 scroll fraction), text }
 *
 * LOCKED CORE (protected from override):
 *   ✓ Era bands + fill line
 *   ✓ Hairline marks
 *   ✓ Story labels with multi-fade + exclusion zones
 *   ✓ rAF scroll engine with getBoundingClientRect detection
 *   ✓ Mobile FAB + overlay panel with staggered reveal
 *   ✓ Horizontal mode scroll-into-view for active item
 *
 * PUBLIC API:
 *   window.SpineNav.update()      — Force scroll recalculation
 *   window.SpineNav.setMode(m)    — Switch mode ('vertical'|'horizontal')
 *   window.SpineNav.openPanel()   — Open mobile panel
 *   window.SpineNav.closePanel()  — Close mobile panel
 *   window.SpineNav.config        — Read-only access to resolved config
 * ═══════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ── DEFAULTS ────────────────────────────────────────────────────────────
  var DEFAULTS = {
    mode: 'vertical',
    fabLabel: 'Sections',
    fabCollapseDelay: 3500,
    panelHeading: 'Navigation',
    sections: null,
    story: null
  };

  // ── READ CONFIG ─────────────────────────────────────────────────────────
  var configEl = document.getElementById('spine-nav-config');
  var userConfig = {};
  if (configEl) {
    try { userConfig = JSON.parse(configEl.textContent); } catch (e) { /* silent */ }
  }

  var cfg = {};
  for (var k in DEFAULTS) { cfg[k] = (userConfig[k] !== undefined) ? userConfig[k] : DEFAULTS[k]; }

  // ── AUTO-DISCOVER SECTIONS ──────────────────────────────────────────────
  if (!cfg.sections) {
    cfg.sections = [];
    var secEls = document.querySelectorAll('section[data-nav-label]');
    var idx = 0;
    secEls.forEach(function(sec) {
      if (sec.id) {
        cfg.sections.push({
          id: sec.id,
          label: sec.getAttribute('data-nav-label'),
          year: sec.getAttribute('data-nav-year') || '',
          era: sec.getAttribute('data-nav-era') || '#4a7c59'
        });
        idx++;
      }
    });
  }

  if (cfg.sections.length === 0) return; // Nothing to build

  // ── STATE ───────────────────────────────────────────────────────────────
  var items = [];       // { id, el, railLink, hbarLink, panelLink, band, hband, mark }
  var storyEls = [];    // { el, at, safe }
  var ticking = false;
  var EXCLUSION = 18;
  var mode = cfg.mode;

  // ── HELPER ──────────────────────────────────────────────────────────────
  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function isMobile() { return window.innerWidth < 768; }


  // ═══════════════════════════════════════════════════════════════════════
  //  BUILD DOM — VERTICAL RAIL
  // ═══════════════════════════════════════════════════════════════════════

  var rail = el('nav', 'spine-rail');
  rail.setAttribute('aria-label', 'Section navigation');

  var eraBands = el('div', 'sn-era-bands', rail);
  var fillLine = el('div', 'sn-fill', rail);
  var spineItems = el('div', 'sn-items', rail);
  var storyTrack = el('div', 'sn-story-track', rail);

  cfg.sections.forEach(function(s, i) {
    // Era band
    var band = el('div', 'sn-era-band', eraBands);
    band.style.background = s.era;

    // Nav item
    var a = el('a', 'sn-item');
    a.href = '#' + s.id;

    var mark = el('span', 'sn-mark', a);
    mark.style.setProperty('--mark-era', s.era);

    var tip = el('span', 'sn-tip', a);
    tip.innerHTML = '<span class="sn-tip-name">' + s.label + '</span><span class="sn-tip-year">' + s.year + '</span>';

    var dl = el('span', 'sn-dlabel', a);
    dl.innerHTML = '<span class="sn-dname">' + s.label + '</span><span class="sn-dyear">' + s.year + '</span>';

    spineItems.appendChild(a);

    items.push({
      id: s.id,
      el: document.getElementById(s.id),
      railLink: a,
      band: band,
      hbarLink: null,
      hband: null,
      panelLink: null
    });
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  BUILD DOM — HORIZONTAL BAR
  // ═══════════════════════════════════════════════════════════════════════

  var hbar = el('div', 'sn-hbar');
  var hbarTrack = el('div', 'sn-hbar-track', hbar);
  var hbarFill = el('div', 'sn-hbar-fill', hbar);
  var hbarItems = el('div', 'sn-hbar-items', hbar);
  var hbarContext = el('span', 'sn-hbar-context', hbar);

  cfg.sections.forEach(function(s, i) {
    // Horizontal era band
    var hband = el('div', 'sn-hbar-band', hbarTrack);
    hband.style.background = s.era;
    items[i].hband = hband;

    // Horizontal nav item
    var a = el('a', 'sn-hbar-item');
    a.href = '#' + s.id;
    a.innerHTML = s.label + (s.year ? ' <span class="sn-hbar-year">' + s.year + '</span>' : '');
    hbarItems.appendChild(a);
    items[i].hbarLink = a;
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  BUILD DOM — MOBILE FAB + OVERLAY PANEL
  // ═══════════════════════════════════════════════════════════════════════

  var overlay = el('div', 'sn-overlay');
  var panel = el('div', 'sn-panel');

  var panelHeading = el('div', 'sn-panel-heading', panel);
  panelHeading.textContent = cfg.panelHeading;

  var panelTl = el('div', 'sn-panel-tl', panel);

  cfg.sections.forEach(function(s, i) {
    var a = el('a', 'sn-panel-item');
    a.href = '#' + s.id;

    el('span', 'sn-panel-dot', a);
    var num = el('span', 'sn-panel-num', a);
    num.textContent = String(i + 1).padStart(2, '0');
    var lbl = el('span', 'sn-panel-label', a);
    lbl.textContent = s.label;
    if (s.year) {
      var yr = el('span', 'sn-panel-year', a);
      yr.textContent = s.year;
    }

    panelTl.appendChild(a);
    items[i].panelLink = a;
  });

  var panelProgress = el('div', 'sn-panel-progress', panel);
  var panelProgressFill = el('div', 'sn-panel-progress-fill', panelProgress);

  // FAB
  var fab = el('button', 'sn-fab');
  fab.setAttribute('aria-label', 'Table of contents');
  fab.title = 'Jump to section';
  var fabIcon = el('span', 'sn-fab-icon', fab);
  fabIcon.textContent = '☰';
  var fabLabelSpan = el('span', 'sn-fab-label', fab);
  fabLabelSpan.textContent = cfg.fabLabel;

  // Mobile context banner
  var mobileContext = el('div', 'sn-mobile-context');
  var mcText = el('span', 'sn-mc-text', mobileContext);


  // ═══════════════════════════════════════════════════════════════════════
  //  BUILD DOM — STORY LABELS (vertical rail + horizontal context)
  // ═══════════════════════════════════════════════════════════════════════

  if (cfg.story && cfg.story.length > 0) {
    cfg.story.forEach(function(sl) {
      var wrap = el('div', 'sn-story-label');
      wrap.setAttribute('data-fade', 'hidden');
      el('span', 'sn-sl-tick', wrap);
      var txt = el('span', 'sn-sl-text', wrap);
      txt.textContent = sl.text;
      storyTrack.appendChild(wrap);
      storyEls.push({ el: wrap, at: sl.at, safe: true, text: sl.text });
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INSERT INTO DOM
  // ═══════════════════════════════════════════════════════════════════════

  var topBar = document.querySelector('.top-bar, .navbar, nav[role="navigation"], header');
  var insertRef = topBar ? topBar.nextElementSibling : document.body.firstChild;

  document.body.insertBefore(rail, insertRef);
  document.body.insertBefore(hbar, insertRef);
  document.body.insertBefore(overlay, insertRef);
  document.body.insertBefore(panel, insertRef);
  document.body.insertBefore(mobileContext, insertRef);
  document.body.appendChild(fab);

  // Set initial mode
  applyMode(mode);


  // ═══════════════════════════════════════════════════════════════════════
  //  FAB INTERACTION
  // ═══════════════════════════════════════════════════════════════════════

  setTimeout(function() { fab.classList.add('collapsed'); }, cfg.fabCollapseDelay);

  function openPanel() {
    panel.classList.add('open');
    overlay.classList.add('open');
  }
  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  }
  function togglePanel() {
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  fab.addEventListener('click', togglePanel);
  overlay.addEventListener('click', closePanel);

  // Close panel on link click
  items.forEach(function(item) {
    if (item.panelLink) {
      item.panelLink.addEventListener('click', function() {
        setTimeout(closePanel, 150);
      });
    }
  });

  // Mobile tap tooltips on vertical rail
  var tipTimer;
  items.forEach(function(item) {
    item.railLink.addEventListener('click', function() {
      if (isMobile()) {
        items.forEach(function(i) { i.railLink.classList.remove('show-tip'); });
        item.railLink.classList.add('show-tip');
        clearTimeout(tipTimer);
        tipTimer = setTimeout(function() { item.railLink.classList.remove('show-tip'); }, 2500);
      }
    });
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  MODE SWITCHING
  // ═══════════════════════════════════════════════════════════════════════

  function applyMode(m) {
    mode = m;
    document.body.classList.remove('sn-vertical', 'sn-horizontal');
    document.body.classList.add('sn-' + mode);
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXCLUSION ZONES (story labels avoid nav item Y positions)  ── LOCKED
  // ═══════════════════════════════════════════════════════════════════════

  function computeSafe() {
    if (storyEls.length === 0) return;
    var trackH = storyTrack.offsetHeight;
    if (trackH <= 0) return;

    var railRect = rail.getBoundingClientRect();
    var padTop = parseFloat(getComputedStyle(rail).paddingTop) || 52;

    var navYs = [];
    var navLinks = spineItems.querySelectorAll('.sn-item');
    navLinks.forEach(function(ni) {
      var r = ni.getBoundingClientRect();
      navYs.push(r.top + r.height / 2 - railRect.top - padTop);
    });

    storyEls.forEach(function(sl) {
      var targetY = sl.at * trackH;
      sl.safe = true;
      for (var d = 0; d < navYs.length; d++) {
        if (Math.abs(targetY - navYs[d]) < EXCLUSION) {
          sl.safe = false; break;
        }
      }
      sl.el.style.top = targetY + 'px';
    });
  }

  requestAnimationFrame(computeSafe);
  window.addEventListener('resize', function() { requestAnimationFrame(computeSafe); });


  // ═══════════════════════════════════════════════════════════════════════
  //  SCROLL ENGINE  ── LOCKED
  // ═══════════════════════════════════════════════════════════════════════

  function update() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var viewH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    var maxScroll = Math.max(1, docH - viewH);
    var progress = Math.min(1, scrollY / maxScroll);

    // ── Vertical fill line ─────────────────────────────────────────────
    var railPadding = parseFloat(getComputedStyle(rail).paddingTop) + parseFloat(getComputedStyle(rail).paddingBottom);
    var trackH = rail.offsetHeight - railPadding;
    fillLine.style.height = (progress * trackH) + 'px';

    // ── Horizontal fill ────────────────────────────────────────────────
    hbarFill.style.width = (progress * 100) + '%';
    panelProgressFill.style.width = (progress * 100) + '%';

    // ── Active section detection ───────────────────────────────────────
    var currentIdx = -1;
    for (var i = items.length - 1; i >= 0; i--) {
      if (!items[i].el) continue;
      if (items[i].el.getBoundingClientRect().top <= viewH * 0.4) {
        currentIdx = i; break;
      }
    }

    // ── Update all nav states ──────────────────────────────────────────
    items.forEach(function(item, idx) {
      var isActive = (idx === currentIdx);
      var isPassed = (idx < currentIdx);

      // Vertical rail
      item.railLink.classList.toggle('active', isActive);
      item.railLink.classList.toggle('passed', isPassed);
      item.band.classList.toggle('lit', isActive || isPassed);

      // Horizontal bar
      if (item.hbarLink) {
        item.hbarLink.classList.toggle('active', isActive);
        item.hbarLink.classList.toggle('passed', isPassed);
      }
      if (item.hband) {
        item.hband.classList.toggle('lit', isActive || isPassed);
      }

      // Mobile panel
      if (item.panelLink) {
        item.panelLink.classList.toggle('active', isActive);
      }
    });

    // Auto-scroll horizontal bar to keep active item visible
    if (currentIdx >= 0 && items[currentIdx].hbarLink && mode === 'horizontal' && !isMobile()) {
      var activeHItem = items[currentIdx].hbarLink;
      var containerRect = hbarItems.getBoundingClientRect();
      var itemRect = activeHItem.getBoundingClientRect();
      if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
        activeHItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }

    // ── Story labels multi-fade ── LOCKED ──────────────────────────────
    var nearestText = '';
    var nearestDist = Infinity;

    storyEls.forEach(function(sl) {
      var dist = progress - sl.at;
      var absDist = Math.abs(dist);
      var fade = 'hidden';

      if (!sl.safe) {
        fade = 'hidden';
      } else if (absDist < 0.04) {
        fade = 'active';
        if (absDist < nearestDist) {
          nearestDist = absDist;
          nearestText = sl.text;
        }
      } else if (dist > 0 && dist < 0.12) {
        fade = 'passed-1';
      } else if (dist >= 0.12 && dist < 0.25) {
        fade = 'passed-2';
      } else if (dist < 0 && dist > -0.10) {
        fade = 'upcoming-1';
      } else if (dist <= -0.10 && dist > -0.20) {
        fade = 'upcoming-2';
      }

      sl.el.setAttribute('data-fade', fade);
    });

    // ── Mobile context banner ──────────────────────────────────────────
    mcText.textContent = nearestText;
    if (nearestText) mcText.classList.add('show');
    else mcText.classList.remove('show');

    // ── Horizontal context label ───────────────────────────────────────
    hbarContext.textContent = nearestText;
    if (nearestText) hbarContext.classList.add('show');
    else hbarContext.classList.remove('show');

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  // Initial render
  update();


  // ═══════════════════════════════════════════════════════════════════════
  //  RESIZE HANDLER
  // ═══════════════════════════════════════════════════════════════════════

  window.addEventListener('resize', function() {
    requestAnimationFrame(update);
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API — window.SpineNav
  // ═══════════════════════════════════════════════════════════════════════

  window.SpineNav = {
    update: function() { requestAnimationFrame(update); },
    setMode: function(m) {
      if (m === 'vertical' || m === 'horizontal') applyMode(m);
    },
    openPanel: openPanel,
    closePanel: closePanel,
    config: cfg
  };

})();
