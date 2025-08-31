import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Anm2Parser } from './parser/Anm2Parser';

export class Anm2PreviewProvider {
  private static readonly viewType = 'anm2.preview';
  private readonly _panels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public static register(extensionUri: vscode.Uri): vscode.Disposable {
    const provider = new Anm2PreviewProvider(extensionUri);
    const disposables: vscode.Disposable[] = [];

    disposables.push(
      vscode.commands.registerCommand('anm2-viewer.preview', (uri: vscode.Uri) => {
        provider.showPreview(uri);
      })
    );

    disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        const fileName = path.basename(e.document.fileName);
        if (fileName.endsWith('.anm2')) {
          const panel = provider._panels.get(e.document.uri.toString());
          if (panel) {
            provider.updatePreview(panel, e.document.uri);
          }
        }
      })
    );

    return vscode.Disposable.from(...disposables);
  }

  private async showPreview(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath);
    const panelTitle = `ANM2 Preview: ${fileName}`;

    let panel = this._panels.get(uri.toString());
    
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      Anm2PreviewProvider.viewType,
      panelTitle,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
        retainContextWhenHidden: true
      }
    );

    this._panels.set(uri.toString(), panel);

    panel.onDidDispose(() => {
      this._panels.delete(uri.toString());
    });

    await this.updatePreview(panel, uri);
  }

  private async updatePreview(panel: vscode.WebviewPanel, uri: vscode.Uri) {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const anm2Content = document.getText();
      
      const anm2Data = await Anm2Parser.parseFromString(anm2Content);
      const spritesheetData = await this.loadSpritesheets(uri, anm2Data);
      
      panel.webview.html = this.getWebviewContent(panel.webview, anm2Data, spritesheetData, uri);
    } catch (error) {
      panel.webview.html = this.getErrorContent(error instanceof Error ? error.message : 'Unknown error');
    }
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

    return `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ANM2 Preview</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div class="preview-container">
          <div class="controls-panel">
            <div class="animation-controls">
              <select id="animation-select">
                ${anm2Data.animations.map((anim: any) => 
                  `<option value="${anim.name}" ${anim.name === anm2Data.defaultAnimation ? 'selected' : ''}>${anim.name}</option>`
                ).join('')}
              </select>
              <button id="play-btn">재생</button>
              <button id="pause-btn">일시정지</button>
              <button id="stop-btn">정지</button>
            </div>
            
            <div class="frame-controls">
              <label for="frame-slider">프레임: </label>
              <input type="range" id="frame-slider" min="0" max="0" value="0">
              <span id="frame-display">0 / 0</span>
            </div>
            
            <div class="speed-controls">
              <label for="speed-slider">속도: </label>
              <input type="range" id="speed-slider" min="0.1" max="2" step="0.1" value="1">
              <span id="speed-display">1.0x</span>
            </div>
          </div>
          
          <div class="canvas-container">
            <canvas id="preview-canvas"></canvas>
          </div>
          
          <div class="info-panel">
            <h3>애니메이션 정보</h3>
            <div class="info-item">
              <span class="label">FPS:</span>
              <span class="value">${anm2Data.info.fps}</span>
            </div>
            <div class="info-item">
              <span class="label">현재 애니메이션:</span>
              <span class="value" id="current-animation">${anm2Data.defaultAnimation}</span>
            </div>
            <div class="info-item">
              <span class="label">루프:</span>
              <span class="value" id="loop-status">-</span>
            </div>
            <div class="info-item">
              <span class="label">총 프레임:</span>
              <span class="value" id="total-frames">-</span>
            </div>
          </div>
        </div>

        <script>
          window.anm2Data = ${JSON.stringify(anm2Data)};
          window.spritesheetData = ${JSON.stringify(Array.from(spritesheetData.entries()))};
          window.workspaceUri = "${uri.toString()}";
        </script>
        <script src="https://unpkg.com/pixi.js@8.0.0/dist/pixi.min.js"></script>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private getErrorContent(error: string): string {
    return `
      <!DOCTYPE html>
      <html lang="ko">
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
          <h3>ANM2 파일 로드 오류</h3>
          <p>${error}</p>
        </div>
      </body>
      </html>
    `;
  }
}