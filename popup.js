/**
 * SnapLink — Popup Script
 *
 * Queries the active tab's content script for ticket info,
 * displays it in the UI, and handles clipboard copy with
 * rich‑text (HTML) + plain‑text fallback.
 */

(function () {
  "use strict";

  // ─── DOM references ──────────────────────────────────────────────────
  var platformBadge   = document.getElementById("platformBadge");
  var titleInput      = document.getElementById("titleInput");
  var urlDisplay      = document.getElementById("urlDisplay");
  var warningBanner   = document.getElementById("warningBanner");
  var copyBtn         = document.getElementById("copyBtn");
  var sourceNote      = document.getElementById("sourceNote");
  var includeTicketId = document.getElementById("includeTicketId");
  var asMarkdown      = document.getElementById("asMarkdown");

  // Remember the Markdown choice (storage may be unavailable → ignore)
  try { asMarkdown.checked = localStorage.getItem("snaplink.md") === "1"; } catch (_) {}
  asMarkdown.addEventListener("change", function () {
    try { localStorage.setItem("snaplink.md", asMarkdown.checked ? "1" : "0"); } catch (_) {}
  });

  // ─── State ──────────────────────────────────────────────────────────
  var ticketInfo = null;   // { url, title, platform, source, hostname }
  var copyTimeout = null;  // timer ID for "Copied!" reset
  var warningTimeout = null; // timer for auto‑hiding warning

  // ─── Platform badge colour mapping ───────────────────────────────────
  function setPlatformBadge(platform) {
    var key = (platform || "Generic").toLowerCase();
    // Remove existing platform classes
    platformBadge.className = "badge";
    if (key === "generic") {
      platformBadge.classList.add("badge-generic");
    } else {
      platformBadge.classList.add("badge-" + key);
    }
    platformBadge.textContent = platform || "Generic";
  }

  // ─── Render UI after receiving ticket data ───────────────────────────
  function render(info) {
    ticketInfo = info;

    // Platform badge
    setPlatformBadge(info.platform);

    // Title
    titleInput.value = info.title || "";
    titleInput.disabled = false;

    // URL
    urlDisplay.textContent = info.url || "";
    urlDisplay.title = info.url || "";

    // Warning banner for fallback sources
    if (info.source === "document.title" && !info.title) {
      warningBanner.classList.remove("hidden");
      titleInput.placeholder = "Enter the title manually…";
    } else if (info.source === "document.title" && info.title) {
      warningBanner.classList.remove("hidden");
    } else {
      warningBanner.classList.add("hidden");
    }

    // Source note
    var sourceLabels = {
      "selector":       "Detected from page element",
      "og:title":       "Detected from page og:title",
      "h1":             "Detected from page <h1>",
      "document.title": "Falling back to page title"
    };
    sourceNote.textContent = sourceLabels[info.source] || "";

    // Enable copy button
    copyBtn.disabled = false;
  }

  // ─── Error state ─────────────────────────────────────────────────────
  function showError(reason) {
    setPlatformBadge("generic");
    titleInput.value = "";
    titleInput.placeholder = "Could not detect title. Enter manually.";
    titleInput.disabled = false;
    urlDisplay.textContent = "Unable to read page data.";
    urlDisplay.style.color = "#f85149";
    warningBanner.classList.remove("hidden");
    warningBanner.innerHTML =
      "&#9888; Error: " + (reason || "Could not read page title.") +
      " <strong>Enter title above, then copy.</strong>";
    sourceNote.textContent = "Connection to page failed";
    copyBtn.disabled = false; // allow manual override
  }

  // ─── Show a temporary warning message ────────────────────────────────
  function showWarning(message) {
    warningBanner.innerHTML =
      "&#9888; " + message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    warningBanner.classList.remove("hidden");

    // Auto‑hide after 4 seconds
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(function () {
      warningBanner.classList.add("hidden");
    }, 4000);
  }

  // ─── Fetch ticket info from content script ───────────────────────────
  function fetchTicketInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab) {
        showError("No active tab found.");
        return;
      }

      // Don't run on chrome:// or edge:// pages
      if (/^(chrome|edge|about):\/\//i.test(tab.url)) {
        showError("SnapLink cannot run on browser system pages.");
        return;
      }

      // Try sending a message to the already‑injected content script
      var responded = false;

      chrome.tabs.sendMessage(
        tab.id,
        { action: "getTicketInfo" },
        function (response) {
          responded = true;
          if (chrome.runtime.lastError) {
            // Content script not ready — inject it dynamically, then retry
            injectAndRetry(tab);
            return;
          }
          if (response && response.url) {
            render(response);
          } else {
            showError("Empty response from content script.");
          }
        }
      );

      // Safety timeout: if sendMessage never calls back, fall back
      setTimeout(function () {
        if (!responded) {
          injectAndRetry(tab);
        }
      }, 500);
    });
  }

  // ─── Dynamic injection fallback for unsupported domains ──────────────
  // Injects the same content.js (single extractor: og:title, h1, URL cleaning)
  function injectAndRetry(tab) {
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ["content.js"] },
      function () {
        if (chrome.runtime.lastError) {
          showError("Failed to read page. Try refreshing the page.");
          return;
        }
        chrome.tabs.sendMessage(tab.id, { action: "getTicketInfo" }, function (response) {
          if (chrome.runtime.lastError || !response || !response.url) {
            showError("Could not extract page data.");
            return;
          }
          render(response);
        });
      }
    );
  }

  // ─── Strip ticket ID prefix from title (e.g. "[BSKWEB-4729] ") ──────
  function stripTicketId(title) {
    return title.replace(/^\[?[A-Z]+-\d+\]?\s*[:·-]?\s*/, "").trim();
  }

  // ─── Clipboard copy: rich HTML + plain text ──────────────────────────
  // This writes both formats simultaneously so that:
  //   Word / Google Docs / Notion → clickable link with title as display text
  //   Excel                        → formatted hyperlink
  //   Notepad / terminal / .txt    → Title - URL
  async function copyAsLink(url, title) {
    // Escape values for HTML safety
    var safeUrl = url.replace(/"/g, "&quot;");
    var safeTitle = title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    var html = '<a href="' + safeUrl + '">' + safeTitle + "</a>";
    var plain = title + " - " + url;

    // Markdown: plain text only, so every surface pastes the raw [title](url)
    if (asMarkdown.checked) {
      plain = "[" + title.replace(/([\[\]\\])/g, "\\$1") + "](" +
              url.replace(/\(/g, "%28").replace(/\)/g, "%29") + ")";
      html = null;
    }

    // Force focus so Chrome allows clipboard write from the popup window
    window.focus();

    try {
      if (html && typeof ClipboardItem !== "undefined") {
        // Rich copy: HTML + plain text simultaneously
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" })
          })
        ]);
      } else {
        // Fallback: plain text only (older browsers that lack ClipboardItem)
        await navigator.clipboard.writeText(plain);
        if (html) showWarning("Rich format not supported in this browser. Plain text copied.");
      }
      showCopiedFeedback();
    } catch (err) {
      // Last resort: execCommand fallback (plain text only)
      try {
        var textarea = document.createElement("textarea");
        textarea.value = plain;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showWarning("Clipboard API failed. Plain text copied as fallback.");
        showCopiedFeedback();
      } catch (_) {
        // Absolute last resort: select the title so user can Ctrl+C
        titleInput.select();
        copyBtn.textContent = "Press Ctrl+C to copy";
        copyBtn.className = "btn";
        setTimeout(function () {
          restoreButton();
        }, 2000);
      }
    }
  }

  // ─── Visual feedback: green "✓ Copied!" for 2 seconds ────────────────
  function showCopiedFeedback() {
    if (copyTimeout) clearTimeout(copyTimeout);
    copyBtn.textContent = "\u2713 Copied!";
    copyBtn.classList.add("success");
    copyTimeout = setTimeout(function () {
      restoreButton();
    }, 2000);
  }

  function restoreButton() {
    copyBtn.textContent = "Copy as Link";
    copyBtn.classList.remove("success");
  }

  // ─── Event listeners ─────────────────────────────────────────────────

  // Copy button click
  copyBtn.addEventListener("click", function () {
    if (!ticketInfo) return;
    var title = titleInput.value.trim() || ticketInfo.title || document.title;
    var url = ticketInfo.url;

    // Strip ticket ID prefix if the user unchecked the toggle
    if (includeTicketId && !includeTicketId.checked) {
      title = stripTicketId(title);
    }

    copyAsLink(url, title);
  });

  // Enter key on title input triggers copy
  titleInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      copyBtn.click();
    }
  });

  // Click URL box to copy plain URL
  urlDisplay.addEventListener("click", function () {
    if (!ticketInfo || !ticketInfo.url) return;
    navigator.clipboard.writeText(ticketInfo.url).catch(function () {});
    // Brief pulse animation
    urlDisplay.style.borderColor = "#1f6feb";
    setTimeout(function () {
      urlDisplay.style.borderColor = "#30363d";
    }, 400);
  });

  // ─── Shortcut hint (reads the user's actual binding) ─────────────────
  chrome.commands.getAll(function (cmds) {
    var cmd = (cmds || []).filter(function (c) { return c.name === "copy-ticket-link"; })[0];
    if (!cmd) return;
    if (cmd.shortcut) {
      document.getElementById("shortcutKey").textContent =
        cmd.shortcut.replace(/May[uú]s/i, "Shift");
    } else {
      document.getElementById("shortcutHint").textContent =
        "Tip: set a keyboard shortcut in chrome://extensions/shortcuts";
    }
  });

  // ─── Initialise ──────────────────────────────────────────────────────
  fetchTicketInfo();
})();
