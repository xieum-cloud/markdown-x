import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { generatePdf } from './pdfGenerator';

const PREVIEW_PATH = path.join(os.tmpdir(), 'markdown-x-preview.pdf');

export async function previewPdf(document: vscode.TextDocument): Promise<void> {
    const title = path.basename(document.fileName, path.extname(document.fileName));

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating page preview...',
            cancellable: false,
        },
        async (progress) => {
            try {
                await generatePdf(document, { outputPath: PREVIEW_PATH, title }, progress);

                progress.report({ increment: 10, message: 'Opening preview...' });

                // Close existing preview tab if open
                const uri = vscode.Uri.file(PREVIEW_PATH);
                for (const tab of vscode.window.tabGroups.all.flatMap(g => g.tabs)) {
                    if (tab.input instanceof vscode.TabInputCustom || tab.input instanceof vscode.TabInputText) {
                        if ((tab.input as any).uri?.fsPath === PREVIEW_PATH) {
                            await vscode.window.tabGroups.close(tab);
                        }
                    }
                }
                await vscode.commands.executeCommand('vscode.open', uri, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: true,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                if (message !== 'No Chromium browser found') {
                    vscode.window.showErrorMessage(`Page preview failed: ${message}`);
                }
            }
        }
    );
}
