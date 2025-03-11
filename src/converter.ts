import { App, Notice, FileSystemAdapter } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { FileHandler } from './fileHandler';
import { DocxToMdSettings } from './settings';

const execPromise = promisify(exec);

export class DocxToMdConverter {
  app: App;
  settings: DocxToMdSettings;
  fileHandler: FileHandler;

  constructor(app: App) {
    this.app = app;
    this.fileHandler = new FileHandler(app);
    this.settings = this.fileHandler.loadSettings();
  }

  async convertDocxToMd() {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const inputFile = await this.fileHandler.requestFile();

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

    if (!existsSync(mediaFolderPath)) {
      mkdirSync(mediaFolderPath, { recursive: true });
    }

    const pandocCommand = `${this.settings.pandocPath} "${inputFile}" -o "${outputPath}" --wrap=none --markdown-headings=atx --reference-links --strip-comments --extract-media="${mediaFolderPath}"`;

    try {
      await execPromise(pandocCommand);
      new Notice(`Erfolgreich konvertiert: ${outputFileName}`);
    } catch (error) {
      new Notice(`Fehler bei der Konvertierung: ${error.message}`);
      console.error(error);
    }
  }

  async cleanCurrentMarkdownFromAutoDescriptions() {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      new Notice('Keine Datei geöffnet.');
      return;
    }

    if (activeFile.extension !== 'md') {
      new Notice('Die geöffnete Datei ist keine Markdown-Datei.');
      return;
    }

    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const mdFilePath = path.join(vaultPath, activeFile.path);

    try {
      let mdContent = await this.fileHandler.readFile(mdFilePath);

      // Regulärer Ausdruck, der die Beschreibung und den Pfad matcht
      const regex = /\[([^\]]*Automatisch generierte Beschreibung)\]:\s*([^\s]+)\s*({width="[^"]*"\s*height="[^"]*"})/g;

      // Ersetze die Beschreibung durch einen korrekten Markdown-Bild-Link
      const cleanedContent = mdContent.replace(regex, (match, description, absolutePath, sizeAttributes) => {
        // Konvertiere den absoluten Pfad in einen relativen Pfad (relativ zum Vault-Root)
        const relativePath = path.relative(vaultPath, absolutePath).replace(/\\/g, '/');
        // Erstelle den Markdown-Bild-Link
        return `![Bild](${relativePath})`;
      });

      await this.fileHandler.writeFile(mdFilePath, cleanedContent);

      new Notice(`Aktuelle Markdown-Datei erfolgreich bereinigt und Bilder eingebunden: ${activeFile.name}`);
    } catch (error) {
      new Notice(`Fehler beim Bereinigen der aktuellen Markdown-Datei: ${error.message}`);
      console.error(error);
    }
  }
}

// Typo in existsSync und mkdirSync korrigieren (falls nötig)
import { existsSync, mkdirSync } from 'fs';