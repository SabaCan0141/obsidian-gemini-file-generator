import { App, PluginSettingTab, Setting } from "obsidian";
import GeminiFileGeneratorPlugin from "./main";

/* ===== define ===== */

export interface GeminiPreset {
  name: string;
  model: string;
  prompt: string;
  outputPath: string;
}

export interface GeminiPluginSettings {
  apiKey: string;
  presets: GeminiPreset[];
  retryIntervalSec: number;
  maxRetryWaitSec: number;
}

export const DEFAULT_SETTINGS: GeminiPluginSettings = {
  apiKey: "",
  presets: [],
  retryIntervalSec: 5,
  maxRetryWaitSec: 60
};

const MODEL_OPTIONS: Record<string, string> = {
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview"
};

/* ===== Setting Tab ===== */

export class GeminiSettingTab extends PluginSettingTab {
  plugin: GeminiFileGeneratorPlugin;

  constructor(app: App, plugin: GeminiFileGeneratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Gemini File Generator - Settings" });

    /* ===== API Key ===== */

    new Setting(containerEl)
      .setName("Gemini API Key")
      .setDesc("API key for Gemini (stored as plain text in plugin settings).")
      .addText(text =>
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async value => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    /* ===== Retry Settings ===== */

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

    /* ===== Presets ===== */

    new Setting(containerEl)
      .setName("Presets");

    const presetContainer = containerEl.createDiv();
    this.renderPresetList(presetContainer);

  }

  /* ===== Preset List ===== */

private renderPresetList(containerEl: HTMLElement) {
  this.plugin.settings.presets.forEach((preset, index) => {
    const card = containerEl.createDiv("gemini-preset-card");

    new Setting(card)
      .setName(preset.name || "(Unnamed preset)")
      .setDesc(
        `Model: ${preset.model}\nOutput folder: ${preset.outputPath || "(root)"}`
      )
      .addButton(btn =>
        btn.setButtonText("Edit").onClick(() => {
          this.openPresetEditor(index);
        })
      )
      .addButton(btn =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.presets.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
  });

  // Add preset
  const addWrapper = containerEl.createDiv();
  addWrapper.style.marginTop = "8px";

  new Setting(addWrapper).addButton(btn =>
    btn
      .setButtonText("Add preset")
      .setCta()
      .onClick(() => this.openPresetEditor())
  );
}


  /* ===== Preset Editor ===== */

  private openPresetEditor(index?: number) {
    const isEdit = index !== undefined;

    const preset: GeminiPreset = isEdit
      ? { ...this.plugin.settings.presets[index!] }
      : {
          name: "",
          model: "gemini-2.5-flash",
          prompt: "",
          outputPath: ""
        };

    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", {
      text: isEdit ? "Edit preset" : "Create preset"
    });

    new Setting(containerEl)
      .setName("Preset name")
      .addText(text =>
        text.setValue(preset.name).onChange(v => (preset.name = v))
      );

    new Setting(containerEl)
      .setName("Model")
      .addDropdown(dropdown => {
        dropdown.addOptions(MODEL_OPTIONS);
        dropdown.setValue(preset.model);
        dropdown.onChange(v => (preset.model = v));
      });

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Vault-relative path")
      .addText(text =>
        text
          .setPlaceholder("e.g. Papers/Translated")
          .setValue(preset.outputPath)
          .onChange(v => (preset.outputPath = v))
      );

    new Setting(containerEl)
      .setName("Prompt")
      .addTextArea(area => {
        area.setValue(preset.prompt).onChange(v => (preset.prompt = v));
        area.inputEl.rows = 10;
        area.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            if (isEdit) {
              this.plugin.settings.presets[index!] = preset;
            } else {
              this.plugin.settings.presets.push(preset);
            }
            await this.plugin.saveSettings();
            this.display();
          })
      )
      .addButton(btn =>
        btn.setButtonText("Cancel").onClick(() => this.display())
      );
  }
}
