/**
 * Comments System v3 â Supabase-powered FAB + Slide-out Panel
 * analyst.rizrazak.com
 *
 * Full-featured comments: Supabase magic-link auth, threaded replies,
 * admin badge, moderation visibility, i18n (EN/SI), click-outside dismiss.
 *
 * Reads config from window.ANALYST_COMMENTS_CONFIG:
 *   supabaseUrl, supabaseAnonKey, dossierId, adminEmail, siteUrl
 *
 * Requires: @supabase/supabase-js loaded before this script
 */

(function () {
  'use strict';

  // âââ Config ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const cfg = window.ANALYST_COMMENTS_CONFIG;
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    console.warn('[comments-v3] Missing ANALYST_COMMENTS_CONFIG â comments disabled');
    return;
  }

  const {
    supabaseUrl,
    supabaseAnonKey,
    dossierId = 'unknown',
    adminEmail = 'riz@dgtl.lk',
    siteUrl = window.location.origin,
  } = cfg;

  // âââ i18n ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const i18n = {
    en: {
      comments: 'Comments',
      signInPrompt: 'Sign in to comment',
      emailPlaceholder: 'your@email.com',
      namePlaceholder: 'Your name (public)',
      sendMagicLink: 'Send sign-in link',
      magicLinkSent: 'Check your email for the sign-in link.',
      writeComment: 'Write a comment\u2026',
      submit: 'Post',
      submitting: 'Posting\u2026',
      pending: 'Awaiting moderation',
      reply: 'Reply',
      cancelReply: 'Cancel',
      signOut: 'Sign out',
      signedInAs: 'Signed in as',
      noComments: 'No comments yet. Be the first.',
      loadError: 'Could not load comments.',
      postError: 'Could not post your comment. Try again.',
      guidelines: 'Comments are moderated. No hate speech, harassment, or defamation.',
      charCount: 'remaining',
      justNow: 'just now',
      minutesAgo: 'm ago',
      hoursAgo: 'h ago',
      daysAgo: 'd ago',
    },
    si: {
      comments: 'à¶à¶¯à·à·à·',
      signInPrompt: 'à¶à¶¯à·à·à· à¶¯à·à¶à·à·à·à¶¸à¶§ à¶´à·à¶»à¶±à·à¶±',
      emailPlaceholder: 'oba@email.com',
      namePlaceholder: 'à¶à¶¶à· à¶±à¶¸ (à¶´à·\u200Dà¶»à·à·à¶¯à·à¶°)',
      sendMagicLink: 'à¶´à·à¶»à¶±à¶º à·à¶¶à·à¶³à·à¶º à¶ºà·à¶±à·à¶±',
      magicLinkSent: 'à¶à¶¶à· à¶à¶¸à·à¶½à· à¶´à¶»à·à¶à·à·à· à¶à¶»à¶±à·à¶±.',
      writeComment: 'à¶à¶¯à·à·à¶à· à¶½à·à¶ºà¶±à·à¶±\u2026',
      submit: 'à¶´à· à¶à¶»à¶±à·à¶±',
      submitting: 'à¶´à· à¶à¶»à¶¸à·à¶±à·\u2026',
      pending: 'à¶´à·\u200Dà¶»à¶­à·à·à·à¶°à¶±à¶º à¶¶à¶½à·à¶´à·à¶»à·à¶­à·à¶­à·à·à·',
      reply: 'à¶´à·à·à·à¶­à·à¶»à·',
      cancelReply: 'à¶à·à¶½à¶à¶à·',
      signOut: 'à¶à·à¶­à· à·à¶±à·à¶±',
      signedInAs: 'à¶½à·à· à¶´à·à¶»à¶±à¶º à·à· à¶à¶­',
      noComments: 'à¶­à·à¶¸ à¶à¶¯à·à·à· à¶±à·à¶­. à¶´à·à¶¸à·à·à·à¶±à·à¶±à· à·à¶±à·à¶±.',
      loadError: 'à¶à¶¯à·à·à· à¶´à·à¶»à¶«à¶º à¶à· à¶±à·à·à·à¶à· à·à·à¶º.',
      postError: 'à¶à¶¶à¶à· à¶à¶¯à·à· à¶´à· à¶à· à¶±à·à·à·à¶à· à·à·à¶º.',
      guidelines: 'à¶à¶¯à·à·à· à¶´à·\u200Dà¶»à¶­à·à·à·à¶°à¶±à¶º à¶à·à¶»à·.',
      charCount: 'à¶à¶­à·à¶»à·à· à¶à¶­',
      justNow: 'à¶¯à·à¶±à·',
      minutesAgo: ' à¶¸à·. à¶´à·à¶»',
      hoursAgo: ' à¶´à·. à¶´à·à¶»',
      daysAgo: ' à¶¯à·. à¶´à·à¶»',
    },
  };

  function t(key) {
    const lang = document.body.classList.contains('sinhala') ? 'si' : 'en';
    return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
  }

  // âââ Supabase client âââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Reuse if already created by another module, otherwise create
  let supabase;
  if (window.__analystSupabase) {
    supabase = window.__analystSupabase;
  } else {
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    window.__analystSupabase = supabase;
  }

  // âââ State âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  let currentUser = null;
  let comments = [];
  let replyingTo = null;
  const MAX_CHARS = 5000;

  // âââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function relativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return mins + t('minutesAgo');
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + t('hoursAgo');
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + t('daysAgo');
    return new Date(dateStr).toLocaleDateString();
  }

  function isSinhala() {
    return document.body.classList.contains('sinhala');
  }

  // âââ Auth ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  async function initAuth() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Supabase handles magic link callback via onAuthStateChange
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        if (window.location.hash.includes('access_token')) {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        renderPanelContent();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        renderPanelContent();
      }
    });
  }

  async function sendMagicLink(email) {
    const redirectTo = siteUrl + '/' + dossierId + '/';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    renderPanelContent();
  }

  // âââ Data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  async function loadComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[comments-v3] Load error:', error);
      return false;
    }

    comments = data || [];
    return true;
  }

  async function postComment(body, parentId) {
    if (!currentUser) return { error: 'Not signed in' };

    const displayName =
      currentUser.user_metadata?.display_name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email.split('@')[0];

    const { data, error } = await supabase.from('comments').insert({
      dossier_id: dossierId,
      parent_id: parentId || null,
      author_id: currentUser.id,
      author_name: displayName,
      author_email: currentUser.email,
      body: body.trim(),
      lang: isSinhala() ? 'si' : 'en',
    }).select();

    if (error) {
      console.error('[comments-v3] Post error:', error);
      return { error };
    }

    if (data && data[0]) {
      comments.push(data[0]);
    }
    return { data };
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // DOM: FAB
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function createFAB() {
    const fab = document.createElement('button');
    fab.id = 'comments-fab';
    fab.className = 'cv3-fab';
    fab.innerHTML = '\uD83D\uDCAC';
    fab.title = 'Comments';
    fab.setAttribute('aria-label', 'Open comments panel');
    fab.addEventListener('click', togglePanel);
    return fab;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // DOM: Panel shell
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'cv3-panel';
    panel.className = 'cv3-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Comments');

    panel.innerHTML =
      '<div class="cv3-panel-header">' +
        '<div class="cv3-panel-title">' + t('comments') + '</div>' +
        '<button class="cv3-panel-close" aria-label="Close comments">\u2715</button>' +
      '</div>' +
      '<div id="cv3-panel-body" class="cv3-panel-body"></div>';

    panel.querySelector('.cv3-panel-close').addEventListener('click', closePanel);
    return panel;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Panel open / close
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function togglePanel() {
    var panel = document.getElementById('cv3-panel');
    if (!panel) return;
    panel.classList.contains('open') ? closePanel() : openPanel();
  }

  function openPanel() {
    var panel = document.getElementById('cv3-panel');
    if (!panel || panel.classList.contains('open')) return;
    panel.classList.add('open');
    loadComments().then(function (ok) {
      renderPanelContent();
    });
    setTimeout(function () {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);
  }

  function closePanel() {
    var panel = document.getElementById('cv3-panel');
    if (!panel) return;
    panel.classList.remove('open');
    document.removeEventListener('click', handleClickOutside, true);
  }

  function handleClickOutside(e) {
    var panel = document.getElementById('cv3-panel');
    var fab = document.getElementById('comments-fab');
    if (!panel || !panel.classList.contains('open')) return;
    if (panel.contains(e.target) || (fab && fab.contains(e.target))) return;
    closePanel();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Render panel content
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function renderPanelContent() {
    var body = document.getElementById('cv3-panel-body');
    if (!body) return;
    body.innerHTML = '';

    // Update title for language
    var title = document.querySelector('.cv3-panel-title');
    if (title) title.textContent = t('comments');

    // Auth section
    body.appendChild(renderAuthSection());

    // Comment list
    body.appendChild(renderCommentList());

    // Guidelines
    var guide = document.createElement('p');
    guide.className = 'cv3-guidelines';
    guide.textContent = t('guidelines');
    body.appendChild(guide);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Auth section
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function renderAuthSection() {
    var section = document.createElement('div');
    section.className = 'cv3-auth';

    if (currentUser) {
      // Signed in â identity bar + compose form
      var identity = document.createElement('div');
      identity.className = 'cv3-identity';

      var avatar = document.createElement('div');
      avatar.className = 'cv3-avatar';
      avatar.textContent = (currentUser.user_metadata?.display_name || currentUser.email)[0].toUpperCase();
      identity.appendChild(avatar);

      var info = document.createElement('span');
      info.className = 'cv3-user-info';
      var displayName =
        currentUser.user_metadata?.display_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email.split('@')[0];
      var isAdmin = currentUser.email === adminEmail;
      info.innerHTML = '<strong>' + esc(displayName) + '</strong>' +
        (isAdmin ? ' <span class="cv3-verified" title="Administrator">\u2713 Verified</span>' : '');
      identity.appendChild(info);

      var signOutBtn = document.createElement('button');
      signOutBtn.className = 'cv3-btn-text';
      signOutBtn.textContent = t('signOut');
      signOutBtn.onclick = signOut;
      identity.appendChild(signOutBtn);

      section.appendChild(identity);

      // Name prompt for first-time users
      if (!currentUser.user_metadata?.display_name) {
        section.appendChild(renderNamePrompt());
      }

      // Compose form
      section.appendChild(renderComposeForm());
    } else {
      section.appendChild(renderSignInForm());
    }

    return section;
  }

  function renderNamePrompt() {
    var form = document.createElement('div');
    form.className = 'cv3-name-prompt';

    var label = document.createElement('label');
    label.textContent = t('namePlaceholder');
    label.className = 'cv3-label';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'cv3-input';
    input.placeholder = t('namePlaceholder');
    input.maxLength = 100;

    var btn = document.createElement('button');
    btn.className = 'cv3-btn-primary cv3-btn-sm';
    btn.textContent = '\u2713';
    btn.onclick = async function () {
      var name = input.value.trim();
      if (!name) return;
      await supabase.auth.updateUser({ data: { display_name: name } });
      currentUser.user_metadata.display_name = name;
      renderPanelContent();
    };

    form.appendChild(label);
    var row = document.createElement('div');
    row.className = 'cv3-input-row';
    row.appendChild(input);
    row.appendChild(btn);
    form.appendChild(row);
    return form;
  }

  function renderSignInForm() {
    var form = document.createElement('div');
    form.className = 'cv3-signin';

    var prompt = document.createElement('p');
    prompt.className = 'cv3-signin-prompt';
    prompt.textContent = t('signInPrompt');
    form.appendChild(prompt);

    var inputRow = document.createElement('div');
    inputRow.className = 'cv3-input-row';

    var emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'cv3-input';
    emailInput.placeholder = t('emailPlaceholder');
    emailInput.required = true;

    var submitBtn = document.createElement('button');
    submitBtn.className = 'cv3-btn-primary';
    submitBtn.textContent = t('sendMagicLink');

    var status = document.createElement('div');
    status.className = 'cv3-status';

    submitBtn.onclick = async function () {
      var email = emailInput.value.trim();
      if (!email || !email.includes('@')) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '\u2026';

      var result = await sendMagicLink(email);

      if (result.error) {
        status.textContent = result.error.message;
        status.className = 'cv3-status cv3-error';
        submitBtn.disabled = false;
        submitBtn.textContent = t('sendMagicLink');
      } else {
        status.textContent = t('magicLinkSent');
        status.className = 'cv3-status cv3-success';
        emailInput.disabled = true;
      }
    };

    emailInput.onkeydown = function (e) {
      if (e.key === 'Enter') submitBtn.click();
    };

    inputRow.appendChild(emailInput);
    inputRow.appendChild(submitBtn);
    form.appendChild(inputRow);
    form.appendChild(status);

    return form;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Compose form
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function renderComposeForm(parentId) {
    var form = document.createElement('div');
    form.className = 'cv3-compose' + (parentId ? ' cv3-compose-reply' : '');

    if (parentId) {
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'cv3-btn-text';
      cancelBtn.textContent = t('cancelReply');
      cancelBtn.onclick = function () {
        replyingTo = null;
        renderPanelContent();
      };
      form.appendChild(cancelBtn);
    }

    var textarea = document.createElement('textarea');
    textarea.className = 'cv3-textarea';
    textarea.placeholder = t('writeComment');
    textarea.maxLength = MAX_CHARS;
    textarea.rows = 3;

    var footer = document.createElement('div');
    footer.className = 'cv3-compose-footer';

    var charCount = document.createElement('span');
    charCount.className = 'cv3-char-count';
    charCount.textContent = MAX_CHARS + ' ' + t('charCount');

    textarea.oninput = function () {
      var remaining = MAX_CHARS - textarea.value.length;
      charCount.textContent = remaining + ' ' + t('charCount');
      charCount.style.color = remaining < 200 ? '#c0392b' : '';
    };

    var submitBtn = document.createElement('button');
    submitBtn.className = 'cv3-btn-primary';
    submitBtn.textContent = t('submit');

    var status = document.createElement('div');
    status.className = 'cv3-status';

    submitBtn.onclick = async function () {
      var text = textarea.value.trim();
      if (!text) return;

      submitBtn.disabled = true;
      submitBtn.textContent = t('submitting');

      var result = await postComment(text, parentId);

      if (result.error) {
        status.textContent = t('postError');
        status.className = 'cv3-status cv3-error';
        submitBtn.disabled = false;
        submitBtn.textContent = t('submit');
      } else {
        replyingTo = null;
        renderPanelContent();
      }
    };

    footer.appendChild(charCount);
    footer.appendChild(submitBtn);

    form.appendChild(textarea);
    form.appendChild(footer);
    form.appendChild(status);

    return form;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Comment list
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  function renderCommentList() {
    var list = document.createElement('div');
    list.className = 'cv3-list';

    var topLevel = comments.filter(function (c) { return !c.parent_id; });
    var replies = comments.filter(function (c) { return c.parent_id; });
    var replyMap = {};
    replies.forEach(function (r) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push(r);
    });

    // Filter: show approved + own pending
    var visibleTop = topLevel.filter(function (c) {
      return c.approved || (currentUser && currentUser.id === c.author_id);
    });

    if (visibleTop.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'cv3-empty';
      empty.textContent = t('noComments');
      list.appendChild(empty);
      return list;
    }

    visibleTop.forEach(function (comment) {
      list.appendChild(renderComment(comment, false));

      var childReplies = replyMap[comment.id] || [];
      childReplies.forEach(function (reply) {
        if (reply.approved || (currentUser && currentUser.id === reply.author_id)) {
          list.appendChild(renderComment(reply, true));
        }
      });

      if (replyingTo === comment.id && currentUser) {
        list.appendChild(renderComposeForm(comment.id));
      }
    });

    return list;
  }

  function renderComment(comment, isReply) {
    var el = document.createElement('div');
    el.className = 'cv3-comment' + (isReply ? ' cv3-comment-reply' : '');
    var isOwn = currentUser && currentUser.id === comment.author_id;
    var isPending = !comment.approved;

    if (isPending && isOwn) {
      el.classList.add('cv3-comment-pending');
    }

    // Header
    var header = document.createElement('div');
    header.className = 'cv3-comment-header';

    var avatar = document.createElement('div');
    avatar.className = 'cv3-avatar cv3-avatar-sm';
    avatar.textContent = (comment.author_name || '?')[0].toUpperCase();

    var meta = document.createElement('div');
    meta.className = 'cv3-comment-meta';
    var isAdminComment = comment.author_email === adminEmail;
    meta.innerHTML = '<strong>' + esc(comment.author_name) + '</strong>' +
      (isAdminComment ? ' <span class="cv3-verified">\u2713</span>' : '') +
      ' <span class="cv3-muted">' + relativeTime(comment.created_at) + '</span>';

    if (isPending && isOwn) {
      var badge = document.createElement('span');
      badge.className = 'cv3-badge cv3-badge-pending';
      badge.textContent = t('pending');
      meta.appendChild(badge);
    }

    header.appendChild(avatar);
    header.appendChild(meta);

    // Body
    var body = document.createElement('div');
    body.className = 'cv3-comment-body';
    body.innerHTML = esc(comment.body).replace(/\n/g, '<br>');

    // Actions
    var actions = document.createElement('div');
    actions.className = 'cv3-comment-actions';

    if (currentUser && !isReply) {
      var replyBtn = document.createElement('button');
      replyBtn.className = 'cv3-btn-text cv3-btn-sm';
      replyBtn.textContent = t('reply');
      replyBtn.onclick = function () {
        replyingTo = comment.id;
        renderPanelContent();
      };
      actions.appendChild(replyBtn);
    }

    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(actions);

    return el;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // Initialization
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async function init() {
    // ── Legacy cleanup: remove old inline comment elements that conflict with cv3 ──
    document.querySelectorAll('#comments-fab:not(.cv3-fab)').forEach(el => el.remove());
    document.querySelectorAll('#comments-panel:not(#cv3-panel)').forEach(el => el.remove());
    // Also remove any inline style rules that hide #comments-fab
    document.querySelectorAll('style').forEach(style => {
      if (style.textContent.includes('#comments-fab') && style.textContent.includes('display') && style.textContent.includes('none')) {
        // Remove the problematic display:none rule for #comments-fab
        style.textContent = style.textContent.replace(/#comments-fab[^}]*displays*:s*nones*!important[^}]*}/g, '');
      }
    });

    // Inject styles
    if (!document.getElementById('cv3-styles')) {
      var link = document.createElement('link');
      link.id = 'cv3-styles';
      link.rel = 'stylesheet';
      link.href = '/_shared/comments-v3.css';
      document.head.appendChild(link);
    }

    // Create FAB and panel
    var fab = createFAB();
    var panel = createPanel();
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // Init auth
    await initAuth();

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    // Re-render on language toggle
    var langObserver = new MutationObserver(function () {
      var p = document.getElementById('cv3-panel');
      if (p && p.classList.contains('open')) {
        renderPanelContent();
      }
    });
    langObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    console.log('[comments-v3] Initialized for dossier:', dossierId);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
