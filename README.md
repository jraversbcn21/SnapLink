# SnapLink

Copy page URLs as rich hyperlinks with the page title as display text — paste into Word, Excel, Notion, Google Docs, Slack, GitHub, and any rich-text application.

## What it does

When you copy a URL, browsers copy the raw address. Pasting it into a document requires manually adding a hyperlink and setting the display text. SnapLink copies both an HTML hyperlink and a plain-text fallback to the clipboard simultaneously, so pasting into any application yields a clickable link with the page title as the visible text.

It works on **any website**. It reads only what is already visible in the browser DOM — no API calls, no authentication, no backend, no data collection.

## Title detection

1. Platform-specific selectors (see below)
2. `og:title` meta tag
3. First `<h1>`
4. `document.title`, with app-name suffixes removed (` - Jira`, ` | GitHub`, ` — Site`...)

The URL is cleaned of tracking parameters (`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `yclid`, `igshid`, `mc_cid`, `mc_eid`, `_ga`, `_gl`). Other parameters are kept.

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
| Any other site        | `og:title` → `<h1>` → `document.title`                     |

## How to install

**From the Chrome Web Store:** search for SnapLink.

**Developer mode:**

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `SnapLink` folder (the one containing `manifest.json`).
4. The SnapLink icon will appear in the toolbar. Pin it for easy access.
5. The default keyboard shortcut is `Ctrl+Shift+L`. To change it, go to `chrome://extensions/shortcuts`.

## How to use

### Via the popup

Click the SnapLink toolbar icon on any page. The popup shows the detected platform, the extracted title (editable), and the current URL. Verify or edit the title, then click **Copy as Link**. The button turns green with a checkmark for two seconds to confirm the copy.

Options in the popup:

- **Include ticket ID in title** — uncheck to strip prefixes like `[ABC-123]` or `ABC-123:`.
- **Copy as Markdown** — copies `[title](url)` as plain text (for Slack, GitHub, Notion). The choice is remembered.
- Click the URL box to copy the plain URL.

If SnapLink could not auto-detect the title from a CSS selector, an orange warning banner explains that it fell back to the page title. The title shown is still usable and can be edited manually before copying.

### Via keyboard shortcut

Press `Ctrl+Shift+L` (or your configured shortcut) on any page. SnapLink extracts the title silently, copies the formatted link to the clipboard, and shows a small dark toast in the bottom-right corner with the confirmation. No popup opens. The shortcut always copies the rich link (HTML + plain text), not Markdown.

If the title cannot be detected, the toast warns: "Title not detected -- open SnapLink to edit."

## Paste behavior by application

| Application      | Paste method | Result |
|-----------------|-------------|--------|
| Microsoft Word   | `Ctrl+V`    | Clickable hyperlink with the title as display text |
| Microsoft Excel  | `Ctrl+V` (cell selected, not in edit mode) | Formatted hyperlink inserted into the cell |
| Google Docs      | `Ctrl+V`    | Clickable hyperlink with the title as display text |
| Notion           | `Ctrl+V`    | Clickable hyperlink with the title as display text |
| Plain text editor | `Ctrl+V`    | `Title - URL` (plain text fallback) |
| Any app, Markdown mode | `Ctrl+V` | `[Title](URL)` text |

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

## Development

- Run the tests with `node test.js` (no dependencies). They cover URL cleaning, title suffix cleaning and the title fallback order in `content.js`.
- `npm install` is only needed to regenerate icons with `generate-icons.js` (uses `sharp`).
- `node_modules/` and `*.zip` are git-ignored. To build the Web Store package, zip only: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.css`, `popup.js` and `icons/*.png`.

## File structure

```
SnapLink/
├── manifest.json       -- MV3 manifest, permissions, content_scripts, commands, background worker
├── content.js          -- Title extraction, URL cleaning, toast notification, clipboard write
├── popup.html          -- 320px dark UI, editable title, platform badge, toggles, copy button
├── popup.css           -- Dark theme, monospaced typography, platform badge colors
├── popup.js            -- Clipboard API (HTML+plain / Markdown), fallback logic, shortcut hint
├── background.js       -- Service worker, keyboard shortcut, on-demand content script injection
├── test.js             -- node test.js: asserts for content.js pure logic
├── icons/              -- icon.svg source and icon16/32/48/128.png
├── generate-icons.js   -- Node.js helper to regenerate PNG icons from SVG using sharp
├── package.json        -- devDependency (sharp) for icon generation only
├── AGENTS.md           -- Persistent memory document with full project context
├── PRIVACY.md          -- Privacy policy for the Chrome Web Store
├── LICENSE             -- MIT License
└── README.md           -- This file
```

## Roadmap (possible future improvements)

- Make the keyboard shortcut honor the Markdown option.
- Right-click context menu to copy any link on a page (needs `contextMenus`).
- Copy all open tabs as a list of links.
- Custom output template (e.g. `[ID] title`).
- History of recently copied links.
- Output format selector (Slack, Jira wiki markup) beyond rich link and Markdown.
- Unit tests for `popup.js` logic (`stripTicketId`, Markdown escaping) by moving pure helpers to a shared module.
- Localized shortcut names beyond Spanish in the popup hint.

## Changelog

### v1.6.0 -- Markdown output
- "Copy as Markdown" option in the popup, remembered between sessions
- Added `test.js`

### v1.5.0 -- Works on any URL
- Title fallback now includes `og:title`; `—` recognized as a suffix separator
- Tracking parameters removed from copied URLs
- Popup uses the same `content.js` extractor on unsupported sites

### v1.4.2 -- Shortcut hint fix
- Shortcut hint shows `Shift` instead of the localized `Mayús`

### v1.4.1 / v1.4.0 -- Shortcut discoverability
- Popup shows the real keyboard shortcut (or points to `chrome://extensions/shortcuts` when none is set)

### v1.3.1 -- Keyboard shortcut correction
- Default shortcut is `Ctrl+Shift+L` (earlier attempts conflicted with Chrome's print and save dialogs)

### v1.2.0 -- Keyboard shortcut
- Added `background.js` service worker and `commands` API shortcut
- Added `showToast()` in `content.js` (dark theme, fade in/out, bottom-right)

### v1.1.0 -- Self-hosted Jira support
- Added `jira.inditex.com`; `match()` detects `/browse/XXX-000` on any domain
- Fixed ClipboardItem flow (`window.focus()` before write)
- Added "Include ticket ID in title" toggle

### v1.0.0 -- Initial release
- Basic popup with title extraction for 10 platforms
- ClipboardItem with HTML + plain text
- Dark UI 320px popup, editable title input with fallback warning

## License

MIT. See the [LICENSE](LICENSE) file.
