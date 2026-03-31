import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseMarkdown } from '../markdownParser';
import { getExportHtml } from './printStyles';

/**
 * Print by opening a temporary HTML file in the system browser,
 * which auto-triggers window.print().
 */
export async function printDocument(document: vscode.TextDocument): Promise<void> {
    const config = vscode.workspace.getConfiguration('markdown-x');
    const content = document.getText();
    const htmlContent = parseMarkdown(content);
    const title = path.basename(document.fileName, path.extname(document.fileName));

    const exportHtml = getExportHtml(htmlContent, {
        title,
        fontSize: config.get<number>('fontSize', 16),
        lineHeight: config.get<number>('lineHeight', 1.6),
        fontFamily: config.get<string>('fontFamily', ''),
        codeFontFamily: config.get<string>('codeFontFamily', ''),
        pageSize: config.get<string>('pdf.pageSize', 'A4'),
        margin: config.get<string>('pdf.margin', '20mm'),
        customCss: config.get<string>('customCss', ''),
    });

    // Add auto-print script
    const printHtml = exportHtml.replace(
        '</body>',
        `<script>
            window.addEventListener('load', () => {
                // Wait for Mermaid/KaTeX to render
                setTimeout(() => { window.print(); }, 1500);
            });
        </script>\n</body>`
    );

    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `markdown-x-print-${Date.now()}.html`);
    fs.writeFileSync(tmpPath, printHtml, 'utf-8');

    await vscode.env.openExternal(vscode.Uri.file(tmpPath));
}
