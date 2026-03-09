/**
 * dossier-disclaimer.js
 * Disclaimer modal module for dossier pages
 *
 * Features:
 * - Shows modal on first visit if not accepted
 * - Blocks page interaction until disclaimer accepted
 * - Stores acceptance in localStorage
 * - Bilingual content (pre-rendered in HTML)
 * - Fade-out animation on accept
 * - ESC key does not dismiss modal (user must click accept)
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'dossier-disclaimer-accepted';
  const MODAL_ID = 'disclaimerModal';
  const ACCEPT_BTN_ID = 'disclaimerAccept';

  /**
   * Initialize disclaimer module on DOM ready
   */
  function init() {
    const modal = document.getElementById(MODAL_ID);

    if (!modal) {
      console.warn('dossier-disclaimer.js: #disclaimerModal not found');
      return;
    }

    // Check if already accepted
    if (hasAcceptedDisclaimer()) {
      modal.style.display = 'none';
      return;
    }

    // Show modal and prevent page interaction
    showModal(modal);

    // Set up accept button handler
    const acceptBtn = document.getElementById(ACCEPT_BTN_ID);
    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => handleAccept(modal));
    }

    // Prevent ESC key from dismissing (user must click accept)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !hasAcceptedDisclaimer()) {
        e.preventDefault();
      }
    });
  }

  /**
   * Check if disclaimer has been accepted
   * @returns {boolean}
   */
  function hasAcceptedDisclaimer() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  /**
   * Show modal and block page interaction
   * @param {HTMLElement} modal - Modal element
   */
  function showModal(modal) {
    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('show');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add aria attributes for accessibility
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
  }

  /**
   * Handle acceptance of disclaimer
   * @param {HTMLElement} modal - Modal element
   */
  function handleAccept(modal) {
    // Store acceptance
    localStorage.setItem(STORAGE_KEY, 'true');

    // Fade out animation
    modal.classList.add('fade-out');

    // Wait for animation to complete, then hide
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('show', 'fade-out');

      // Restore body scroll
      document.body.style.overflow = 'auto';
    }, 400);

    // Track analytics event
    if (window.gtag && typeof gtag === 'function') {
      gtag('event', 'disclaimer_accept', {
        dossier_id: getDossierId()
      });
    }
  }

  /**
   * Get dossier ID from meta tag
   * @returns {string} Dossier ID or empty string
   */
  function getDossierId() {
    const meta = document.querySelector('meta[name="dossier-id"]');
    return meta ? meta.getAttribute('content') : '';
  }

  /**
   * Reset disclaimer acceptance (for testing)
   */
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Expose reset for debugging
  window.DossierDisclaimer = {
    reset: reset
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
