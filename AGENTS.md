# AGENTS.md — SnapLink Persistent Memory

This document provides full context for the SnapLink Chrome extension so any AI agent can pick up work without re-explanation. Paste this at the start of every new conversation.

---

## 1. Project overview

- **Extension name:** SnapLink
- **Version:** 1.7.0
- **Purpose:** Copy ticket URLs from Jira, Linear, GitHub, and other platforms as formatted hyperlinks (HTML + plain text) to the clipboard. When pasted into Word, Excel, Google Docs, or Notion, they appear as clickable links with the ticket title as display text — never raw URLs.
- **Repository:** `https://github.com/jraversbcn21/SnapLink.git`
- **Branch:** `master`

---

## 2. File structure

```
SnapLink/
├── manifest.json       — MV3 manifest, permissions (activeTab, scripting, clipboardWrite), commands, background worker — no content_scripts / host_permissions
├── content.js          — DOM title extraction per platform, toast notification, clipboard write
├── popup.html          — 320px dark UI, editable title input, platform badge, copy button
├── popup.css           — Dark theme #0f1117, monospaced typography, platform badge colors
├── popup.js            — Clipboard API (ClipboardItem HTML+plain), fallback logic, ticket ID toggle
├── background.js       — Service worker, listens for Ctrl+Shift+L command, triggers copy flow
├── icons/
│   ├── icon.svg        — Base SVG icon (black bg, chain-link motif, "SL" letters)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test.js             — `node test.js`: asserts for cleanUrl, cleanAppSuffix and title fallback order (loads content.js in a vm, no deps)
├── package.json        — devDependency `sharp` (icon generation only)
├── .gitignore          — node_modules/, *.zip
├── generate-icons.js   — Node.js helper to regenerate PNG icons from SVG using `sharp`
├── AGENTS.md           — This file (persistent memory document)
├── README.md           — Installation guide, usage, how to add new platforms
├── LICENSE             — MIT License
├── PRIVACY.md          — Privacy policy for the Chrome Web Store
└── STORE_LISTING.md    — Store description text (keyword-spam-safe); paste into the Developer Dashboard
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
| **Generic fallback** | Any other URL | `meta[property="og:title"]`, then first `<h1>`, then `document.title` (cleaned of app suffixes) |

---

## 4. Key technical decisions

- **Clipboard API:** Uses `ClipboardItem` with `text/html` + `text/plain` simultaneously. Falls back to `execCommand('copy')` only as absolute last resort.
- **`window.focus()`** is called before every clipboard write from the popup to prevent Chrome from blocking the Clipboard API.
- **Title cleaning — ticket ID prefix:** Strips `[XXX-1234]` or `XXX-1234:` prefixes using regex `/^\[?[A-Z]+-\d+\]?\s*[:·-]?\s*/` when the "Include ticket ID" toggle is unchecked.
- **Title cleaning — app suffixes:** Removes known app name suffixes (e.g. ` - Jira`, ` | GitHub`) from `document.title` when no selector matches.
- **Keyboard shortcut:** `Ctrl+Shift+L` — registered via `commands` API in `manifest.json`, handled by `background.js` → `content.js` → clipboard write + toast.
- **Shortcut hint:** `popup.js` reads the user's actual binding via `chrome.commands.getAll` (no extra permission) and shows a tip under the copy button; if no shortcut is assigned, it points the user to `chrome://extensions/shortcuts` instead. Defaults to `Ctrl+Shift+L` in the HTML before the lookup resolves.
- **Toast notification:** Injected into the page DOM via `content.js` (not OS-level `chrome.notifications`). Fixed position bottom-right, `z-index: 999999`, 200ms fade-in / 300ms fade-out, dark theme matching popup.
- **Popup width:** 320px (compact, tool-like).
- **Single extractor on every site:** `scripting.executeScript` injects `content.js` (popup and `background.js` both do this, for supported and unsupported domains alike), so there is a single extractor: platform selectors → `og:title` → `<h1>` → `document.title`.
- **URL cleaning:** `cleanUrl()` in `content.js` removes tracking params (`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `yclid`, `igshid`, `mc_cid`, `mc_eid`, `_ga`, `_gl`) from every copied URL; other params are kept.
- **Markdown mode:** popup checkbox (persisted in `localStorage`, key `snaplink.md`) copies plain text `[title](url)` only, escaping `[ ] \` in the title and `( )` in the URL. The keyboard shortcut ignores it and always copies the rich link.
- **Tests:** `node test.js` loads `content.js` in a `vm` with stubbed globals (no framework). `popup.js` logic is not covered.
- **Packaging:** `node_modules/` and `*.zip` are git-ignored. The Web Store zip contains only `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.css`, `popup.js`, `icons/*.png`.
- **On-demand injection only (v1.7.0):** no `content_scripts` and no `host_permissions` in the manifest. Popup and `background.js` always call `scripting.executeScript(content.js)` under `activeTab`, then `sendMessage` in the callback (the listener is already registered, so no delay/timeout). Platform detection still uses `PLATFORMS` by hostname/URL, so adding a platform needs no manifest change.
- **Injection guard:** `content.js` sets `window.__snaplink` and returns early on re-injection, so repeated popup/shortcut uses never stack listeners.
- **Host globs precompiled:** `PLATFORMS[i].patterns` are compiled once to `hostRegexes` at script load.
- **`chrome://` pages:** Error state shown, copy button enabled for manual override.
- **Jira self-hosted matching:** Uses a `match(href, hostname)` function (not just hostname globs) to detect `/browse/XXX-1234` URL patterns on any domain.
- **Platform matching:** Each platform entry can have either `patterns` (hostname globs), a custom `match(href, hostname)` function (for Jira), or both.

---

## 5. Known behaviors and edge cases

- **Excel:** Paste works only when a cell is *selected* (not in edit mode — no blinking cursor inside the cell).
- **Word / Google Docs:** `Ctrl+V` works normally, pastes as a formatted hyperlink.
- **Orange warning banner:** "⚠ Title not auto-detected" appears when falling back to `document.title`. This is informational — the title shown is still usable and can be edited manually.
- **Jira CSS selectors** may become outdated when Atlassian updates their frontend. The `h1` fallback handles most cases.
- **Alt+Shift+C** was the original shortcut in the manifest, but was changed to **Ctrl+Shift+L** via `chrome://extensions/shortcuts`. Chrome allows users to override extension shortcuts at any time.

---

## 6. Assets for Chrome Web Store

| Asset | Size | Status |
|-------|------|--------|
| Promotional image (small) | 440×280px | SVG generated, PNG pending |
| Screenshot | 1280×800px | SVG generated, PNG pending |
| Marquee image | 1400×560px | SVG generated, PNG pending |

(Listing already live; assets above only matter if the store requires updates.)

- **Developer account:** Registered ($5 fee paid).
- **Store status:** Extension published. **v1.7.0 submitted for review on 2026-11-13** (package `SnapLink-1.7.0.zip`, built outside the repo; new description from `STORE_LISTING.md`; no host permissions). Result pending — update here when approved/rejected. Previously, the v1.6.0 package was **rejected on 2026-11-10** for "Keyword Spam" (ref. Yellow Argon): the store description listed ten platform names ("Jira, Linear, GitHub, GitLab, Trello, ..."). The package/manifest were fine; the fix is in the Dashboard description only. Use the text in `STORE_LISTING.md` (max 2–3 brand names, in a sentence) and resubmit; also check title, screenshots and promo images for brand lists. Package: `SnapLink-1.6.0.zip` (git-ignored, built outside the repo). When zipping, keep the `icons/` folder (flattening it breaks the manifest icon paths).
- **Privacy policy URL (store field):** `https://github.com/jraversbcn21/SnapLink/blob/master/PRIVACY.md` — must stay reachable or the store blocks publishing ("Privacy policy link is not reachable"). Do not rename/delete `PRIVACY.md` or make the repo private.

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

### v1.3.1 — Keyboard shortcut correction
- Changed shortcut from `Ctrl+Shift+S` to `Ctrl+Shift+L`
- Reason: `Ctrl+Shift+S` was set incorrectly in v1.3.0; correct shortcut is `Ctrl+Shift+L`

### v1.7.0 — Performance and fewer permissions
- Removed `content_scripts` and `host_permissions`: `content.js` is injected only when the user opens the popup or presses the shortcut (zero cost on other page loads)
- Popup injects then messages directly (removed the sendMessage-first + 500ms timeout path)
- Shortcut: removed the fixed 150ms wait after injection
- `window.__snaplink` guard against double injection; hostname globs precompiled
- `test.js` covers the guard and platform matching

### 2026-11-10 — Store rejection (no version change)
- v1.6.0 rejected for Keyword Spam in the store description (list of platform names)
- Added `STORE_LISTING.md` with a compliant description; no code changes

### v1.6.0 — Markdown output
- Popup checkbox "Copy as Markdown [title](url)" (remembered in `localStorage`); copies plain text only, escaping `[ ] \` in the title and `( )` in the URL
- The `Ctrl+Shift+L` shortcut still copies the rich link (HTML + plain)
- Added `test.js` (no extension change): run `node test.js` after editing `content.js`

### v1.5.0 — Works on any URL
- Title fallback order is now: platform selectors → `og:title` → `<h1>` → cleaned `document.title`; added `—` as a suffix separator
- URL is cleaned of tracking params (`utm_*`, `fbclid`, `gclid`, `msclkid`, etc.) in `content.js` `cleanUrl()`
- Popup fallback on unsupported domains now injects `content.js` and messages it, instead of a duplicate inline extractor (one extractor for popup and shortcut)
- The shortcut already injected `content.js` on demand via `activeTab`, so it works on any site

### v1.4.2 — Shortcut hint shows "Shift"
- Chrome returns the shortcut with localized key names (e.g. `Ctrl+Mayús+L` in Spanish); `popup.js` now replaces `Mayús`/`Mayus` with `Shift` so the hint matches `Ctrl+Shift+L`

### v1.4.1 — Shortcut hint always visible
- Hint shows `Ctrl+Shift+L` by default instead of starting hidden
- When no shortcut is assigned, hint tells the user to set one in `chrome://extensions/shortcuts`

### v1.4.0 — Shortcut discoverability
- Popup shows a "Tip: ... Ctrl+Shift+L" hint under the copy button
- Hint reflects the user's real shortcut (rebinding in `chrome://extensions/shortcuts` is picked up)
- Removed duplicate `privacy-policy.md` (kept `PRIVACY.md`)

---

## 8. How to add a new platform

Three steps to extend SnapLink to any new ticket system:

1. **Add a platform entry** to the `PLATFORMS` array in `content.js`:
   ```js
   {
     key: "YourPlatform",
     patterns: ["yourplatform.com", "*.yourplatform.com"],
     selectors: [".your-main-title-selector", "h1"],
     extract: null   // or a custom fn for <input>/<textarea> elements
   }
   ```
   Optionally provide a `match(href, hostname)` function if the platform can't be identified by hostname alone.

2. **Reload** the extension in `chrome://extensions/`.

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

## 10. Roadmap — possible future improvements

Ordered by suggested priority:

1. Keyboard shortcut honors the Markdown option (today it always copies the rich link).
2. Right-click context menu to copy any link on a page (needs `contextMenus`; title would be the link text).
3. Copy all open tabs as a list of links.
4. Custom output template (e.g. `[ID] title`).
5. History of recently copied links.
6. More output formats (Slack, Jira wiki markup).
7. Move `popup.js` pure helpers (`stripTicketId`, Markdown escaping) to a shared module so `test.js` can cover them.
8. Localized shortcut names beyond Spanish in the popup hint (currently only `Mayús`→`Shift`).
9. Chrome Web Store assets: convert SVG promo/screenshot/marquee to PNG.

---

## Last updated

**Version:** 1.7.0 — **Date:** 2026-11-13
