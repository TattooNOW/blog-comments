/**
 * TattooNOW Blog Comments Widget
 * ================================
 * Embed via: <script src="https://YOUR_DOMAIN/comment-widget.js" 
 *              data-supabase-url="https://xxx.supabase.co"
 *              data-supabase-fn="https://xxx.supabase.co/functions/v1/comments"
 *              defer></script>
 *
 * Optional attributes:
 *   data-blog-slug="custom-slug"   (defaults to window.location.pathname)
 *   data-blog-title="Post Title"   (defaults to document.title)
 *   data-theme="dark"              (default) or "light"
 *   data-accent="#EA9320"           (TattooNOW orange default)
 */

(function () {
  "use strict";

  // --- CONFIG FROM SCRIPT TAG ---
  const scriptTag = document.currentScript || document.querySelector('script[data-supabase-fn]');
  // Detect GHL location ID: manual override > chat widget > hostname
  function detectLocationId() {
    var manual = scriptTag?.getAttribute("data-location-id");
    if (manual) return manual;
    var chatWidget = document.querySelector("chat-widget[location-id]");
    if (chatWidget) return chatWidget.getAttribute("location-id");
    var ghlDiv = document.querySelector("[data-location-id]");
    if (ghlDiv) return ghlDiv.getAttribute("data-location-id");
    return window.location.hostname;
  }

  const CONFIG = {
    supabaseUrl: scriptTag?.getAttribute("data-supabase-url") || "",
    functionUrl: scriptTag?.getAttribute("data-supabase-fn") || "",
    locationId: detectLocationId(),
    blogSlug: scriptTag?.getAttribute("data-blog-slug") || window.location.pathname,
    blogTitle: scriptTag?.getAttribute("data-blog-title") || document.title,
    theme: scriptTag?.getAttribute("data-theme") || "dark",
    accent: scriptTag?.getAttribute("data-accent") || "#EA9320",
  };

  if (!CONFIG.functionUrl) {
    console.error("[TattooNOW Comments] Missing data-supabase-fn attribute on script tag.");
    return;
  }

  // --- COOKIE HELPERS ---
  const COOKIE_NAME = "tnow_commenter";
  const COOKIE_DAYS = 365;

  function getCommenterToken() {
    const match = document.cookie.match(new RegExp("(^| )" + COOKIE_NAME + "=([^;]+)"));
    return match ? match[2] : null;
  }

  function setCommenterToken(token) {
    const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = `${COOKIE_NAME}=${token}; expires=${expires}; path=/; SameSite=Lax; Secure`;
  }

  // --- TIME FORMATTING ---
  function timeAgo(dateStr) {
    const now = new Date();
    const then = new Date(dateStr);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 2592000) return Math.floor(seconds / 86400) + "d ago";
    return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // --- STYLES ---
  function injectStyles() {
    const isDark = CONFIG.theme === "dark";
    const bg = isDark ? "#0a0a0a" : "#fafafa";
    const bgCard = isDark ? "#1a1a1a" : "#ffffff";
    const bgInput = isDark ? "#252525" : "#f0f0f0";
    const text = isDark ? "#fafafa" : "#1a1a1a";
    const textMuted = isDark ? "#999" : "#666";
    const border = isDark ? "#333" : "#ddd";
    const accent = CONFIG.accent;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap');

      .tnow-comments {
        font-family: 'Roboto', sans-serif;
        max-width: 720px;
        margin: 40px auto;
        padding: 0 16px;
        color: ${text};
      }

      .tnow-comments * { box-sizing: border-box; }

      .tnow-comments-header {
        font-family: 'Roboto Slab', serif;
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 24px;
        color: ${text};
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tnow-comments-header .count {
        background: ${accent};
        color: #fff;
        font-family: 'Roboto', sans-serif;
        font-size: 0.8rem;
        font-weight: 500;
        padding: 2px 10px;
        border-radius: 20px;
      }

      /* --- FORM --- */
      .tnow-form {
        background: ${bgCard};
        border: 1px solid ${border};
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 32px;
      }

      .tnow-form-row {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }

      .tnow-form-row > div { flex: 1; }

      .tnow-form label {
        display: block;
        font-size: 0.8rem;
        font-weight: 500;
        color: ${textMuted};
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tnow-form input,
      .tnow-form textarea {
        width: 100%;
        padding: 10px 14px;
        font-family: 'Roboto', sans-serif;
        font-size: 0.95rem;
        color: ${text};
        background: ${bgInput};
        border: 1px solid ${border};
        border-radius: 8px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .tnow-form input:focus,
      .tnow-form textarea:focus {
        border-color: ${accent};
        box-shadow: 0 0 0 3px ${accent}33;
      }

      .tnow-form textarea {
        min-height: 100px;
        resize: vertical;
        margin-bottom: 12px;
      }

      /* Honeypot - visually hidden but accessible to bots */
      .tnow-hp {
        position: absolute;
        left: -9999px;
        top: -9999px;
        opacity: 0;
        height: 0;
        width: 0;
        overflow: hidden;
        pointer-events: none;
        tab-index: -1;
      }

      .tnow-form-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .tnow-form-footer .note {
        font-size: 0.75rem;
        color: ${textMuted};
      }

      .tnow-submit {
        font-family: 'Roboto Slab', serif;
        font-size: 0.9rem;
        font-weight: 600;
        color: #fff;
        background: ${accent};
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.15s;
      }

      .tnow-submit:hover { opacity: 0.9; transform: translateY(-1px); }
      .tnow-submit:active { transform: translateY(0); }
      .tnow-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      /* --- MESSAGES --- */
      .tnow-alert {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 0.9rem;
        display: none;
      }

      .tnow-alert.success {
        background: #0d3320;
        border: 1px solid #166534;
        color: #4ade80;
        display: block;
      }

      .tnow-alert.error {
        background: #3b1111;
        border: 1px solid #991b1b;
        color: #fca5a5;
        display: block;
      }

      ${CONFIG.theme === "light" ? `
      .tnow-alert.success { background: #dcfce7; border-color: #86efac; color: #166534; }
      .tnow-alert.error { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
      ` : ""}

      /* --- COMMENTS LIST --- */
      .tnow-comment {
        background: ${bgCard};
        border: 1px solid ${border};
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 12px;
        transition: border-color 0.2s;
      }

      .tnow-comment:hover { border-color: ${accent}66; }

      .tnow-comment.pending {
        border-left: 3px solid ${accent};
        opacity: 0.75;
      }

      .tnow-comment-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .tnow-comment-author {
        font-family: 'Roboto Slab', serif;
        font-weight: 600;
        font-size: 0.95rem;
        color: ${text};
      }

      .tnow-comment-time {
        font-size: 0.75rem;
        color: ${textMuted};
      }

      .tnow-comment-body {
        font-size: 0.9rem;
        line-height: 1.6;
        color: ${text}dd;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .tnow-pending-badge {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 500;
        color: ${accent};
        background: ${accent}1a;
        padding: 2px 8px;
        border-radius: 4px;
        margin-left: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tnow-empty {
        text-align: center;
        padding: 32px;
        color: ${textMuted};
        font-size: 0.9rem;
      }

      .tnow-loading {
        text-align: center;
        padding: 24px;
        color: ${textMuted};
      }

      .tnow-loading .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid ${border};
        border-top-color: ${accent};
        border-radius: 50%;
        animation: tnow-spin 0.6s linear infinite;
      }

      @keyframes tnow-spin { to { transform: rotate(360deg); } }

      /* Responsive */
      @media (max-width: 480px) {
        .tnow-form-row { flex-direction: column; gap: 0; }
        .tnow-form { padding: 16px; }
        .tnow-comment { padding: 16px; }
      }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --- WIDGET HTML ---
  function createWidget() {
    const container = document.createElement("div");
    container.className = "tnow-comments";
    container.id = "tnow-comments";
    container.innerHTML = `
      <div class="tnow-comments-header">
        Comments <span class="count" id="tnow-count">0</span>
      </div>

      <div class="tnow-form">
        <div class="tnow-alert" id="tnow-alert"></div>
        <div class="tnow-form-row">
          <div>
            <label for="tnow-name">Name</label>
            <input type="text" id="tnow-name" placeholder="Your name" maxlength="100" autocomplete="name" />
          </div>
          <div>
            <label for="tnow-email">Email</label>
            <input type="email" id="tnow-email" placeholder="your@email.com" maxlength="254" autocomplete="email" />
          </div>
        </div>
        <!-- Honeypot field - hidden from humans, bots will fill it -->
        <div class="tnow-hp" aria-hidden="true">
          <label for="tnow-website">Website</label>
          <input type="text" id="tnow-website" name="website" tabindex="-1" autocomplete="off" />
        </div>
        <label for="tnow-comment">Comment</label>
        <textarea id="tnow-comment" placeholder="Share your thoughts..." maxlength="5000"></textarea>
        <div class="tnow-form-footer">
          <span class="note">Your email won't be published. Comments are moderated.</span>
          <button class="tnow-submit" id="tnow-submit">Post Comment</button>
        </div>
      </div>

      <div id="tnow-list">
        <div class="tnow-loading"><span class="spinner"></span> Loading comments...</div>
      </div>
    `;
    return container;
  }

  // --- API CALLS ---
  async function fetchComments() {
    const token = getCommenterToken();
    const params = new URLSearchParams({ location_id: CONFIG.locationId, blog_slug: CONFIG.blogSlug });
    if (token) params.append("commenter_token", token);

    try {
      const res = await fetch(`${CONFIG.functionUrl}?${params}`, {
        headers: token ? { "x-commenter-token": token } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    } catch (err) {
      console.error("[TattooNOW Comments] Fetch error:", err);
      return { comments: [], pending_own: [] };
    }
  }

  async function submitComment(name, email, text, honeypot) {
    const res = await fetch(CONFIG.functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: CONFIG.locationId,
        blog_slug: CONFIG.blogSlug,
        blog_title: CONFIG.blogTitle,
        author_name: name,
        author_email: email,
        comment_text: text,
        honeypot: honeypot,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Submission failed");
    return data;
  }

  // --- RENDERING ---
  function renderComment(comment, isPending = false) {
    const div = document.createElement("div");
    div.className = `tnow-comment${isPending ? " pending" : ""}`;
    div.innerHTML = `
      <div class="tnow-comment-meta">
        <span>
          <span class="tnow-comment-author">${escapeHtml(comment.author_name)}</span>
          ${isPending ? '<span class="tnow-pending-badge">Awaiting Approval</span>' : ""}
        </span>
        <span class="tnow-comment-time">${timeAgo(comment.created_at)}</span>
      </div>
      <div class="tnow-comment-body">${escapeHtml(comment.comment_text)}</div>
    `;
    return div;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function renderComments() {
    const listEl = document.getElementById("tnow-list");
    const countEl = document.getElementById("tnow-count");
    const data = await fetchComments();

    const approved = data.comments || [];
    const pending = data.pending_own || [];
    const total = approved.length;

    countEl.textContent = total;
    listEl.innerHTML = "";

    // Show user's pending comments first
    pending.forEach((c) => listEl.appendChild(renderComment(c, true)));

    // Then approved
    if (approved.length === 0 && pending.length === 0) {
      listEl.innerHTML = '<div class="tnow-empty">No comments yet. Be the first to share your thoughts!</div>';
    } else {
      approved.forEach((c) => listEl.appendChild(renderComment(c)));
    }
  }

  // --- EVENT HANDLERS ---
  function showAlert(type, message) {
    const alert = document.getElementById("tnow-alert");
    alert.className = `tnow-alert ${type}`;
    alert.textContent = message;

    if (type === "success") {
      setTimeout(() => {
        alert.style.display = "none";
        alert.className = "tnow-alert";
      }, 6000);
    }
  }

  function bindEvents() {
    const btn = document.getElementById("tnow-submit");
    const nameInput = document.getElementById("tnow-name");
    const emailInput = document.getElementById("tnow-email");
    const commentInput = document.getElementById("tnow-comment");
    const honeypotInput = document.getElementById("tnow-website");

    // Pre-fill name/email from cookie data if available
    try {
      const saved = localStorage.getItem("tnow_commenter_info");
      if (saved) {
        const info = JSON.parse(saved);
        if (info.name) nameInput.value = info.name;
        if (info.email) emailInput.value = info.email;
      }
    } catch (e) { /* ignore */ }

    btn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const comment = commentInput.value.trim();
      const honeypot = honeypotInput.value;

      if (!name || !email || !comment) {
        showAlert("error", "Please fill in all fields.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Submitting...";

      try {
        const result = await submitComment(name, email, comment, honeypot);

        // Save commenter token as cookie
        if (result.commenter_token) {
          setCommenterToken(result.commenter_token);
        }

        // Save name/email for convenience
        try {
          localStorage.setItem("tnow_commenter_info", JSON.stringify({ name, email }));
        } catch (e) { /* ignore */ }

        // Clear form & show success
        commentInput.value = "";
        showAlert("success", "✓ Comment submitted! It will appear once approved.");

        // Re-render to show pending comment
        await renderComments();
      } catch (err) {
        showAlert("error", err.message || "Something went wrong. Please try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Post Comment";
      }
    });
  }

  // --- INIT ---
  function init() {
    injectStyles();
    const widget = createWidget();

    // Insert at end of article/main content, or append to body
    const target =
      document.querySelector("[data-comments-target]") ||
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.body;

    target.appendChild(widget);
    bindEvents();
    renderComments();
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
