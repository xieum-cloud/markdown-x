import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseMarkdown } from '../markdownParser';

export async function exportDocx(document: vscode.TextDocument): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting to Word...',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 20, message: 'Parsing markdown...' });

            const config = vscode.workspace.getConfiguration('markdown-x');
            const content = document.getText();
            const htmlContent = parseMarkdown(content);
            const title = path.basename(document.fileName, path.extname(document.fileName));
            const fontFamily = config.get<string>('fontFamily', '') || 'Malgun Gothic';
            const fontSize = config.get<number>('fontSize', 16);

            // Wrap in full HTML for html-to-docx
            const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family: ${fontFamily}; font-size: ${fontSize}px;">
${htmlContent}
</body>
</html>`;

            progress.report({ increment: 30, message: 'Converting to DOCX...' });

            try {
                // Dynamic import for html-to-docx (ESM/CJS compat)
                const htmlToDocx = require('html-to-docx');

                const docxBuffer = await htmlToDocx(fullHtml, null, {
                    table: { row: { cantSplit: true } },
                    title,
                    margins: {
                        top: 1440,    // 1 inch in twips (1440 twips = 1 inch)
                        right: 1080,  // 0.75 inch
                        bottom: 1440,
                        left: 1080,
                    },
                    font: fontFamily,
                    fontSize: fontSize * 2, // half-points
                });

                progress.report({ increment: 30, message: 'Saving...' });

                const defaultUri = vscode.Uri.file(
                    path.join(path.dirname(document.fileName), `${title}.docx`)
                );
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri,
                    filters: { 'Word Document': ['docx'] },
                });

                if (!saveUri) return;

                fs.writeFileSync(saveUri.fsPath, docxBuffer);

                progress.report({ increment: 20, message: 'Done!' });
                vscode.window.showInformationMessage(`Word exported: ${path.basename(saveUri.fsPath)}`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Word export failed: ${message}`);
            }
        }
    );
}
