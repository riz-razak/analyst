# Supabase Comments Setup — analyst.rizrazak.com

## 1. Create Supabase project

Go to https://supabase.com/dashboard → New Project

- Project name: `analyst-comments`
- Region: Pick closest to Sri Lanka (e.g., Singapore `ap-southeast-1`)
- Database password: (save this)

## 2. Run migration

In Supabase Dashboard → SQL Editor → paste contents of `migrations/001_comments.sql` → Run.

This creates:
- `comments` table with RLS policies
- Auto-approve trigger (commented out — uncomment if you want your own comments auto-approved)
- `comment_counts` view

## 3. Enable Magic Link auth

Dashboard → Authentication → Providers → Email:
- Enable Email provider: ✅
- Enable Magic Link: ✅ (toggle "Enable Email Signup" ON)
- Confirm email: OFF (magic link IS the confirmation)
- Secure email change: ON
- Email OTP expiry: 3600 (1 hour)

Dashboard → Authentication → URL Configuration:
- Site URL: `https://analyst.rizrazak.com`
- Redirect URLs: Add `https://analyst.rizrazak.com/dossiers/womens-day-betrayal/`
  (Add one per dossier page, or use wildcard: `https://analyst.rizrazak.com/**`)

## 4. Customize magic link email

Dashboard → Authentication → Email Templates → Magic Link:

Subject: `Sign in to comment — analyst.rizrazak.com`

Body (HTML):
```html
<h2>Sign in to comment</h2>
<p>Click below to sign in to analyst.rizrazak.com and leave your comment:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in now →</a></p>
<p style="color:#888;font-size:12px;">
  This link expires in 1 hour. If you didn't request this, ignore this email.
</p>
```

## 5. Get credentials

Dashboard → Settings → API:
- **Project URL**: Copy → replace `SUPABASE_URL_HERE` in index.html
- **anon/public key**: Copy → replace `SUPABASE_ANON_KEY_HERE` in index.html

These are safe to expose in client-side code — RLS policies protect the data.

## 6. Verify it works

1. Open the dossier page
2. Enter an email address in the comments section
3. Click "Send sign-in link"
4. Check email for magic link
5. Click link → redirected back to dossier → signed in
6. Post a comment → appears as "Awaiting moderation"
7. In Supabase Dashboard → Table Editor → comments → set `approved = true`

## 7. Admin moderation

For now, moderate via Supabase Dashboard directly:
- Table Editor → comments → filter by `approved = false`
- Toggle `approved` to `true` to publish
- Toggle `flagged` to `true` to flag problematic comments

Future: Build admin moderation UI in `/admin-comments.html`

## Cost

Supabase Free tier includes:
- 500 MB database
- 50,000 monthly active users
- Unlimited API requests
- Magic link emails (via Supabase's built-in email)

This is more than sufficient for a citizen journalism site.
