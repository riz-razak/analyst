/**
 * dossier-analytics.js
 * Analytics event tracking module for dossier pages
 *
 * Features:
 * - Initialize GA4 and Microsoft Clarity from data attributes
 * - Track custom events: section_view, language_toggle, theme_toggle, etc.
 * - Graceful degradation if analytics not available
 * - Respect "Do Not Track" browser setting
 * - Debounced section view tracking
 * - All events include dossier ID
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    gaId: '',
    clarityId: '',
    dossierId: '',
    trackingEnabled: true
  };

  // Debounce tracking
  let sectionViewTimeout = null;
  const SECTION_VIEW_DEBOUNCE = 500;

  /**
   * Initialize analytics module on DOM ready
   */
  function init() {
    // Check "Do Not Track" setting
    if (respectsDoNotTrack()) {
      config.trackingEnabled = false;
      console.info('dossier-analytics.js: Do Not Track enabled, analytics disabled');
      return;
    }

    // Get configuration from script tag
    getConfigFromScript();

    // Load GA4
    if (config.gaId) {
      loadGA4(config.gaId);
    }

    // Load Microsoft Clarity
    if (config.clarityId) {
      loadClarity(config.clarityId);
    }

    // Set up event listeners
    setupEventListeners();

    // Set up section view tracking
    setupSectionViewTracking();
  }

  /**
   * Check if browser respects Do Not Track
   * @returns {boolean}
   */
  function respectsDoNotTrack() {
    return (
      navigator.doNotTrack === '1' ||
      window.doNotTrack === '1' ||
      navigator.msDoNotTrack === '1'
    );
  }

  /**
   * Read GA and Clarity IDs from script data attributes
   */
  function getConfigFromScript() {
    const script = document.currentScript ||
                   document.querySelector('script[data-ga]');

    if (!script) return;

    const ga = script.getAttribute('data-ga');
    const clarity = script.getAttribute('data-clarity');

    if (ga) config.gaId = ga;
    if (clarity) config.clarityId = clarity;

    // Get dossier ID from meta tag
    const meta = document.querySelector('meta[name="dossier-id"]');
    if (meta) {
      config.dossierId = meta.getAttribute('content');
    }
  }

  /**
   * Load GA4 script dynamically
   * @param {string} gaId - Google Analytics measurement ID
   */
  function loadGA4(gaId) {
    try {
      window.dataLayer = window.dataLayer || [];

      function gtag() {
        window.dataLayer.push(arguments);
      }

      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', gaId);

      // Load GA4 script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);
    } catch (error) {
      console.error('dossier-analytics.js: Error loading GA4', error);
    }
  }

  /**
   * Load Microsoft Clarity script dynamically
   * @param {string} clarityId - Clarity project ID
   */
  function loadClarity(clarityId) {
    try {
      window.clarity = window.clarity || function() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };

      window.clarity('set', 'userid', '');

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${clarityId}`;
      document.head.appendChild(script);
    } catch (error) {
      console.error('dossier-analytics.js: Error loading Clarity', error);
    }
  }

  /**
   * Track custom event
   * @param {string} eventName - Event name
   * @param {Object} params - Event parameters
   */
  function trackEvent(eventName, params = {}) {
    if (!config.trackingEnabled) return;

    const eventData = {
      ...params,
      dossier_id: config.dossierId,
      timestamp: Date.now()
    };

    // Send to GA4
    if (window.gtag && typeof gtag === 'function') {
      try {
        gtag('event', eventName, eventData);
      } catch (error) {
        console.error(`dossier-analytics.js: Error tracking GA4 event ${eventName}`, error);
      }
    }

    // Send to Clarity
    if (window.clarity && typeof clarity === 'function') {
      try {
        clarity('event', eventName, eventData);
      } catch (error) {
        console.error(`dossier-analytics.js: Error tracking Clarity event ${eventName}`, error);
      }
    }
  }

  /**
   * Set up event listeners for automatic tracking
   */
  function setupEventListeners() {
    // Track external link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[target="_blank"]');
      if (link && link.href) {
        trackEvent('external_link', {
          url: link.href,
          text: link.textContent.substring(0, 100)
        });
      }
    });

    // Track evidence card expansions
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-evidence-card]');
      if (card) {
        const cardId = card.getAttribute('data-evidence-id') || '';
        trackEvent('evidence_expand', {
          evidence_id: cardId
        });
      }
    });

    // Track pledge button clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-pledge]')) {
        trackEvent('pledge_click', {
          pledge_type: e.target.getAttribute('data-pledge') || ''
        });
      }
    });
  }

  /**
   * Set up section view tracking via Intersection Observer
   */
  function setupSectionViewTracking() {
    const sections = document.querySelectorAll('section[data-nav-label]');

    if (sections.length === 0) return;

    const options = {
      root: null,
      rootMargin: '-50% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Debounce section view tracking
          clearTimeout(sectionViewTimeout);

          sectionViewTimeout = setTimeout(() => {
            const sectionId = entry.target.id;
            const sectionLabel = entry.target.getAttribute('data-nav-label');

            trackEvent('section_view', {
              section_id: sectionId,
              section_label: sectionLabel
            });
          }, SECTION_VIEW_DEBOUNCE);
        }
      });
    }, options);

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  /**
   * Manual event tracking (for external modules)
   */
  window.DossierAnalytics = {
    trackEvent: trackEvent,
    isEnabled: () => config.trackingEnabled,
    getDossierId: () => config.dossierId
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
