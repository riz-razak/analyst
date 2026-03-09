# Collaborative CMS Setup Guide

## Phase 1: Foundation - Complete ✅

This guide walks through setting up the collaborative editing system for The Analyst.

### What's Been Created

1. **Cloudflare Worker** (`functions/collaborative-session.js`)
   - Session lock management
   - Autosave to KV
   - Heartbeat/inactivity detection
   - Handoff support
   - Draft/publish workflow

2. **GitHub Actions Workflow** (`.github/workflows/collaborative-sync.yml`)
   - Auto-deploy on dossier changes
   - Lock conflict detection
   - Build validation

3. **React SessionManager** (`src/components/SessionManager.jsx`)
   - Client-side lock acquisition
   - Autosave logic
   - UI state management
   - Publish handler

4. **Styling** (`src/components/SessionManager.css`)
   - Session indicators
   - Lock badges
   - Activity log
   - Animations

5. **Configuration** (`wrangler.toml`)
   - KV namespaces (SESSION_STORE, DRAFT_STORE)
   - Environment variables
   - Cloudflare Pages integration

### Prerequisites

- Cloudflare account with Workers + KV access
- GitHub repo access (already set up)
- Environment variables configured

### Setup Steps

#### 1. Create Cloudflare KV Namespaces

```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Authenticate
wrangler login

# Create KV namespaces
wrangler kv:namespace create "analyst-session-kv"
wrangler kv:namespace create "analyst-draft-kv"

# Create preview namespaces
wrangler kv:namespace create "analyst-session-kv" --preview
wrangler kv:namespace create "analyst-draft-kv" --preview
```

Note the namespace IDs and add them to `wrangler.toml`.

#### 2. Deploy Worker

```bash
wrangler deploy functions/collaborative-session.js
```

The Worker will be deployed to:
```
https://analyst-collaborative-cms.<your-cloudflare-subdomain>.workers.dev
```

#### 3. Set Environment Variables in Cloudflare

Go to Cloudflare Dashboard → Workers → Settings → Environment Variables:

```
GITHUB_REPO = riz-razak/analyst
GITHUB_BRANCH = main
ENVIRONMENT = production
```

#### 4. Update React App

Import SessionManager in your visual editor component:

```jsx
import { useCollaborativeSession, SessionIndicator } from './SessionManager';

function VisualEditor() {
  const { sessionState, acquireLock, releaseLock, handleContentChange, publishDraft } =
    useCollaborativeSession('womens-day-betrayal', 'riz@dgtl.lk', 'Riz Razak');

  useEffect(() => {
    acquireLock();
  }, []);

  return (
    <>
      <SessionIndicator sessionState={sessionState} />
      {/* Editor UI */}
      <button onClick={() => publishDraft()}>Publish</button>
    </>
  );
}
```

#### 5. Configure GitHub Actions Secrets

Add to GitHub repo settings (Settings → Secrets):

```
CLOUDFLARE_API_TOKEN = <your-api-token>
CLOUDFLARE_ACCOUNT_ID = <your-account-id>
```

### How It Works

**User Workflow:**
```
1. Editor opens dossier in Visual Editor (?admin)
2. SessionManager calls `/api/session/acquire-lock`
3. Lock acquired (KV stored) OR blocked if another user has it
4. Every 30s: autosave to `/api/session/autosave`
5. Every 20s: heartbeat to keep lock alive
6. After 5 min inactivity: another user can take over
7. Click "Publish" → commits to GitHub → Cloudflare deploys
```

**Lock States:**
```
[Available] → User A takes lock
             ↓
         [Editing A]
             ↓
         (5 min inactivity)
             ↓
         User B warned: "Ready to take over in 60s"
             ↓
         User B clicks "Take Over"
             ↓
         [Editing B]
```

**Draft Storage:**
- Location: Cloudflare KV (DRAFT_STORE)
- Expires: 7 days
- Format: JSON with content + metadata

**Published Content:**
- Location: Git repo (`content/dossiers/{slug}/overrides.json`)
- Method: GitHub API commit via Worker
- Trigger: Click "Publish" button
- Deploy: GitHub Actions → Cloudflare Pages

### API Endpoints

All endpoints are at `/api/session/*`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/acquire-lock` | Get lock for dossier |
| POST | `/release-lock` | Release lock when done |
| GET | `/status` | Check current lock status |
| POST | `/heartbeat` | Keep lock alive |
| POST | `/autosave` | Save draft |
| GET | `/draft` | Get current draft |
| POST | `/publish` | Commit draft to GitHub |
| POST | `/handoff` | Transfer lock to another user |

### Monitoring & Debugging

**Check KV stores:**
```bash
wrangler kv:key list --namespace-id=<NAMESPACE_ID>
wrangler kv:key get "<key>" --namespace-id=<NAMESPACE_ID>
```

**Check Worker logs:**
```bash
wrangler tail analyst-collaborative-cms
```

**Test API:**
```bash
# Acquire lock
curl -X POST https://analyst-collaborative-cms.workers.dev/api/session/acquire-lock \
  -H "Content-Type: application/json" \
  -d '{"dossierId":"womens-day-betrayal","userId":"riz","userEmail":"riz@dgtl.lk"}'

# Check status
curl "https://analyst-collaborative-cms.workers.dev/api/session/status?dossierId=womens-day-betrayal"
```

### Common Issues

**Q: "Lock held by another user"**
- Another editor is active on this dossier
- Wait for timeout (5 min) or click "Take Over" if they're inactive

**Q: Autosave not working**
- Check SessionManager heartbeat logs
- Verify KV namespace exists and Worker has access
- Check CORS headers in Worker response

**Q: Publish fails**
- Check GitHub API token in environment
- Verify repo has write permissions
- Check GitHub Actions workflow logs

**Q: Lock expires unexpectedly**
- Heartbeat interval too long (should be <1 min)
- Network latency issues
- Increase TTL in Worker (line 100)

### Next Steps

**Phase 2:** Build visual editor UI with TipTap
**Phase 3:** Integrate Sveltia CMS for metadata editing
**Phase 4:** Testing & production deployment

---

**Questions?** Review:
- `COLLABORATIVE_EDITING_SYSTEM.md` — Full architecture
- `API_REFERENCE_AND_DEPLOYMENT.md` — API docs
- `IMPLEMENTATION_GUIDE.md` — Step-by-step breakdown
