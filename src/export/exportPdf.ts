import * as vscode from 'vscode';
import * as path from 'path';
import { generatePdf } from './pdfGenerator';

export async function exportPdf(document: vscode.TextDocument): Promise<void> {
    const title = path.basename(document.fileName, path.extname(document.fileName));
    const defaultUri = vscode.Uri.file(
        path.join(path.dirname(document.fileName), `${title}.pdf`)
    );
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'PDF': ['pdf'] },
    });
    if (!saveUri) return;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting to PDF...',
            cancellable: false,
        },
        async (progress) => {
            try {
                await generatePdf(document, { outputPath: saveUri.fsPath, title }, progress);
                progress.report({ increment: 10, message: 'Done!' });
                vscode.window.showInformationMessage(`PDF exported: ${path.basename(saveUri.fsPath)}`);
                vscode.env.openExternal(vscode.Uri.file(saveUri.fsPath));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                if (message !== 'No Chromium browser found') {
                    vscode.window.showErrorMessage(`PDF export failed: ${message}`);
                }
            }
        }
    );
}
