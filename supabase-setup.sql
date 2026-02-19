-- ============================================
-- TattooNOW Blog Comments System - Supabase Setup
-- ============================================

-- 1. COMMENTS TABLE
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id TEXT NOT NULL,          -- GHL location/site identifier to scope comments per site
  blog_slug TEXT NOT NULL,           -- URL path/slug of the blog post
  blog_title TEXT,                    -- Optional: blog post title for admin context
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  commenter_token UUID DEFAULT gen_random_uuid(),  -- Cookie token so commenter can see own pending comments
  ip_hash TEXT,                       -- Hashed IP for rate limiting (not raw IP for privacy)
  ghl_webhook_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT                    -- Admin who approved/rejected
);

-- 2. INDEXES
CREATE INDEX idx_comments_location_slug ON public.comments(location_id, blog_slug);
CREATE INDEX idx_comments_status ON public.comments(status);
CREATE INDEX idx_comments_commenter_token ON public.comments(commenter_token);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comments_ip_hash ON public.comments(ip_hash);

-- 3. SPAM KEYWORDS TABLE (optional - for server-side pre-screening)
CREATE TABLE public.spam_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL DEFAULT 'flag' CHECK (action IN ('flag', 'auto_reject')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some common spam keywords
INSERT INTO public.spam_keywords (keyword, action) VALUES
  ('buy now', 'auto_reject'),
  ('click here', 'auto_reject'),
  ('free money', 'auto_reject'),
  ('casino', 'auto_reject'),
  ('viagra', 'auto_reject'),
  ('crypto', 'flag'),
  ('discount code', 'flag'),
  ('check out my', 'flag'),
  ('follow me', 'flag'),
  ('DM me', 'flag');

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spam_keywords ENABLE ROW LEVEL SECURITY;

-- Public can read approved comments
CREATE POLICY "Public can read approved comments"
  ON public.comments FOR SELECT
  USING (status = 'approved');

-- NOTE: Pending comments are fetched via the edge function using service_role key,
-- which bypasses RLS. No public RLS policy needed for pending comments.
-- The edge function filters by commenter_token server-side.

-- Public can insert comments
CREATE POLICY "Public can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (true);

-- Service role (edge functions) can do everything
-- (service_role bypasses RLS by default)

-- Admin read access for spam_keywords via service role
CREATE POLICY "Service role reads spam keywords"
  ON public.spam_keywords FOR SELECT
  USING (true);

-- 5. RATE LIMIT TRACKING TABLE
CREATE TABLE public.rate_limits (
  id SERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'comment',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_ip_hash ON public.rate_limits(ip_hash);
CREATE INDEX idx_rate_limits_created_at ON public.rate_limits(created_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
  ON public.rate_limits FOR ALL
  USING (true);

-- 6. LOCATION WEBHOOKS TABLE (per-location webhook URLs)
CREATE TABLE public.location_webhooks (
  id SERIAL PRIMARY KEY,
  location_id TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.location_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages location webhooks"
  ON public.location_webhooks FOR ALL
  USING (true);

-- 7. CLEANUP FUNCTION (run periodically to purge old rate limit records)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
