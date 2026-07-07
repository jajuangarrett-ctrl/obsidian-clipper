# FJG Obsidian Task Clipper

Chrome extension forked from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) for Franklin Garrett's FJG task workflow.

Version 2 does not use the TaskNotes HTTP API. The Chrome extension sends selected text through an Obsidian protocol URL, and the companion Obsidian plugin appends plain Markdown tasks to the configured vault note.

Detailed setup and use instructions live in [docs/FJG Obsidian Task Clipper User Guide.md](docs/FJG%20Obsidian%20Task%20Clipper%20User%20Guide.md).

## What It Does

- Captures selected Chrome text or the current page title.
- Lets Franklin choose status, project, and tags in the extension popup.
- Appends plain Obsidian task lines to `08 Tasks/Tasks.md` by default.
- Keeps every task compatible with Obsidian task plugins by including `#task`.
- Uses status tags such as `#Inbox`, `#DoFirst`, and `#Waiting`.

Default FJG statuses:

- `Inbox`
- `DoFirst`
- `DoSoon`
- `Delegate`
- `Waiting`
- `On-Hold`

Example output:

```md
- [ ] Review the budget packet PJ: Basic Needs #task #DoSoon
  - Source: [Budget page](https://example.com/budget)
```

## Architecture

```text
Chrome extension -> obsidian://fjg-task-clipper -> FJG Task Clipper Bridge -> Markdown task page
```

This avoids localhost, CORS, Chrome Local Network Access prompts, bearer tokens, and TaskNotes API behavior.

## Chrome Setup

```bash
npm install
npm run build:chrome
```

Chrome output:

```text
dist/
builds/fjg-obsidian-task-clipper-0.1.0-chrome.zip
```

Load or reload the unpacked extension:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click `Load unpacked`.
4. Select this folder's `dist/` directory.
5. Pin `FJG Obsidian Task Clipper`.

## Obsidian Setup

Install the companion bridge plugin into the FJG Vault:

```text
/Users/franklingarrett/FJG Vault/.obsidian/plugins/fjg-task-clipper-bridge/
```

Required files:

```text
main.js
manifest.json
README.md
```

Enable `FJG Task Clipper Bridge` in Obsidian Community Plugins, then restart Obsidian if the protocol handler was just installed.

## Extension Settings

Open the extension options page.

Destination:

- Vault name: blank to use the currently open Obsidian vault, or `FJG Vault` if explicit routing is needed.
- Task page: `08 Tasks/Tasks`

Projects:

- Add project names in the extension settings.
- They are stored in Chrome extension sync storage and appear in the popup project dropdown.

Statuses:

- The FJG defaults are already included.
- Add new statuses by entering a display label and tag value.
- The tag value is what appears on the saved task line, for example `DoSoon` becomes `#DoSoon`.

## Use

1. Select text on a web page.
2. Click the extension icon, or right-click and choose `Create Obsidian task from selection`.
3. Edit the task text if needed.
4. Choose status, project, and tags.
5. Click `Create Task`.

## Verification

```bash
npm test
npm run build:chrome
node --check obsidian-plugin/main.js
```

The Obsidian bridge can be smoke-tested with a protocol payload into a separate test note before using the live task page.
