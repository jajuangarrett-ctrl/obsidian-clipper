const { Notice, Plugin, PluginSettingTab, Setting, normalizePath } = require("obsidian");

const DEFAULT_SETTINGS = {
  destinationFile: "08 Tasks/Tasks",
  taskFolder: "TaskNotes/Tasks",
};

module.exports = class FjgTaskClipperBridgePlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerObsidianProtocolHandler("fjg-task-clipper", async (params) => {
      await this.handleTaskClip(params);
    });

    this.addCommand({
      id: "insert-test-task-note",
      name: "Create test task note from bridge",
      callback: async () => {
        const file = await this.createTaskNote({
          taskFolder: this.settings.taskFolder,
          indexFile: this.settings.destinationFile,
          title: "Test FJG Task Clipper Bridge",
          details: "Bridge test task created from Obsidian.",
          status: "Inbox",
          project: "",
          tags: ["task"],
          source: { title: "", url: "" },
          createdAt: new Date().toISOString(),
        });
        new Notice(`FJG Task Clipper Bridge test note created: ${file.path}`);
      },
    });

    this.addSettingTab(new FjgTaskClipperBridgeSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async handleTaskClip(params) {
    try {
      const payload = decodePayload(String(params.payload || ""));
      if (!payload || payload.version !== 2) {
        throw new Error("Unsupported FJG Task Clipper payload.");
      }

      if (payload.action === "create-task-note") {
        const file = await this.createTaskNote(payload);
        new Notice(`Task note created: ${file.basename}`);
        return;
      }

      if (payload.action === "append-update") {
        const file = await this.appendUpdate(payload);
        new Notice(`Task update added: ${file.basename}`);
        return;
      }

      await this.appendLegacyTasks(payload);
      new Notice("Task added to Obsidian.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Task clip failed: ${message}`, 10000);
      console.error("[FJG Task Clipper Bridge]", error);
    }
  }

  async createTaskNote(payload) {
    const title = cleanTitle(payload.title || firstLine(payload.details) || "Clipped task");
    const status = cleanStatus(payload.status || "Inbox");
    const project = cleanInlineValue(payload.project || "");
    const tags = normalizeTags(payload.tags || ["task"], status);
    const createdAt = safeIsoDate(payload.createdAt);
    const folder = normalizeFolderPath(payload.taskFolder || this.settings.taskFolder);
    const path = await uniqueTaskNotePath(this.app, folder, title);
    const content = buildTaskNoteMarkdown({
      title,
      details: String(payload.details || "").trim(),
      status,
      project,
      tags,
      source: normalizeSource(payload.source),
      createdAt,
    });

    await ensureParentFolder(this.app, path);
    const file = await this.app.vault.create(path, content);
    await this.appendTaskIndexLine(payload.indexFile || this.settings.destinationFile, file.path, {
      title,
      status,
      project,
      tags,
    });
    return file;
  }

  async appendUpdate(payload) {
    const query = String(payload.taskQuery || "").trim();
    const updateText = String(payload.updateText || "").trim();
    if (!query) throw new Error("No task title or filename was provided.");
    if (!updateText) throw new Error("No update text was provided.");

    const folder = normalizeFolderPath(payload.taskFolder || this.settings.taskFolder);
    const file = await findTaskNote(this.app, folder, query);
    const current = await this.app.vault.read(file);
    const updated = appendUpdateBlock(current, {
      updateText,
      source: normalizeSource(payload.source),
      createdAt: safeIsoDate(payload.createdAt),
    });
    await this.app.vault.modify(file, updated);
    return file;
  }

  async appendTaskIndexLine(indexFile, taskPath, task) {
    const destination = normalizeTaskPath(indexFile || this.settings.destinationFile);
    await ensureParentFolder(this.app, destination);

    const file = this.app.vault.getAbstractFileByPath(destination);
    const taskRef = taskPath.replace(/\.md$/i, "");
    const projectText = task.project ? ` PJ: ${task.project}` : "";
    const tagText = normalizeTags(task.tags, task.status).map((tag) => `#${tag}`).join(" ");
    const line = `- [ ] [[${taskRef}|${task.title}]]${projectText} ${tagText}\n`;

    if (file && file.extension === "md") {
      const current = await this.app.vault.read(file);
      const prefix = current && !current.endsWith("\n") ? "\n" : "";
      await this.app.vault.append(file, `${prefix}${line}`);
      return;
    }

    if (file) throw new Error(`${destination} exists but is not a Markdown note.`);
    await this.app.vault.create(destination, line);
  }

  async appendLegacyTasks(payload) {
    const content = String(payload.content || "").trim();
    if (!content) throw new Error("No task content was provided.");

    const destination = normalizeTaskPath(payload.destinationFile || this.settings.destinationFile);
    await ensureParentFolder(this.app, destination);

    const file = this.app.vault.getAbstractFileByPath(destination);
    const block = `${content}\n`;

    if (file && file.extension === "md") {
      const current = await this.app.vault.read(file);
      const prefix = current && !current.endsWith("\n") ? "\n" : "";
      await this.app.vault.append(file, `${prefix}${block}`);
      return;
    }

    if (file) throw new Error(`${destination} exists but is not a Markdown note.`);
    await this.app.vault.create(destination, block);
  }
};

class FjgTaskClipperBridgeSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "FJG Task Clipper Bridge" });

    new Setting(containerEl)
      .setName("Task notes folder")
      .setDesc("New clipped task notes are created here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.taskFolder)
          .setValue(this.plugin.settings.taskFolder)
          .onChange(async (value) => {
            this.plugin.settings.taskFolder = normalizeFolderPath(value || DEFAULT_SETTINGS.taskFolder);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Task index page")
      .setDesc("New task notes are also appended here as linked checkbox items.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.destinationFile)
          .setValue(this.plugin.settings.destinationFile)
          .onChange(async (value) => {
            this.plugin.settings.destinationFile = normalizeTaskPath(value || DEFAULT_SETTINGS.destinationFile).replace(/\.md$/i, "");
            await this.plugin.saveSettings();
          });
      });
  }
}

function decodePayload(encoded) {
  if (!encoded) throw new Error("Missing payload.");
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - encoded.length % 4) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

function buildTaskNoteMarkdown(task) {
 const tags = normalizeTags(task.tags, task.status);
 const taskLineTags = tags.map((tag) => `#${tag}`).join(" ");
  const details = cleanDetails(task.details, task.title);
  const source = buildSourceLine(task.source);

  const sections = [
    "---",
    `title: ${yamlString(task.title)}`,
    `status: ${yamlString(task.status)}`,
    "priority: normal",
    `dateCreated: ${yamlString(task.createdAt)}`,
    `dateModified: ${yamlString(task.createdAt)}`,
    yamlList("projects", task.project ? [task.project] : []),
    yamlList("tags", tags),
    "---",
    `# ${task.title}`,
    "",
    `- [ ] ${task.title} ${taskLineTags}`,
  ];

  if (task.project) sections.push("", `Project: ${task.project}`);
  if (details) sections.push("", "## Details", "", details);
  if (source) sections.push("", "## Source", "", source);
  sections.push("", "## Updates", "");

  return sections.join("\n") + "\n";
}

function appendUpdateBlock(content, update) {
  const block = buildUpdateBlock(update.updateText, update.source, update.createdAt);
  const withModified = setFrontmatterValue(content, "dateModified", update.createdAt);
  const heading = /^## Updates\s*$/m;
  const match = withModified.match(heading);

  if (!match || match.index === undefined) {
    const prefix = withModified.endsWith("\n") ? "" : "\n";
    return `${withModified}${prefix}\n## Updates\n\n${block}\n`;
  }

  const insertAt = match.index + match[0].length;
  const before = withModified.slice(0, insertAt).replace(/\s*$/, "");
  const after = withModified.slice(insertAt).replace(/^\s*/, "");
  return after
    ? `${before}\n\n${block}\n\n${after}`
    : `${before}\n\n${block}\n`;
}

function buildUpdateBlock(updateText, source, isoDate) {
  const parts = [
    `### ${formatLocalDateTime(new Date(isoDate))}`,
    String(updateText || "").trim(),
    buildSourceLine(source),
  ].filter(Boolean);
  return parts.join("\n\n");
}

async function findTaskNote(app, folder, query) {
  const directPath = normalizeMaybeMarkdownPath(query);
  if (directPath) {
    const directFile = app.vault.getAbstractFileByPath(directPath);
    if (directFile && directFile.extension === "md") return directFile;
  }

  const folderPrefix = `${folder.replace(/\/+$/, "")}/`;
  const queryKey = normalizeSearchText(query);
  const files = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(folderPrefix));
  const candidates = files.map((file) => {
    const cache = app.metadataCache.getFileCache(file);
    const frontmatterTitle = cache && cache.frontmatter && cache.frontmatter.title
      ? String(cache.frontmatter.title)
      : "";
    const cleanedBasename = file.basename.replace(/^\d{12,14}\s+/, "");
    const fields = [file.basename, cleanedBasename, frontmatterTitle, file.path.replace(/\.md$/i, "")].filter(Boolean);
    return { file, fields, keys: fields.map(normalizeSearchText) };
  });

  const exact = candidates.filter((candidate) => candidate.keys.includes(queryKey));
  if (exact.length === 1) return exact[0].file;
  if (exact.length > 1) throw new Error(`Multiple exact task matches found for "${query}". Use the note filename.`);

  const partial = candidates.filter((candidate) => candidate.keys.some((key) => key.includes(queryKey)));
  if (partial.length === 1) return partial[0].file;
  if (!partial.length) throw new Error(`No task note matched "${query}" in ${folder}.`);

  const examples = partial.slice(0, 5).map((candidate) => candidate.file.basename).join(", ");
  throw new Error(`Multiple task notes matched "${query}": ${examples}. Type more of the title.`);
}

async function uniqueTaskNotePath(app, folder, title) {
  const base = sanitizeFileName(title) || "Clipped task";
  let path = `${folder}/${base}.md`;
  let index = 2;

  while (app.vault.getAbstractFileByPath(path)) {
    path = `${folder}/${base} - ${index}.md`;
    index += 1;
  }

  return path;
}

function normalizeTaskPath(value) {
  const normalized = normalizePath(String(value || DEFAULT_SETTINGS.destinationFile)
    .trim()
    .replace(/\.md$/i, ""));
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error("Invalid task destination.");
  }
  return `${normalized}.md`;
}

function normalizeFolderPath(value) {
  const normalized = normalizePath(String(value || DEFAULT_SETTINGS.taskFolder)
    .trim()
    .replace(/\.md$/i, "")
    .replace(/\/+$/g, ""));
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error("Invalid task folder.");
  }
  return normalized;
}

function normalizeMaybeMarkdownPath(value) {
  const text = String(value || "").trim();
  if (!text || !text.includes("/")) return "";
  return normalizeTaskPath(text);
}

async function ensureParentFolder(app, filePath) {
  const parts = filePath.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) await app.vault.createFolder(current);
  }
}

function setFrontmatterValue(content, key, value) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match || match.index !== 0) return content;

  const body = match[1];
  const line = `${key}: ${yamlString(value)}`;
  const nextBody = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m").test(body)
    ? body.replace(new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m"), line)
    : `${body}\n${line}`;
  return `---\n${nextBody}\n---${content.slice(match[0].length)}`;
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function yamlList(key, values) {
  if (!values.length) return `${key}: []`;
  return `${key}:\n${values.map((value) => `  - ${yamlString(value)}`).join("\n")}`;
}

function buildSourceLine(source) {
  const title = String(source.title || "").trim();
  const url = String(source.url || "").trim();
  if (source.sourceKind === "email" || isEmailUrl(url)) {
    const subject = cleanEmailSubject(title);
    return subject ? `Email subject: ${subject}` : "Email source: subject unavailable";
  }
  if (title && url) return `Source: [${escapeMarkdownLinkText(title)}](${url})`;
  if (url) return `Source: ${url}`;
  if (title) return `Source: ${title}`;
  return "";
}

function cleanEmailSubject(value) {
  const clean = String(value || "")
    .replace(/^subject\s*:?\s*/i, "")
    .replace(/\s*Summarize this email\s*$/i, "")
    .replace(/\s+-\s+[^-]+?\s+-\s+Outlook$/i, "")
    .replace(/\s+-\s+(Outlook|Microsoft Outlook|Microsoft Outlook Web App|Mail)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return looksLikeEmailSubject(clean) ? clean : "";
}

function looksLikeEmailSubject(value) {
  if (!value || value.length < 3 || value.length > 240) return false;
  return !/^(Inbox|Mail|Outlook|Microsoft Outlook|Message|Reading Pane|Navigation pane|Navigation)$/i.test(value);
}

function normalizeSource(source) {
  return {
    title: String((source && source.title) || ""),
    url: String((source && source.url) || ""),
    sourceKind: (source && source.sourceKind) === "email" ? "email" : "web",
  };
}

function isEmailUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("outlook.") ||
      host.includes("office.com") ||
      host.includes("office365.com") ||
      host.includes("mail.google.com") ||
      (host.includes("cloud.microsoft") && parsed.pathname.includes("/mail"))
    );
  } catch {
    return false;
  }
}

function normalizeTags(tags, status) {
  const out = [];
  for (const tag of Array.isArray(tags) ? tags : []) {
    const clean = cleanTag(tag);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  if (!out.includes("task")) out.unshift("task");
  const statusTag = cleanTag(status);
  if (statusTag && !out.includes(statusTag)) out.push(statusTag);
  return out;
}

function cleanTag(value) {
  return String(value || "")
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9/_-]/g, "");
}

function cleanStatus(value) {
  return cleanTag(value) || "Inbox";
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "Clipped task";
}

function cleanInlineValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDetails(details, title) {
  const clean = String(details || "").trim();
  return normalizeSearchText(clean) === normalizeSearchText(title) ? "" : clean;
}

function firstLine(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function safeIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/^\d{12,14}\s+/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMarkdownLinkText(value) {
  return String(value || "").replace(/[[\]\\]/g, "\\$&");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
