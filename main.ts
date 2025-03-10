import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView, ViewUpdate } from '@codemirror/view';

interface SlashCommandsPluginSettings {
	codeBlockLanguage: string;
	latexCommands: string[];
}

const DEFAULT_SETTINGS: SlashCommandsPluginSettings = {
	codeBlockLanguage: 'javascript',
	latexCommands: [
		'\\newline',
		'\\pagebreak',
		'\\textbf{}',
		'\\textit{}',
		'\\underline{}',
		'\\begin{equation}\\end{equation}',
		'\\begin{align}\\end{align}',
		'\\frac{}{}',
		'\\sum_{}^{}',
		'\\int_{}^{}'
	]
}

export default class SlashCommandsPlugin extends Plugin {
	settings: SlashCommandsPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register the slash command handler
		this.registerEditorExtension([
			this.createSlashCommandExtension()
		]);

		// Add settings tab
		this.addSettingTab(new SlashCommandsSettingTab(this.app, this));
	}
	createSlashCommandExtension() {
		// This is a simplified implementation using proper CodeMirror extension
		return EditorView.updateListener.of((update: ViewUpdate) => {
			if (!update.docChanged) return;
			
			const changes = update.changes;
			const editor = this.app.workspace.activeEditor?.editor;
			if (!editor) return;
			handleKey: (key: string, editor: Editor) => {
				// Check if the key is a space and the last word is a slash command
				if (key === ' ') {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);
					const beforeCursor = line.substring(0, cursor.ch - 1);
					
					if (beforeCursor.endsWith('/code')) {
						// Replace "/code " with a code block
						const codeBlock = '```' + this.settings.codeBlockLanguage + '\n\n```';
						editor.replaceRange(
							codeBlock, 
							{ line: cursor.line, ch: cursor.ch - 6 }, // 6 chars = "/code "
							{ line: cursor.line, ch: cursor.ch }
						);
						
						// Position cursor inside the code block
						editor.setCursor({ 
							line: cursor.line + 1, 
							ch: 0 
						});
						
						return true; // Handled
					}
					
					if (beforeCursor.endsWith('/latex')) {
						// Show the LaTeX command suggestions
						this.showLatexCommandSuggestions(editor, cursor);
						return true; // Handled
					}
				}
				
				return false; // Not handled
			}
		});
	}
	
	showLatexCommandSuggestions(editor: Editor, cursor: any) {
		// Create and show modal with LaTeX commands
		const modal = new LatexCommandsModal(this.app, this.settings.latexCommands, (command: string) => {
			// Replace "/latex " with the selected LaTeX command
			editor.replaceRange(
				command, 
				{ line: cursor.line, ch: cursor.ch - 7 }, // 7 chars = "/latex "
				{ line: cursor.line, ch: cursor.ch }
			);
			
			// If the command has braces, position cursor inside first brace
			const cursorOffset = command.indexOf('{}');
			if (cursorOffset !== -1) {
				editor.setCursor({ 
					line: cursor.line, 
					ch: cursor.ch - 7 + cursorOffset + 1 
				});
			}
		});
		
		modal.open();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class LatexCommandsModal extends Modal {
	commands: string[];
	onChoose: (command: string) => void;

	constructor(app: App, commands: string[], onChoose: (command: string) => void) {
		super(app);
		this.commands = commands;
		this.onChoose = onChoose;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: 'LaTeX Commands' });
		
		const commandsContainer = contentEl.createDiv('latex-commands-container');
		
		for (const command of this.commands) {
			const commandEl = commandsContainer.createDiv('latex-command-item');
			commandEl.setText(command);
			commandEl.addEventListener('click', () => {
				this.onChoose(command);
				this.close();
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SlashCommandsSettingTab extends PluginSettingTab {
	plugin: SlashCommandsPlugin;

	constructor(app: App, plugin: SlashCommandsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Slash Commands Settings' });

		new Setting(containerEl)
			.setName('Default Code Block Language')
			.setDesc('The programming language to use for code blocks by default')
			.addText(text => text
				.setValue(this.plugin.settings.codeBlockLanguage)
				.onChange(async (value) => {
					this.plugin.settings.codeBlockLanguage = value;
					await this.plugin.saveSettings();
				}));
		
		containerEl.createEl('h3', { text: 'LaTeX Commands' });
		containerEl.createEl('p', { text: 'Add or remove LaTeX commands that appear in the suggestion list' });
		
		const latexCommandsContainer = containerEl.createDiv('latex-commands-settings');
		
		// Add existing commands
		this.plugin.settings.latexCommands.forEach((command, index) => {
			this.addLatexCommandSetting(latexCommandsContainer, command, index);
		});
		
		// Add button to add new command
		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Add LaTeX Command')
				.onClick(() => {
					this.plugin.settings.latexCommands.push('\\newcommand');
					this.plugin.saveSettings();
					this.display(); // Refresh the settings tab
				}));
	}
	
	addLatexCommandSetting(containerEl: HTMLElement, command: string, index: number): void {
		new Setting(containerEl)
			.addText(text => text
				.setValue(command)
				.onChange(async (value) => {
					this.plugin.settings.latexCommands[index] = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Remove')
				.onClick(async () => {
					this.plugin.settings.latexCommands.splice(index, 1);
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings tab
				}));
	}
}