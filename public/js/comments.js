/**
 * Supabase Magic-Link Comments System
 * analyst.rizrazak.com — Phase 3
 *
 * Depends on: @supabase/supabase-js (loaded from CDN before this script)
 * Config: window.ANALYST_COMMENTS_CONFIG must be set before loading
 *
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script>
 *     window.ANALYST_COMMENTS_CONFIG = {
 *       supabaseUrl: 'https://xxx.supabase.co',
 *       supabaseAnonKey: 'eyJ...',
 *       dossierId: 'womens-day-betrayal',
 *       containerId: 'comments-root',
 *       adminEmail: 'riz@dgtl.lk'
 *     };
 *   </script>
 *   <script src="/js/comments.js"></script>
 */

(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  const cfg = window.ANALYST_COMMENTS_CONFIG;
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    console.warn('[comments] Missing ANALYST_COMMENTS_CONFIG — comments disabled');
    return;
  }

  const {
    supabaseUrl,
    supabaseAnonKey,
    dossierId,
    containerId = 'comments-root',
    adminEmail = 'riz@dgtl.lk',
    siteUrl = window.location.origin,
  } = cfg;

  // ─── i18n ──────────────────────────────────────────────────────────────────
  const i18n = {
    en: {
      signInPrompt: 'Sign in with your email to comment',
      emailPlaceholder: 'your@email.com',
      namePlaceholder: 'Your name (public)',
      sendMagicLink: 'Send sign-in link',
      magicLinkSent: 'Check your email — click the link to sign in.',
      writeComment: 'Write a comment…',
      submit: 'Post comment',
      submitting: 'Posting…',
      pending: 'Awaiting moderation',
      approved: 'Published',
      reply: 'Reply',
      cancelReply: 'Cancel',
      signOut: 'Sign out',
      signedInAs: 'Signed in as',
      noComments: 'No comments yet. Be the first.',
      loadError: 'Could not load comments.',
      postError: 'Could not post your comment. Try again.',
      guidelines: 'Comments are moderated. No hate speech, harassment, or defamation.',
      charCount: 'characters remaining',
      justNow: 'just now',
      minutesAgo: 'm ago',
      hoursAgo: 'h ago',
      daysAgo: 'd ago',
    },
    si: {
      signInPrompt: 'අදහස් දැක්වීමට ඔබගේ ඊමේල් ලිපිනයෙන් පුරන්න',
      emailPlaceholder: 'oba@email.com',
      namePlaceholder: 'ඔබේ නම (ප්‍රසිද්ධ)',
      sendMagicLink: 'පුරනය සබැඳිය යවන්න',
      magicLinkSent: 'ඔබේ ඊමේල් පරීක්ෂා කරන්න — පුරනය වීමට සබැඳිය ක්ලික් කරන්න.',
      writeComment: 'අදහසක් ලියන්න…',
      submit: 'අදහස පළ කරන්න',
      submitting: 'පළ කරමින්…',
      pending: 'ප්‍රතිශෝධනය බලාපොරොත්තුවේ',
      approved: 'ප්‍රකාශිත',
      reply: 'පිළිතුරු',
      cancelReply: 'අවලංගු',
      signOut: 'ඉවත් වන්න',
      signedInAs: 'ලෙස පුරනය වී ඇත',
      noComments: 'තවම අදහස් නැත. පළමුවැන්නා වන්න.',
      loadError: 'අදහස් පූරණය කළ නොහැකි විය.',
      postError: 'ඔබගේ අදහස පළ කළ නොහැකි විය. නැවත උත්සාහ කරන්න.',
      guidelines: 'අදහස් ප්‍රතිශෝධනය කෙරේ. වෛරී කතාබහ, හිංසනය හෝ අපකීර්තිය ඉවසනු නොලැබේ.',
      charCount: 'අක්ෂර ඉතිරිව ඇත',
      justNow: 'දැන්',
      minutesAgo: ' මි. පෙර',
      hoursAgo: ' පැ. පෙර',
      daysAgo: ' දි. පෙර',
    },
  };

  function t(key) {
    const lang = document.body.classList.contains('sinhala') ? 'si' : 'en';
    return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
  }

  // ─── Supabase client ───────────────────────────────────────────────────────
  const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentUser = null;
  let comments = [];
  let replyingTo = null; // parent comment id
  const MAX_CHARS = 5000;

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const root = document.getElementById(containerId);
  if (!root) {
    console.warn('[comments] Container not found:', containerId);
    return;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
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

  // ─── Auth ──────────────────────────────────────────────────────────────────
  async function initAuth() {
    // Check for magic link callback in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Supabase handles this automatically via onAuthStateChange
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        // Clean up URL hash after magic link
        if (window.location.hash.includes('access_token')) {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        render();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        render();
      }
    });
  }

  async function sendMagicLink(email) {
    const redirectTo = `${siteUrl}/${dossierId}/`;
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
    render();
  }

  // ─── Data ──────────────────────────────────────────────────────────────────
  async function loadComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[comments] Load error:', error);
      return false;
    }

    comments = data || [];
    return true;
  }

  async function postComment(body, parentId = null) {
    if (!currentUser) return { error: 'Not signed in' };

    const displayName =
      currentUser.user_metadata?.display_name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email.split('@')[0];

    const { data, error } = await supabase.from('comments').insert({
      dossier_id: dossierId,
      parent_id: parentId,
      author_id: currentUser.id,
      author_name: displayName,
      author_email: currentUser.email,
      body: body.trim(),
      lang: isSinhala() ? 'si' : 'en',
    }).select();

    if (error) {
      console.error('[comments] Post error:', error);
      return { error };
    }

    // Add to local state (even if not yet approved, user sees their own)
    if (data && data[0]) {
      comments.push(data[0]);
    }
    return { data };
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function render() {
    root.innerHTML = '';

    // Auth section
    root.appendChild(renderAuthSection());

    // Comment list
    root.appendChild(renderCommentList());

    // Guidelines
    const guide = document.createElement('p');
    guide.className = 'comments-guidelines';
    guide.textContent = t('guidelines');
    root.appendChild(guide);
  }

  function renderAuthSection() {
    const section = document.createElement('div');
    section.className = 'comments-auth';

    if (currentUser) {
      // Signed in — show compose form + identity
      const identity = document.createElement('div');
      identity.className = 'comments-identity';

      const avatar = document.createElement('div');
      avatar.className = 'comments-avatar';
      avatar.textContent = (currentUser.user_metadata?.display_name || currentUser.email)[0].toUpperCase();
      identity.appendChild(avatar);

      const info = document.createElement('span');
      info.className = 'comments-user-info';
      const displayName =
        currentUser.user_metadata?.display_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email.split('@')[0];
      info.innerHTML = `<strong>${esc(displayName)}</strong> <span class="comments-muted">${esc(currentUser.email)}</span>`;
      identity.appendChild(info);

      const signOutBtn = document.createElement('button');
      signOutBtn.className = 'comments-btn-text';
      signOutBtn.textContent = t('signOut');
      signOutBtn.onclick = signOut;
      identity.appendChild(signOutBtn);

      section.appendChild(identity);

      // Name update (first time only — check if display_name is set)
      if (!currentUser.user_metadata?.display_name) {
        section.appendChild(renderNamePrompt());
      }

      // Compose form
      section.appendChild(renderComposeForm());
    } else {
      // Not signed in — show magic link form
      section.appendChild(renderSignInForm());
    }

    return section;
  }

  function renderNamePrompt() {
    const form = document.createElement('div');
    form.className = 'comments-name-prompt';

    const label = document.createElement('label');
    label.textContent = t('namePlaceholder');
    label.className = 'comments-label';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'comments-input';
    input.placeholder = t('namePlaceholder');
    input.maxLength = 100;

    const btn = document.createElement('button');
    btn.className = 'comments-btn-primary';
    btn.textContent = '✓';
    btn.onclick = async () => {
      const name = input.value.trim();
      if (!name) return;
      await supabase.auth.updateUser({
        data: { display_name: name },
      });
      currentUser.user_metadata.display_name = name;
      render();
    };

    form.appendChild(label);
    const row = document.createElement('div');
    row.className = 'comments-input-row';
    row.appendChild(input);
    row.appendChild(btn);
    form.appendChild(row);
    return form;
  }

  function renderSignInForm() {
    const form = document.createElement('div');
    form.className = 'comments-signin';

    const prompt = document.createElement('p');
    prompt.className = 'comments-signin-prompt';
    prompt.textContent = t('signInPrompt');
    form.appendChild(prompt);

    const inputRow = document.createElement('div');
    inputRow.className = 'comments-input-row';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'comments-input';
    emailInput.placeholder = t('emailPlaceholder');
    emailInput.required = true;

    const submitBtn = document.createElement('button');
    submitBtn.className = 'comments-btn-primary';
    submitBtn.textContent = t('sendMagicLink');

    const status = document.createElement('div');
    status.className = 'comments-status';

    submitBtn.onclick = async () => {
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) return;

      submitBtn.disabled = true;
      submitBtn.textContent = '…';

      const { error } = await sendMagicLink(email);

      if (error) {
        status.textContent = error.message;
        status.className = 'comments-status comments-error';
        submitBtn.disabled = false;
        submitBtn.textContent = t('sendMagicLink');
      } else {
        status.textContent = t('magicLinkSent');
        status.className = 'comments-status comments-success';
        emailInput.disabled = true;
      }
    };

    // Allow Enter key
    emailInput.onkeydown = (e) => {
      if (e.key === 'Enter') submitBtn.click();
    };

    inputRow.appendChild(emailInput);
    inputRow.appendChild(submitBtn);
    form.appendChild(inputRow);
    form.appendChild(status);

    return form;
  }

  function renderComposeForm(parentId = null) {
    const form = document.createElement('div');
    form.className = 'comments-compose' + (parentId ? ' comments-compose-reply' : '');

    if (parentId) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'comments-btn-text';
      cancelBtn.textContent = t('cancelReply');
      cancelBtn.onclick = () => {
        replyingTo = null;
        render();
      };
      form.appendChild(cancelBtn);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'comments-textarea';
    textarea.placeholder = t('writeComment');
    textarea.maxLength = MAX_CHARS;
    textarea.rows = 3;

    const footer = document.createElement('div');
    footer.className = 'comments-compose-footer';

    const charCount = document.createElement('span');
    charCount.className = 'comments-char-count';
    charCount.textContent = `${MAX_CHARS} ${t('charCount')}`;

    textarea.oninput = () => {
      const remaining = MAX_CHARS - textarea.value.length;
      charCount.textContent = `${remaining} ${t('charCount')}`;
      charCount.style.color = remaining < 200 ? 'var(--ember)' : '';
    };

    const submitBtn = document.createElement('button');
    submitBtn.className = 'comments-btn-primary';
    submitBtn.textContent = t('submit');

    const status = document.createElement('div');
    status.className = 'comments-status';

    submitBtn.onclick = async () => {
      const body = textarea.value.trim();
      if (!body) return;

      submitBtn.disabled = true;
      submitBtn.textContent = t('submitting');

      const { error } = await postComment(body, parentId);

      if (error) {
        status.textContent = t('postError');
        status.className = 'comments-status comments-error';
        submitBtn.disabled = false;
        submitBtn.textContent = t('submit');
      } else {
        replyingTo = null;
        render();
      }
    };

    footer.appendChild(charCount);
    footer.appendChild(submitBtn);

    form.appendChild(textarea);
    form.appendChild(footer);
    form.appendChild(status);

    return form;
  }

  function renderCommentList() {
    const list = document.createElement('div');
    list.className = 'comments-list';

    // Separate top-level and replies
    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);
    const replyMap = {};
    replies.forEach((r) => {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push(r);
    });

    if (topLevel.length === 0 && comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'comments-empty';
      empty.textContent = t('noComments');
      list.appendChild(empty);
      return list;
    }

    topLevel.forEach((comment) => {
      list.appendChild(renderComment(comment));

      // Render replies
      const childReplies = replyMap[comment.id] || [];
      childReplies.forEach((reply) => {
        const replyEl = renderComment(reply, true);
        list.appendChild(replyEl);
      });

      // If user is replying to this comment, show reply form
      if (replyingTo === comment.id && currentUser) {
        list.appendChild(renderComposeForm(comment.id));
      }
    });

    return list;
  }

  function renderComment(comment, isReply = false) {
    const el = document.createElement('div');
    el.className = 'comment' + (isReply ? ' comment-reply' : '');
    const isOwn = currentUser && currentUser.id === comment.author_id;
    const isPending = !comment.approved;

    if (isPending && isOwn) {
      el.classList.add('comment-pending');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'comment-header';

    const avatar = document.createElement('div');
    avatar.className = 'comments-avatar comments-avatar-sm';
    avatar.textContent = (comment.author_name || '?')[0].toUpperCase();

    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    meta.innerHTML = `<strong>${esc(comment.author_name)}</strong> <span class="comments-muted">${relativeTime(comment.created_at)}</span>`;

    if (isPending && isOwn) {
      const badge = document.createElement('span');
      badge.className = 'comment-badge comment-badge-pending';
      badge.textContent = t('pending');
      meta.appendChild(badge);
    }

    header.appendChild(avatar);
    header.appendChild(meta);

    // Body
    const body = document.createElement('div');
    body.className = 'comment-body';
    // Render with line breaks but no HTML
    body.innerHTML = esc(comment.body).replace(/\n/g, '<br>');

    // Actions
    const actions = document.createElement('div');
    actions.className = 'comment-actions';

    if (currentUser && !isReply) {
      const replyBtn = document.createElement('button');
      replyBtn.className = 'comments-btn-text comments-btn-sm';
      replyBtn.textContent = t('reply');
      replyBtn.onclick = () => {
        replyingTo = comment.id;
        render();
      };
      actions.appendChild(replyBtn);
    }

    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(actions);

    return el;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await initAuth();
    const loaded = await loadComments();

    if (!loaded) {
      root.innerHTML = `<p class="comments-error">${t('loadError')}</p>`;
      return;
    }

    render();

    // Re-render on language toggle
    const observer = new MutationObserver(() => render());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
