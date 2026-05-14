# SnapLink

Copy page URLs as rich hyperlinks with the page title as display text — paste into Word, Excel, Notion, Google Docs, and any rich-text application.

## What it does

When you copy a ticket URL from Jira, Linear, GitHub, or any supported platform, browsers copy the raw URL. Pasting into a document requires manually adding a hyperlink and setting the display text. SnapLink copies both an HTML hyperlink and a plain-text fallback to the clipboard simultaneously, so pasting into any application yields a clickable link with the ticket title as the visible text.

It reads only what is already visible in the browser DOM — no API calls, no authentication, no backend.

## Supported platforms

| Platform              | Domain pattern                                             |
|-----------------------|-----------------------------------------------------------|
| Jira                  | `*.atlassian.net`, `*.atlassian.com`, self-hosted (any domain with `/browse/XXX-000`) |
| Linear                | `*.linear.app`                                             |
| GitHub                | `github.com`                                               |
| GitLab                | `gitlab.com`, `*.gitlab.com`                               |
| Trello                | `trello.com`                                               |
| Notion                | `notion.so`                                                |
| ClickUp               | `*.clickup.com`                                            |
| Asana                 | `*.asana.com`                                              |
| Zendesk               | `*.zendesk.com`                                            |
| Shortcut              | `*.shortcut.com`                                           |
| Generic (any site)    | Falls back to the first `<h1>` or `document.title`         |

## How to install (developer mode)

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `SnapLink` folder (the one containing `manifest.json`).
4. The SnapLink icon will appear in the toolbar. Pin it for easy access.
5. To set the keyboard shortcut, go to `chrome://extensions/shortcuts`, find SnapLink, and assign a key combination. The default is `Alt+Shift+C`.

## How to use

### Via the popup

Click the SnapLink toolbar icon on any supported page. The popup shows the detected platform, the extracted title (editable), and the current URL. Verify or edit the title, then click **Copy as Link**. The button turns green with a checkmark for two seconds to confirm the copy.

If SnapLink could not auto-detect the title from a CSS selector, an orange warning banner explains that it fell back to the page title. The title shown is still usable and can be edited manually before copying.

### Via keyboard shortcut

Press `Ctrl+Shift+P` (or your configured shortcut) on any supported page. SnapLink extracts the title silently, copies the formatted link to the clipboard, and shows a small dark toast in the bottom-right corner with the confirmation. No popup opens.

If the title cannot be detected, the toast warns: "Title not detected -- open SnapLink to edit."

## Paste behavior by application

| Application      | Paste method | Result |
|-----------------|-------------|--------|
| Microsoft Word   | `Ctrl+V`    | Clickable hyperlink with ticket title as display text |
| Microsoft Excel  | `Ctrl+V` (cell selected, not in edit mode) | Formatted hyperlink inserted into the cell |
| Google Docs      | `Ctrl+V`    | Clickable hyperlink with ticket title as display text |
| Notion           | `Ctrl+V`    | Clickable hyperlink with ticket title as display text |
| Plain text editor | `Ctrl+V`    | `Title - URL` (plain text fallback) |

## How to add a new platform

1. Add the domain to both `host_permissions` and `content_scripts[0].matches` in `manifest.json`.
2. Add a new entry to the `PLATFORMS` array in `content.js`:
   ```js
   {
     key: "YourPlatform",
     patterns: ["yourplatform.com", "*.yourplatform.com"],
     selectors: [".your-main-title-selector", "h1"],
     extract: null   // or a custom function for <input>/<textarea> elements
   }
   ```
   Optionally provide a `match(href, hostname)` function if the platform cannot be identified by hostname alone (as done for self-hosted Jira instances).
3. Reload the extension in `chrome://extensions/`.

## File structure

```
SnapLink/
├── manifest.json       -- MV3 manifest, permissions, content_scripts, commands, background worker
├── content.js          -- DOM title extraction per platform, toast notification, clipboard write
├── popup.html          -- 320px dark UI, editable title input, platform badge, copy button
├── popup.css           -- Dark theme #0f1117, monospaced typography, platform badge colors
├── popup.js            -- Clipboard API (ClipboardItem HTML+plain), fallback logic, ticket ID toggle
├── background.js       -- Service worker, listens for keyboard shortcut, triggers copy flow
├── icons/
│   ├── icon.svg        -- Base SVG icon (black background, chain-link motif, "SL" letters)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── generate-icons.js   -- Node.js helper to regenerate PNG icons from SVG using sharp
├── AGENTS.md           -- Persistent memory document with full project context
├── LICENSE             -- MIT License
└── README.md           -- This file
```

## Changelog

### v1.0.0 -- Initial release
- Basic popup with title extraction for 10 platforms
- ClipboardItem with HTML + plain text
- Dark UI 320px popup
- Editable title input with fallback warning

### v1.1.0 -- Self-hosted Jira support
- Added `jira.inditex.com` to `host_permissions` and `content_scripts.matches`
- Updated platform `match()` function to detect `/browse/XXX-000` on any domain
- Fixed ClipboardItem flow (`window.focus()` before write)
- Added "Include ticket ID in title" toggle checkbox in popup

### v1.2.0 -- Keyboard shortcut
- Added `background.js` service worker
- Registered keyboard shortcut via `commands` API
- Added `showToast()` in `content.js` (dark theme, fade in/out, bottom-right)
- Independent `copyTicketLink` message handler -- popup flow untouched

## License

MIT. See the [LICENSE](LICENSE) file.
