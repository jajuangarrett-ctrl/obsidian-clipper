# FJG Obsidian Task Clipper

Version 0.2.0 works with FJG Objective Manager 0.23.2 or later.

## Capture an objective

1. Select text in Chrome and open **FJG Obsidian Task Clipper**.
2. Review the title, text, and status.
3. Expand **People — Unassigned**. Search and check one or more names, or leave it unassigned.
4. Review the preview and click **Create Task**.
5. Open the objective in Obsidian. Its People associations are saved in the objective's `people` property and appear in Objective Manager's People view.

People replaces the Project picker. Every new popup starts unassigned; names selected for a previous capture are not carried forward. Existing saved project settings and previously created objectives are preserved. Projects are never converted into people.

Selecting People does not add an objective to staff agendas automatically. Enable **Show on agendas** in Objective Manager when wanted.

## People list and connection

The clipper reads the current People list from Objective Manager's authenticated desktop catalog. It includes the manager's employee roster and names already associated with objectives.

Keep Obsidian open. In clipper **Settings**, use the catalog port and pairing token from Objective Manager. Existing pairing settings are preserved during this update. Click **Test catalog connection** to check the connection.

You can also add names under **Settings → People → Add person**. These manual names remain available if the live catalog cannot be reached. Adding a manual name does not update the manager's roster; it becomes an association when you create an objective with that name selected.

If the live list cannot load, the picker explains the connection or version problem. An empty selection creates an unassigned objective.

## Add an update

Choose **Add Update**, search for the existing objective, select the exact result, enter the update text, and submit. Updates continue to use the objective's stable ID and do not change its People associations.

## Install or update

Enable **FJG Objective Manager 0.23.2 or later** in Obsidian. Keep the older **FJG Task Clipper Bridge** disabled; Objective Manager owns the capture protocol and uses its configured task locations.

For an existing unpacked Chrome installation, open `chrome://extensions` and click **Reload** on **FJG Obsidian Task Clipper**. Confirm version **0.2.0**. New installations use **Load unpacked** and the extension's `dist/` folder.

Source: `/Users/franklingarrett/Codex/plugins/obsidian-task-clipper/`.
Chrome runtime: `/Users/franklingarrett/Codex/plugins/obsidian-task-clipper/dist/`.
Release ZIP: `builds/fjg-obsidian-task-clipper-0.2.0-chrome.zip`.

## Verification

```sh
npm test
npm run build:chrome
```

The matching Objective Manager tests cover protocol normalization, People persistence through workspace creation and refresh, and authenticated catalog access. Browser checks cover the live People list, multi-selection, filtering, and preview.
