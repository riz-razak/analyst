/**
 * _analytics_events.js — Mission-aligned custom event tracking
 * analyst.rizrazak.com
 *
 * Tracks signals that matter for investigative journalism impact:
 *   1. REACH      — Are people finding this?
 *   2. DEPTH      — Are they actually reading?
 *   3. RESONANCE  — Is it making them think?
 *   4. AUDIENCE   — Who is engaging?
 *
 * All events flow into GA4 → Engagement → Events.
 * GDPR-aware: only fires if gtag is loaded (which itself respects consent).
 */
(function () {
  'use strict';

  /* ── helpers ───────────────────────────────────────────────────────────── */
  function track(event, params) {
    if (window.gtag) {
      params = params || {};
      params.page_title = document.title;
      params.page_path  = location.pathname;
      window.gtag('event', event, params);
    }
  }

  var pagePath = location.pathname;

  /* ════════════════════════════════════════════════════════════════════════
     1. SCROLL DEPTH — how far down the page do readers get?
     ════════════════════════════════════════════════════════════════════════ */
  var scrollMarks = [25, 50, 75, 90, 100];
  var scrollFired = {};

  function getScrollPct() {
    var h  = document.documentElement;
    var b  = document.body;
    var st = h.scrollTop || b.scrollTop;
    var sh = Math.max(h.scrollHeight, b.scrollHeight) - h.clientHeight;
    if (sh <= 0) return 100;
    return Math.round((st / sh) * 100);
  }

  window.addEventListener('scroll', function () {
    var pct = getScrollPct();
    scrollMarks.forEach(function (mark) {
      if (pct >= mark && !scrollFired[mark]) {
        scrollFired[mark] = true;
        track('scroll_depth', { percent: mark });
      }
    });
  }, { passive: true });

  /* ════════════════════════════════════════════════════════════════════════
     2. ENGAGED READ TIME — time actually spent reading (tab visible)
        Fires at 30s, 1min, 2min, 5min, 10min thresholds.
        This separates skimmers from deep readers.
     ════════════════════════════════════════════════════════════════════════ */
  var readStart      = Date.now();
  var readTimeFired   = {};
  var readTimeMarks   = [30, 60, 120, 300, 600]; // seconds

  setInterval(function () {
    if (document.hidden) return; // only count visible time
    var elapsed = Math.round((Date.now() - readStart) / 1000);
    readTimeMarks.forEach(function (mark) {
      if (elapsed >= mark && !readTimeFired[mark]) {
        readTimeFired[mark] = true;
        track('engaged_read_time', { seconds: mark, label: mark + 's' });
      }
    });
  }, 5000);

  /* ════════════════════════════════════════════════════════════════════════
     3. CHAPTER / SECTION VISIBILITY — which sections do readers reach?
        Uses IntersectionObserver on [id] elements with common section patterns.
     ════════════════════════════════════════════════════════════════════════ */
  var sectionsSeen = {};
  if (window.IntersectionObserver) {
    var sectionObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !sectionsSeen[entry.target.id]) {
          sectionsSeen[entry.target.id] = true;
          track('section_view', { section_id: entry.target.id });
        }
      });
    }, { threshold: 0.3 });

    // Observe all major section anchors
    document.querySelectorAll(
      'section[id], [id^="chapter"], [id^="section"], [id^="s-"], ' +
      '#anatomy, #melbet-dialog, #kheloyar, #wolf777, #celebrities, ' +
      '#enablers, #loop, #convictions, #stbet, #humancost, #accountability, #networkmap'
    ).forEach(function (el) { sectionObs.observe(el); });
  }

  /* ════════════════════════════════════════════════════════════════════════
     4. SOCIAL SHARE CLICKS
     ════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.nav-social-link, .share-btn, [data-share], a[href*="facebook.com/sharer"], a[href*="twitter.com/intent"], a[href*="wa.me"], a[href*="t.me"]');
    if (link) {
      var platform = link.title || link.dataset.share || 'unknown';
      if (link.href) {
        if (link.href.includes('facebook'))  platform = 'facebook';
        if (link.href.includes('twitter') || link.href.includes('x.com'))  platform = 'twitter';
        if (link.href.includes('wa.me') || link.href.includes('whatsapp')) platform = 'whatsapp';
        if (link.href.includes('t.me') || link.href.includes('telegram'))  platform = 'telegram';
      }
      track('share_click', { platform: platform });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     5. LANGUAGE TOGGLE — Sinhala reach
        Tracks every EN↔SI switch. High SI usage = reaching local audience.
     ════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#lang-toggle, .lang-btn, [onclick*="toggleLang"]');
    if (btn) {
      // The lang change hasn't happened yet at click time, so the
      // current lang is what they're switching FROM.
      var fromLang = localStorage.getItem('slc-lang') || 'en';
      var toLang   = fromLang === 'en' ? 'si' : 'en';
      track('language_toggle', { from: fromLang, to: toLang });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     6. MINDMAP INTERACTIONS
        Node clicks, link clicks, drag, embed copy, expand toggle.
     ════════════════════════════════════════════════════════════════════════ */
  // These are detected by listening on common mindmap UI elements.
  // The mindmap's own JS calls showNodePopup / showLinkPopup — we
  // hook those via a MutationObserver on the popup container.
  if (pagePath.includes('mindmap')) {
    // Node popup appeared
    var popupObs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.target.style && m.target.style.display !== 'none') {
          var titleEl = m.target.querySelector('#popup-title, #popup-fact-text');
          if (titleEl) {
            track('mindmap_interact', {
              action: m.target.id === 'link-popup' ? 'link_click' : 'node_click',
              label: (titleEl.textContent || '').slice(0, 80)
            });
          }
        }
      });
    });
    ['node-popup', 'link-popup'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) popupObs.observe(el, { attributes: true, attributeFilter: ['style'] });
    });

    // Embed copy
    document.addEventListener('click', function (e) {
      if (e.target.closest('#copy-embed-btn')) {
        track('mindmap_interact', { action: 'embed_copy' });
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     7. COMMENT SUBMISSION
     ════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#submit-comment-btn, [onclick*="submitComment"]')) {
      track('comment_submit', { page: pagePath });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     8. OUTBOUND LINK CLICKS — what sources are readers following?
     ════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="http"]');
    if (a && a.hostname !== location.hostname) {
      track('outbound_click', { url: a.href.slice(0, 200), text: (a.textContent || '').slice(0, 60) });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     9. CROSS-DOSSIER NAVIGATION — are readers exploring multiple dossiers?
     ════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (a && a.hostname === location.hostname && a.pathname !== pagePath) {
      var isDossierLink = a.pathname.includes('/dossiers/');
      if (isDossierLink) {
        track('cross_dossier_nav', { from: pagePath, to: a.pathname });
      }
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     10. PAGE EXIT — capture final scroll depth + read time on unload
     ════════════════════════════════════════════════════════════════════════ */
  window.addEventListener('beforeunload', function () {
    var finalScroll = getScrollPct();
    var finalTime   = Math.round((Date.now() - readStart) / 1000);
    // Use sendBeacon via gtag transport
    if (window.gtag) {
      window.gtag('event', 'page_exit', {
        final_scroll_pct: finalScroll,
        final_read_seconds: finalTime,
        transport_type: 'beacon'
      });
    }
  });

})();
