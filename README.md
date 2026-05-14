# SnapLink — Chrome Extension

Copy page URLs as rich links with the ticket title as display text. Paste
formatted links into Word, Excel, Notion, Google Docs, and any rich-text
application.

---

## Supported Platforms

| Platform     | Selector                                      |
| ------------ | --------------------------------------------- |
| **Jira**     | `[data-testid="…"]`, `#summary-val`, `h1`     |
| **Linear**   | `[class*="titleText"]`, `[class*="IssueTitle"]`, `h1` |
| **GitHub**   | `.js-issue-title`, `bdi.js-issue-title`, `h1.gh-header-title` |
| **GitLab**   | `h1.title`, `.issue-title`                    |
| **Trello**   | `.card-detail-title-input`, `h2.card-title`   |
| **Notion**   | `[placeholder="Untitled"]`, `[class*="title"] [contenteditable]` |
| **ClickUp**  | `.task-name__title`, `[class*="task-title"]`  |
| **Asana**    | `[class*="TaskPane-taskName"]`, `textarea[aria-label*="Task Name"]` |
| **Zendesk**  | `[data-test-id="ticket-title"]`, `.ticket-subject` |
| **Shortcut** | `[class*="story-name"]`                       |
| **Generic**  | First `<h1>`, then `document.title`           |

---

## Installation (Developer Mode)

1. Open **Chrome** and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `SnapLink` folder (the one containing `manifest.json`)
5. The SnapLink icon should appear in your toolbar. Pin it for easy access.

---

## How to Use

1. Navigate to any supported ticket / issue page (Jira, GitHub, Linear, etc.)
2. Click the **SnapLink** toolbar icon
3. Review the detected title (edit if needed)
4. Click **Copy as Link**
5. Paste (Ctrl+V) into Word, Excel, Notion, Google Docs — the link appears as
   **clickable text** with the ticket title, not as a raw URL.

---

## Adding Support for a New Platform

1. **Add selectors to `content.js`** — insert a new entry in the `PLATFORMS`
   array (near the top of the file):

   ```js
   {
     key: "YourPlatform",
     patterns: ["yourplatform.com", "*.yourplatform.com"],
     selectors: [
       ".your-main-title-selector",
       "h1"   // fallback
     ],
     extract: null   // or provide a custom fn for input/textarea
   }
   ```

2. **Add `host_permissions` to `manifest.json`** — add your domain patterns
   to both the `host_permissions` array and the `content_scripts[0].matches`
   array.

3. **Add a badge style to `popup.css`** (optional) — copy one of the
   `.badge-*` rules and adjust the colours. Then the popup will display the
   platform name in a matching badge.

---

## File Structure

```
SnapLink/
├── manifest.json        Extension manifest (MV3)
├── content.js           Content script — DOM title extraction
├── popup.html           Popup UI
├── popup.css            Popup styles (dark theme, 320px)
├── popup.js             Popup logic + clipboard handling
├── generate-icons.js    Icon generator (Node.js + sharp)
├── icons/
│   ├── icon.svg         Source icon (128×128)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── README.md        Icon generation instructions
└── README.md            This file
```

---

## Technical Details

- **Manifest V3** — required for new Chrome extensions
- **No backend, no API calls, no login** — everything is read from the DOM
- **Clipboard API** — writes `text/html` and `text/plain` simultaneously
  using `ClipboardItem`
- **Offline-compatible** — works without internet access
- **Chrome 110+ and Edge (Chromium)** supported

---

## License

MIT
