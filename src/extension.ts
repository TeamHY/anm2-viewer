import * as vscode from 'vscode';
import { Anm2PreviewProvider } from './Anm2PreviewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('ANM2 Viewer extension is now active!');

	// Register the preview provider
	context.subscriptions.push(
		Anm2PreviewProvider.register(context.extensionUri)
	);

	// Register file association commands
	context.subscriptions.push(
		vscode.commands.registerCommand('anm2-viewer.openPreview', async (uri?: vscode.Uri) => {
			if (!uri) {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document.fileName.endsWith('.anm2')) {
					uri = activeEditor.document.uri;
				} else {
					vscode.window.showErrorMessage('Please select an ANM2 file first.');
					return;
				}
			}
			
			// Check if preview is already open
			const existingTab = vscode.window.tabGroups.all
				.flatMap(group => group.tabs)
				.find(tab => 
					tab.input instanceof vscode.TabInputCustom && 
					tab.input.viewType === 'anm2.preview' &&
					tab.input.uri.toString() === uri!.toString()
				);
			
			if (existingTab && existingTab.input instanceof vscode.TabInputCustom) {
				// Focus existing preview tab
				await vscode.commands.executeCommand('vscode.openWith', existingTab.input.uri, 'anm2.preview', existingTab.group.viewColumn);
			} else {
				await vscode.commands.executeCommand('vscode.openWith', uri, 'anm2.preview', vscode.ViewColumn.Beside);
			}
		})
	);

	// Register text editor command
	context.subscriptions.push(
		vscode.commands.registerCommand('anm2-viewer.openAsText', async (uri?: vscode.Uri) => {
			if (!uri) {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document.fileName.endsWith('.anm2')) {
					uri = activeEditor.document.uri;
				} else {
					vscode.window.showErrorMessage('Please select an ANM2 file first.');
					return;
				}
			}
			
			// Check if text editor is already open
			const existingTab = vscode.window.tabGroups.all
				.flatMap(group => group.tabs)
				.find(tab => 
					tab.input instanceof vscode.TabInputText &&
					tab.input.uri.toString() === uri!.toString()
				);
			
			if (existingTab && existingTab.input instanceof vscode.TabInputText) {
				// Focus existing text tab
				await vscode.window.showTextDocument(existingTab.input.uri, { viewColumn: existingTab.group.viewColumn });
			} else {
				await vscode.commands.executeCommand('vscode.openWith', uri, 'default', vscode.ViewColumn.Beside);
			}
		})
	);

	// Legacy command for backwards compatibility
	const disposable = vscode.commands.registerCommand('anm2-viewer.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from anm2-viewer!');
	});
	
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
