# FJG Obsidian Task Clipper User Guide

This is the version 2 setup guide for the FJG Obsidian Task Clipper.

Version 2 replaces the old TaskNotes HTTP API workflow. It uses two local pieces:

- A Chrome extension loaded from this repo's `dist/` folder.
- A small Obsidian companion plugin named `FJG Task Clipper Bridge`.

The extension sends selected Chrome text to Obsidian with an `obsidian://fjg-task-clipper` URL. The bridge receives it and creates or updates Markdown task notes directly in the vault.

No TaskNotes API server, localhost port, bearer token, or TaskNotes authentication token is required.

## What It Creates

By default, new task notes are created in:

```text
TaskNotes/Tasks/
```

Each task gets its own Markdown note. The bridge also appends a linked checkbox item to:

```text
08 Tasks/Tasks.md
```

That gives you a compact index page without forcing every update into one long document.

Example task note:

```md
---
title: Review the budget packet
status: DoSoon
priority: normal
projects:
  - Basic Needs
tags:
  - task
  - DoSoon
---
# Review the budget packet

- [ ] Review the budget packet #task #DoSoon

Project: Basic Needs

## Details

Selected text or edited task details.

## Source

Source: [Budget page](https://example.com/budget)

## Updates
```

Example index line:

```md
- [ ] [[TaskNotes/Tasks/Review the budget packet|Review the budget packet]] PJ: Basic Needs #task #DoSoon
```

If a note with the same title already exists, the bridge creates the next available filename with a numeric suffix:

```text
Review the budget packet.md
Review the budget packet - 2.md
Review the budget packet - 3.md
```

## Files Involved

Repo source:

```text
/Users/franklingarrett/Codex/plugins/obsidian-task-clipper
```

Chrome extension build output:

```text
/Users/franklingarrett/Codex/plugins/obsidian-task-clipper/dist
```

Obsidian bridge plugin installed in the FJG Vault:

```text
/Users/franklingarrett/FJG Vault/.obsidian/plugins/fjg-task-clipper-bridge
```

The bridge plugin folder must contain:

```text
main.js
manifest.json
README.md
```

## Build Or Update The Chrome Extension

From the repo folder:

```bash
cd /Users/franklingarrett/Codex/plugins/obsidian-task-clipper
npm install
npm run build:chrome
```

This refreshes:

```text
dist/
builds/fjg-obsidian-task-clipper-0.1.0-chrome.zip
```

## Install Or Reload The Chrome Extension

These steps happen in Chrome:

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. If the extension is already installed, click `Reload` on `FJG Obsidian Task Clipper`.
4. If it is not installed, click `Load unpacked`.
5. Select:

```text
/Users/franklingarrett/Codex/plugins/obsidian-task-clipper/dist
```

6. Pin `FJG Obsidian Task Clipper` to the Chrome toolbar.

Reloading the unpacked extension is required after each new `npm run build:chrome`.

## Enable The Obsidian Bridge

These steps happen in Obsidian:

1. Open the FJG Vault.
2. Go to `Settings -> Community plugins`.
3. Confirm `Restricted mode` is off.
4. Enable `FJG Task Clipper Bridge`.
5. Restart Obsidian if the bridge was just installed or updated.

The bridge registers the local protocol handler:

```text
obsidian://fjg-task-clipper
```

If the Chrome extension opens Obsidian but no task appears, restart Obsidian once so the protocol handler is registered cleanly.

## Configure Extension Settings

Open the extension options:

1. Right-click the pinned `FJG Obsidian Task Clipper` icon.
2. Choose `Options`.

Recommended destination settings:

```text
Vault name: leave blank
Task index page: 08 Tasks/Tasks
Task notes folder: TaskNotes/Tasks
```

Leaving the vault name blank tells Obsidian to use the currently open vault. This is usually more reliable than hardcoding `FJG Vault`, especially when Obsidian is already open to the right vault.

Optional AI title settings:

```text
OpenAI model: gpt-4.1-mini
OpenAI API key: paste your OpenAI API key
```

The API key is stored locally in Chrome extension storage. It is only used when you click `Generate` next to the task title.

## Projects

Projects are stored in the Chrome extension settings.

To add a project:

1. Open extension `Options`.
2. In `Projects`, type the project name.
3. Click `Add project`.
4. Click `Save settings`.

The project appears in the popup's `Project` dropdown. When selected, it is written into the task note frontmatter and index line.

Project choice is per task. Each time the popup opens, it starts at `No project` so a prior clip does not accidentally assign the next task.

## Statuses

The default FJG statuses are:

- `Inbox`
- `DoFirst`
- `DoSoon`
- `Delegate`
- `Waiting`
- `On-Hold`

Each status has:

- A label shown in the extension.
- A tag value saved on the task.

For example, the status label `Do Soon` saves the status value and tag:

```md
status: DoSoon
#DoSoon
```

To add a status:

1. Open extension `Options`.
2. In `Statuses`, enter a display label.
3. Enter the status tag value.
4. Click `Add status`.
5. Click `Save settings`.

Use simple tag values with no spaces, such as:

```text
Follow-Up
Blocked
Someday
```

If you want to return to the built-in FJG status set, click `Reset default statuses`.

## Tags

The extension always keeps `task` as a default tag so every created item includes:

```md
#task
```

You can add optional tags in extension `Options`. In the popup, the `Tags` field can contain one or more tags separated by spaces or commas.

## Create A Task

1. Select text on a web page.
2. Click the `FJG Obsidian Task Clipper` icon.
3. Choose `Create Task`.
4. Edit the task title and details if needed.
5. Optional: click `Generate` to ask AI for a cleaner task title.
6. Choose a status.
7. Choose a project, or leave `No project`.
8. Adjust tags if needed.
9. Keep `Include page source` checked if you want the source URL saved.
10. Click `Create Task`.

Obsidian should open or come forward. A dedicated task note should be created in `TaskNotes/Tasks`, and a linked checkbox should be appended to `08 Tasks/Tasks.md`.

If Chrome asks whether to open Obsidian, choose `Open Obsidian`. That permission prompt is Chrome's external-app safety check for the `obsidian://` handoff.

## Generate A Better Task Title

The popup starts with the first line of the selected text as the task title. If that title is too long or messy, click `Generate`.

`Generate` sends the task text, selected status, selected project, and source title or email subject to OpenAI. It returns one concise title and puts it in the editable `Task title` field.

The generated title is not final until you click `Create Task`. You can edit it first.

If `Generate` says an OpenAI API key is missing:

1. Open extension `Options`.
2. Paste your OpenAI API key in `OpenAI API key`.
3. Confirm the model field is set to `gpt-4.1-mini` or another model you want to use.
4. Click `Save settings`.
5. Return to the popup and click `Generate` again.

## Add An Update

Use `Add Update` when the task already exists and selected web text should become a dated update inside that task note.

1. Select update text on a web page.
2. Right-click and choose `Add selection as task update`, or click the extension icon and choose `Add Update`.
3. In `Task to update`, type enough of the task title or note filename to identify one task.
4. Edit the update text if needed.
5. Keep `Include page source` checked if you want the source URL saved.
6. Click `Add Update`.

The bridge searches `TaskNotes/Tasks` for a matching Markdown note.

- If it finds one exact match, it appends the update under `## Updates`.
- If it finds no match, it shows an Obsidian notice.
- If it finds multiple matches, it asks you to type more of the title or use the note filename.

Example update:

```md
## Updates

### 2026-07-07 06:06

Selected update text from Chrome.

Source: [Update page](https://example.com/update)
```

## Email Sources

When the source page is an email in Outlook or Gmail, the clipper saves the email subject as plain text instead of saving a clickable email URL.

Example:

```md
## Source

Email subject: Pedro Beltran Garcia is cleared to work
```

This is intentional because browser email URLs often reopen the mailbox shell instead of returning to the exact message.

## Verify It Worked

After clicking `Create Task`, open:

```text
/Users/franklingarrett/FJG Vault/TaskNotes/Tasks/
```

Confirm a new task note was created. Then open:

```text
/Users/franklingarrett/FJG Vault/08 Tasks/Tasks.md
```

Confirm a linked checkbox item points to the new task note.

After clicking `Add Update`, open the task note and confirm the update appears under:

```md
## Updates
```

## Troubleshooting

If nothing happens after clicking `Create Task` or `Add Update`:

1. Confirm Obsidian is running.
2. Confirm the FJG Vault is open.
3. Confirm `FJG Task Clipper Bridge` is enabled in Obsidian.
4. Restart Obsidian once.
5. Reload the unpacked Chrome extension from `chrome://extensions`.
6. If Chrome opens an `obsidian://` tab or prompt, allow it to open Obsidian.

If Obsidian opens but no task note appears:

1. Check that the extension `Task notes folder` setting is `TaskNotes/Tasks`.
2. Confirm the bridge plugin is installed at:

```text
/Users/franklingarrett/FJG Vault/.obsidian/plugins/fjg-task-clipper-bridge
```

3. Open Obsidian Developer Tools and check for `FJG Task Clipper Bridge` errors.

If `Add Update` cannot find a task:

1. Type more of the task title.
2. Or type the task note filename without `.md`.
3. Confirm the task note lives in `TaskNotes/Tasks`.

If Chrome says the extension changed:

1. Open `chrome://extensions`.
2. Click `Reload` on `FJG Obsidian Task Clipper`.

If a selected text block is very long:

The extension may copy the task or update text to the clipboard instead of opening Obsidian, because protocol URLs have practical length limits. Paste the copied text manually into the task note.

## What Is Different From The Old Version

The old version tried to talk to TaskNotes at:

```text
http://localhost:8080/api/health
```

That required Obsidian, TaskNotes, the TaskNotes HTTP API, local network permissions, and a matching bearer token. Chrome and macOS made that flow fragile.

Version 2 removes that dependency. The extension now creates and updates Markdown task notes through Obsidian itself.

The generated task notes are still compatible with TaskNotes-style organization because they live in `TaskNotes/Tasks`, carry the `task` tag, and use frontmatter such as `title`, `status`, `projects`, `dateCreated`, and `dateModified`.

## Developer Verification

From the repo:

```bash
npm test
npm run build:chrome
node --check obsidian-plugin/main.js
```

The local Obsidian bridge can also be smoke-tested with an `obsidian://fjg-task-clipper` payload that creates a test task note and then appends an update to it.
