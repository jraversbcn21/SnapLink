/**
 * SnapLink — Content Script
 *
 * Injected into supported ticket‑platform pages.
 * Extracts the ticket / issue / task title from the DOM using
 * platform‑specific CSS selectors, with a generic fallback.
 *
 * Listens for two message actions from the popup and background worker:
 *   { action: "getTicketInfo" }   → returns { url, title, platform } for the popup UI
 *   { action: "copyTicketLink" }  → copies to clipboard and shows a toast (keyboard shortcut)
 */

(function () {
  "use strict";

  // ─── Platform definitions ────────────────────────────────────────────
  // Each entry maps a platform key to an object with:
  //   - patterns: array of globs to match window.location.hostname
  //   - match:    optional function(href, hostname) → boolean,
  //               for platforms that can't be identified by hostname alone
  //               (e.g. self‑hosted Jira instances)
  //   - selectors: array of CSS selectors tried in order (first with text wins)
  //   - extract:   optional function(node) → string, for special elements

  var PLATFORMS = [
    {
      key: "Jira",
      patterns: ["*.atlassian.net", "*.atlassian.com"],
      match: function (href, hostname) {
        // Match official Atlassian domains OR self‑hosted Jira instances
        // by detecting /browse/XXX-1234 URL patterns
        return /atlassian\.(net|com)/.test(hostname) ||
               /\/jira\/browse\//.test(href) ||
               /\/browse\/[A-Z]+-\d+/.test(href);
      },
      selectors: [
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        "#summary-val",
        "h1"
      ],
      extract: null
    },
    {
      key: "Linear",
      patterns: ["*.linear.app"],
      selectors: [
        "[class*='titleText']",
        "[class*='IssueTitle']",
        "h1"
      ],
      extract: null
    },
    {
      key: "GitHub",
      patterns: ["github.com"],
      selectors: [
        ".js-issue-title",
        "bdi.js-issue-title",
        "h1.gh-header-title"
      ],
      extract: null
    },
    {
      key: "GitLab",
      patterns: ["gitlab.com", "*.gitlab.com"],
      selectors: [
        "h1.title",
        ".issue-title"
      ],
      extract: null
    },
    {
      key: "Trello",
      patterns: ["trello.com"],
      selectors: [
        ".card-detail-title-input",
        "h2.card-title"
      ],
      // Trello uses an <input> or <textarea> — read .value instead of .textContent
      extract: function (node) {
        if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
          return node.value.trim();
        }
        return (node.textContent || "").trim();
      }
    },
    {
      key: "Notion",
      patterns: ["notion.so"],
      selectors: [
        '[placeholder="Untitled"]',
        "[class*='title'] [contenteditable]"
      ],
      extract: null
    },
    {
      key: "ClickUp",
      patterns: ["*.clickup.com"],
      selectors: [
        ".task-name__title",
        "[class*='task-title']"
      ],
      extract: null
    },
    {
      key: "Asana",
      patterns: ["*.asana.com"],
      selectors: [
        "[class*='TaskPane-taskName']",
        "textarea[aria-label*='Task Name']"
      ],
      // Asana uses a <textarea> — read .value
      extract: function (node) {
        if (node.tagName === "TEXTAREA" || node.tagName === "INPUT") {
          return node.value.trim();
        }
        return (node.textContent || "").trim();
      }
    },
    {
      key: "Zendesk",
      patterns: ["*.zendesk.com"],
      selectors: [
        '[data-test-id="ticket-title"]',
        ".ticket-subject"
      ],
      extract: null
    },
    {
      key: "Shortcut",
      patterns: ["*.shortcut.com"],
      selectors: [
        "[class*='story-name']"
      ],
      extract: null
    }
  ];

  // ─── Helper: match hostname against glob patterns ────────────────────
  function matchesHostname(patterns, hostname) {
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      // Convert glob to regex: escape dots, replace * with .*
      var regex = new RegExp(
        "^" + p.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
        "i"
      );
      if (regex.test(hostname)) {
        return true;
      }
    }
    return false;
  }

  // ─── Helper: clean extra platform suffixes from title text ───────────
  // Example: "Fix login bug - Jira" → "Fix login bug"
  function cleanAppSuffix(text) {
    if (!text) return "";

    // Common app names that appear as suffixes in document.title
    var appSuffixes = [
      "Jira", "JIRA", "Linear", "GitHub", "GitLab", "Trello",
      "Notion", "ClickUp", "Asana", "Zendesk", "Shortcut",
      "Google Docs", "Microsoft Teams", "Slack", "Confluence"
    ];

    // Try each separator; if the right‑hand side is a known app name, strip it
    var separators = [" - ", " | ", " \u2013 ", " \u00b7 "]; // – and ·
    for (var s = 0; s < separators.length; s++) {
      var sep = separators[s];
      var idx = text.indexOf(sep);
      if (idx > 0) {
        var suffix = text.slice(idx + sep.length).trim();
        for (var a = 0; a < appSuffixes.length; a++) {
          if (suffix.toLowerCase() === appSuffixes[a].toLowerCase()) {
            return text.slice(0, idx).trim();
          }
        }
        // If only one separator exists and the right side is short, strip it
        // (heuristic: if suffix is <= 20 chars it's likely an app name)
        if (suffix.length <= 20 && text.indexOf(sep, idx + 1) === -1) {
          return text.slice(0, idx).trim();
        }
      }
    }

    return text.trim();
  }

  // ─── Core: extract title from the DOM ────────────────────────────────
  function extractTitle() {
    var hostname = window.location.hostname;
    var href = window.location.href;
    var title = "";
    var platform = "Generic";
    var source = "fallback"; // "selector" | "h1" | "document.title"

    // Walk platform list in order; first match wins
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = PLATFORMS[i];
      var isMatch = false;

      // Use custom match function if provided, otherwise fall back to hostname patterns
      if (typeof p.match === "function") {
        isMatch = p.match(href, hostname);
      } else if (p.patterns) {
        isMatch = matchesHostname(p.patterns, hostname);
      }

      if (isMatch) {
        platform = p.key;

        // Try each selector until one yields text
        for (var s = 0; s < p.selectors.length; s++) {
          try {
            var nodes = document.querySelectorAll(p.selectors[s]);
            for (var n = 0; n < nodes.length; n++) {
              var raw = p.extract
                ? p.extract(nodes[n])
                : (nodes[n].textContent || "").trim();
              if (raw) {
                title = raw;
                source = "selector";
                break;
              }
            }
          } catch (_) {
            // Invalid selector or missing element — skip
          }
          if (title) break;
        }

        if (title) break;
      }
    }

    // Generic fallback: first <h1> on the page
    if (!title) {
      platform = platform || "Generic";
      try {
        var h1 = document.querySelector("h1");
        if (h1) {
          var h1Text = (h1.textContent || "").trim();
          if (h1Text) {
            title = h1Text;
            source = "h1";
          }
        }
      } catch (_) {}
    }

    // Final fallback: document.title, cleaned
    if (!title) {
      title = cleanAppSuffix(document.title);
      source = "document.title";
    }

    return {
      title: title,
      platform: platform,
      source: source,
      url: window.location.href,
      hostname: hostname
    };
  }

  // ─── Toast notification ──────────────────────────────────────────────
  // In‑page toast that fades in/out in the bottom‑right corner.
  // Injects its CSS only once (on first use).

  var toastStyleInjected = false;

  function injectToastStyles() {
    if (toastStyleInjected) return;
    var style = document.createElement("style");
    style.id = "snaplink-toast-styles";
    style.textContent = [
      ".snaplink-toast {",
      "  position: fixed;",
      "  bottom: 24px;",
      "  right: 24px;",
      "  z-index: 999999;",
      "  max-width: 320px;",
      "  padding: 10px 14px;",
      "  background: #1a1d27;",
      "  border: 1px solid #2a2d3a;",
      "  border-radius: 8px;",
      "  font-family: 'SF Mono','Fira Code','Cascadia Code','Consolas','Monaco',monospace;",
      "  font-size: 12px;",
      "  line-height: 1.4;",
      "  color: #e2e4ed;",
      "  box-shadow: 0 4px 16px rgba(0,0,0,0.45);",
      "  opacity: 0;",
      "  transition: opacity 200ms ease;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "  white-space: nowrap;",
      "  pointer-events: none;",
      "}",
      ".snaplink-toast.snaplink-visible {",
      "  opacity: 1;",
      "}",
      ".snaplink-toast.snaplink-success {",
      "  border-color: rgba(35,134,54,0.35);",
      "}",
      ".snaplink-toast.snaplink-warning {",
      "  border-color: rgba(227,98,9,0.35);",
      "  color: #f0883e;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
    toastStyleInjected = true;
  }

  /**
   * showToast — display a brief confirmation / warning toast on the page.
   *
   * @param {string|null} title  The ticket title (null/empty → warning mode).
   * @param {string}      type   "success" (green border) or "warning" (orange).
   */
  function showToast(title, type) {
    injectToastStyles();

    // Remove any existing toast so they don't stack
    var existing = document.querySelector(".snaplink-toast");
    if (existing) {
      existing.classList.remove("snaplink-visible");
      if (existing.parentNode) existing.parentNode.removeChild(existing);
    }

    // Build toast element
    var toast = document.createElement("div");
    toast.className = "snaplink-toast snaplink-" + (type === "warning" ? "warning" : "success");

    if (type === "warning" || !title) {
      toast.textContent = "\u26a0 Title not detected \u2014 open SnapLink to edit";
    } else {
      // Truncate long titles so the toast stays compact
      var displayTitle = title;
      if (displayTitle.length > 60) {
        displayTitle = displayTitle.slice(0, 57) + "\u2026";
      }
      toast.textContent = "\u2713 Copied: " + displayTitle;
    }

    document.body.appendChild(toast);

    // Fade in (rAF ensures the initial opacity:0 is painted before the transition)
    requestAnimationFrame(function () {
      toast.classList.add("snaplink-visible");
    });

    // Fade out after 2 s, then remove from DOM after the transition
    setTimeout(function () {
      toast.classList.remove("snaplink-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300); // matches CSS transition duration
    }, 2000);
  }

  // ─── Message listeners ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    // ── Popup flow: return ticket info for the popup UI ────────────────
    if (message.action === "getTicketInfo") {
      var info = extractTitle();
      sendResponse({
        url: info.url,
        title: info.title,
        platform: info.platform,
        source: info.source,
        hostname: info.hostname
      });
      return true;
    }

    // ── Keyboard shortcut flow: copy silently + show toast ─────────────
    if (message.action === "copyTicketLink") {
      var data = extractTitle();

      // No title found → show warning toast and return
      if (!data.title) {
        showToast(null, "warning");
        sendResponse({ success: false, reason: "no-title" });
        return true;
      }

      // Escape values for HTML safety
      var safeUrl = data.url.replace(/"/g, "&quot;");
      var safeTitle = data.title
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      var html = '<a href="' + safeUrl + '">' + safeTitle + "</a>";
      var plain = data.title + " - " + data.url;

      // Write to clipboard with both formats
      if (typeof ClipboardItem !== "undefined") {
        navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" })
          })
        ]).then(function () {
          showToast(data.title, "success");
          sendResponse({ success: true });
        }).catch(function () {
          showToast(null, "warning");
          sendResponse({ success: false, reason: "clipboard" });
        });
      } else {
        // ClipboardItem not available — fall back to plain text
        navigator.clipboard.writeText(plain).then(function () {
          showToast(data.title, "success");
          sendResponse({ success: true });
        }).catch(function () {
          showToast(null, "warning");
          sendResponse({ success: false, reason: "clipboard" });
        });
      }

      // Keep channel open for the async clipboard operation
      return true;
    }
  });
})();
