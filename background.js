/**
 * SnapLink — Background Service Worker
 *
 * Handles the Alt+Shift+C keyboard shortcut command.
 * Receives the command from Chrome, finds the active tab,
 * and dispatches a "copyTicketLink" message to the content script
 * so it can extract the title, write to the clipboard, and show a toast.
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

    // Send message to content script; handle missing listener gracefully
    chrome.tabs.sendMessage(
      tab.id,
      { action: "copyTicketLink" },
      function (response) {
        // If content script was not yet injected (e.g. the tab was opened
        // before the extension was installed/reloaded), inject it and retry
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              files: ["content.js"]
            },
            function () {
              if (chrome.runtime.lastError) return;
              // Retry sending the message after a short delay for the
              // content script to initialise
              setTimeout(function () {
                chrome.tabs.sendMessage(tab.id, { action: "copyTicketLink" });
              }, 150);
            }
          );
        }
        // On success or injection failure, we intentionally swallow errors.
        // The user will see the toast on success or nothing on failure,
        // and they can always fall back to the popup UI.
      }
    );
  });
});
