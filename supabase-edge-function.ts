// supabase/functions/comments/index.ts
// ============================================
// TattooNOW Blog Comments - Edge Function
// Handles: POST (submit), GET (fetch), PATCH (admin approve/reject)
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-commenter-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// --- CONFIG ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GHL_WEBHOOK_URL = Deno.env.get("GHL_WEBHOOK_URL") || "";
const ADMIN_API_KEY = Deno.env.get("COMMENTS_ADMIN_KEY") || "change-me-in-production";
const RATE_LIMIT_MAX = 3;          // Max comments per window
const RATE_LIMIT_WINDOW_MIN = 15;  // Window in minutes

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- HELPERS ---

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "tattoonow-salt-2024");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeText(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

// --- RATE LIMITING ---

async function checkRateLimit(ipHash: string): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);

  return (count || 0) >= RATE_LIMIT_MAX;
}

async function recordRateLimit(ipHash: string) {
  await supabase.from("rate_limits").insert({ ip_hash: ipHash });
}

// --- SPAM CHECK ---

async function checkSpamKeywords(text: string): Promise<{ isSpam: boolean; action: string }> {
  const { data: keywords } = await supabase
    .from("spam_keywords")
    .select("keyword, action");

  if (!keywords) return { isSpam: false, action: "none" };

  const lowerText = text.toLowerCase();
  for (const kw of keywords) {
    if (lowerText.includes(kw.keyword.toLowerCase())) {
      return { isSpam: true, action: kw.action };
    }
  }
  return { isSpam: false, action: "none" };
}

// --- GHL WEBHOOK ---

async function sendGHLWebhook(comment: Record<string, unknown>) {
  if (!GHL_WEBHOOK_URL) {
    console.log("No GHL webhook URL configured, skipping");
    return;
  }

  try {
    const payload = {
      comment_id: comment.id,
      blog_slug: comment.blog_slug,
      blog_title: comment.blog_title || "",
      author_name: comment.author_name,
      author_email: comment.author_email,
      comment_text: comment.comment_text,
      status: comment.status,
      created_at: comment.created_at,
      source: "tattoonow_blog_comments",
    };

    const response = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      await supabase
        .from("comments")
        .update({ ghl_webhook_sent: true })
        .eq("id", comment.id);
    } else {
      console.error("GHL webhook failed:", response.status);
    }
  } catch (err) {
    console.error("GHL webhook error:", err);
  }
}

// --- HANDLERS ---

async function handleSubmit(req: Request): Promise<Response> {
  const body = await req.json();
  const { blog_slug, blog_title, author_name, author_email, comment_text, honeypot } = body;

  // Honeypot check - if this hidden field has a value, it's a bot
  if (honeypot) {
    // Return fake success to not tip off bots
    return new Response(
      JSON.stringify({ success: true, commenter_token: crypto.randomUUID() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate required fields
  if (!blog_slug || !author_name || !author_email || !comment_text) {
    return new Response(
      JSON.stringify({ error: "All fields are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(author_email)) {
    return new Response(
      JSON.stringify({ error: "Please enter a valid email address" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Length limits
  if (author_name.length > 100 || author_email.length > 254 || comment_text.length > 5000) {
    return new Response(
      JSON.stringify({ error: "Input exceeds maximum length" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limit check
  const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIP(clientIP);

  if (await checkRateLimit(ipHash)) {
    return new Response(
      JSON.stringify({ error: "You're commenting too frequently. Please wait a few minutes." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Spam keyword check
  const spamResult = await checkSpamKeywords(comment_text + " " + author_name);
  let status = "pending";
  if (spamResult.isSpam && spamResult.action === "auto_reject") {
    status = "spam";
  }

  // Sanitize & insert
  const sanitizedComment = {
    blog_slug: sanitizeText(blog_slug),
    blog_title: blog_title ? sanitizeText(blog_title) : null,
    author_name: sanitizeText(author_name),
    author_email: author_email.trim().toLowerCase(),
    comment_text: sanitizeText(comment_text),
    status,
    ip_hash: ipHash,
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(sanitizedComment)
    .select()
    .single();

  if (error) {
    console.error("Insert error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to save comment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Record rate limit hit
  await recordRateLimit(ipHash);

  // Fire GHL webhook (non-blocking)
  sendGHLWebhook(data);

  return new Response(
    JSON.stringify({
      success: true,
      commenter_token: data.commenter_token,
      status: data.status === "spam" ? "pending" : data.status, // Don't reveal spam detection
      message:
        data.status === "spam"
          ? "Your comment has been submitted and is awaiting moderation."
          : "Your comment has been submitted and is awaiting moderation.",
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleFetch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization");

  // Admin listing: return all comments when authenticated with admin key
  if (url.searchParams.get("admin") === "true") {
    if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch comments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ comments: data || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Public listing: approved + own pending
  const blogSlug = url.searchParams.get("blog_slug");
  const commenterToken = url.searchParams.get("commenter_token") ||
    req.headers.get("x-commenter-token");

  if (!blogSlug) {
    return new Response(
      JSON.stringify({ error: "blog_slug is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch approved comments for this blog post
  const { data: approved } = await supabase
    .from("comments")
    .select("id, author_name, comment_text, created_at, status")
    .eq("blog_slug", blogSlug)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  // If commenter token provided, also fetch their pending comments
  let pending: typeof approved = [];
  if (commenterToken) {
    const { data: ownPending } = await supabase
      .from("comments")
      .select("id, author_name, comment_text, created_at, status")
      .eq("blog_slug", blogSlug)
      .eq("commenter_token", commenterToken)
      .eq("status", "pending");
    pending = ownPending || [];
  }

  return new Response(
    JSON.stringify({
      comments: approved || [],
      pending_own: pending,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleAdmin(req: Request): Promise<Response> {
  // Simple API key auth for admin actions
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { comment_id, action, reviewed_by } = await req.json();

  if (!comment_id || !["approve", "reject", "spam"].includes(action)) {
    return new Response(
      JSON.stringify({ error: "comment_id and valid action (approve/reject/spam) required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const statusMap: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    spam: "spam",
  };

  const { data, error } = await supabase
    .from("comments")
    .update({
      status: statusMap[action],
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewed_by || "admin",
    })
    .eq("id", comment_id)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to update comment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, comment: data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// --- MAIN ROUTER ---

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    switch (req.method) {
      case "POST":
        return await handleSubmit(req);
      case "GET":
        return await handleFetch(req);
      case "PATCH":
        return await handleAdmin(req);
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
