import { App, Plugin } from 'obsidian';
import { DocxToMdConverter } from './src/converter';
import { DocxToMdSettingsTab } from './src/settings';

export default class DocxToMdPlugin extends Plugin {
  converter: DocxToMdConverter;

  async onload() {
    this.converter = new DocxToMdConverter(this.app);

    this.addCommand({
      id: 'convert-docx-to-md',
      name: 'Convert DOCX to Markdown',
      callback: () => this.converter.convertDocxToMd(),
    });

    // Neuer Befehl: Bereinigung der aktuell geöffneten Markdown-Datei
    this.addCommand({
      id: 'clean-current-md-auto-descriptions',
      name: 'Clean Current Markdown from Auto-Generated Descriptions',
      callback: () => this.converter.cleanCurrentMarkdownFromAutoDescriptions(),
    });

    this.addSettingTab(new DocxToMdSettingsTab(this.app, this));
  }
  
  async onunload() {
    // Cleanup, falls nötig
  }
}