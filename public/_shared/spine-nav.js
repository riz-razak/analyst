/**
 * spine-nav.js — Spine Rail Navigation Module
 * analyst.rizrazak.com
 *
 * USAGE:
 *   1. Add <link rel="stylesheet" href="/_shared/spine-nav.css"> to <head>
 *   2. Add <script src="/_shared/spine-nav.js"></script> before </body>
 *   3. Define sections via data-nav-label attributes on <section> elements
 *      OR provide a JSON config block:
 *
 *   <script type="application/json" id="spine-nav-config">
 *   {
 *     "topOffset": 56,
 *     "sections": [
 *       { "id": "incident", "label": "The Incident" },
 *       { "id": "evidence", "label": "Evidence" }
 *     ]
 *   }
 *   </script>
 *
 * CONFIG OPTIONS:
 *   topOffset  — px from top (e.g. navbar height), default: 0
 *   sections[] — Array of { id, label }
 */

(function() {
  'use strict';

  // ── Read config ───────────────────────────────────────────────────────
  var configEl = document.getElementById('spine-nav-config');
  var config = {};
  if (configEl) {
    try { config = JSON.parse(configEl.textContent); } catch (e) { /* silent */ }
  }

  var topOffset = config.topOffset || 0;
  var sectionDefs = config.sections || null;

  // ── Auto-discover sections if none provided ───────────────────────────
  if (!sectionDefs) {
    sectionDefs = [];
    var sectionEls = document.querySelectorAll('section[data-nav-label]');
    sectionEls.forEach(function(sec) {
      if (sec.id) {
        sectionDefs.push({
          id: sec.id,
          label: sec.getAttribute('data-nav-label')
        });
      }
    });
  }

  if (sectionDefs.length === 0) return; // Nothing to build

  // ── Apply top offset via CSS custom property ──────────────────────────
  if (topOffset > 0) {
    document.documentElement.style.setProperty('--spine-top', topOffset + 'px');
  }

  // ── Build DOM ─────────────────────────────────────────────────────────

  // Rail container
  var rail = document.createElement('nav');
  rail.className = 'spine-rail';
  rail.id = 'spine-rail';
  rail.setAttribute('aria-label', 'Section navigation');

  // Track line
  var track = document.createElement('div');
  track.className = 'spine-track';
  rail.appendChild(track);

  // Fill line
  var fill = document.createElement('div');
  fill.className = 'spine-fill';
  fill.id = 'spine-fill';
  rail.appendChild(fill);

  // Items container
  var itemsWrap = document.createElement('div');
  itemsWrap.className = 'spine-items';
  itemsWrap.id = 'spine-items';

  var items = [];
  sectionDefs.forEach(function(s) {
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.className = 'spine-item';
    a.setAttribute('data-section', s.id);

    var dot = document.createElement('span');
    dot.className = 'spine-dot';
    a.appendChild(dot);

    var lbl = document.createElement('span');
    lbl.className = 'spine-label';
    lbl.textContent = s.label;
    a.appendChild(lbl);

    itemsWrap.appendChild(a);
    items.push({ id: s.id, el: document.getElementById(s.id), link: a });
  });

  rail.appendChild(itemsWrap);

  // Insert into DOM at start of body
  document.body.insertBefore(rail, document.body.firstChild);

  // Mark body for content offset
  document.body.classList.add('spine-nav-active');

  // ── Mobile tap-to-show label ──────────────────────────────────────────
  var labelTimeout;
  items.forEach(function(item) {
    item.link.addEventListener('click', function() {
      if (window.innerWidth < 768) {
        item.link.classList.add('show-label');
        clearTimeout(labelTimeout);
        labelTimeout = setTimeout(function() {
          items.forEach(function(i) { i.link.classList.remove('show-label'); });
        }, 2000);
      }
    });
  });

  // ── Scroll tracking ───────────────────────────────────────────────────
  var ticking = false;

  function updateScroll() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var viewH = window.innerHeight;
    var docH = document.documentElement.scrollHeight;
    var progress = Math.min(1, scrollY / Math.max(1, docH - viewH));

    // Fill line height
    var railRect = rail.getBoundingClientRect();
    var trackTop = 60; // padding-top of track
    var trackBottom = 24; // padding-bottom
    var trackHeight = railRect.height - trackTop - trackBottom;
    fill.style.height = (progress * trackHeight) + 'px';

    // Active section detection
    var currentId = '';
    for (var i = items.length - 1; i >= 0; i--) {
      if (!items[i].el) continue;
      var rect = items[i].el.getBoundingClientRect();
      if (rect.top <= viewH * 0.4) {
        currentId = items[i].id;
        break;
      }
    }

    var foundCurrent = false;
    items.forEach(function(item) {
      item.link.classList.remove('active', 'passed');
      if (item.id === currentId) {
        item.link.classList.add('active');
        foundCurrent = true;
      } else if (!foundCurrent) {
        item.link.classList.add('passed');
      }
    });

    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) { ticking = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });

  updateScroll();

  // ── Expose for manual control ─────────────────────────────────────────
  window.SpineNav = {
    update: updateScroll,
    items: items
  };

})();
