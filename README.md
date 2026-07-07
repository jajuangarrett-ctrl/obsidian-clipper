# FJG Obsidian Task Clipper

Chrome extension forked from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) for Franklin Garrett's FJG task workflow.

The extension now works with [TaskNotes](https://github.com/callumalpass/tasknotes), using its local HTTP API to create one-note-per-task Markdown tasks and append running updates to existing task notes.

## What It Does

- Create a new TaskNotes task from selected Chrome text.
- Choose TaskNotes status and project in the popup.
- Add selected Chrome text as a dated update to an existing active TaskNotes task.
- Keep `#task` on created tasks.
- Fall back to appending an inline Obsidian checkbox task when TaskNotes API is unavailable.

Default FJG statuses:

- `Inbox`
- `DoFirst`
- `DoSoon`
- `Delegate`
- `Waiting`
- `On-Hold`

## TaskNotes Setup

In Obsidian:

1. Install and enable TaskNotes.
2. Open `Settings -> TaskNotes -> Integrations -> HTTP API`.
3. Enable the HTTP API.
4. Keep the default port `8080`, or update the extension setting to match your port.
5. Optional but recommended: set an API auth token, then paste the same token into the extension settings.

The default extension API URL is:

```text
http://localhost:8080
```

TaskNotes API is desktop-only, so Obsidian must be running on the Mac for create/update mode to work.

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

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder's `dist/` directory.
5. Pin `FJG Obsidian Task Clipper`.

## Extension Settings

Open the extension options page.

TaskNotes:

- API base URL: `http://localhost:8080`
- Bearer token: optional TaskNotes API token
- Test connection: checks `GET /api/health`
- Sync projects/statuses: pulls TaskNotes filter options

Fallback Obsidian destination:

- Vault name: `FJG Vault`
- Task page: `08 Tasks/Tasks`
- Save fallback task lines without opening the note: on

## Use

Create a task:

1. Select text on a web page.
2. Click the extension icon.
3. Choose `Create Task`.
4. Edit title/details, status, project, and tags.
5. Click Create Task.

Add an update:

1. Select update text on a web page.
2. Click the extension icon.
3. Choose `Add Update`.
4. Search and choose the existing active TaskNotes task.
5. Click Add Update.

Update entries are appended to the task note body like this:

```md
## Updates

### 2026-07-07 16:30
Selected clipped text

Source: [Page title](https://example.com/page)
```

## Verification

```bash
npm test
npm run build:chrome
```
