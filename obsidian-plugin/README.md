# FJG Task Clipper Bridge

Companion Obsidian plugin for the FJG Obsidian Task Clipper Chrome extension.

The Chrome extension sends selected text to Obsidian with:

```text
obsidian://fjg-task-clipper?payload=...
```

This plugin decodes the payload and appends plain Markdown task lines to the configured task page. It does not use the TaskNotes HTTP API or any local web server.

Default task page:

```text
08 Tasks/Tasks.md
```
