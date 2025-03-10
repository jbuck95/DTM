import { App, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

const execPromise = promisify(exec);

interface DocxToMdSettings {
  mediaFolder: string;
  pandocPath: string;
}

const DEFAULT_SETTINGS: DocxToMdSettings = {
  mediaFolder: 'media',
  pandocPath: 'pandoc'
};

export default class DocxToMdPlugin extends Plugin {
  settings: DocxToMdSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'convert-docx-to-md',
      name: 'Convert DOCX to Markdown',
      callback: () => this.convertDocxToMd(),
    });

    this.addSettingTab(new DocxToMdSettingTab(this.app, this));
  }

  async convertDocxToMd() {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const inputFile = await this.requestFile();

    if (!inputFile) {
      new Notice('Keine Datei ausgewählt.');
      return;
    }

    if (!inputFile.endsWith('.docx')) {
      new Notice('Bitte wähle eine .docx-Datei aus.');
      return;
    }

    const baseFileName = path.basename(inputFile, '.docx');
    const outputFileName = `${baseFileName}.md`;
    const outputPath = path.join(vaultPath, outputFileName);
    const mediaFolderPath = path.join(vaultPath, this.settings.mediaFolder);

    // Stelle sicher, dass der Media-Ordner existiert
    if (!existsSync(mediaFolderPath)) {
      mkdirSync(mediaFolderPath, { recursive: true });
    }

    const pandocCommand = `${this.settings.pandocPath} "${inputFile}" -o "${outputPath}" --wrap=none --markdown-headings=atx --reference-links --strip-comments --extract-media="${mediaFolderPath}"`;

    try {
      await execPromise(pandocCommand);

      // Überprüfe, ob Bilder extrahiert wurden, und füge sie manuell hinzu
      const mediaFiles = readdirSync(mediaFolderPath).filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
      let updatedContent = await readFile(outputPath, 'utf-8');

      // Entferne automatische Beschreibungen wie "[Ein Bild, das ...]"
      updatedContent = updatedContent.replace(/!\[Ein Bild, das[^]]*Automatisch generierte Beschreibung\]\s*(\(width="[^"]*"\s*height="[^"]*"\))?/g, '');

      if (mediaFiles.length > 0) {
        mediaFiles.forEach(mediaFile => {
          const relativeMediaPath = path.join(this.settings.mediaFolder, mediaFile).replace(/\\/g, '/');
          const imageMarkdown = `\n![Bild](${relativeMediaPath})\n`; // Einfacher Alt-Text wie "Bild"
          updatedContent += imageMarkdown; // Füge am Ende der Datei hinzu
        });

        await writeFile(outputPath, updatedContent, 'utf-8');
        new Notice(`Erfolgreich konvertiert: ${outputFileName} (Bilder hinzugefügt)`);
      } else {
        await writeFile(outputPath, updatedContent, 'utf-8'); // Schreibe auch ohne Bilder, um Beschreibungen zu entfernen
        new Notice(`Erfolgreich konvertiert: ${outputFileName} (keine Bilder gefunden)`);
      }
    } catch (error) {
      new Notice(`Fehler bei der Konvertierung: ${error.message}`);
      console.error(error);
    }
  }

  async requestFile(): Promise<string | null> {
    const filePaths = await (window as any).electron.remote.dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    });

    if (filePaths.canceled || !filePaths.filePaths.length) {
      return null;
    }

    return filePaths.filePaths[0];
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class DocxToMdSettingTab extends PluginSettingTab {
  plugin: DocxToMdPlugin;

  constructor(app: App, plugin: DocxToMdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Media Folder')
      .setDesc('Ordner, in den extrahierte Medien gespeichert werden (relativ zum Vault-Root).')
      .addText(text => text
        .setPlaceholder('media')
        .setValue(this.plugin.settings.mediaFolder)
        .onChange(async (value) => {
          this.plugin.settings.mediaFolder = value || DEFAULT_SETTINGS.mediaFolder;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Pandoc Path')
      .setDesc('Absoluter Pfad zu Pandoc, falls nicht im PATH (Standard: "pandoc").')
      .addText(text => text
        .setPlaceholder('pandoc')
        .setValue(this.plugin.settings.pandocPath)
        .onChange(async (value) => {
          this.plugin.settings.pandocPath = value || DEFAULT_SETTINGS.pandocPath;
          await this.plugin.saveSettings();
        }));
  }
}