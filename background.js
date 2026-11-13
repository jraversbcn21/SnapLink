/**
 * SnapLink — Background Service Worker
 *
 * Handles the Ctrl+Shift+L keyboard shortcut command.
 * Receives the command from Chrome, injects content.js into the active tab
 * (allowed by activeTab; a no-op if it is already there) and dispatches a
 * "copyTicketLink" message so it can extract the title, write to the
 * clipboard, and show a toast.
 *
 * The background worker itself does NOT access the clipboard or the DOM —
 * all clipboard and DOM operations happen in the content script context.
 */

"use strict";

// ─── Keyboard shortcut handler ────────────────────────────────────────
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "copy-ticket-link") return;

  // Get the currently active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) return;

    // Skip browser system pages (chrome://, edge://, about://)
    if (/^(chrome|edge|about):\/\//i.test(tab.url || "")) return;

    // executeScript calls back once content.js has run, so its message
    // listener is already registered — no delay needed before messaging.
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ["content.js"] },
      function () {
        // Injection fails on protected pages (e.g. the Web Store): swallow it,
        // the user can still fall back to the popup UI.
        if (chrome.runtime.lastError) return;
        chrome.tabs.sendMessage(tab.id, { action: "copyTicketLink" }, function () {
          void chrome.runtime.lastError; // silence "no receiver" warnings
        });
      }
    );
  });
});
