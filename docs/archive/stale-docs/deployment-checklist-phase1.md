# Phase 1 Deployment Checklist

## Pre-Deployment ✅

- [x] Code committed to GitHub (`main` branch)
- [x] SessionManager React hook complete
- [x] Worker API endpoints implemented
- [x] `wrangler.toml` configured
- [x] Setup guide written

## Deployment Steps (Do These Now)

### Step 1: Install Wrangler CLI
```bash
# Check if installed
wrangler --version

# If not, install globally
npm install -g @cloudflare/wrangler

# Or use npx (no install needed)
npx wrangler login
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
# Opens browser, complete OAuth flow
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 3: Create KV Namespaces

```bash
# Create production namespaces
wrangler kv:namespace create "analyst-session-kv"
wrangler kv:namespace create "analyst-draft-kv"

# Create preview namespaces (for wrangler dev)
wrangler kv:namespace create "analyst-session-kv" --preview
wrangler kv:namespace create "analyst-draft-kv" --preview
```

**Output will be:**
```
✓ Creating namespace with title "analyst-session-kv"
✓ Add the following binding to your wrangler.toml file:
id = "abc123..."
preview_id = "xyz789..."
```

**Copy the IDs to `wrangler.toml`:**

```toml
[[kv_namespaces]]
binding = "SESSION_STORE"
id = "abc123..."              # ← Paste here
preview_id = "xyz789..."       # ← Paste here
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 4: Deploy Worker

```bash
# From repo root
cd /path/to/analyst-site

# Deploy
wrangler deploy functions/collaborative-session.js

# Or use Wrangler Cloud dashboard
# https://dash.cloudflare.com → Workers → Upload
```

**Expected output:**
```
✓ Uploaded analyst-collaborative-cms
✓ Published to https://analyst-collaborative-cms.{subdomain}.workers.dev
```

**Note the URL** — you'll use this for API calls.

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 5: Set Cloudflare Environment Variables

Go to **Cloudflare Dashboard → Workers → Your Worker → Settings → Environment Variables**

Add:
```
GITHUB_REPO = riz-razak/analyst
GITHUB_BRANCH = main
ENVIRONMENT = production
```

Click **Save**.

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 6: Test Worker Endpoints

```bash
# Test lock acquisition
curl -X POST https://analyst-collaborative-cms.{subdomain}.workers.dev/api/session/acquire-lock \
  -H "Content-Type: application/json" \
  -d '{"dossierId":"womens-day-betrayal","userId":"riz","userEmail":"riz@dgtl.lk"}'

# Expected response:
# {
#   "success": true,
#   "lock": {
#     "dossierId": "womens-day-betrayal",
#     "userId": "riz",
#     "sessionId": "1725234567890-abc123def",
#     "acquiredAt": 1725234567890
#   }
# }
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 7: Verify KV Storage

```bash
# List keys in SESSION_STORE
wrangler kv:key list --binding SESSION_STORE

# Expected output shows the lock keys you created in step 6
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 8: Update GitHub Personal Access Token

Your current PAT is missing the `workflow` scope. To add GitHub Actions support:

1. Go to **GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**
2. Click your current token
3. Check `workflow` under **repo** section
4. **Save changes**

Or create a new token with these scopes:
- `repo` (all)
- `workflow` ✓
- `write:packages` (optional)

**Update local git credentials:**
```bash
# macOS (Keychain)
security delete-internet-password -l github.com
git credential approve  # Then paste new token when prompted

# Linux (store)
git config --global credential.helper store
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 9: Add GitHub Actions Workflow

Create `.github/workflows/collaborative-sync.yml` (from `COLLAB_SETUP.md` section):

```bash
# Create the file manually or:
git checkout COLLAB_SETUP.md  # Read the workflow section
# Copy content to .github/workflows/collaborative-sync.yml
git add .github/workflows/collaborative-sync.yml
git commit -m "Add GitHub Actions collaborative sync workflow"
git push
```

**Verify:** Go to GitHub repo → Actions → should see "Collaborative CMS Sync" workflow

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 10: Test End-to-End Flow

```bash
# 1. Acquire lock
LOCK=$(curl -X POST https://your-worker.workers.dev/api/session/acquire-lock \
  -H "Content-Type: application/json" \
  -d '{"dossierId":"test-doc","userId":"user1","userEmail":"user@example.com"}')

SESSION_ID=$(echo $LOCK | jq -r '.lock.sessionId')

# 2. Autosave draft
curl -X POST https://your-worker.workers.dev/api/session/autosave \
  -H "Content-Type: application/json" \
  -d "{\"dossierId\":\"test-doc\",\"sessionId\":\"$SESSION_ID\",\"content\":\"# Test Content\"}"

# 3. Check status
curl "https://your-worker.workers.dev/api/session/status?dossierId=test-doc"

# 4. Release lock
curl -X POST https://your-worker.workers.dev/api/session/release-lock \
  -H "Content-Type: application/json" \
  -d "{\"dossierId\":\"test-doc\",\"sessionId\":\"$SESSION_ID\"}"
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 11: Test Concurrent Edits (Blocking)

```bash
# Terminal 1: User A acquires lock
LOCK_A=$(curl -X POST https://your-worker.workers.dev/api/session/acquire-lock \
  -H "Content-Type: application/json" \
  -d '{"dossierId":"test-concurrent","userId":"user-a","userEmail":"a@example.com"}')

# Terminal 2: User B tries to acquire same lock
curl -X POST https://your-worker.workers.dev/api/session/acquire-lock \
  -H "Content-Type: application/json" \
  -d '{"dossierId":"test-concurrent","userId":"user-b","userEmail":"b@example.com"}'

# Expected: 409 Conflict error
# {
#   "error": "Lock held by another user",
#   "lock": {...user A...},
#   "timeRemainingMs": 299999
# }
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Step 12: Monitor Logs

```bash
# Watch Worker logs in real-time
wrangler tail analyst-collaborative-cms

# Should show:
# [2026-03-09T12:34:56.789Z] Session established...
# [2026-03-09T12:35:01.234Z] Heartbeat received...
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

## Post-Deployment

### Integration with React App

In your visual editor component:

```jsx
import { useCollaborativeSession, SessionIndicator } from './SessionManager';

function VisualEditor({ dossierId }) {
  const { sessionState, acquireLock, publishDraft } = useCollaborativeSession(
    dossierId,
    'riz',  // userId
    'riz@dgtl.lk'  // userEmail
  );

  useEffect(() => {
    acquireLock();
  }, []);

  return (
    <>
      <SessionIndicator sessionState={sessionState} />
      {/* Your editor UI here */}
      <button onClick={() => publishDraft('Updated dossier')}>
        Publish
      </button>
    </>
  );
}
```

**Status:** [ ] Not started  [ ] In progress  [ ] Complete

---

### Monitoring Checklist

- [ ] Worker logs show no errors
- [ ] KV keys created on lock acquisition
- [ ] 2+ simultaneous edits properly blocked
- [ ] Autosave triggers every 30s
- [ ] Heartbeat every 20s
- [ ] Timeout after 5 min inactivity
- [ ] Handoff works correctly
- [ ] Publish commits to GitHub
- [ ] Cloudflare Pages auto-deploys

---

## Troubleshooting

### "Cannot find wrangler"
```bash
npm install -g @cloudflare/wrangler
# Or use: npx wrangler deploy
```

### "KV namespace not found"
- Verify IDs in `wrangler.toml` match output from Step 3
- Make sure you're logged in: `wrangler whoami`

### "API returns 404"
- Check Worker deployment completed (Step 4)
- Verify correct URL (should include `.workers.dev`)
- Check CORS headers in Worker response

### "Lock expires unexpectedly"
- Heartbeat interval too long
- Network latency causing missed heartbeats
- Increase KV TTL in `functions/collaborative-session.js` line ~100

### "GitHub Actions fails"
- Personal Access Token needs `workflow` scope (Step 8)
- Push the `.github/workflows/collaborative-sync.yml` file
- Check GitHub repo Actions tab for error logs

---

## Timeline

- **Today:** Complete Steps 1-7 (30 min)
- **Tomorrow:** Complete Steps 8-10 (20 min)
- **Testing:** Steps 11-12 (15 min)

**Total time to production: ~1 hour**

---

## Questions?

- **Setup issues?** → Review `COLLAB_SETUP.md`
- **API questions?** → Check `API_REFERENCE_AND_DEPLOYMENT.md`
- **Logs not showing?** → Run `wrangler tail` in separate terminal
- **Still stuck?** → Double-check environment variables in Step 5

**Ready to begin?**
