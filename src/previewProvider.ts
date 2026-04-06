import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parseMarkdown } from './markdownParser';

export class MarkdownPreviewProvider implements vscode.WebviewPanelSerializer {
    private panel: vscode.WebviewPanel | undefined;
    private currentDocument: vscode.TextDocument | undefined;
    private extensionUri: vscode.Uri;
    private cachedCustomCss: string = '';
    private scrollSyncEnabled = false;
    private previewFocused = false;
    private lastCustomCssPath: string = '';

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        state: unknown
    ): Promise<void> {
        this.panel = webviewPanel;
        this.initialized = false;
        this.setupWebview();

        // Re-render content from the active markdown editor
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
            this.currentDocument = editor.document;
            this.updateContent(editor.document);
        } else {
            for (const doc of vscode.workspace.textDocuments) {
                if (doc.languageId === 'markdown') {
                    this.currentDocument = doc;
                    this.updateContent(doc);
                    break;
                }
            }
        }

        vscode.commands.executeCommand('setContext', 'markdown-x:previewOpen', true);
        setTimeout(() => {
            webviewPanel.reveal(undefined, true);
        }, 500);
        // Delay scroll sync activation to prevent forced scroll on restore
        this.scrollSyncEnabled = false;
        setTimeout(() => { this.scrollSyncEnabled = true; }, 3000);
    }

    openPreview(document: vscode.TextDocument, toSide: boolean): void {
        this.currentDocument = document;

        if (this.panel) {
            this.panel.reveal(toSide ? vscode.ViewColumn.Two : vscode.ViewColumn.One);
            this.initialized = false;
            this.updateContent(document);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'markdown-x-preview',
            `Preview: ${path.basename(document.fileName)}`,
            toSide ? vscode.ViewColumn.Two : vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    this.extensionUri,
                    vscode.Uri.file(path.dirname(document.fileName))
                ]
            }
        );

        this.setupWebview();
        this.updateContent(document);
        vscode.commands.executeCommand('setContext', 'markdown-x:previewOpen', true);
        this.scrollSyncEnabled = false;
        setTimeout(() => { this.scrollSyncEnabled = true; }, 2000);
    }

    private setupWebview(): void {
        if (!this.panel) return;

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                this.initialized = false;
                this.previewFocused = false;
                vscode.commands.executeCommand('setContext', 'markdown-x:previewOpen', false);
            },
            null,
            []
        );

        this.panel.onDidChangeViewState(
            (e) => {
                this.previewFocused = e.webviewPanel.active;
            },
            null,
            []
        );

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'scroll': {
                        break;
                    }
                    case 'changeFontSize': {
                        const config = vscode.workspace.getConfiguration('markdown-x');
                        const current = config.get<number>('fontSize', 16);
                        const next = Math.max(10, Math.min(32, current + message.delta));
                        if (next !== current) {
                            config.update('fontSize', next, true);
                            this.refresh();
                        }
                        break;
                    }
                    case 'clickLink': {
                        const linkPath = message.href;
                        if (linkPath.startsWith('http')) {
                            vscode.env.openExternal(vscode.Uri.parse(linkPath));
                        } else {
                            const docDir = this.currentDocument?.fileName
                                ? path.dirname(this.currentDocument.fileName)
                                : '';
                            const fullPath = path.isAbsolute(linkPath)
                                ? linkPath
                                : path.join(docDir, linkPath);
                            try {
                                const doc = await vscode.workspace.openTextDocument(fullPath);
                                await vscode.window.showTextDocument(doc);
                            } catch {
                                vscode.window.showErrorMessage(`Cannot open: ${linkPath}`);
                            }
                        }
                        break;
                    }
                    case 'insertPageBreak': {
                        if (!this.currentDocument) break;
                        const doc = this.currentDocument;
                        const text = doc.getText();
                        const lines = text.split('\n');

                        // Find the source line for the element
                        // Strategy: count block elements (pre, table, blockquote, mermaid, p, h, ul, ol, hr) in order
                        const targetIndex = message.elementIndex;
                        const tag = message.elementTag;
                        let blockCount = 0;
                        let insertLine = 0;

                        let inCodeBlock = false;
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.startsWith('```')) {
                                if (!inCodeBlock) {
                                    // Start of code block — this is a block element
                                    if (blockCount === targetIndex) {
                                        insertLine = i;
                                        break;
                                    }
                                    blockCount++;
                                }
                                inCodeBlock = !inCodeBlock;
                                continue;
                            }
                            if (inCodeBlock) continue;

                            // Count block-level elements
                            const isBlock = line.match(/^#{1,6}\s/) || // heading
                                line.match(/^[>|*\-+]/) ||            // blockquote, list, hr
                                line.match(/^\d+\./) ||                // ordered list
                                line.match(/^\|/) ||                    // table
                                (line === '---' || line === '***' || line === '___'); // hr

                            if (isBlock || (line.length > 0 && i > 0 && lines[i-1].trim() === '')) {
                                if (blockCount === targetIndex) {
                                    insertLine = i;
                                    break;
                                }
                                blockCount++;
                            }
                        }

                        // Insert pagebreak comment before the element
                        const editor = vscode.window.visibleTextEditors.find(
                            e => e.document.fileName === doc.fileName
                        );
                        if (editor) {
                            editor.edit(editBuilder => {
                                const pos = new vscode.Position(insertLine, 0);
                                editBuilder.insert(pos, '\n<!-- pagebreak -->\n\n');
                            });
                            vscode.window.showInformationMessage(
                                `Page break inserted at line ${insertLine + 1}`
                            );
                        }
                        break;
                    }
                    case 'updateMermaidScale': {
                        if (!this.currentDocument) break;
                        const doc = this.currentDocument;
                        const text = doc.getText();
                        const lines = text.split('\n');
                        const mermaidIndex = message.mermaidIndex as number;
                        const scale = message.scale as number;

                        // Find the Nth ```mermaid block
                        let count = 0;
                        let targetLine = -1;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].trim().startsWith('```mermaid')) {
                                if (count === mermaidIndex) {
                                    targetLine = i;
                                    break;
                                }
                                count++;
                            }
                        }
                        if (targetLine < 0) break;

                        const editor = vscode.window.visibleTextEditors.find(
                            e => e.document.fileName === doc.fileName
                        );
                        if (!editor) break;

                        // Check if line above is already a mermaid-scale comment
                        const prevLine = targetLine > 0 ? lines[targetLine - 1].trim() : '';
                        const hasExisting = prevLine.match(/^<!--\s*mermaid-scale:\s*\d+%?\s*-->$/);

                        await editor.edit(editBuilder => {
                            if (scale === 100) {
                                // Remove scale comment if resetting to 100%
                                if (hasExisting) {
                                    const range = new vscode.Range(
                                        new vscode.Position(targetLine - 1, 0),
                                        new vscode.Position(targetLine, 0)
                                    );
                                    editBuilder.delete(range);
                                }
                            } else if (hasExisting) {
                                // Update existing comment
                                const range = new vscode.Range(
                                    new vscode.Position(targetLine - 1, 0),
                                    new vscode.Position(targetLine - 1, lines[targetLine - 1].length)
                                );
                                editBuilder.replace(range, `<!-- mermaid-scale: ${scale}% -->`);
                            } else {
                                // Insert new comment above ```mermaid
                                const pos = new vscode.Position(targetLine, 0);
                                editBuilder.insert(pos, `<!-- mermaid-scale: ${scale}% -->\n`);
                            }
                        });
                        break;
                    }
                }
            },
            null,
            []
        );
    }

    private initialized = false;
    updateContent(document: vscode.TextDocument): void {
        if (!this.panel) return;
        if (this.currentDocument?.fileName !== document.fileName) return;

        if (!this.initialized) {
            // First render: set full HTML
            const html = this.generateHtml(document.getText(), document.fileName);
            this.panel.webview.html = html;
            this.initialized = true;
        } else {
            // Subsequent renders: update content only via message
            const htmlContent = this.renderMarkdown(document.getText(), document.fileName);
            this.panel.webview.postMessage({ type: 'updateContent', html: htmlContent });
        }
        this.panel.title = `Preview: ${path.basename(document.fileName)}`;
    }

    updateTheme(theme: string): void {
        this.panel?.webview.postMessage({ type: 'theme', theme });
    }

    scrollToLine(line: number): void {
        if (!this.scrollSyncEnabled || this.previewFocused) return;
        this.panel?.webview.postMessage({ type: 'scrollToLine', line });
    }

    getCurrentDocument(): vscode.TextDocument | undefined {
        return this.currentDocument;
    }

    refresh(): void {
        if (this.currentDocument) {
            this.initialized = false; // Force full HTML rebuild
            this.updateContent(this.currentDocument);
        }
    }

    dispose(): void {
        this.panel?.dispose();
    }

    private renderMarkdown(content: string, filePath: string): string {
        const webview = this.panel?.webview;
        const docDir = path.dirname(filePath);

        return parseMarkdown(content, {
            resolveImageUri: (src: string) => {
                const absPath = path.isAbsolute(src) ? src : path.join(docDir, src);
                if (webview) {
                    return webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
                }
                return src;
            }
        });
    }

    private generateHtml(content: string, filePath: string): string {
        const config = vscode.workspace.getConfiguration('markdown-x');
        const theme = config.get<string>('theme', 'auto');
        const fontSize = config.get<number>('fontSize', 16);
        const lineHeight = config.get<number>('lineHeight', 1.6);
        const enableMermaid = config.get<boolean>('enableMermaid', true);
        const enableImageLightbox = config.get<boolean>('enableImageLightbox', true);
        const enableScrollSync = config.get<boolean>('enableScrollSync', true);
        const fontFamily = config.get<string>('fontFamily', '');
        const codeFontFamily = config.get<string>('codeFontFamily', '');
        const customCssPath = config.get<string>('customCssPath', '');
        const customCss = config.get<string>('customCss', '');

        const htmlContent = this.renderMarkdown(content, filePath);

        // Load custom CSS file (cached)
        let customCssFileContent = '';
        if (customCssPath) {
            if (customCssPath !== this.lastCustomCssPath) {
                try {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    const baseDir = workspaceFolders?.[0]?.uri.fsPath || path.dirname(filePath);
                    const cssFullPath = path.isAbsolute(customCssPath)
                        ? customCssPath
                        : path.join(baseDir, customCssPath);
                    this.cachedCustomCss = fs.readFileSync(cssFullPath, 'utf-8');
                    this.lastCustomCssPath = customCssPath;
                } catch {
                    this.cachedCustomCss = '';
                }
            }
            customCssFileContent = this.cachedCustomCss;
        }

        // Generate nonce for CSP
        const nonce = crypto.randomBytes(16).toString('base64');

        // Webview URI for local resources
        const webview = this.panel!.webview;
        const cspSource = webview.cspSource;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net 'unsafe-eval'; img-src ${cspSource} https: data:; font-src https://cdn.jsdelivr.net;">
    <title>Markdown X Preview</title>

    <!-- KaTeX for math -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>

    ${enableMermaid ? `<!-- Mermaid for diagrams -->
    <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>` : ''}

    <style>
        :root {
            --font-size: ${fontSize}px;
            --line-height: ${lineHeight};
            --max-width: 900px;
            --padding: 40px;
            --font-family: ${fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif"};
            --code-font-family: ${codeFontFamily || "'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace"};
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--font-family);
            font-size: var(--font-size);
            line-height: var(--line-height);
            transition: background-color 0.3s, color 0.3s;
        }

        @media (prefers-color-scheme: dark) {
            body.theme-auto {
                --bg-color: #0d1117; --text-color: #c9d1d9; --heading-color: #e6edf3;
                --link-color: #58a6ff; --border-color: #30363d;
                --code-bg: #161b22; --blockquote-bg: #161b22; --blockquote-border: #30363d;
            }
        }

        body.theme-auto {
            --bg-color: #ffffff; --text-color: #24292f; --heading-color: #1f2328;
            --link-color: #0969da; --border-color: #d0d7de;
            --code-bg: #f6f8fa; --blockquote-bg: #f6f8fa; --blockquote-border: #d0d7de;
        }

        body.theme-light {
            --bg-color: #ffffff; --text-color: #24292f; --heading-color: #1f2328;
            --link-color: #0969da; --border-color: #d0d7de;
            --code-bg: #f6f8fa; --blockquote-bg: #f6f8fa; --blockquote-border: #d0d7de;
        }

        body.theme-dark {
            --bg-color: #0d1117; --text-color: #c9d1d9; --heading-color: #e6edf3;
            --link-color: #58a6ff; --border-color: #30363d;
            --code-bg: #161b22; --blockquote-bg: #161b22; --blockquote-border: #30363d;
        }

        body.theme-sepia {
            --bg-color: #f4ecd8; --text-color: #5b4636; --heading-color: #433422;
            --link-color: #0066cc; --border-color: #d7cbb3;
            --code-bg: #e8dec5; --blockquote-bg: #e8dec5; --blockquote-border: #d7cbb3;
        }

        body { background-color: var(--bg-color); color: var(--text-color); }
        .container { max-width: var(--max-width); margin: 0 auto; padding: var(--padding); }

        h1, h2, h3, h4, h5, h6 {
            color: var(--heading-color); margin-top: 1.5em; margin-bottom: 0.5em;
            font-weight: 600; line-height: 1.25;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; opacity: 0.7; }

        p { margin-bottom: 1em; }
        a { color: var(--link-color); text-decoration: none; }
        a:hover { text-decoration: underline; }

        ul, ol { margin-bottom: 1em; padding-left: 2em; }
        li { margin-bottom: 0.25em; }

        code {
            font-family: var(--code-font-family);
            font-size: 0.85em; background-color: var(--code-bg);
            padding: 0.2em 0.4em; border-radius: 3px;
        }
        pre {
            background-color: var(--code-bg); padding: 1em;
            border-radius: 6px; overflow-x: auto; margin-bottom: 1em;
        }
        pre code { background: none; padding: 0; }

        blockquote {
            background-color: var(--blockquote-bg); border-left: 4px solid var(--blockquote-border);
            padding: 0.5em 1em; margin-bottom: 1em;
        }
        blockquote p:last-child { margin-bottom: 0; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
        th, td { border: 1px solid var(--border-color); padding: 0.5em 1em; text-align: left; }
        th { background-color: var(--code-bg); font-weight: 600; }

        img {
            max-width: 100%; height: auto; border-radius: 6px;
            cursor: ${enableImageLightbox ? 'zoom-in' : 'default'}; transition: transform 0.2s;
        }

        ${enableImageLightbox ? `
        .lightbox {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 1000;
            justify-content: center; align-items: center; cursor: zoom-out;
        }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; object-fit: contain; cursor: default; }
        ` : ''}

        .mermaid {
            text-align: center; margin: 1em 0; position: relative;
            max-width: 100%; margin-left: auto; margin-right: auto;
        }
        .mermaid:not([data-processed="true"]):not(:has(svg)) { opacity: 0; height: 0; overflow: hidden; }
        .mermaid[data-processed="true"], .mermaid:has(svg) { opacity: 1; height: auto; }
        .mermaid:hover { outline: 2px solid var(--link-color); outline-offset: 4px; border-radius: 4px; }

        .diagram-toolbar {
            opacity: 0; pointer-events: none;
            position: absolute; top: 4px; right: 4px;
            background: var(--code-bg); border: 1px solid var(--border-color);
            border-radius: 6px; padding: 2px; z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex; gap: 2px; align-items: center;
            transition: opacity 0.15s;
        }
        .mermaid:hover .diagram-toolbar { opacity: 1; pointer-events: auto; }
        .diagram-toolbar button {
            width: 28px; height: 28px; border: none; border-radius: 4px;
            background: var(--bg-color); color: var(--text-color); cursor: pointer;
            font-size: 16px; display: flex; align-items: center; justify-content: center;
        }
        .diagram-toolbar button:hover { background: var(--border-color); }
        .diagram-toolbar span {
            font-size: 11px; color: var(--text-color); min-width: 36px; text-align: center;
        }
        hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }

        .container { position: relative; }

        .task-list-item { list-style-type: none; }
        .task-list-item input { margin-right: 0.5em; }

        /* highlight.js theme-aware */
        .hljs { background: var(--code-bg) !important; color: var(--text-color); }
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #d73a49; }
        .hljs-string, .hljs-attr { color: #032f62; }
        .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
        .hljs-number, .hljs-literal { color: #005cc5; }
        .hljs-title, .hljs-section { color: #6f42c1; }
        .hljs-type, .hljs-name { color: #22863a; }

        @media (prefers-color-scheme: dark) {
            body.theme-auto .hljs-keyword, body.theme-auto .hljs-selector-tag, body.theme-auto .hljs-built_in { color: #ff7b72; }
            body.theme-auto .hljs-string, body.theme-auto .hljs-attr { color: #a5d6ff; }
            body.theme-auto .hljs-comment, body.theme-auto .hljs-quote { color: #8b949e; }
            body.theme-auto .hljs-number, body.theme-auto .hljs-literal { color: #79c0ff; }
            body.theme-auto .hljs-title, body.theme-auto .hljs-section { color: #d2a8ff; }
            body.theme-auto .hljs-type, body.theme-auto .hljs-name { color: #7ee787; }
        }
        body.theme-dark .hljs-keyword, body.theme-dark .hljs-selector-tag, body.theme-dark .hljs-built_in { color: #ff7b72; }
        body.theme-dark .hljs-string, body.theme-dark .hljs-attr { color: #a5d6ff; }
        body.theme-dark .hljs-comment, body.theme-dark .hljs-quote { color: #8b949e; }
        body.theme-dark .hljs-number, body.theme-dark .hljs-literal { color: #79c0ff; }
        body.theme-dark .hljs-title, body.theme-dark .hljs-section { color: #d2a8ff; }
        body.theme-dark .hljs-type, body.theme-dark .hljs-name { color: #7ee787; }

        body.theme-sepia .hljs-keyword { color: #8b4513; }
        body.theme-sepia .hljs-string { color: #2e6b3a; }
        body.theme-sepia .hljs-comment { color: #8c7a6b; }

        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: var(--bg-color); }
        ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-color); opacity: 0.5; }
    </style>
    ${customCssFileContent ? `<style>\n${customCssFileContent}\n    </style>` : ''}
    ${customCss ? `<style>\n${customCss}\n    </style>` : ''}
</head>
<body class="theme-${theme}">
    <div class="container">
        <div id="content">${htmlContent}</div>
    </div>

    ${enableImageLightbox ? `<div id="lightbox" class="lightbox"><img id="lightbox-img" src="" alt=""></div>` : ''}

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();


        ${enableMermaid ? `
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: '${theme === 'dark' ? 'dark' : 'default'}',
                securityLevel: 'loose'
            });
            mermaid.run({ querySelector: '.mermaid' }).then(() => {
                attachMermaidToolbars();
            }).catch(() => {});
        }` : ''}

        document.addEventListener('DOMContentLoaded', () => {
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ]
                });
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'theme':
                    document.body.className = 'theme-' + message.theme;
                    ${enableMermaid ? 'location.reload();' : ''}
                    break;
                case 'updateContent': {
                    const contentEl = document.getElementById('content');
                    if (contentEl) {
                        const scrollPos = window.scrollY;

                        // Detach existing mermaid diagrams (preserve original nodes with events)
                        ${enableMermaid ? `
                        const savedMermaids = [];
                        contentEl.querySelectorAll('.mermaid').forEach((el) => {
                            if (el.querySelector('svg')) {
                                const placeholder = document.createComment('mermaid');
                                el.replaceWith(placeholder);
                                savedMermaids.push(el);
                            }
                        });` : ''}

                        contentEl.innerHTML = message.html;

                        // Restore original mermaid nodes (with SVG, toolbar, and event listeners intact)
                        ${enableMermaid ? `
                        const newMermaids = contentEl.querySelectorAll('.mermaid');
                        let needsNewRender = false;
                        let savedIdx = 0;
                        newMermaids.forEach((el) => {
                            if (savedIdx < savedMermaids.length) {
                                el.replaceWith(savedMermaids[savedIdx]);
                                savedIdx++;
                            } else {
                                needsNewRender = true;
                            }
                        });
                        if (needsNewRender && typeof mermaid !== 'undefined') {
                            mermaid.run({ querySelector: '.mermaid:not([data-processed])' }).then(() => {
                                setTimeout(attachMermaidToolbars, 500);
                            }).catch(() => {});
                        }` : ''}

                        window.scrollTo(0, scrollPos);

                        // Re-run KaTeX
                        if (typeof renderMathInElement !== 'undefined') {
                            renderMathInElement(contentEl, {
                                delimiters: [
                                    {left: '$$', right: '$$', display: true},
                                    {left: '$', right: '$', display: false}
                                ]
                            });
                        }
                        // Re-attach lightbox
                        ${enableImageLightbox ? `
                        contentEl.querySelectorAll('img').forEach(img => {
                            img.addEventListener('click', () => {
                                const lb = document.getElementById('lightbox');
                                const lbi = document.getElementById('lightbox-img');
                                if (lb && lbi) { lbi.src = img.src; lb.classList.add('active'); }
                            });
                        });` : ''}
                        // Re-attach link handlers
                        contentEl.querySelectorAll('a').forEach(link => {
                            link.addEventListener('click', (e) => {
                                const href = link.getAttribute('href');
                                if (href && !href.startsWith('#')) {
                                    e.preventDefault();
                                    vscode.postMessage({ type: 'clickLink', href: href });
                                }
                            });
                        });
                    }
                    break;
                }
                case 'scrollToLine': {
                    ${enableScrollSync ? `
                    const targetLine = message.line;
                    const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
                    let closestEl = null;
                    let closestDist = Infinity;
                    headings.forEach(el => {
                        const line = parseInt(el.getAttribute('data-line') || '-1', 10);
                        if (line >= 0 && line <= targetLine) {
                            const dist = targetLine - line;
                            if (dist < closestDist) {
                                closestDist = dist;
                                closestEl = el;
                            }
                        }
                    });
                    if (closestEl) {
                        closestEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    ` : ''}
                    break;
                }
            }
        });

        ${enableImageLightbox ? `
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        document.querySelectorAll('#content img').forEach(img => {
            img.addEventListener('click', () => {
                lightboxImg.src = img.src;
                lightbox.classList.add('active');
            });
        });
        lightbox.addEventListener('click', () => {
            lightbox.classList.remove('active');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                lightbox.classList.remove('active');
            }
        });
        ` : ''}

        // Handle link clicks
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#')) {
                    e.preventDefault();
                    vscode.postMessage({ type: 'clickLink', href: href });
                }
            });
        });

        ${enableScrollSync ? `
        // Cmd/Ctrl + mouse wheel to resize font
        let fontTooltip = null;
        let fontTooltipTimer = null;

        function showFontTooltip(size) {
            if (!fontTooltip) {
                fontTooltip = document.createElement('div');
                fontTooltip.style.cssText = 'position:fixed;top:12px;right:12px;background:var(--code-bg);color:var(--text-color);border:1px solid var(--border-color);padding:6px 14px;border-radius:6px;font-size:13px;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
                document.body.appendChild(fontTooltip);
            }
            fontTooltip.textContent = 'Font: ' + size + 'px';
            fontTooltip.style.opacity = '1';
            if (fontTooltipTimer) clearTimeout(fontTooltipTimer);
            fontTooltipTimer = setTimeout(() => { fontTooltip.style.opacity = '0'; }, 1200);
        }

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === 'Meta' || e.key === 'Control') {
                showFontTooltip(parseInt(getComputedStyle(document.body).fontSize) || 16);
                fontTooltip.textContent = '\u2318/Ctrl + Scroll to resize font';
            }
        });

        document.addEventListener('keyup', (e) => {
            if (fontTooltip) fontTooltip.style.opacity = '0';
        });

        document.addEventListener('wheel', (e) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 2 : -2;
                const currentSize = parseInt(getComputedStyle(document.body).fontSize) || 16;
                const newSize = Math.max(10, Math.min(32, currentSize + delta));
                showFontTooltip(newSize);
                vscode.postMessage({ type: 'changeFontSize', delta: delta });
            }
        }, { passive: false });

        // Report scroll position to extension (preview -> editor sync)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
                let topLine = 0;
                for (const el of headings) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top > 50) break;
                    const line = parseInt(el.getAttribute('data-line') || '0', 10);
                    if (line > 0) topLine = line;
                }
                vscode.postMessage({ type: 'scroll', line: topLine });
            }, 150);
        });
        ` : ''}

        ${enableMermaid ? `
        // Diagram resize — hover to show toolbar, click buttons to resize
        function getScale(el) {
            return parseInt(el.getAttribute('data-scale') || '100', 10);
        }

        function setScale(el, scale) {
            scale = Math.max(30, Math.min(200, scale));
            el.setAttribute('data-scale', String(scale));
            const ratio = scale / 100;
            const svg = el.querySelector('svg');
            if (svg) {
                svg.style.transform = 'scale(' + ratio + ')';
                svg.style.transformOrigin = 'top center';
                const bbox = svg.getBBox ? svg.getBBox() : null;
                if (bbox) {
                    el.style.height = (bbox.height * ratio + 20) + 'px';
                }
                el.style.overflow = 'hidden';
            }
            const label = el.querySelector('.diagram-size-label');
            if (label) label.textContent = scale + '%';
        }

        function resetScale(el) {
            el.setAttribute('data-scale', '100');
            const svg = el.querySelector('svg');
            if (svg) {
                svg.style.transform = '';
                svg.style.transformOrigin = '';
            }
            el.style.height = '';
            el.style.overflow = '';
            const label = el.querySelector('.diagram-size-label');
            if (label) label.textContent = '100%';
        }

        function getMermaidIndex(el) {
            const all = Array.from(document.querySelectorAll('.mermaid'));
            return all.indexOf(el);
        }

        function notifyScaleChange(el, scale) {
            const idx = getMermaidIndex(el);
            if (idx >= 0) {
                vscode.postMessage({
                    type: 'updateMermaidScale',
                    mermaidIndex: idx,
                    scale: scale
                });
            }
        }

        // Add toolbars and apply initial scale to mermaid diagrams
        function attachMermaidToolbars() {
            document.querySelectorAll('.mermaid').forEach(el => {
                if (el.querySelector('.diagram-toolbar')) return;

                const initialScale = parseInt(el.getAttribute('data-scale') || '100', 10);

                // Apply initial scale to SVG (not to the container div)
                if (initialScale !== 100) {
                    const svg = el.querySelector('svg');
                    if (svg) {
                        setScale(el, initialScale);
                    }
                }

                const toolbar = document.createElement('div');
                toolbar.className = 'diagram-toolbar';
                toolbar.innerHTML =
                    '<button class="diagram-shrink" title="Shrink">\\u2212</button>' +
                    '<span class="diagram-size-label">' + initialScale + '%</span>' +
                    '<button class="diagram-grow" title="Grow">+</button>' +
                    '<button class="diagram-reset" title="Reset">\\u21BA</button>';
                el.prepend(toolbar);

                toolbar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    let newScale;
                    if (btn.classList.contains('diagram-shrink')) {
                        newScale = getScale(el) - 10;
                        setScale(el, newScale);
                        notifyScaleChange(el, Math.max(30, newScale));
                    } else if (btn.classList.contains('diagram-grow')) {
                        newScale = getScale(el) + 10;
                        setScale(el, newScale);
                        notifyScaleChange(el, Math.min(200, newScale));
                    } else if (btn.classList.contains('diagram-reset')) {
                        resetScale(el);
                        notifyScaleChange(el, 100);
                    }
                });
            });
        }

        // Initial toolbar attach after Mermaid renders
        setTimeout(attachMermaidToolbars, 2000);
        ` : ''}
    </script>
</body>
</html>`;
    }
}
