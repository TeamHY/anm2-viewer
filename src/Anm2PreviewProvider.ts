import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Anm2Parser } from './parser/Anm2Parser';

class Anm2Document implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly anm2Data: any,
    public readonly spritesheetData: Map<number, string>
  ) {}

  dispose(): void {}
}

export class Anm2PreviewProvider implements vscode.CustomReadonlyEditorProvider<Anm2Document> {
  private static readonly viewType = 'anm2.preview';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public static register(extensionUri: vscode.Uri): vscode.Disposable {
    const provider = new Anm2PreviewProvider(extensionUri);
    
    return vscode.window.registerCustomEditorProvider(
      Anm2PreviewProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  async openCustomDocument(uri: vscode.Uri): Promise<Anm2Document> {
    const document = await vscode.workspace.openTextDocument(uri);
    const anm2Content = document.getText();
    
    const anm2Data = await Anm2Parser.parseFromString(anm2Content);
    const spritesheetData = await this.loadSpritesheets(uri, anm2Data);
    
    return new Anm2Document(uri, anm2Data, spritesheetData);
  }

  async resolveCustomEditor(
    document: Anm2Document,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewPanel.webview.html = this.getWebviewContent(
      webviewPanel.webview,
      document.anm2Data,
      document.spritesheetData,
      document.uri
    );
  }


  private async loadSpritesheets(anm2Uri: vscode.Uri, anm2Data: any): Promise<Map<number, string>> {
    const spritesheetData = new Map<number, string>();
    const anm2Dir = path.dirname(anm2Uri.fsPath);

    for (const spritesheet of anm2Data.content.spritesheets) {
      try {
        const spritesheetPath = path.resolve(anm2Dir, spritesheet.path);
        
        if (fs.existsSync(spritesheetPath)) {
          const imageBuffer = fs.readFileSync(spritesheetPath);
          const ext = path.extname(spritesheetPath).toLowerCase();
          let mimeType = 'image/png';
          
          if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
          } else if (ext === '.gif') {
            mimeType = 'image/gif';
          } else if (ext === '.bmp') {
            mimeType = 'image/bmp';
          }

          const base64 = imageBuffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          spritesheetData.set(spritesheet.id, dataUrl);
        } else {
          console.warn(`Spritesheet not found: ${spritesheetPath}`);
        }
      } catch (error) {
        console.error(`Failed to load spritesheet ${spritesheet.path}:`, error);
      }
    }

    return spritesheetData;
  }

  private getWebviewContent(webview: vscode.Webview, anm2Data: any, spritesheetData: Map<number, string>, uri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js')
    );
    
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.css')
    );

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );

    const pixiUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'pixi.js', 'dist', 'pixi.min.js')
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ANM2 Preview</title>
        <link href="${styleUri}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
      </head>
      <body>
        <div class="preview-container">
          <div class="canvas-container">
            <canvas id="preview-canvas"></canvas>
            
            <div class="floating-controls">
              <div class="controls-row">
                <select id="animation-select" class="animation-selector">
                  ${anm2Data.animations.map((anim: any) => 
                    `<option value="${anim.name}" ${anim.name === anm2Data.defaultAnimation ? 'selected' : ''}>${anim.name}</option>`
                  ).join('')}
                </select>
                
                <button id="play-pause-btn" class="play-pause-button" title="Play/Pause">
                  <i class="codicon codicon-play play-icon"></i>
                  <i class="codicon codicon-debug-pause pause-icon" style="display: none;"></i>
                </button>
                
                <input type="text" id="zoom-input" class="zoom-input" value="100%" title="Edit zoom level">
              </div>
              
              <div class="progress-row">
                <span id="frame-display" class="frame-display">0 / 0</span>
                <input type="range" id="frame-slider" class="frame-slider" min="0" max="0" value="0">
              </div>
            </div>
          </div>
        </div>

        <script>
          window.anm2Data = ${JSON.stringify(anm2Data)};
          window.spritesheetData = ${JSON.stringify(Array.from(spritesheetData.entries()))};
          window.workspaceUri = "${uri.toString()}";
        </script>
        <script src="${pixiUri}"></script>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private getErrorContent(error: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ANM2 Preview - Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 15px;
            border-radius: 4px;
          }
          .error h3 {
            margin-top: 0;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h3>ANM2 File Load Error</h3>
          <p>${error}</p>
        </div>
      </body>
      </html>
    `;
  }
}
