import { App, PluginSettingTab, Setting } from 'obsidian';
import DocxToMdPlugin from '../main';
import { FileHandler } from './fileHandler';

export interface DocxToMdSettings {
  mediaFolder: string;
  pandocPath: string;
}

export const DEFAULT_SETTINGS: DocxToMdSettings = {
  mediaFolder: 'media',
  pandocPath: 'pandoc'
};

export class DocxToMdSettingsTab extends PluginSettingTab {
  plugin: DocxToMdPlugin;
  fileHandler: FileHandler;

  constructor(app: App, plugin: DocxToMdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.fileHandler = new FileHandler(app);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const settings = this.fileHandler.loadSettings();

    new Setting(containerEl)
      .setName('Media Folder')
      .setDesc('Ordner, in den extrahierte Medien gespeichert werden (relativ zum Vault-Root).')
      .addText(text => text
        .setPlaceholder('media')
        .setValue(settings.mediaFolder)
        .onChange(async (value) => {
          settings.mediaFolder = value || DEFAULT_SETTINGS.mediaFolder;
          await this.fileHandler.saveSettings(settings);
        }));

    new Setting(containerEl)
      .setName('Pandoc Path')
      .setDesc('Absoluter Pfad zu Pandoc, falls nicht im PATH (Standard: "pandoc").')
      .addText(text => text
        .setPlaceholder('pandoc')
        .setValue(settings.pandocPath)
        .onChange(async (value) => {
          settings.pandocPath = value || DEFAULT_SETTINGS.pandocPath;
          await this.fileHandler.saveSettings(settings);
        }));
  }
}