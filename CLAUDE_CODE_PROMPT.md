# TattooNOW Blog Comments System - Claude Code Deployment Prompt

You are deploying a blog comment system for TattooNOW, a tattoo industry technology company. The system uses Supabase as the backend and embeds on GoHighLevel (GHL) blog pages via a script tag. Comments require admin approval before becoming publicly visible. A GHL webhook receives all new comments for promotional keyword filtering via GHL automations.

## Project Files

This project contains 4 files:

1. **supabase-setup.sql** — Database schema (tables: comments, spam_keywords, rate_limits), RLS policies, indexes, and seed data for spam keywords
2. **supabase-edge-function.ts** — Supabase Edge Function handling POST (submit comment), GET (fetch comments), and PATCH (admin approve/reject). Includes rate limiting, honeypot detection, spam keyword checking, and GHL webhook dispatch
3. **comment-widget.js** — Embeddable frontend script for GHL blog pages. Self-contained with no dependencies. Injects its own CSS. Uses cookie-based commenter tokens so users can see their own pending comments. Includes honeypot field for bot detection
4. **admin-panel.html** — Standalone admin moderation panel (dark theme, TattooNOW branded). Connects to Supabase to list/approve/reject/spam comments

## Deployment Steps

### Step 1: Supabase Database Setup

- Ensure we have a Supabase project. If not, create one
- Run `supabase-setup.sql` against the database via the SQL Editor or CLI (`supabase db execute`)
- Confirm tables `comments`, `spam_keywords`, and `rate_limits` are created with RLS enabled
- Note the project URL and service_role key

### Step 2: Deploy the Edge Function

```bash
# Create function directory structure
mkdir -p supabase/functions/comments

# Copy the edge function
cp supabase-edge-function.ts supabase/functions/comments/index.ts

# Set required secrets (prompt me for values if not provided):
# - GHL_WEBHOOK_URL: The GoHighLevel inbound webhook URL
# - COMMENTS_ADMIN_KEY: A strong random key for admin API access
supabase secrets set GHL_WEBHOOK_URL="REPLACE_ME"
supabase secrets set COMMENTS_ADMIN_KEY="REPLACE_ME"

# Deploy with public access (function handles its own auth)
supabase functions deploy comments --no-verify-jwt
```

After deployment, the function URL will be:
`https://<PROJECT_REF>.supabase.co/functions/v1/comments`

### Step 3: Host the Widget Script

The `comment-widget.js` file needs to be hosted at a public URL. Options:
- **Supabase Storage**: Upload to a public bucket
- **CDN / Static host**: Any static file host works
- **TattooNOW infrastructure**: If they have existing hosting

Upload the file and note the public URL.

### Step 4: GHL Blog Embed Code

Generate the script tag for the client to add to their GHL blog page template footer:

```html
<script
  src="PUBLIC_URL_TO/comment-widget.js"
  data-supabase-fn="https://PROJECT_REF.supabase.co/functions/v1/comments"
  data-theme="dark"
  data-accent="#EA9320"
  defer>
</script>
```

This goes in GHL → Sites → Blog → Settings → Custom Code → Footer Code.

### Step 5: Host the Admin Panel

Upload `admin-panel.html` to a location accessible to the studio owner/admin. This can be:
- A password-protected page on their site
- Embedded in GHL via a custom menu link
- Hosted on Supabase Storage (not public — share URL only with admins)

The admin panel requires the Edge Function URL and the COMMENTS_ADMIN_KEY to connect.

### Step 6: Configure GHL Webhook Automation

In GoHighLevel, create a workflow:
1. **Trigger**: Inbound Webhook
2. Copy the webhook URL and update the Supabase secret: `supabase secrets set GHL_WEBHOOK_URL="<webhook_url>"`
3. **Workflow steps**:
   - IF/ELSE branch checking `{{comment_text}}` for promotional keywords (buy, discount, promo, click here, follow me, crypto, casino, URLs)
   - If spam detected → optionally call the Supabase PATCH endpoint to auto-reject
   - If clean → send email notification to admin
   - Optional: create/update GHL contact from `{{author_email}}`

## Environment Variables Summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Auto-set by Supabase | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | Full DB access for edge function |
| `GHL_WEBHOOK_URL` | Supabase secret | GHL inbound webhook URL |
| `COMMENTS_ADMIN_KEY` | Supabase secret | Admin auth for approve/reject |

## Testing Checklist

After deployment, verify:

- [ ] Visit a blog page → comment widget renders with TattooNOW styling
- [ ] Submit a comment with valid name, email, text → success alert shown
- [ ] Check Supabase `comments` table → new row with status `pending`
- [ ] Refresh the blog page → pending comment visible (cookie present)
- [ ] Open admin panel → pending comment appears
- [ ] Approve the comment → refresh blog page → comment now public
- [ ] Check GHL webhook execution log → payload received
- [ ] Submit a comment with "buy now" in text → check DB, status should be `spam`
- [ ] Submit 4 comments rapidly → 4th should be rate-limited (429 response)
- [ ] Inspect honeypot: fill the hidden "website" field via dev tools, submit → no real DB entry

## TattooNOW Brand Reference

- **Fonts**: Roboto Slab (headings), Roboto (body)
- **Colors**: Orange accent `#EA9320`, dark background `#0a0a0a` / `#1a1a1a`, light text `#fafafa`
- **Brand site**: longevity.tattoonow.com

## Important Notes

- The edge function uses `service_role` key internally, which bypasses RLS. This is intentional — RLS protects against direct Supabase client access, while the edge function enforces its own access control
- The widget uses `localStorage` for name/email convenience only (pre-filling the form). Core functionality (pending comment visibility) uses cookies
- IP addresses are SHA-256 hashed with a salt before storage — raw IPs are never persisted
- The `--no-verify-jwt` flag on deployment means the function is publicly accessible. The function validates admin access via the `COMMENTS_ADMIN_KEY` bearer token on PATCH requests
- Rate limiting is per-IP (hashed). The cleanup function `cleanup_rate_limits()` should be scheduled via pg_cron to run hourly
