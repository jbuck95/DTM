import { App, Notice, FileSystemAdapter, Plugin } from 'obsidian';
import { readFile, writeFile } from 'fs/promises';
import { readdirSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { DocxToMdSettings, DEFAULT_SETTINGS } from './settings';

export class FileHandler {
  app: App;

  constructor(app: App) {
    this.app = app;
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

  loadSettings(): DocxToMdSettings {
    return Object.assign({}, DEFAULT_SETTINGS, (this.app as any).plugins.getPlugin('obsidian-docx-to-md')?.loadData() || {});
  }

  async saveSettings(settings: DocxToMdSettings) {
    await (this.app as any).plugins.getPlugin('obsidian-docx-to-md')?.saveData(settings);
  }
  async readFile(filePath: string): Promise<string> {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        throw new Error(`Error reading file: ${error.message}`);
    }
}

async writeFile(filePath: string, content: string): Promise<void> {
    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
    } catch (error) {
        throw new Error(`Error writing file: ${error.message}`);
    }
}

}