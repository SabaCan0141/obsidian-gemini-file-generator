import { App, PluginSettingTab, Setting, Modal, Notice } from "obsidian";


export interface GeminiPreset {
  name: string;
  model: string;
  prompt: string;
  outputPath: string;
}

export interface GeminiPluginSettings {
  apiKey: string;
  presets: GeminiPreset[];

  retryIntervalSec: number;   // 再試行間隔（秒）
  maxRetryWaitSec: number;    // 最大待機時間（秒）
}

export const DEFAULT_SETTINGS: GeminiPluginSettings = {
  apiKey: "",
  presets: [],
  retryIntervalSec: 5,
  maxRetryWaitSec: 60
};

export class GeminiSettingTab extends PluginSettingTab {
  plugin: any;
  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Gemini File Generator - Settings" });

    new Setting(containerEl)
      .setName("Gemini API Key")
      .setDesc("API key for Gemini (stored as plain text in plugin settings).")
      .addText(text => text
        .setPlaceholder("Enter API key")
        .setValue(this.plugin.settings.apiKey || "")
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "Presets" });
    const presetsDiv = containerEl.createDiv();
    const refreshPresets = () => {
      presetsDiv.empty();
      this.plugin.settings.presets.forEach((p: any, i: number) => {
        const row = presetsDiv.createDiv({ cls: "setting-item" });
        row.createEl("strong", { text: p.name });
        row.createEl("div", { text: `Model: ${p.model} • Output: ${p.outputPath}`});
        const btns = row.createDiv({ cls: "setting-buttons" });
        const edit = btns.createEl("button", { text: "Edit" });
        const del = btns.createEl("button", { text: "Delete" });
        edit.onclick = () => { this.openEditModal(i); };
        del.onclick = async () => {
          this.plugin.settings.presets.splice(i, 1);
          await this.plugin.saveSettings();
          refreshPresets();
        };
      });
      const addBtn = containerEl.createEl("button", { text: "Add preset" });
      addBtn.onclick = () => this.openCreateModal();
    };
    refreshPresets();

    new Setting(containerEl)
      .setName("Retry interval (seconds)")
      .setDesc("Interval between retries when Gemini API is overloaded.")
      .addText(text =>
        text
          .setValue(String(this.plugin.settings.retryIntervalSec))
          .onChange(async value => {
            const v = Number(value);
            if (!Number.isNaN(v) && v > 0) {
              this.plugin.settings.retryIntervalSec = v;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Max retry wait time (seconds)")
      .setDesc("Maximum total wait time before giving up.")
      .addText(text =>
        text
          .setValue(String(this.plugin.settings.maxRetryWaitSec))
          .onChange(async value => {
            const v = Number(value);
            if (!Number.isNaN(v) && v > 0) {
              this.plugin.settings.maxRetryWaitSec = v;
              await this.plugin.saveSettings();
            }
          })
      );

  }

  openCreateModal() {
    this.openPresetModal(null);
  }

  openEditModal(index: number) {
    this.openPresetModal(index);
  }

  openPresetModal(index: number | null) {
    const preset =
      index === null
        ? { name: "", model: "", prompt: "", outputPath: "" }
        : { ...this.plugin.settings.presets[index] };

    const plugin = this.plugin;
    const tab = this;

    class PresetModal extends Modal {
      idx: number | null;
      preset: any;

      constructor(app: App, idx: number | null, preset: any) {
        super(app);
        this.idx = idx;
        this.preset = preset;
      }

      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", {
          text: this.idx === null ? "Create preset" : "Edit preset",
        });

        const nameInput = contentEl.createEl("input");
        nameInput.placeholder = "Preset name";
        nameInput.value = this.preset.name ?? "";

        const modelInput = contentEl.createEl("input");
        modelInput.placeholder = "Model name";
        modelInput.value = this.preset.model ?? "";

        const promptInput = contentEl.createEl("textarea");
        promptInput.placeholder = "Prompt";
        promptInput.value = this.preset.prompt ?? "";
        promptInput.style.width = "100%";
        promptInput.style.height = "120px";

        const outputInput = contentEl.createEl("input");
        outputInput.placeholder = "Output path";
        outputInput.value = this.preset.outputPath ?? "";

        const saveBtn = contentEl.createEl("button", { text: "Save" });
        saveBtn.onclick = async () => {
          const newPreset = {
            name: nameInput.value.trim(),
            model: modelInput.value.trim(),
            prompt: promptInput.value,
            outputPath: outputInput.value.trim(),
          };

          if (!newPreset.name) {
            new Notice("Preset name is required");
            return;
          }

          if (this.idx === null) {
            plugin.settings.presets.push(newPreset);
          } else {
            plugin.settings.presets[this.idx] = newPreset;
          }

          await plugin.saveSettings();
          this.close();
          tab.display();
        };
      }

      onClose() {
        this.contentEl.empty();
      }
    }

    new PresetModal(this.app, index, preset).open();
  }
}
