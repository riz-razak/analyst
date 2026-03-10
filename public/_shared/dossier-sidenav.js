/**
 * dossier-sidenav.js — Persistent Side Navigation Module
 * analyst.rizrazak.com
 *
 * USAGE:
 *   1. Add <link rel="stylesheet" href="/_shared/dossier-sidenav.css"> to <head>
 *   2. Add <script src="/_shared/dossier-sidenav.js"></script> before </body>
 *   3. Define sections in a JSON config block OR let it auto-discover from
 *      <section id="..." data-nav-label="..."> elements
 *
 * AUTO-DISCOVERY MODE (zero-config):
 *   Just add data-nav-label="Section Name" to your <section> elements.
 *   The script will build the side nav, FAB, and overlay automatically.
 *
 * MANUAL MODE (via JSON config):
 *   <script type="application/json" id="sidenav-config">
 *   {
 *     "label": "Navigation",
 *     "fabLabel": "Sections",
 *     "fabCollapseDelay": 3000,
 *     "heroThreshold": 0.6,
 *     "sections": [
 *       { "id": "incident", "num": "01", "label": "The Incident" },
 *       { "id": "evidence", "num": "02", "label": "Evidence" }
 *     ]
 *   }
 *   </script>
 *
 * CONFIG OPTIONS:
 *   label             — Heading above nav links (default: "Navigation")
 *   fabLabel          — Text shown on FAB button (default: "Sections")
 *   fabCollapseDelay  — ms before FAB label retracts (default: 3500)
 *   heroThreshold     — scroll fraction before desktop sidebar appears (default: 0.6)
 *   sections[]        — Array of { id, num, label }
 */

(function() {
  'use strict';

  // ── Defaults ──────────────────────────────────────────────────────────
  var DEFAULTS = {
    label: 'Navigation',
    fabLabel: 'Sections',
    fabCollapseDelay: 3500,
    heroThreshold: 0.6
  };

  // ── Read config ───────────────────────────────────────────────────────
  var configEl = document.getElementById('sidenav-config');
  var config = {};
  if (configEl) {
    try { config = JSON.parse(configEl.textContent); } catch (e) { /* silent */ }
  }
  var label      = config.label            || DEFAULTS.label;
  var fabLabel   = config.fabLabel          || DEFAULTS.fabLabel;
  var fabDelay   = config.fabCollapseDelay  || DEFAULTS.fabCollapseDelay;
  var heroThresh = config.heroThreshold     || DEFAULTS.heroThreshold;
  var sectionDefs = config.sections         || null;

  // ── Auto-discover sections if none provided ───────────────────────────
  if (!sectionDefs) {
    sectionDefs = [];
    var sectionEls = document.querySelectorAll('section[data-nav-label]');
    var idx = 1;
    sectionEls.forEach(function(sec) {
      if (sec.id) {
        sectionDefs.push({
          id: sec.id,
          num: String(idx).padStart(2, '0'),
          label: sec.getAttribute('data-nav-label')
        });
        idx++;
      }
    });
  }

  if (sectionDefs.length === 0) return; // Nothing to build

  // ── Build DOM ─────────────────────────────────────────────────────────

  // Overlay
  var overlay = document.createElement('div');
  overlay.className = 'side-nav-overlay';
  overlay.id = 'side-nav-overlay';

  // Side panel
  var nav = document.createElement('nav');
  nav.className = 'side-nav';
  nav.id = 'side-nav';
  nav.setAttribute('aria-label', 'Section navigation');

  var navLabel = document.createElement('div');
  navLabel.className = 'side-nav-label';
  navLabel.textContent = label;
  nav.appendChild(navLabel);

  var links = [];
  sectionDefs.forEach(function(s) {
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.setAttribute('data-section', s.id);

    var dot = document.createElement('span');
    dot.className = 'sn-dot';
    a.appendChild(dot);

    var num = document.createElement('span');
    num.className = 'sn-num';
    num.textContent = s.num;
    a.appendChild(num);

    a.appendChild(document.createTextNode(' ' + s.label));

    nav.appendChild(a);
    links.push({ id: s.id, el: document.getElementById(s.id), link: a });
  });

  // Progress bar
  var progressWrap = document.createElement('div');
  progressWrap.className = 'side-nav-progress';
  var progressFill = document.createElement('div');
  progressFill.className = 'side-nav-progress-fill';
  progressFill.id = 'side-nav-progress';
  progressWrap.appendChild(progressFill);
  nav.appendChild(progressWrap);

  // FAB
  var fab = document.createElement('button');
  fab.className = 'side-nav-fab';
  fab.id = 'side-nav-fab';
  fab.setAttribute('aria-label', 'Table of contents');
  fab.title = 'Jump to section';

  var fabIcon = document.createElement('span');
  fabIcon.className = 'fab-icon';
  fabIcon.textContent = '☰';
  fab.appendChild(fabIcon);

  var fabLabelSpan = document.createElement('span');
  fabLabelSpan.className = 'fab-label';
  fabLabelSpan.textContent = fabLabel;
  fab.appendChild(fabLabelSpan);

  // Insert into DOM (after navbar or at start of body)
  var navbar = document.querySelector('.navbar, nav[role="navigation"], header');
  var insertRef = navbar ? navbar.nextElementSibling : document.body.firstChild;
  document.body.insertBefore(overlay, insertRef);
  document.body.insertBefore(nav, insertRef);
  document.body.appendChild(fab);

  // ── Desktop class ─────────────────────────────────────────────────────
  var isDesktop = function() { return window.innerWidth >= 1200; };
  if (isDesktop()) document.body.classList.add('side-nav-active');

  // ── FAB label auto-retract ────────────────────────────────────────────
  setTimeout(function() {
    fab.classList.add('collapsed');
  }, fabDelay);

  // ── Toggle / Close ────────────────────────────────────────────────────
  function openSideNav() {
    nav.classList.add('visible');
    overlay.classList.add('open');
  }
  function closeSideNav() {
    nav.classList.remove('visible');
    overlay.classList.remove('open');
  }
  function toggleSideNav() {
    if (isDesktop()) return;
    if (nav.classList.contains('visible')) {
      closeSideNav();
    } else {
      openSideNav();
    }
  }

  fab.addEventListener('click', toggleSideNav);
  overlay.addEventListener('click', closeSideNav);

  // Close on link click (mobile)
  links.forEach(function(item) {
    item.link.addEventListener('click', function() {
      if (!isDesktop()) setTimeout(closeSideNav, 150);
    });
  });

  // ── Scroll tracking ───────────────────────────────────────────────────
  var ticking = false;

  function updateNav() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var viewH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;

    // Progress
    var progress = Math.min(1, scrollY / Math.max(1, docH - viewH));
    progressFill.style.width = (progress * 100) + '%';

    // Desktop: show/hide based on scroll
    if (isDesktop()) {
      if (scrollY > viewH * heroThresh) {
        nav.classList.add('visible');
      } else {
        nav.classList.remove('visible');
      }
    }

    // Active section
    var currentId = '';
    for (var i = links.length - 1; i >= 0; i--) {
      if (!links[i].el) continue;
      var rect = links[i].el.getBoundingClientRect();
      if (rect.top <= viewH * 0.4) {
        currentId = links[i].id;
        break;
      }
    }

    links.forEach(function(item) {
      if (item.id === currentId) {
        item.link.classList.add('active');
      } else {
        item.link.classList.remove('active');
      }
    });

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) { ticking = true; requestAnimationFrame(updateNav); }
  }, { passive: true });

  updateNav();

  // ── Resize handler ────────────────────────────────────────────────────
  window.addEventListener('resize', function() {
    if (isDesktop()) {
      document.body.classList.add('side-nav-active');
      overlay.classList.remove('open');
    } else {
      document.body.classList.remove('side-nav-active');
      nav.classList.remove('visible');
    }
  });

  // ── Expose for manual control ─────────────────────────────────────────
  window.DossierSideNav = {
    open: openSideNav,
    close: closeSideNav,
    toggle: toggleSideNav,
    update: updateNav
  };

})();
