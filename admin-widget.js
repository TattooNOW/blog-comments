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

  // Check URL for location_id filter
  const urlParams = new URLSearchParams(window.location.search);
  const locationFilter = urlParams.get("locationId") || urlParams.get("location_id") || "";

  let allComments = [];
  let allWebhooks = [];
  let currentSection = "comments"; // "comments" or "webhooks"
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
        background: var(--bg);
        color: var(--text);
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 16px;
        min-height: 100vh;
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

      /* Top-level section tabs */
      .tnow-admin .section-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
        border-bottom: 2px solid var(--border);
      }

      .tnow-admin .section-tab {
        padding: 10px 20px;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: 'Roboto Slab', serif;
        transition: all 0.2s;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
      }

      .tnow-admin .section-tab:hover { color: var(--text); }

      .tnow-admin .section-tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }

      /* Sub-tabs (comment statuses) */
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
        color: var(--text);
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

      /* Webhook styles */
      .tnow-admin .webhook-row {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        transition: border-color 0.2s;
      }

      .tnow-admin .webhook-row:hover { border-color: #EA932066; }

      .tnow-admin .webhook-info { flex: 1; min-width: 0; }

      .tnow-admin .webhook-location {
        font-family: 'Roboto Slab', serif;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .tnow-admin .webhook-url {
        font-size: 0.8rem;
        color: var(--text-muted);
        word-break: break-all;
        margin-top: 2px;
      }

      .tnow-admin .btn-delete {
        padding: 6px 14px;
        border: 1px solid var(--red);
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        background: transparent;
        color: var(--red);
        transition: all 0.2s;
        white-space: nowrap;
      }

      .tnow-admin .btn-delete:hover { background: var(--red); color: var(--bg); }

      .tnow-admin .webhook-form {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-top: 16px;
      }

      .tnow-admin .webhook-form h3 {
        font-family: 'Roboto Slab', serif;
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 14px;
      }

      .tnow-admin .webhook-form .form-row {
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }

      .tnow-admin .webhook-form .form-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .tnow-admin .webhook-form label {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-muted);
      }

      .tnow-admin .webhook-form input {
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.85rem;
        font-family: 'Roboto', sans-serif;
        background: var(--bg);
        color: var(--text);
      }

      .tnow-admin .webhook-form input:focus {
        outline: none;
        border-color: var(--accent);
      }

      .tnow-admin .btn-save {
        padding: 8px 18px;
        border: 1px solid var(--accent);
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        background: var(--accent);
        color: #fff;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .tnow-admin .btn-save:hover { opacity: 0.9; }

      .tnow-admin .webhook-msg {
        font-size: 0.8rem;
        margin-top: 10px;
        padding: 8px 12px;
        border-radius: 6px;
      }

      .tnow-admin .webhook-msg.success { color: var(--green); background: #0d3320; }
      .tnow-admin .webhook-msg.error { color: var(--red); background: #3b1111; }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    document.body.style.background = "#0a0a0a";
  }

  // --- WIDGET HTML ---
  function createWidget() {
    const container = document.createElement("div");
    container.className = "tnow-admin";
    var locationLabel = locationFilter ? " &middot; " + esc(locationFilter) : "";
    container.innerHTML = `
      <div class="tnow-admin-header">
        <h1><span>&#9679;</span> Comment Moderation${locationLabel}</h1>
      </div>
      <div class="section-tabs" id="tnow-section-tabs">
        <div class="section-tab active" data-section="comments">Comments</div>
        <div class="section-tab" data-section="webhooks">Webhooks</div>
      </div>
      <div id="tnow-comments-section">
        <div class="tabs" id="tnow-admin-tabs"></div>
        <div id="tnow-admin-list">
          <div class="empty-state">Loading comments...</div>
        </div>
      </div>
      <div id="tnow-webhooks-section" style="display:none;">
        <div id="tnow-webhook-list">
          <div class="empty-state">Loading webhooks...</div>
        </div>
        <div class="webhook-form">
          <h3>${locationFilter ? "Webhook for " + esc(locationFilter) : "Add / Update Webhook"}</h3>
          <div class="form-row">
            <div class="form-group" ${locationFilter ? 'style="display:none"' : ""}>
              <label>Location ID</label>
              <input type="text" id="tnow-wh-location" placeholder="e.g. dWlb0GcHLhNYv9zAChVt" value="${locationFilter ? esc(locationFilter) : ""}" ${locationFilter ? "readonly" : ""} />
            </div>
            <div class="form-group">
              <label>Webhook URL</label>
              <input type="text" id="tnow-wh-url" placeholder="https://..." />
            </div>
            <button class="btn-save" id="tnow-wh-save">Save</button>
          </div>
          <div id="tnow-wh-msg"></div>
        </div>
      </div>
    `;
    return container;
  }

  // --- SECTION SWITCHING ---
  function bindSectionTabs() {
    var tabs = document.getElementById("tnow-section-tabs");
    tabs.querySelectorAll(".section-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        currentSection = tab.dataset.section;
        tabs.querySelectorAll(".section-tab").forEach(function (t) {
          t.classList.toggle("active", t.dataset.section === currentSection);
        });
        document.getElementById("tnow-comments-section").style.display =
          currentSection === "comments" ? "" : "none";
        document.getElementById("tnow-webhooks-section").style.display =
          currentSection === "webhooks" ? "" : "none";

        if (currentSection === "webhooks" && allWebhooks.length === 0) {
          loadWebhooks();
        }
      });
    });
  }

  // --- COMMENTS API ---
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
      if (locationFilter) {
        allComments = allComments.filter(function (c) { return c.location_id === locationFilter; });
      }
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

  // --- WEBHOOKS API ---
  async function loadWebhooks() {
    try {
      var res = await fetch(CONFIG.url + "?admin=true&webhooks=true", {
        headers: {
          "Authorization": "Bearer " + CONFIG.key,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || "Failed to load webhooks (" + res.status + ")");
      }

      var data = await res.json();
      allWebhooks = data.webhooks || [];
      if (locationFilter) {
        allWebhooks = allWebhooks.filter(function (wh) { return wh.location_id === locationFilter; });
      }
      renderWebhooks();
    } catch (err) {
      document.getElementById("tnow-webhook-list").innerHTML =
        '<div class="empty-state">Error: ' + esc(err.message) + "</div>";
    }
  }

  function renderWebhooks() {
    var list = document.getElementById("tnow-webhook-list");

    if (allWebhooks.length === 0) {
      list.innerHTML = '<div class="empty-state">No webhooks configured.</div>';
      return;
    }

    list.innerHTML = allWebhooks.map(function (wh) {
      return '<div class="webhook-row">' +
        '<div class="webhook-info">' +
          '<div class="webhook-location">' + esc(wh.location_id) + "</div>" +
          '<div class="webhook-url">' + esc(wh.webhook_url) + "</div>" +
        "</div>" +
        '<button class="btn-delete" data-location="' + esc(wh.location_id) + '">&#10005; Delete</button>' +
      "</div>";
    }).join("");

    list.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (confirm("Delete webhook for " + btn.dataset.location + "?")) {
          deleteWebhook(btn.dataset.location);
        }
      });
    });
  }

  async function saveWebhook() {
    var locInput = document.getElementById("tnow-wh-location");
    var urlInput = document.getElementById("tnow-wh-url");
    var msgEl = document.getElementById("tnow-wh-msg");
    var locationId = locInput.value.trim();
    var webhookUrl = urlInput.value.trim();

    if (!locationId || !webhookUrl) {
      msgEl.className = "webhook-msg error";
      msgEl.textContent = "Both fields are required.";
      return;
    }

    try {
      var res = await fetch(CONFIG.url, {
        method: "PATCH",
        headers: {
          "Authorization": "Bearer " + CONFIG.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "set_webhook",
          location_id: locationId,
          webhook_url: webhookUrl,
        }),
      });

      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.error || "Failed to save webhook");
      }

      msgEl.className = "webhook-msg success";
      msgEl.textContent = "Webhook saved for " + locationId;
      locInput.value = "";
      urlInput.value = "";

      // Reload webhook list
      loadWebhooks();

      setTimeout(function () { msgEl.textContent = ""; msgEl.className = ""; }, 3000);
    } catch (err) {
      msgEl.className = "webhook-msg error";
      msgEl.textContent = "Error: " + err.message;
    }
  }

  async function deleteWebhook(locationId) {
    try {
      var res = await fetch(CONFIG.url, {
        method: "PATCH",
        headers: {
          "Authorization": "Bearer " + CONFIG.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_webhook",
          location_id: locationId,
        }),
      });

      if (!res.ok) throw new Error("Delete failed");

      allWebhooks = allWebhooks.filter(function (wh) { return wh.location_id !== locationId; });
      renderWebhooks();
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
    bindSectionTabs();
    document.getElementById("tnow-wh-save").addEventListener("click", saveWebhook);
    loadComments();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
