/* ===================================================================
   EVIDENCE HOVER PREVIEW — On-demand floating source preview panel
   analyst.rizrazak.com  |  _shared/hover-preview.js
   =================================================================== */

(function () {
  'use strict';

  // ── Panel DOM ─────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'ev-preview-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = [
    '<div class="evp-img-wrap">',
    '  <img id="evp-img" src="" alt="" loading="eager">',
    '  <div class="evp-img-error">Preview unavailable</div>',
    '</div>',
    '<div class="evp-meta">',
    '  <span id="evp-caption"></span>',
    '  <span class="evp-hint">Hover to open →</span>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);

  const evpImg     = panel.querySelector('#evp-img');
  const evpCaption = panel.querySelector('#evp-caption');
  const evpError   = panel.querySelector('.evp-img-error');

  let hideTimer = null;
  let activeEl  = null;

  // ── Image resolution ──────────────────────────────────────────
  function getImgSrc(card) {
    if (!card) return null;
    const url = card.getAttribute('data-ev-img-url');
    if (url) return url;
    const varName = card.getAttribute('data-ev-img-var');
    if (varName && window[varName]) return window[varName];
    return null;
  }

  function getCaption(card) {
    return card ? (card.getAttribute('data-ev-caption') || '') : '';
  }

  // ── Target card from an element (card itself or ref-marker) ───
  function resolveCard(el) {
    // If it's an evidence card directly
    if (el.classList.contains('evidence-card')) return el;
    // If it's a ref-marker like [S2], look at its href
    const href = el.getAttribute('href') || '';
    const match = href.match(/#(ev-\S+)/);
    if (match) return document.getElementById(match[1]);
    return null;
  }

  // ── Panel positioning ─────────────────────────────────────────
  function positionPanel(anchorEl) {
    const P_W = 260;
    const P_OFFSET = 12;
    const rect = anchorEl.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    let left, top;

    // Try right side first
    if (rect.right + P_OFFSET + P_W < vw - 8) {
      left = rect.right + P_OFFSET + window.scrollX;
    }
    // Otherwise try left side
    else if (rect.left - P_OFFSET - P_W > 8) {
      left = rect.left - P_OFFSET - P_W + window.scrollX;
    }
    // Fall back: centre over element
    else {
      left = Math.max(8, rect.left + (rect.width - P_W) / 2 + window.scrollX);
    }

    // Vertical: align top with element, clamp to viewport
    const PANEL_H = 280;
    top = rect.top + window.scrollY;
    if (rect.top + PANEL_H > vh) {
      top = Math.max(window.scrollY + 8, rect.bottom + window.scrollY - PANEL_H);
    }

    panel.style.left = Math.round(left) + 'px';
    panel.style.top  = Math.round(top)  + 'px';
  }

  // ── Show / hide ───────────────────────────────────────────────
  function showPreview(triggerEl) {
    const card = resolveCard(triggerEl);
    const src  = getImgSrc(card);
    if (!src) return;

    clearTimeout(hideTimer);
    activeEl = triggerEl;

    evpImg.src = src;
    evpCaption.textContent = getCaption(card);
    evpError.style.display = 'none';
    evpImg.style.display   = 'block';

    evpImg.onerror = function () {
      evpImg.style.display   = 'none';
      evpError.style.display = 'flex';
    };

    positionPanel(triggerEl);
    panel.classList.add('ev-preview-visible');
    panel.setAttribute('aria-hidden', 'false');
  }

  function hidePreview() {
    hideTimer = setTimeout(function () {
      panel.classList.remove('ev-preview-visible');
      panel.setAttribute('aria-hidden', 'true');
      activeEl = null;
    }, 120);
  }

  // ── Event binding ─────────────────────────────────────────────
  function bindEl(el) {
    el.addEventListener('mouseenter', function () { showPreview(el); });
    el.addEventListener('mouseleave', hidePreview);
    el.addEventListener('focus',      function () { showPreview(el); });
    el.addEventListener('blur',       hidePreview);

    // Mobile tap-toggle
    el.addEventListener('touchstart', function (e) {
      if (panel.classList.contains('ev-preview-visible') && activeEl === el) {
        hidePreview();
      } else {
        showPreview(el);
        e.preventDefault();
      }
    }, { passive: false });
  }

  // Keep panel visible when hovering over it
  panel.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
  panel.addEventListener('mouseleave', hidePreview);

  // ── Init (wait for DOM) ───────────────────────────────────────
  function init() {
    // Bind to evidence cards that have preview data
    document.querySelectorAll('.evidence-card[data-ev-img-url], .evidence-card[data-ev-img-var]')
      .forEach(bindEl);

    // Bind to inline ref-markers whose href targets an evidence card
    document.querySelectorAll('a.ref-marker[href^="#ev-"]').forEach(function (a) {
      const id  = a.getAttribute('href').slice(1);
      const card = document.getElementById(id);
      if (card && (card.hasAttribute('data-ev-img-url') || card.hasAttribute('data-ev-img-var'))) {
        bindEl(a);
      }
    });

    // ── Audit helper: window.evPreviewAudit() ──────────────────
    window.evPreviewAudit = function () {
      const cards = ['ev-S2', 'ev-S1', 'ev-S3', 'ev-S8S9'];
      return cards.map(function (id) {
        const card = document.getElementById(id);
        const src  = getImgSrc(card);
        return {
          id:         id,
          hasCard:    !!card,
          hasSrc:     !!src,
          srcType:    src ? (src.startsWith('data:') ? 'base64' : 'external-url') : 'none',
          srcLen:     src ? src.length : 0,
          caption:    getCaption(card),
          refCount:   document.querySelectorAll('a.ref-marker[href="#' + id + '"]').length
        };
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
