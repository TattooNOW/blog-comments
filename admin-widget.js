/**
 * TattooNOW Blog Comments - Admin Widget
 * ========================================
 * Embed via loader script with data attributes:
 *   data-supabase-fn  (required) Edge function URL
 *   data-admin-key    (required) Admin API key
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript || document.querySelector('script[data-admin-key]');

  const CONFIG = {
    url: scriptTag?.getAttribute("data-supabase-fn") || "",
    key: scriptTag?.getAttribute("data-admin-key") || "",
  };

  if (!CONFIG.url || !CONFIG.key) {
    console.error("[TattooNOW Admin] Missing data-supabase-fn or data-admin-key attribute.");
    return;
  }

  let allComments = [];
  let currentTab = "pending";

  // --- STYLES ---
  function injectStyles() {
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap');

      .tnow-admin {
        --bg: #0a0a0a;
        --bg-card: #1a1a1a;
        --text: #fafafa;
        --text-muted: #999;
        --border: #333;
        --accent: #EA9320;
        --green: #4ade80;
        --red: #f87171;

        font-family: 'Roboto', sans-serif;
        color: var(--text);
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 16px;
      }

      .tnow-admin * { box-sizing: border-box; }

      .tnow-admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }

      .tnow-admin-header h1 {
        font-family: 'Roboto Slab', serif;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
      }

      .tnow-admin-header h1 span { color: var(--accent); }

      /* Tabs */
      .tnow-admin .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
      }

      .tnow-admin .tab {
        padding: 8px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px 8px 0 0;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
        transition: all 0.2s;
        border-bottom: none;
      }

      .tnow-admin .tab.active {
        color: var(--accent);
        border-color: var(--accent);
        border-bottom: 2px solid var(--bg-card);
        margin-bottom: -1px;
        position: relative;
        z-index: 1;
      }

      .tnow-admin .tab .badge {
        background: var(--accent);
        color: #fff;
        font-size: 0.7rem;
        padding: 1px 7px;
        border-radius: 10px;
        margin-left: 6px;
      }

      /* Comment cards */
      .tnow-admin .comment-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 10px;
        transition: border-color 0.2s;
      }

      .tnow-admin .comment-card:hover { border-color: #EA932066; }

      .tnow-admin .comment-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
        gap: 12px;
      }

      .tnow-admin .comment-meta { flex: 1; }

      .tnow-admin .comment-author {
        font-family: 'Roboto Slab', serif;
        font-weight: 600;
        font-size: 0.95rem;
      }

      .tnow-admin .comment-email {
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      .tnow-admin .comment-slug {
        font-size: 0.75rem;
        color: var(--accent);
        margin-top: 2px;
      }

      .tnow-admin .comment-time {
        font-size: 0.75rem;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .tnow-admin .comment-body {
        font-size: 0.9rem;
        line-height: 1.6;
        color: #fafafadd;
        margin: 12px 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .tnow-admin .comment-actions {
        display: flex;
        gap: 8px;
      }

      .tnow-admin .btn-approve, .tnow-admin .btn-reject, .tnow-admin .btn-spam {
        padding: 6px 14px;
        border: 1px solid;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        background: transparent;
        transition: all 0.2s;
      }

      .tnow-admin .btn-approve { color: var(--green); border-color: var(--green); }
      .tnow-admin .btn-approve:hover { background: var(--green); color: var(--bg); }
      .tnow-admin .btn-reject { color: var(--red); border-color: var(--red); }
      .tnow-admin .btn-reject:hover { background: var(--red); color: var(--bg); }
      .tnow-admin .btn-spam { color: var(--text-muted); border-color: var(--border); }
      .tnow-admin .btn-spam:hover { background: var(--border); color: var(--text); }

      .tnow-admin .empty-state {
        text-align: center;
        padding: 48px;
        color: var(--text-muted);
      }

      .tnow-admin .status-badge {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-left: 8px;
      }

      .tnow-admin .status-badge.approved { color: var(--green); background: #0d3320; }
      .tnow-admin .status-badge.rejected { color: var(--red); background: #3b1111; }
      .tnow-admin .status-badge.spam { color: var(--text-muted); background: #2a2a2a; }
      .tnow-admin .status-badge.pending { color: var(--accent); background: #EA932033; }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --- WIDGET HTML ---
  function createWidget() {
    const container = document.createElement("div");
    container.className = "tnow-admin";
    container.innerHTML = `
      <div class="tnow-admin-header">
        <h1><span>&#9679;</span> Comment Moderation</h1>
      </div>
      <div class="tabs" id="tnow-admin-tabs"></div>
      <div id="tnow-admin-list">
        <div class="empty-state">Loading comments...</div>
      </div>
    `;
    return container;
  }

  // --- API ---
  async function loadComments() {
    try {
      const res = await fetch(CONFIG.url + "?admin=true", {
        headers: {
          "Authorization": "Bearer " + CONFIG.key,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || "Failed to load comments (" + res.status + ")");
      }

      const data = await res.json();
      allComments = data.comments || [];
      renderTabs();
      renderTab();
    } catch (err) {
      document.getElementById("tnow-admin-list").innerHTML =
        '<div class="empty-state">Error: ' + esc(err.message) + "</div>";
    }
  }

  function renderTabs() {
    const tabsEl = document.getElementById("tnow-admin-tabs");
    const statuses = ["pending", "approved", "rejected", "spam"];
    const pendingCount = allComments.filter(function (c) { return c.status === "pending"; }).length;

    tabsEl.innerHTML = statuses.map(function (s) {
      var badge = s === "pending" ? ' <span class="badge" id="tnow-badge-pending">' + pendingCount + "</span>" : "";
      var active = s === currentTab ? " active" : "";
      return '<div class="tab' + active + '" data-status="' + s + '">' +
        s.charAt(0).toUpperCase() + s.slice(1) + badge + "</div>";
    }).join("");

    tabsEl.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        currentTab = tab.dataset.status;
        tabsEl.querySelectorAll(".tab").forEach(function (t) {
          t.classList.toggle("active", t.dataset.status === currentTab);
        });
        renderTab();
      });
    });
  }

  function renderTab() {
    var list = document.getElementById("tnow-admin-list");
    var filtered = allComments.filter(function (c) { return c.status === currentTab; });

    // Update pending badge
    var pendingCount = allComments.filter(function (c) { return c.status === "pending"; }).length;
    var badgeEl = document.getElementById("tnow-badge-pending");
    if (badgeEl) badgeEl.textContent = pendingCount;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state">No ' + currentTab + " comments.</div>";
      return;
    }

    list.innerHTML = filtered.map(function (c) {
      var approveBtn = c.status !== "approved" ? '<button class="btn-approve" data-id="' + c.id + '" data-action="approve">&#10003; Approve</button>' : "";
      var rejectBtn = c.status !== "rejected" ? '<button class="btn-reject" data-id="' + c.id + '" data-action="reject">&#10005; Reject</button>' : "";
      var spamBtn = c.status !== "spam" ? '<button class="btn-spam" data-id="' + c.id + '" data-action="spam">&#9873; Spam</button>' : "";

      return '<div class="comment-card">' +
        '<div class="comment-top">' +
          '<div class="comment-meta">' +
            '<span class="comment-author">' + esc(c.author_name) + "</span>" +
            '<span class="status-badge ' + c.status + '">' + c.status + "</span>" +
            '<div class="comment-email">' + esc(c.author_email) + "</div>" +
            '<div class="comment-slug">' + esc(c.location_id) + " &middot; " + esc(c.blog_slug) + "</div>" +
          "</div>" +
          '<span class="comment-time">' + new Date(c.created_at).toLocaleString() + "</span>" +
        "</div>" +
        '<div class="comment-body">' + esc(c.comment_text) + "</div>" +
        '<div class="comment-actions">' + approveBtn + rejectBtn + spamBtn + "</div>" +
      "</div>";
    }).join("");

    // Bind action buttons
    list.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        moderate(btn.dataset.id, btn.dataset.action);
      });
    });
  }

  async function moderate(commentId, action) {
    try {
      var res = await fetch(CONFIG.url, {
        method: "PATCH",
        headers: {
          "Authorization": "Bearer " + CONFIG.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment_id: commentId,
          action: action,
          reviewed_by: "admin",
        }),
      });

      if (!res.ok) throw new Error("Action failed");

      var comment = allComments.find(function (c) { return c.id === commentId; });
      if (comment) {
        var statusMap = { approve: "approved", reject: "rejected", spam: "spam" };
        comment.status = statusMap[action];
      }
      renderTabs();
      renderTab();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // --- INIT ---
  function init() {
    injectStyles();
    var widget = createWidget();
    var target =
      document.querySelector("[data-admin-target]") ||
      document.querySelector("main") ||
      document.body;
    target.appendChild(widget);
    loadComments();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
