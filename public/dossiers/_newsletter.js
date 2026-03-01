/**
 * Newsletter Signup Bar — analyst.rizrazak.com
 * Lightweight, privacy-respecting newsletter capture.
 *
 * Configure: Set NEWSLETTER_PROVIDER and NEWSLETTER_ID below.
 * Supported: 'buttondown', 'substack', 'formspree', 'custom'
 *
 * The bar appears at the bottom of the viewport after 30% scroll.
 * Respects dismiss (stored in localStorage for 7 days).
 * GDPR-aware: only fires after consent check.
 */
(function(){
  'use strict';

  // ══════════════════════════════════════════
  // CONFIGURATION — Change these values
  // ══════════════════════════════════════════
  var NEWSLETTER_PROVIDER = 'formspree';           // 'buttondown' | 'substack' | 'formspree' | 'custom'
  var NEWSLETTER_ID       = 'YOUR_FORMSPREE_ID';   // Buttondown username, Substack subdomain, Formspree form ID, or custom endpoint URL
  var SHOW_AFTER_SCROLL   = 30;                    // Show after scrolling this % of the page
  var DISMISS_DAYS        = 7;                      // Days to remember dismiss
  var SUBSCRIBE_DAYS      = 90;                     // Days to remember subscription

  // ══════════════════════════════════════════

  var DISMISS_KEY = 'nl_dismissed_v1';
  var SUBSCRIBED_KEY = 'nl_subscribed_v1';

  // Check if already dismissed or subscribed
  function isDismissed(){
    try {
      var val = localStorage.getItem(DISMISS_KEY);
      if(!val) return false;
      var data = JSON.parse(val);
      return Date.now() < data.expires;
    } catch(e){ return false; }
  }

  function isSubscribed(){
    try {
      var val = localStorage.getItem(SUBSCRIBED_KEY);
      if(!val) return false;
      var data = JSON.parse(val);
      return Date.now() < data.expires;
    } catch(e){ return false; }
  }

  if(isDismissed() || isSubscribed()) return;

  // Build the bar
  var bar = document.createElement('div');
  bar.id = 'nl-bar';
  bar.innerHTML = [
    '<div class="nl-inner">',
    '  <div class="nl-text">',
    '    <strong>Stay informed.</strong> Get new investigations delivered to your inbox — no spam, no tracking, just journalism.',
    '  </div>',
    '  <form class="nl-form" id="nl-form">',
    '    <input type="email" class="nl-input" id="nl-email" placeholder="your@email.com" required autocomplete="email" />',
    '    <button type="submit" class="nl-btn" id="nl-submit">Subscribe</button>',
    '  </form>',
    '  <button class="nl-close" id="nl-close" title="Dismiss">&times;</button>',
    '</div>',
    '<div class="nl-success" id="nl-success" style="display:none;">',
    '  <strong>Thank you.</strong> You\'ll hear from us when it matters.',
    '</div>'
  ].join('\n');

  // Styles
  var style = document.createElement('style');
  style.textContent = [
    '#nl-bar{',
    '  position:fixed;bottom:-100px;left:0;right:0;z-index:9999;',
    '  background:rgba(10,10,15,0.97);border-top:2px solid #d97706;',
    '  padding:14px 24px;transition:bottom 0.4s ease;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '  backdrop-filter:blur(12px);',
    '}',
    '#nl-bar.visible{bottom:0;}',
    '.nl-inner{display:flex;align-items:center;gap:16px;max-width:900px;margin:0 auto;flex-wrap:wrap;}',
    '.nl-text{flex:1;font-size:0.78rem;color:#e8e8f0;line-height:1.4;min-width:200px;}',
    '.nl-text strong{color:#fbbf24;}',
    '.nl-form{display:flex;gap:8px;flex-shrink:0;}',
    '.nl-input{',
    '  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);',
    '  color:#f9fafb;font-size:0.75rem;padding:8px 14px;border-radius:4px;',
    '  outline:none;width:220px;font-family:inherit;',
    '}',
    '.nl-input:focus{border-color:#d97706;}',
    '.nl-input::placeholder{color:rgba(255,255,255,0.3);}',
    '.nl-btn{',
    '  background:#d97706;color:#fff;border:none;font-size:0.7rem;',
    '  letter-spacing:0.5px;text-transform:uppercase;padding:8px 18px;',
    '  border-radius:4px;cursor:pointer;font-weight:600;font-family:inherit;',
    '  transition:background 0.2s;white-space:nowrap;',
    '}',
    '.nl-btn:hover{background:#b45309;}',
    '.nl-btn:disabled{opacity:0.5;cursor:not-allowed;}',
    '.nl-close{',
    '  background:none;border:none;color:rgba(255,255,255,0.4);',
    '  font-size:1.3rem;cursor:pointer;padding:4px 8px;line-height:1;',
    '  transition:color 0.2s;flex-shrink:0;',
    '}',
    '.nl-close:hover{color:#fff;}',
    '.nl-success{',
    '  text-align:center;font-size:0.78rem;color:#34d399;padding:4px 0;',
    '  max-width:900px;margin:0 auto;',
    '}',
    '@media(max-width:600px){',
    '  .nl-inner{flex-direction:column;gap:10px;text-align:center;}',
    '  .nl-form{width:100%;}',
    '  .nl-input{flex:1;width:auto;}',
    '}'
  ].join('\n');

  document.head.appendChild(style);
  document.body.appendChild(bar);

  // Show after scroll threshold
  var shown = false;
  window.addEventListener('scroll', function(){
    if(shown) return;
    var scrollPct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    if(scrollPct >= SHOW_AFTER_SCROLL){
      shown = true;
      bar.classList.add('visible');
    }
  }, {passive: true});

  // Dismiss
  document.getElementById('nl-close').addEventListener('click', function(){
    bar.classList.remove('visible');
    localStorage.setItem(DISMISS_KEY, JSON.stringify({
      ts: Date.now(),
      expires: Date.now() + DISMISS_DAYS * 86400000
    }));
  });

  // Submit
  document.getElementById('nl-form').addEventListener('submit', function(e){
    e.preventDefault();
    var email = document.getElementById('nl-email').value.trim();
    if(!email) return;

    var btn = document.getElementById('nl-submit');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    var endpoint, body, headers;

    if(NEWSLETTER_PROVIDER === 'buttondown'){
      endpoint = 'https://api.buttondown.email/v1/subscribers';
      body = JSON.stringify({ email: email });
      headers = { 'Content-Type': 'application/json' };
    } else if(NEWSLETTER_PROVIDER === 'formspree'){
      endpoint = 'https://formspree.io/f/' + NEWSLETTER_ID;
      body = JSON.stringify({ email: email, _subject: 'New newsletter subscriber' });
      headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    } else if(NEWSLETTER_PROVIDER === 'custom'){
      endpoint = NEWSLETTER_ID;
      body = JSON.stringify({ email: email });
      headers = { 'Content-Type': 'application/json' };
    } else {
      // Substack fallback — open subscription page
      window.open('https://' + NEWSLETTER_ID + '.substack.com/subscribe?email=' + encodeURIComponent(email), '_blank');
      showSuccess();
      return;
    }

    fetch(endpoint, { method: 'POST', body: body, headers: headers })
      .then(function(res){
        if(res.ok || res.status === 201){
          showSuccess();
        } else {
          btn.textContent = 'Error — try again';
          btn.disabled = false;
        }
      })
      .catch(function(){
        btn.textContent = 'Error — try again';
        btn.disabled = false;
      });
  });

  function showSuccess(){
    document.querySelector('.nl-inner').style.display = 'none';
    document.getElementById('nl-success').style.display = 'block';
    localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify({
      ts: Date.now(),
      expires: Date.now() + SUBSCRIBE_DAYS * 86400000
    }));
    // Track in GA4
    if(window.gtag){
      window.gtag('event', 'newsletter_subscribe', { method: NEWSLETTER_PROVIDER });
    }
    setTimeout(function(){ bar.classList.remove('visible'); }, 4000);
  }

})();
