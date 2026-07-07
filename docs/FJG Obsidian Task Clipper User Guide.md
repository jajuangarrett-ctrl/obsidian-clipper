# FJG Obsidian Task Clipper User Guide

This is the version 2 setup guide for the FJG Obsidian Task Clipper.

Version 2 replaces the old TaskNotes HTTP API workflow. It uses two local pieces:

- A Chrome extension loaded from this repo's `dist/` folder.
- A small Obsidian companion plugin named `FJG Task Clipper Bridge`.

The extension sends selected Chrome text to Obsidian with an `obsidian://fjg-task-clipper` URL. The bridge receives it and appends plain Markdown task lines to your configured task page.

No TaskNotes API server, localhost port, bearer token, or TaskNotes authentication token is required.

## What It Creates

By default, tasks are appended to:

```text
08 Tasks/Tasks.md
```

Each saved task is a normal Obsidian checkbox task with `#task`, a status tag, and an optional project:

```md
- [ ] Review the budget packet PJ: Basic Needs #task #DoSoon
  - Source: [Budget page](https://example.com/budget)
```

This keeps the workflow compatible with Obsidian task plugins that understand Markdown checkbox tasks and tags.

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
Task page: 08 Tasks/Tasks
```

Leaving the vault name blank tells Obsidian to use the currently open vault. This is usually more reliable than hardcoding `FJG Vault`, especially when Obsidian is already open to the right vault.

## Projects

Projects are stored in the Chrome extension settings.

To add a project:

1. Open extension `Options`.
2. In `Projects`, type the project name.
3. Click `Add project`.
4. Click `Save settings`.

The project appears in the popup's `Project` dropdown. When selected, it is written into the task line as:

```md
PJ: Project Name
```

Example:

```md
- [ ] Follow up with Basic Needs team PJ: Basic Needs #task #Waiting
```

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

For example, the status label `Do Soon` saves the tag:

```md
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

Example:

```text
task followup BasicNeeds
```

## Create A Task

1. Select text on a web page.
2. Click the `FJG Obsidian Task Clipper` icon.
3. Edit the task text if needed.
4. Choose a status.
5. Choose a project, or leave `No project`.
6. Adjust tags if needed.
7. Keep `Include page source` checked if you want the source URL saved.
8. Click `Create Task`.

Obsidian should open or come forward, and the task should be appended to the configured task page.

## Verify It Worked

After clicking `Create Task`, open:

```text
/Users/franklingarrett/FJG Vault/08 Tasks/Tasks.md
```

Confirm a new line was appended in this shape:

```md
- [ ] Your selected text PJ: Your Project #task #YourStatus
```

If `Include page source` was checked, the next indented line should include the source page.

## Troubleshooting

If nothing happens after clicking `Create Task`:

1. Confirm Obsidian is running.
2. Confirm the FJG Vault is open.
3. Confirm `FJG Task Clipper Bridge` is enabled in Obsidian.
4. Restart Obsidian once.
5. Reload the unpacked Chrome extension from `chrome://extensions`.

If Obsidian opens but the task does not appear:

1. Check that the extension `Task page` setting is `08 Tasks/Tasks`.
2. Confirm the bridge plugin is installed at:

```text
/Users/franklingarrett/FJG Vault/.obsidian/plugins/fjg-task-clipper-bridge
```

3. Open Obsidian Developer Tools and check for `FJG Task Clipper Bridge` errors.

If Chrome says the extension changed:

1. Open `chrome://extensions`.
2. Click `Reload` on `FJG Obsidian Task Clipper`.

If a selected text block is very long:

The extension may copy the task lines to the clipboard instead of opening Obsidian, because protocol URLs have practical length limits. Paste the copied task lines manually into `08 Tasks/Tasks.md`.

## What Is Different From The Old Version

The old version tried to talk to TaskNotes at:

```text
http://localhost:8080/api/health
```

That required Obsidian, TaskNotes, the TaskNotes HTTP API, local network permissions, and a matching bearer token. Chrome and macOS made that flow fragile.

Version 2 removes that dependency. The extension now creates regular Markdown tasks through Obsidian itself.

You can still use TaskNotes or other Obsidian task plugins afterward if they read normal Markdown checkbox tasks and tags, but this clipper does not require TaskNotes to create the task.

## Developer Verification

From the repo:

```bash
npm test
npm run build:chrome
node --check obsidian-plugin/main.js
```

The local Obsidian bridge can also be smoke-tested by opening an `obsidian://fjg-task-clipper` payload that writes to a separate test note.
