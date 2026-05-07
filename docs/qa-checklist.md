# QA Checklist — analyst.rizrazak.com

Lightweight QA procedures for all changes to the analyst platform.
Every change must be verified before reporting completion.

## Pre-Deployment Checks

1. **Code Review**: Grep the codebase for stale references to old paths/patterns after refactoring
2. **No Hardcoded Secrets**: Verify no API keys, tokens, or passwords in committed code
3. **Build Check**: Ensure no syntax errors in JS files (`node -c functions/collaborative-session.js`)

## Post-Deployment Verification

### For Every Change

- [ ] Take a **screenshot** of the feature working live (not just in code)
- [ ] Test on the **production URL** (`analyst.rizrazak.com`), not localhost
- [ ] Hard-refresh (`Cmd+Shift+R`) to bypass cache before verifying
- [ ] Check the **browser console** for JS errors on affected pages

### URL & Routing Changes

- [ ] Verify new URL loads correctly (screenshot)
- [ ] Verify old URL redirects properly (301 → new URL)
- [ ] Check homepage links still navigate correctly
- [ ] Check admin panel "Live URL" shows correct path
- [ ] Test sitemap.xml has updated URLs

### Visibility / Hide-Publish Changes

- [ ] Set a dossier to "Hidden" in admin → verify the **live URL** returns 404 page
- [ ] Set a dossier to "Published" → verify the **live URL** loads the content
- [ ] Verify the KV state matches the UI state (`/api/dossier/visibility` endpoint)
- [ ] Refresh admin panel → verify status persists

### Admin Panel Changes

- [ ] Load the admin panel fresh (hard refresh)
- [ ] Navigate to the affected section
- [ ] Test the specific UI interaction (button click, form submit, etc.)
- [ ] Verify toast/feedback messages appear
- [ ] Check that the action actually took effect (not just UI update)

### Email / Notification Changes

- [ ] Send a test email and verify delivery
- [ ] Check email renders correctly (preview endpoint)
- [ ] Verify sender address and subject line

## Mitigation Strategies

### Reducing False "Done" Reports

1. **Screenshot Rule**: Always take a screenshot of the live site AFTER the change, not just the code. The screenshot must show the browser URL bar to confirm it's the production site.

2. **Round-Trip Test**: For any state change (hide/publish, save, etc.), verify the state survived a page refresh. Don't just check the optimistic UI update.

3. **Architecture Check**: Before implementing, verify HOW the site is deployed. Is it GitHub Pages? Cloudflare Pages? Worker? The implementation must match the actual infrastructure.

4. **Cache Awareness**: After deploying, always hard-refresh. GitHub Pages and Cloudflare both cache aggressively. Wait 30-60 seconds after push before testing.

5. **End-to-End Over Unit**: Test the complete user flow, not just the individual function. A function can work perfectly but fail because the request never reaches it.

## Common Gotchas

- **GitHub Pages deploy lag**: 30-90 seconds after push. Wait before testing.
- **Cloudflare cache**: Use `?cb=timestamp` query params or hard-refresh.
- **Worker Route vs Pages Function**: This site uses GitHub Pages + Cloudflare Worker Routes, NOT Cloudflare Pages. The `_middleware.js` does NOT run as a Pages Function.
- **KV eventual consistency**: KV writes may take a few seconds to propagate globally.
- **Relative paths**: When moving files, `../_shared/` references depend on directory depth.
