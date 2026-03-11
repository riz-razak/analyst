/**
 * Privacy Consent Banner — Shared Component
 * analyst.rizrazak.com
 *
 * Self-contained IIFE that:
 * 1. Injects a GDPR/PDPA-compliant privacy banner
 * 2. Manages consent state in localStorage
 * 3. Optionally fetches visitor IP + geo if consented
 * 4. Exposes window.AnalystPrivacy for other scripts to check consent
 *
 * Usage: <script src="../_shared/privacy-banner.js" defer></script>
 */
(function () {
  'use strict';

  const CONSENT_KEY = 'analyst_privacy_consent_v2';
  const RETENTION_DAYS = 180;

  // ── State ──────────────────────────────────────────────
  const state = {
    ip: 'unknown',
    geo: '',
    consented: null, // null = not yet decided, true = accepted, false = declined
  };

  // ── Check existing consent ─────────────────────────────
  function loadConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      state.consented = parsed.accepted;
      return parsed;
    } catch {
      return null;
    }
  }

  // ── Save consent ───────────────────────────────────────
  function saveConsent(accepted) {
    state.consented = accepted;
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted,
      ts: Date.now(),
      version: '2.0',
      retention: RETENTION_DAYS,
    }));
  }

  // ── Fetch visitor IP (only if consented) ───────────────
  function fetchVisitorIP() {
    if (state.consented !== true) return;
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => { state.ip = d.ip; })
      .catch(() => {});

    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        state.geo = (d.city || '') + (d.country_name ? ', ' + d.country_name : '');
      })
      .catch(() => {});
  }

  // ── FNV-1a hash (for IP anonymisation) ─────────────────
  function fnv1aHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  // ── Build & inject banner ──────────────────────────────
  function injectBanner() {
    const banner = document.createElement('div');
    banner.className = 'privacy-banner hidden';
    banner.id = 'privacy-banner';
    banner.innerHTML = `
      <div class="privacy-banner__text">
        <strong>Privacy notice:</strong>
        This site logs visitor IPs and metadata strictly for legal compliance
        and protection against defamation claims. No data is sold or shared
        with third parties. IP addresses are anonymised after ${RETENTION_DAYS} days.
        By continuing to use this site you acknowledge this practice.
      </div>
      <div class="privacy-banner__actions">
        <button class="privacy-banner__btn privacy-banner__btn--accept" id="privacy-accept">
          Understood
        </button>
        <button class="privacy-banner__btn privacy-banner__btn--decline" id="privacy-decline">
          Decline Analytics
        </button>
      </div>
    `;
    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('privacy-accept').addEventListener('click', function () {
      saveConsent(true);
      banner.classList.add('hidden');
      fetchVisitorIP();
    });

    document.getElementById('privacy-decline').addEventListener('click', function () {
      saveConsent(false);
      banner.classList.add('hidden');
      state.ip = 'DECLINED';
      state.geo = 'DECLINED';
    });
  }

  // ── Init ────────────────────────────────────────────────
  function init() {
    const existing = loadConsent();

    injectBanner();

    if (!existing) {
      // No prior consent — show banner
      requestAnimationFrame(function () {
        document.getElementById('privacy-banner').classList.remove('hidden');
      });
    } else if (existing.accepted) {
      fetchVisitorIP();
    } else {
      state.ip = 'DECLINED';
      state.geo = 'DECLINED';
    }
  }

  // ── Public API ──────────────────────────────────────────
  window.AnalystPrivacy = {
    get consented() { return state.consented; },
    get ip() { return state.ip; },
    get geo() { return state.geo; },
    get retentionDays() { return RETENTION_DAYS; },
    hashIP: function (salt) {
      return fnv1aHash(state.ip + (salt || 'analyst_2026'));
    },
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
