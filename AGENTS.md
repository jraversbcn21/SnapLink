# AGENTS.md — SnapLink Persistent Memory

This document provides full context for the SnapLink Chrome extension so any AI agent can pick up work without re-explanation. Paste this at the start of every new conversation.

---

## 1. Project overview

- **Extension name:** SnapLink
- **Version:** 1.3.0
- **Purpose:** Copy ticket URLs from Jira, Linear, GitHub, and other platforms as formatted hyperlinks (HTML + plain text) to the clipboard. When pasted into Word, Excel, Google Docs, or Notion, they appear as clickable links with the ticket title as display text — never raw URLs.
- **Repository:** `https://github.com/jraversbcn21/SnapLink.git`
- **Branch:** `master`

---

## 2. File structure

```
SnapLink/
├── manifest.json       — MV3 manifest, permissions, content_scripts, commands, background worker
├── content.js          — DOM title extraction per platform, toast notification, clipboard write
├── popup.html          — 320px dark UI, editable title input, platform badge, copy button
├── popup.css           — Dark theme #0f1117, monospaced typography, platform badge colors
├── popup.js            — Clipboard API (ClipboardItem HTML+plain), fallback logic, ticket ID toggle
├── background.js       — Service worker, listens for Ctrl+Shift+S command, triggers copy flow
├── icons/
│   ├── icon.svg        — Base SVG icon (black bg, chain-link motif, "SL" letters)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── generate-icons.js   — Node.js helper to regenerate PNG icons from SVG using `sharp`
├── AGENTS.md           — This file (persistent memory document)
└── README.md           — Installation guide, usage, how to add new platforms
```

---

## 3. Supported platforms

| Platform   | Domain patterns | CSS selectors (tried in order) |
|------------|----------------|-------------------------------|
| **Jira** | `*.atlassian.net`, `*.atlassian.com`, `jira.inditex.com`, any URL matching `/browse/[A-Z]+-\d+` | `[data-testid="issue.views.issue-base.foundation.summary.heading"]`, `#summary-val`, `h1` |
| **Linear** | `*.linear.app` | `[class*="titleText"]`, `[class*="IssueTitle"]`, `h1` |
| **GitHub** | `github.com` | `.js-issue-title`, `bdi.js-issue-title`, `h1.gh-header-title` |
| **GitLab** | `gitlab.com`, `*.gitlab.com` | `h1.title`, `.issue-title` |
| **Trello** | `trello.com` | `.card-detail-title-input` (reads `.value`), `h2.card-title` |
| **Notion** | `notion.so` | `[placeholder="Untitled"]`, `[class*="title"] [contenteditable]` |
| **ClickUp** | `*.clickup.com` | `.task-name__title`, `[class*="task-title"]` |
| **Asana** | `*.asana.com` | `[class*="TaskPane-taskName"]`, `textarea[aria-label*="Task Name"]` (reads `.value`) |
| **Zendesk** | `*.zendesk.com` | `[data-test-id="ticket-title"]`, `.ticket-subject` |
| **Shortcut** | `*.shortcut.com` | `[class*="story-name"]` |
| **Generic fallback** | Any other URL | First `<h1>`, then `document.title` (cleaned of app suffixes) |

---

## 4. Key technical decisions

- **Clipboard API:** Uses `ClipboardItem` with `text/html` + `text/plain` simultaneously. Falls back to `execCommand('copy')` only as absolute last resort.
- **`window.focus()`** is called before every clipboard write from the popup to prevent Chrome from blocking the Clipboard API.
- **Title cleaning — ticket ID prefix:** Strips `[XXX-1234]` or `XXX-1234:` prefixes using regex `/^\[?[A-Z]+-\d+\]?\s*[:·-]?\s*/` when the "Include ticket ID" toggle is unchecked.
- **Title cleaning — app suffixes:** Removes known app name suffixes (e.g. ` - Jira`, ` | GitHub`) from `document.title` when no selector matches.
- **Keyboard shortcut:** `Ctrl+Shift+S` — registered via `commands` API in `manifest.json`, handled by `background.js` → `content.js` → clipboard write + toast.
- **Toast notification:** Injected into the page DOM via `content.js` (not OS-level `chrome.notifications`). Fixed position bottom-right, `z-index: 999999`, 200ms fade-in / 300ms fade-out, dark theme matching popup.
- **Popup width:** 320px (compact, tool-like).
- **Unsupported domains:** `scripting.executeScript` dynamically injects a lightweight extractor that tries `<h1>` then `document.title`.
- **Content script timeout:** If `chrome.tabs.sendMessage` doesn't respond within 500ms, falls back to dynamic injection.
- **`chrome://` pages:** Error state shown, copy button enabled for manual override.
- **Jira self-hosted matching:** Uses a `match(href, hostname)` function (not just hostname globs) to detect `/browse/XXX-1234` URL patterns on any domain.
- **Platform matching:** Each platform entry can have either `patterns` (hostname globs), a custom `match(href, hostname)` function (for Jira), or both.

---

## 5. Known behaviors and edge cases

- **Excel:** Paste works only when a cell is *selected* (not in edit mode — no blinking cursor inside the cell).
- **Word / Google Docs:** `Ctrl+V` works normally, pastes as a formatted hyperlink.
- **Orange warning banner:** "⚠ Title not auto-detected" appears when falling back to `document.title`. This is informational — the title shown is still usable and can be edited manually.
- **Jira CSS selectors** may become outdated when Atlassian updates their frontend. The `h1` fallback handles most cases.
- **Alt+Shift+C** was the original shortcut in the manifest, but was changed to **Ctrl+Shift+S** via `chrome://extensions/shortcuts`. Chrome allows users to override extension shortcuts at any time.

---

## 6. Assets for Chrome Web Store

| Asset | Size | Status |
|-------|------|--------|
| Promotional image (small) | 440×280px | SVG generated, PNG pending |
| Screenshot | 1280×800px | SVG generated, PNG pending |
| Marquee image | 1400×560px | SVG generated, PNG pending |

- **Developer account:** Pending $5 registration fee.
- **Store submission:** Not yet submitted.

---

## 7. Changelog

### v1.0.0 — Initial release
- Basic popup with title extraction for 10 platforms
- ClipboardItem with HTML + plain text
- Dark UI 320px popup
- Editable title input with fallback warning

### v1.1.0 — Self-hosted Jira support
- Added `jira.inditex.com` to `host_permissions` and `content_scripts.matches`
- Updated platform `match()` function to detect `/browse/XXX-000` on any domain
- Fixed ClipboardItem flow (`window.focus()` before write)
- Added "Include ticket ID in title" toggle checkbox in popup

### v1.2.0 — Keyboard shortcut
- Added `background.js` service worker
- Registered `Ctrl+Shift+P` via `commands` API
- Added `showToast()` in `content.js` (dark theme, fade in/out, bottom-right)
- Independent `copyTicketLink` message handler — popup flow untouched

### v1.3.0 — Keyboard shortcut fix
- Changed shortcut from `Ctrl+Shift+P` to `Ctrl+Shift+S`
- Reason: `Ctrl+Shift+P` conflicts with Chrome's native print dialog

---

## 8. How to add a new platform

Three steps to extend SnapLink to any new ticket system:

1. **Add the domain** to both `host_permissions` and `content_scripts[0].matches` in `manifest.json`.

2. **Add a platform entry** to the `PLATFORMS` array in `content.js`:
   ```js
   {
     key: "YourPlatform",
     patterns: ["yourplatform.com", "*.yourplatform.com"],
     selectors: [".your-main-title-selector", "h1"],
     extract: null   // or a custom fn for <input>/<textarea> elements
   }
   ```
   Optionally provide a `match(href, hostname)` function if the platform can't be identified by hostname alone.

3. **Reload** the extension in `chrome://extensions/`.

Optionally add a `.badge-*` CSS class in `popup.css` for a matching platform badge color.

---

## 9. How to update this document

Every time a change is made to SnapLink, update AGENTS.md:

- Bump the version in section 1
- Add new files or edit descriptions in section 2 if files changed
- Add new platforms to section 3 if added
- Add new technical decisions to section 4 if architecture changed
- Add new edge cases to section 5 if discovered
- Update section 6 if new store assets are created
- Add a new entry to the changelog in section 7

---

## Last updated

**Version:** 1.3.0 — **Date:** 2026-05-15
