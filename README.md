# TattooNOW Blog Comments System

A lightweight, embeddable comment system for GoHighLevel blog pages, powered by Supabase with GHL webhook integration for promotional keyword filtering.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  GHL Blog Page                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  <script> Comment Widget (comment-widget.js) │   │
│  │  - Comment form (name, email, text)          │   │
│  │  - Honeypot spam trap                        │   │
│  │  - Cookie-based "see your pending" comments  │   │
│  │  - Displays approved + own pending comments  │   │
│  └──────────────────┬───────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │ HTTPS
                      ▼
┌──────────────────────────────────────────────────────┐
│  Supabase Edge Function (/functions/v1/comments)     │
│  - POST: Validate → Spam check → Insert → Webhook   │
│  - GET:  Fetch approved + own pending                │
│  - PATCH: Admin approve/reject/spam                  │
└──────────────┬────────────────────┬──────────────────┘
               │                    │
               ▼                    ▼
┌──────────────────────┐  ┌────────────────────────────┐
│  Supabase Database   │  │  GHL Webhook               │
│  - comments          │  │  - Receives all comments    │
│  - spam_keywords     │  │  - Automation filters for   │
│  - rate_limits       │  │    promotional keywords     │
│  - Row Level Security│  │  - Can auto-update status   │
└──────────────────────┘  │  - Adds contact if needed   │
                          └────────────────────────────┘
```

---

## Setup Steps

### 1. Supabase Project

1. Create a new Supabase project (or use existing) at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-setup.sql`
3. Note your:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: (Settings → API → `anon` key)
   - **Service Role Key**: (Settings → API → `service_role` key — keep secret!)

### 2. Deploy Edge Function

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Create the function directory
mkdir -p supabase/functions/comments
cp supabase-edge-function.ts supabase/functions/comments/index.ts

# Set environment variables
supabase secrets set GHL_WEBHOOK_URL="https://services.leadconnectorhq.com/hooks/YOUR_WEBHOOK_ID"
supabase secrets set COMMENTS_ADMIN_KEY="your-strong-admin-key-here"

# Deploy
supabase functions deploy comments --no-verify-jwt
```

> **Note**: `--no-verify-jwt` allows public access. The function handles its own auth for admin routes.

### 3. GoHighLevel Webhook Setup

1. In GHL, go to **Automation** → **Create Workflow**
2. Set trigger: **Inbound Webhook**
3. Copy the webhook URL → set as `GHL_WEBHOOK_URL` in Supabase secrets
4. Add workflow steps:

**Suggested GHL Automation Flow:**

```
Trigger: Inbound Webhook
  │
  ├─ IF/ELSE: Check comment_text contains promotional keywords
  │   ├─ YES → Tag as "Spam Comment"
  │   │        → (Optional) Call Supabase PATCH to auto-reject
  │   │
  │   └─ NO  → Send Email notification to admin
  │           → (Optional) Create/update GHL contact from author_email
  │
  └─ Always: Log to custom field or notes
```

**Promotional Keywords to Filter in GHL:**
- "check out my", "follow me on", "DM me", "link in bio"
- "buy", "discount", "promo code", "free", "click here"
- "crypto", "NFT", "casino", "earn money"
- URLs (regex: `https?://`)
- Excessive caps (regex: `[A-Z]{10,}`)

### 4. Embed on GHL Blog Pages

Add this script tag to your GHL blog page template (via **Custom Code** in page settings → Footer Code):

```html
<script
  src="https://YOUR_HOSTING_DOMAIN/comment-widget.js"
  data-supabase-fn="https://YOUR_PROJECT.supabase.co/functions/v1/comments"
  data-theme="dark"
  data-accent="#EA9320"
  defer>
</script>
```

**Optional attributes:**

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-supabase-fn` | *required* | Your Supabase edge function URL |
| `data-blog-slug` | `window.location.pathname` | Custom slug for the blog post |
| `data-blog-title` | `document.title` | Blog post title (sent to GHL) |
| `data-theme` | `dark` | `dark` or `light` |
| `data-accent` | `#EA9320` | Accent color (TattooNOW orange) |

**Hosting the widget script:**
- Upload `comment-widget.js` to your CDN, Supabase Storage, or any static host
- Or host it via your existing TattooNOW infrastructure

### 5. Admin Panel

Open `admin-panel.html` in a browser or embed in a GHL custom menu page.

1. Enter your Supabase Edge Function URL
2. Enter your admin API key (`COMMENTS_ADMIN_KEY`)
3. Click Connect
4. Approve, reject, or mark comments as spam

> **Tip:** For the admin panel to list all comments, you can use the Supabase **service role key** as the API key. This bypasses RLS. Only share this with admins.

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| **Honeypot** | Hidden "website" field — bots fill it, humans don't |
| **Rate Limiting** | 3 comments per 15min per IP (hashed, not stored raw) |
| **Keyword Filtering** | Server-side spam check + GHL webhook for advanced filtering |
| **Input Sanitization** | HTML entities escaped on both server and client |
| **Length Limits** | Name: 100, Email: 254, Comment: 5000 chars |
| **Cookie Auth** | Commenter token stored in cookie for pending comment visibility |
| **RLS** | Supabase Row Level Security — public only reads approved |
| **Admin Auth** | API key required for approve/reject actions |
| **IP Privacy** | IPs are SHA-256 hashed with salt before storage |

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase-setup.sql` | Database schema, RLS policies, indexes, seed data |
| `supabase-edge-function.ts` | API: submit, fetch, moderate comments + GHL webhook |
| `comment-widget.js` | Embeddable frontend widget (single script, no deps) |
| `admin-panel.html` | Standalone admin moderation panel |

---

## GHL Webhook Payload

Every new comment sends this JSON to your GHL webhook:

```json
{
  "comment_id": "uuid",
  "blog_slug": "/blog/best-tattoo-aftercare",
  "blog_title": "Best Tattoo Aftercare Tips",
  "author_name": "Jane Doe",
  "author_email": "jane@example.com",
  "comment_text": "Great article! ...",
  "status": "pending",
  "created_at": "2026-02-18T15:30:00Z",
  "source": "tattoonow_blog_comments"
}
```

Use `author_email` to create/match GHL contacts. Use `comment_text` in IF/ELSE conditions for keyword filtering.

---

## Maintenance

- **Cleanup rate limits**: The `cleanup_rate_limits()` function can be called via a Supabase cron job (pg_cron) to purge old rate limit records every hour
- **Spam keywords**: Add/remove via Supabase Table Editor or write an admin endpoint
- **Backups**: Supabase handles automatic database backups on paid plans
