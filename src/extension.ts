import * as vscode from 'vscode';
import { MarkdownPreviewProvider } from './previewProvider';
import { exportPdf } from './export/exportPdf';
import { exportDocx } from './export/exportDocx';
import { printDocument } from './export/printDocument';
import { MarkdownOutlineProvider } from './outlineProvider';

let previewProvider: MarkdownPreviewProvider;

export function activate(context: vscode.ExtensionContext) {
    previewProvider = new MarkdownPreviewProvider(context.extensionUri);

    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('markdown-x-preview', previewProvider)
    );

    // Register outline (document symbol) provider
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'markdown' },
            new MarkdownOutlineProvider(),
            { label: 'Markdown X' }
        )
    );

    // Open Preview (always opens to the side)
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.openPreview', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Markdown X: No active editor found');
                return;
            }
            if (editor.document.languageId !== 'markdown') {
                vscode.window.showWarningMessage(
                    `Markdown X: Current file is "${editor.document.languageId}", not markdown.`
                );
                return;
            }
            previewProvider.openPreview(editor.document, true);
        })
    );

    // Refresh Preview
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.refreshPreview', () => {
            previewProvider.refresh();
        })
    );

    // Font size +/-
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.increaseFontSize', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<number>('fontSize', 16);
            const next = Math.min(current + 2, 32);
            await config.update('fontSize', next, true);
            previewProvider.refresh();
        }),
        vscode.commands.registerCommand('markdown-x.decreaseFontSize', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<number>('fontSize', 16);
            const next = Math.max(current - 2, 10);
            await config.update('fontSize', next, true);
            previewProvider.refresh();
        }),
    );

    // Set font size (input box with current value)
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.setFontSize', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<number>('fontSize', 16);
            const sizes = [12, 14, 16, 18, 20, 24, 28, 32].map(s => ({
                label: `${s}px`,
                description: s === current ? '(current)' : '',
                value: s,
            }));
            sizes.push({ label: 'Custom...', description: 'Enter size directly', value: -1 });

            const selected = await vscode.window.showQuickPick(sizes, {
                placeHolder: `Current: ${current}px`,
            });
            if (!selected) return;

            let size = selected.value;
            if (size === -1) {
                const input = await vscode.window.showInputBox({
                    prompt: 'Font size (10-32)',
                    value: String(current),
                    validateInput: (v) => {
                        const n = parseInt(v, 10);
                        if (isNaN(n) || n < 10 || n > 32) return '10-32';
                        return null;
                    },
                });
                if (!input) return;
                size = parseInt(input, 10);
            }
            await config.update('fontSize', size, true);
            previewProvider.refresh();
        }),
    );

    // Change font family
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.changeFontFamily', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<string>('fontFamily', '');
            const fonts = [
                { label: 'System Default', description: '-apple-system, BlinkMacSystemFont, sans-serif', value: '' },
                { label: 'Pretendard', description: 'Pretendard, sans-serif', value: 'Pretendard, sans-serif' },
                { label: 'Noto Sans KR', description: "'Noto Sans KR', sans-serif", value: "'Noto Sans KR', sans-serif" },
                { label: 'Malgun Gothic', description: "'맑은 고딕', sans-serif", value: "'맑은 고딕', 'Malgun Gothic', sans-serif" },
                { label: 'Nanum Gothic', description: "'나눔고딕', sans-serif", value: "'NanumGothic', '나눔고딕', sans-serif" },
                { label: 'D2Coding', description: 'D2Coding, monospace', value: "'D2Coding', monospace" },
                { label: 'Georgia', description: 'Georgia, serif', value: 'Georgia, serif' },
                { label: 'Times New Roman', description: "'Times New Roman', serif", value: "'Times New Roman', serif" },
                { label: 'Custom...', description: 'Enter custom font family', value: '__custom__' },
            ];

            const selected = await vscode.window.showQuickPick(fonts, {
                placeHolder: `Current: ${current || 'System Default'}`,
            });
            if (!selected) return;

            let fontValue = selected.value;
            if (fontValue === '__custom__') {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter font family (CSS format)',
                    value: current,
                    placeHolder: "'Font Name', sans-serif",
                });
                if (!input) return;
                fontValue = input;
            }

            await config.update('fontFamily', fontValue, true);
            previewProvider.refresh();
        }),
    );

    // Change theme
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.changeTheme', async () => {
            const themes = [
                { label: 'Auto', description: 'Follow VS Code theme', value: 'auto' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'Sepia', description: 'Easy on eyes', value: 'sepia' },
            ];
            const selected = await vscode.window.showQuickPick(themes, {
                placeHolder: 'Select preview theme',
            });
            if (selected) {
                await vscode.workspace.getConfiguration('markdown-x').update('theme', selected.value, true);
                previewProvider.refresh();
            }
        }),
    );

    // Page Preview: generate temp PDF and open in VSCode tab
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.togglePagePreview', async () => {
            const editor = vscode.window.activeTextEditor;
            const doc = editor?.document.languageId === 'markdown'
                ? editor.document
                : previewProvider.getCurrentDocument();
            if (!doc) {
                vscode.window.showWarningMessage('Markdown X: Please open a markdown file first');
                return;
            }

            const { previewPdf } = await import('./export/previewPdf');
            previewPdf(doc);
        }),
    );

    // Change page size
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.changePageSize', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<string>('pdf.pageSize', 'A4');
            const sizes = [
                { label: 'A4', description: '210 × 297 mm', value: 'A4' },
                { label: 'A3', description: '297 × 420 mm', value: 'A3' },
                { label: 'Letter', description: '216 × 279 mm', value: 'Letter' },
                { label: 'Legal', description: '216 × 356 mm', value: 'Legal' },
            ];
            const selected = await vscode.window.showQuickPick(sizes, {
                placeHolder: `Current: ${current}`,
            });
            if (selected) {
                await config.update('pdf.pageSize', selected.value, true);
                previewProvider.refresh();
            }
        }),
    );

    // Change page margin
    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.changeMargin', async () => {
            const config = vscode.workspace.getConfiguration('markdown-x');
            const current = config.get<string>('pdf.margin', '20mm');
            const margins = [
                { label: 'Narrow', description: '10mm', value: '10mm' },
                { label: 'Normal', description: '20mm', value: '20mm' },
                { label: 'Wide', description: '25mm 30mm', value: '25mm 30mm' },
                { label: 'Custom...', description: 'Enter custom margin', value: '__custom__' },
            ];
            const selected = await vscode.window.showQuickPick(margins, {
                placeHolder: `Current: ${current}`,
            });
            if (!selected) return;

            let marginValue = selected.value;
            if (marginValue === '__custom__') {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter margin (CSS format)',
                    value: current,
                    placeHolder: '20mm or 20mm 15mm',
                });
                if (!input) return;
                marginValue = input;
            }
            await config.update('pdf.margin', marginValue, true);
            previewProvider.refresh();
        }),
    );

    // Export commands — works from both editor and preview panel
    const markdownGuard = (fn: (doc: vscode.TextDocument) => Promise<void>) => {
        return () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'markdown') {
                fn(editor.document);
                return;
            }
            const previewDoc = previewProvider.getCurrentDocument();
            if (previewDoc) {
                fn(previewDoc);
                return;
            }
            vscode.window.showWarningMessage('Markdown X: Please open a markdown file first');
        };
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('markdown-x.exportPdf', markdownGuard(exportPdf)),
        vscode.commands.registerCommand('markdown-x.exportDocx', markdownGuard(exportDocx)),
        vscode.commands.registerCommand('markdown-x.print', markdownGuard(printDocument)),
    );

    // Document change listener (debounced)
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.languageId === 'markdown') {
                if (updateTimer) clearTimeout(updateTimer);
                updateTimer = setTimeout(() => {
                    previewProvider.updateContent(e.document);
                }, 300);
            }
        })
    );

    // Editor scroll -> preview scroll sync (with debounce to prevent loop)
    let scrollSyncTimer: ReturnType<typeof setTimeout> | undefined;
    let lastScrollLine = -1;
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
            const enableScrollSync = vscode.workspace.getConfiguration('markdown-x')
                .get<boolean>('enableScrollSync', true);
            if (!enableScrollSync) return;
            // Only sync scroll for the document currently being previewed
            const previewDoc = previewProvider.getCurrentDocument();
            if (!previewDoc || e.textEditor.document !== previewDoc) return;
            if (e.textEditor.document.languageId === 'markdown' && e.visibleRanges.length > 0) {
                const topLine = e.visibleRanges[0].start.line;
                if (topLine === lastScrollLine) return;
                lastScrollLine = topLine;
                if (scrollSyncTimer) clearTimeout(scrollSyncTimer);
                scrollSyncTimer = setTimeout(() => {
                    previewProvider.scrollToLine(topLine);
                }, 200);
            }
        })
    );
}

export function deactivate() {
    previewProvider?.dispose();
}
