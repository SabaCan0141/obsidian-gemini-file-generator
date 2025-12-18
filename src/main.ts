import { App, Notice, Plugin, SuggestModal } from "obsidian";
import { DEFAULT_SETTINGS, GeminiPluginSettings, GeminiPreset, GeminiSettingTab } from "./settings";
import { generateFromInlineData } from "./gemini";

/* ================================
 * Preset Select Modal
 * ================================ */

class PresetSelectModal extends SuggestModal<GeminiPreset> {
  plugin: GeminiFileGeneratorPlugin;

  constructor(app: App, plugin: GeminiFileGeneratorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  getSuggestions(query: string): GeminiPreset[] {
    return this.plugin.settings.presets.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  renderSuggestion(preset: GeminiPreset, el: HTMLElement) {
    el.createEl("div", { text: preset.name });
    el.createEl("small", {
      text: `Model: ${preset.model} • Output: ${preset.outputPath || "(root)"}`
    });
  }

  async onChooseSuggestion(preset: GeminiPreset) {
    try {
      await this.plugin.runWithPreset(preset);
    } catch (err: any) {
      console.error(err);
      new Notice(err?.message || "Execution failed");
    }
  }
}

/* ================================
 * Plugin
 * ================================ */

export default class GeminiFileGeneratorPlugin extends Plugin {
  settings: GeminiPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new GeminiSettingTab(this.app, this));

    this.addCommand({
      id: "create-note-from-file",
      name: "Create note from file",
      callback: () => {
        if (this.settings.presets.length === 0) {
          new Notice("No presets configured");
          return;
        }
        new PresetSelectModal(this.app, this).open();
      }
    });
  }

  /* ================================
   * Main Execution Flow
   * ================================ */

  async runWithPreset(preset: GeminiPreset) {
    // 1. File picker (Returns standard File object, not TFile)
    const file = await this.pickFile();
    if (!file) return;

    const notice = new Notice("Generating note...", 0);

    try {
      // Convert File to Base64 directly without saving to vault
      const base64 = await this.fileToBase64(file);

      const result = await generateFromInlineData(
        this.settings.apiKey,
        preset.model,
        preset.prompt,
        file.type || "application/pdf",
        base64,
        this.settings.retryIntervalSec,
        this.settings.maxRetryWaitSec
      );

      if (!result.text || result.text.trim() === "") {
        new Notice("No content generated");
        return;
      }

      // Remove extension for the note name
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      
      await this.createNote(
        preset.outputPath,
        baseName,
        result.text
      );

      new Notice("Note created: " + baseName);

    } finally {
      notice.hide();
    }
  }

  /* ================================
   * File Picker
   * ================================ */

  async pickFile(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file";
      // Accept typical document formats
      input.accept = ".pdf,application/pdf,text/*,image/*"; 
      input.style.display = "none";

      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file || null);
      };

      input.oncancel = () => {
        resolve(null);
      }

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }

  /* ================================
   * Helpers
   * ================================ */

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove "data:*/*;base64," prefix
        const base64 = result.substring(result.indexOf(",") + 1);
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /* ================================
   * Note Creation
   * ================================ */

  async createNote(
    folder: string,
    baseName: string,
    content: string
  ) {
    const dir = folder?.trim() || "";
    if (dir) {
      try {
        await this.app.vault.createFolder(dir);
      } catch (e) {
        // Folder already exists or invalid
      }
    }

    let path = dir ? `${dir}/${baseName}.md` : `${baseName}.md`;
    // Clean up path double slashes if any
    path = path.replace("//", "/");

    let counter = 1;
    while (await this.app.vault.adapter.exists(path)) {
      path = dir
        ? `${dir}/${baseName} (${counter}).md`
        : `${baseName} (${counter}).md`;
      path = path.replace("//", "/");
      counter++;
    }

    await this.app.vault.create(path, content);
  }

  /* ================================
   * Settings
   * ================================ */

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
