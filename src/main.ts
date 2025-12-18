import { App, Modal, Notice, Plugin, TFile } from "obsidian";
import { GeminiPluginSettings, DEFAULT_SETTINGS, GeminiSettingTab } from "./settings";
import { generateFromInlineData } from "./gemini";
import { fileToBase64 } from "./utils";

export default class GeminiFileGeneratorPlugin extends Plugin {
  settings: GeminiPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new GeminiSettingTab(this.app, this));

    this.addCommand({
      id: "gemini-generate-from-file",
      name: "Gemini: Generate note from file",
      callback: () => this.openExecutionFlow()
    });

    console.log("Gemini File Generator loaded");
  }

  onunload() {
    console.log("Gemini File Generator unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async openExecutionFlow() {
    if (!this.settings.presets || this.settings.presets.length === 0) {
      new Notice("No presets configured. Open plugin settings to add one.");
      return;
    }
    // モーダル: プリセット選択 -> ファイル選択
    const modal = new (class extends Modal {
      plugin: GeminiFileGeneratorPlugin;
      constructor(app: App, plugin: GeminiFileGeneratorPlugin) {
        super(app);
        this.plugin = plugin;
        this.open();
      }
      onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: "Select preset and file" });

        const select = contentEl.createEl("select");
        this.plugin.settings.presets.forEach((p, i) => {
          const opt = select.createEl("option");
          opt.value = String(i);
          opt.text = p.name;
        });

        const fileInput = contentEl.createEl("input");
        fileInput.setAttr("type", "file");
        fileInput.setAttr("accept", ".pdf,application/pdf");

        const runBtn = contentEl.createEl("button", { text: "Run" });
        runBtn.onclick = async () => {
          const presetIndex = Number((select as HTMLSelectElement).value);
          const preset = this.plugin.settings.presets[presetIndex];
          const files = (fileInput as HTMLInputElement).files;
          if (!files || files.length === 0) {
            new Notice("No file selected");
            return;
          }
          const file = files[0];
          // validation: apiKey
          if (!this.plugin.settings.apiKey) {
            new Notice("API key not set");
            return;
          }

          new Notice("Generating...");

          try {
            const base64 = await fileToBase64(file);
            const resp = await generateFromInlineData(
              this.plugin.settings.apiKey,
              preset.model,
              preset.prompt,
              file.type || "application/pdf",
              base64,
              this.plugin.settings.retryIntervalSec,
              this.plugin.settings.maxRetryWaitSec
            );

            if (!resp || !resp.text) {
              new Notice("No text returned from Gemini; no note created.");
              return;
            }

            // タイトル決定（拡張子除く）
            const rawName = file.name.replace(/\.[^/.]+$/, "");
            // ensure unique filename
            let candidate = `${rawName}.md`;
            const vault = this.app.vault;
            const targetFolder = preset.outputPath || "";
            // ensure folder exists
            if (targetFolder) {
              try {
                await vault.createFolder(targetFolder);
              } catch (e) {
                // 存在していればエラーになるため無視
                console.log("createFolder:", e);
              }
            }
            // check existence and add (1), (2) ...
            let idx = 0;
            const folderPrefix = targetFolder ? `${targetFolder.replace(/\/$/,'')}/` : "";
            while (await this.app.vault.adapter.exists(folderPrefix + candidate)) {
              idx++;
              candidate = `${rawName} (${idx}).md`;
            }

            const finalPath = folderPrefix + candidate;
            await vault.create(finalPath, resp.text);
            new Notice("Note created: " + finalPath);
          } catch (err: any) {
            console.error("Execution error", err);
            new Notice("Error: " + (err?.message || String(err)));
          } finally {
            this.close();
          }
        };
      }
      onClose() {
        this.contentEl.empty();
      }
    })(this.app, this);
  }
}
