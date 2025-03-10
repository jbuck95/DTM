import { App, Plugin, PluginSettingTab, Setting, TFile, SuggestModal, FileSystemAdapter } from 'obsidian';
import { exec } from 'child_process';

interface PandocConverterSettings {
    mediaFolder: string;
}

const DEFAULT_SETTINGS: PandocConverterSettings = {
    mediaFolder: 'media'
};

export default class PandocConverterPlugin extends Plugin {
    settings: PandocConverterSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('file-input', 'Convert DOCX to Markdown', async () => {
            await this.convertDocxToMd();
        });

        this.addSettingTab(new PandocConverterSettingTab(this.app, this));
    }

    async convertDocxToMd() {
        const inputFile = await this.promptForDocxFile();
        if (!inputFile) return;

        const adapter = this.app.vault.adapter;
        let inputFilePath = inputFile.path;

        if (adapter instanceof FileSystemAdapter) {
            inputFilePath = adapter.getFullPath(inputFile.path);
        }

        const outputFileName = inputFile.name.replace('.docx', '.md');
        const basePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : '';
        const outputFilePath = `${basePath}/${outputFileName}`;
        const mediaPath = `${basePath}/${this.settings.mediaFolder}`.replace(/(["\s'$`\\])/g, '\\$1');

        const command = `pandoc "${inputFilePath}" -o "${outputFilePath}" -f docx+styles -t markdown --wrap=none --markdown-headings=atx --reference-links --strip-comments --extract-media="${mediaPath}"`;

        exec(command, async (error, _stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                alert('Conversion failed. Check the console for details.');
                return;
            }
            if (stderr) {
                console.error(`Pandoc stderr: ${stderr}`);
            }
            console.log(`Conversion successful: ${outputFilePath}`);
            const baseFileName = inputFile.name.replace('.docx', '');
            await this.updateMarkdownImageLinks(outputFilePath, baseFileName);
            alert('Conversion completed successfully!');
        });
    }

    async updateMarkdownImageLinks(mdFilePath: string, baseFileName: string) {
        const file = this.app.vault.getAbstractFileByPath(mdFilePath);
        if (!(file instanceof TFile)) return;
    
        let content = await this.app.vault.read(file);
        const adapter = this.app.vault.adapter;
        
        // Alle Bilder im Medienordner finden
        const mediaFolderPath = `${this.settings.mediaFolder}/${baseFileName}-images/media`;
        let imageFiles: string[] = [];
        
        if (adapter instanceof FileSystemAdapter) {
            try {
                // Obsidian API gibt ein Objekt mit files und folders zurück
                const result = await adapter.list(mediaFolderPath);
                // Jetzt extrahieren wir nur die Dateien und filtern nach Bildern
                imageFiles = result.files.filter((file: string) => 
                    file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
            } catch (e) {
                console.error("Couldn't read media folder:", e);
            }
        }
        
        // Zähler für gefundene Bildverweise
        let imageCounter = 0;
        
        // Die automatisch generierten Beschreibungen ersetzen
        content = content.replace(/!\[Ein Bild, das .*?Automatisch generierte Beschreibung\]/g, () => {
            if (imageCounter < imageFiles.length) {
                const imageName = imageFiles[imageCounter];
                // Extrahiere nur den Dateinamen ohne Pfad
                const imageFileName = imageName.split('/').pop() || imageName;
                const extension = imageFileName.substring(imageFileName.lastIndexOf('.'));
                const newImageName = `${baseFileName}-img${imageCounter+1}${extension}`;
                imageCounter++;
                return `![${newImageName}](${mediaFolderPath}/${imageFileName})`;
            }
            return "![Bild nicht gefunden]()";
        });
        
        await this.app.vault.modify(file, content);
    }

    async promptForDocxFile(): Promise<TFile | null> {
        const docxFiles = this.app.vault.getFiles().filter(file => file.extension === 'docx');
        if (docxFiles.length === 0) {
            alert('No DOCX files found in your vault.');
            return null;
        }

        return new Promise((resolve) => {
            class FileSuggestModal extends SuggestModal<TFile> {
                getSuggestions(query: string): TFile[] {
                    return docxFiles.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));
                }

                renderSuggestion(file: TFile, el: HTMLElement) {
                    el.setText(file.name);
                }

                onChooseSuggestion(file: TFile) {
                    resolve(file);
                }
            }

            const modal = new FileSuggestModal(this.app);
            modal.open();
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class PandocConverterSettingTab extends PluginSettingTab {
    plugin: PandocConverterPlugin;

    constructor(app: App, plugin: PandocConverterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Media folder')
            .setDesc('Folder where extracted images will be saved (relative to the vault). Example: media')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.mediaFolder)
                .onChange(async (value) => {
                    this.plugin.settings.mediaFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
