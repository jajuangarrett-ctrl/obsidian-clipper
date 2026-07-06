# FJG Obsidian Task Clipper

Chrome extension forked from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) for Franklin Garrett's FJG task workflow.

The extension turns selected Chrome text into one or more Obsidian task lines and appends them to a configured note.

```md
- [ ] Review summer schedule request PJ: Basic Needs #task #DoSoon
```

The default statuses mirror the FJG iOS Taskboard app:

- `Inbox`
- `DoFirst`
- `DoSoon`
- `Delegate`
- `Waiting`
- `On-Hold`

`Done` is treated as a completed task state in Taskboard, not as a capture status for new tasks.

## Build

```bash
npm install
npm run build:chrome
```

Chrome output:

```text
dist/
builds/fjg-obsidian-task-clipper-0.1.0-chrome.zip
```

## Load In Chrome

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder's `dist/` directory.
5. Pin `FJG Obsidian Task Clipper` from the Chrome extensions menu.

## Configure

Open the extension options page.

Default Obsidian settings:

- Vault name: `FJG Vault`
- Task page: `08 Tasks/Tasks`
- Save without opening the note: on

The task page value should be the Obsidian note path without `.md`.

## Projects

Projects are stored in Chrome extension sync storage.

To add projects:

1. Open extension options.
2. Use the Projects section.
3. Add each project name.

You can also add a project directly from the popup. Project names are written into task lines as `PJ: Project Name`, which matches the existing FJG task parser.

## Statuses

Default statuses are protected in settings. You can add custom statuses with a label and hashtag value.

Example:

- Label: `Follow Up`
- Hashtag: `FollowUp`

Custom statuses work for Obsidian task lines. The live FJG Taskboard API currently supports only the default bucket values above; custom statuses sent to Taskboard fall back to `Inbox`.

## Optional Taskboard API

The extension can also create tasks directly in the deployed FJG Taskboard.

In settings:

1. Set Taskboard URL to `https://fjg-taskboard.netlify.app`.
2. Enter the dashboard password.
3. Click Test connection.
4. Click Sync projects to pull the live managed project list.
5. Turn on Also create tasks in FJG Taskboard if you want Chrome captures to write to both Obsidian and the Taskboard API.

The password is stored in Chrome local extension storage, not sync storage.

## Use

1. Select text on a web page.
2. Click the extension icon, or right-click and choose Create Obsidian task from selection.
3. Choose status and project.
4. Click Add to Obsidian.

Multiple selected lines become multiple task lines.

## Verification

Current verification commands:

```bash
npm test
npm run build:chrome
```
