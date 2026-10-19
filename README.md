# FJG Obsidian Task Clipper

Chrome extension forked from [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) for capturing objectives and updates in FJG Objective Manager.

Version **0.2.0** replaces the Project dropdown with a searchable, collapsible **People** checklist. Select multiple names from the live Objective Manager catalog or manually saved People. New captures start unassigned. Existing projects and pairing settings are preserved.

Requires **FJG Objective Manager 0.23.2 or later**, which preserves People in incoming protocol captures. Agenda inclusion remains opt-in in Objective Manager.

See the [user guide](docs/FJG%20Obsidian%20Task%20Clipper%20User%20Guide.md) for setup and use.

```sh
npm install
npm test
npm run build:chrome
```

Load or reload `dist/` through `chrome://extensions`. The packaged release is `builds/fjg-obsidian-task-clipper-0.2.0-chrome.zip`.

The extension sends capture payloads through `obsidian://fjg-task-clipper`. Objective Manager writes authoritative Markdown workspaces to its configured vault locations. The authenticated loopback catalog supplies People and exact objective search results. Keep the older Task Clipper Bridge disabled.
