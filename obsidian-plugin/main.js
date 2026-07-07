const { Notice, Plugin, PluginSettingTab, Setting, normalizePath } = require("obsidian");

const DEFAULT_SETTINGS = {
  destinationFile: "08 Tasks/Tasks",
};

module.exports = class FjgTaskClipperBridgePlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerObsidianProtocolHandler("fjg-task-clipper", async (params) => {
      await this.handleTaskClip(params);
    });

    this.addCommand({
      id: "insert-test-task",
      name: "Insert test task from bridge",
      callback: async () => {
        await this.appendTasks({
          destinationFile: this.settings.destinationFile,
          content: "- [ ] Test FJG Task Clipper Bridge #task #Inbox",
        });
        new Notice("FJG Task Clipper Bridge test task added.");
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
      await this.appendTasks(payload);
      new Notice("Task added to Obsidian.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Task clip failed: ${message}`, 8000);
      console.error("[FJG Task Clipper Bridge]", error);
    }
  }

  async appendTasks(payload) {
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
      .setName("Default task page")
      .setDesc("Used when the Chrome extension payload does not specify a destination.")
      .addText((text) => {
        text
          .setPlaceholder("08 Tasks/Tasks")
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

function normalizeTaskPath(value) {
  const normalized = normalizePath(String(value || DEFAULT_SETTINGS.destinationFile)
    .trim()
    .replace(/\.md$/i, ""));
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error("Invalid task destination.");
  }
  return `${normalized}.md`;
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
