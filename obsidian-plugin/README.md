# FJG Task Clipper Bridge

Companion Obsidian plugin for the FJG Obsidian Task Clipper Chrome extension.

The Chrome extension sends selected text to Obsidian with:

```text
obsidian://fjg-task-clipper?payload=...
```

This plugin decodes the payload and writes task notes directly in the vault. It does not use the TaskNotes HTTP API or any local web server.

Default task notes folder:

```text
TaskNotes/Tasks/
```

Default task index page:

```text
08 Tasks/Tasks.md
```

Create payloads make one Markdown note per task and append a linked checkbox to the index page. Update payloads find the matching task note and append selected text under `## Updates`.
