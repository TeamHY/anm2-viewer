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
		vscode.commands.registerCommand('anm2-viewer.openPreview', (uri?: vscode.Uri) => {
			if (!uri) {
				// If no URI provided, try to get from active editor
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document.fileName.endsWith('.anm2')) {
					uri = activeEditor.document.uri;
				} else {
					vscode.window.showErrorMessage('ANM2 파일을 먼저 선택하세요.');
					return;
				}
			}
			
			vscode.commands.executeCommand('anm2-viewer.preview', uri);
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
