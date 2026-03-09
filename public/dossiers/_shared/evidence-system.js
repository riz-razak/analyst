/**
 * Evidence System — Shared across all dossiers
 * analyst.rizrazak.com
 * Last updated: 2026-03-09
 *
 * Features:
 * - Smooth scroll navigation between ref-markers, evidence cards, and source index
 * - Highlight target card/row on navigation
 * - Mobile-friendly tap behavior
 */

(function () {
  'use strict';

  // ===== SMOOTH SCROLL + HIGHLIGHT =====
  const HIGHLIGHT_DURATION = 2000; // ms

  function highlightElement(el) {
    if (!el) return;
    el.style.transition = 'box-shadow 0.3s, outline 0.3s';
    el.style.outline = '2px solid var(--forest, #2d5a27)';
    el.style.boxShadow = '0 0 16px rgba(45,90,39,0.2)';
    setTimeout(() => {
      el.style.outline = 'none';
      el.style.boxShadow = 'none';
    }, HIGHLIGHT_DURATION);
  }

  function smoothScrollTo(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    // For table rows, highlight the row
    if (target.tagName === 'TR') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const cells = target.querySelectorAll('td');
      cells.forEach(td => {
        td.style.transition = 'background 0.3s';
        td.style.background = 'var(--sage-mist, #e8f0e2)';
        setTimeout(() => { td.style.background = ''; }, HIGHLIGHT_DURATION);
      });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightElement(target);
    }
  }

  // ===== CLICK HANDLERS FOR REF-MARKERS AND NAV LINKS =====
  document.addEventListener('click', function (e) {
    const marker = e.target.closest('.ref-marker, .ev-nav-link');
    if (!marker) return;

    const href = marker.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    e.preventDefault();
    const targetId = href.substring(1);
    smoothScrollTo(targetId);

    // Update URL hash without jumping
    history.pushState(null, '', href);
  });

  // ===== ON PAGE LOAD: SCROLL TO HASH TARGET =====
  function handleHashOnLoad() {
    const hash = window.location.hash;
    if (!hash) return;
    const targetId = hash.substring(1);
    // Small delay to let page render
    setTimeout(() => smoothScrollTo(targetId), 300);
  }

  // Handle hash changes (back/forward navigation)
  window.addEventListener('hashchange', function () {
    const targetId = window.location.hash.substring(1);
    if (targetId) smoothScrollTo(targetId);
  });

  // On DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleHashOnLoad);
  } else {
    handleHashOnLoad();
  }
})();
