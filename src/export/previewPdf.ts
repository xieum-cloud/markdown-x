import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import puppeteer from 'puppeteer-core';
import { parseMarkdown } from '../markdownParser';
import { getExportHtml } from './printStyles';
import { findChromePath } from './chromeFinder';
import { getPageBreakScript } from './pageBreakProcessor';

/**
 * Generate a temporary PDF and open it in a VSCode tab for page preview.
 */
export async function previewPdf(document: vscode.TextDocument): Promise<void> {
    const chromePath = findChromePath();
    if (!chromePath) {
        const action = await vscode.window.showErrorMessage(
            'A Chromium-based browser (Chrome, Edge, Brave, Arc) is required for page preview.',
            'Download Chrome'
        );
        if (action === 'Download Chrome') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.google.com/chrome/'));
        }
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating page preview...',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 10, message: 'Parsing markdown...' });

            const config = vscode.workspace.getConfiguration('markdown-x');
            const content = document.getText();
            const htmlContent = parseMarkdown(content);
            const title = path.basename(document.fileName, path.extname(document.fileName));

            const exportHtml = getExportHtml(htmlContent, {
                title,
                fontSize: config.get<number>('fontSize', 16),
                lineHeight: config.get<number>('lineHeight', 1.6),
                fontFamily: config.get<string>('fontFamily', '') || undefined,
                codeFontFamily: config.get<string>('codeFontFamily', '') || undefined,
                pageSize: config.get<string>('pdf.pageSize', 'A4'),
                margin: config.get<string>('pdf.margin', '20mm'),
                customCss: config.get<string>('customCss', ''),
            });

            progress.report({ increment: 20, message: 'Launching browser...' });

            let browser;
            try {
                browser = await puppeteer.launch({
                    executablePath: chromePath,
                    headless: true,
                    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
                });

                const page = await browser.newPage();

                progress.report({ increment: 10, message: 'Loading HTML...' });
                await page.setContent(exportHtml, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                });

                progress.report({ increment: 10, message: 'Loading CDN...' });
                await page.waitForFunction(
                    'typeof mermaid !== "undefined"',
                    { timeout: 15000 }
                ).catch(() => {});

                progress.report({ increment: 10, message: 'Rendering diagrams...' });
                await page.evaluate(`
                    new Promise((resolve) => {
                        const timeout = setTimeout(resolve, 10000);
                        const mermaidDivs = document.querySelectorAll('.mermaid');
                        if (mermaidDivs.length === 0 || typeof mermaid === 'undefined') {
                            clearTimeout(timeout);
                            resolve();
                            return;
                        }
                        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
                        mermaid.run({ querySelector: '.mermaid' }).then(() => {
                            clearTimeout(timeout);
                            setTimeout(resolve, 300);
                        }).catch(() => { clearTimeout(timeout); resolve(); });
                    })
                `);

                progress.report({ increment: 10, message: 'Rendering math...' });
                await page.evaluate(`
                    new Promise((resolve) => {
                        if (typeof renderMathInElement !== 'undefined') {
                            renderMathInElement(document.body, {
                                delimiters: [
                                    {left: '$$', right: '$$', display: true},
                                    {left: '$', right: '$', display: false}
                                ]
                            });
                        }
                        setTimeout(resolve, 300);
                    })
                `);

                progress.report({ increment: 10, message: 'Optimizing layout...' });

                const marginStr = config.get<string>('pdf.margin', '20mm') || '20mm';
                const marginParts = marginStr.trim().split(/\s+/);
                const marginTop = marginParts[0];
                const marginRight = marginParts[1] || marginParts[0];
                const marginBottom = marginParts[2] || marginParts[0];
                const marginLeft = marginParts[3] || marginParts[1] || marginParts[0];

                const pageSizes: Record<string, { w: number; h: number }> = {
                    'A4': { w: 794, h: 1123 },
                    'A3': { w: 1123, h: 1587 },
                    'Letter': { w: 816, h: 1056 },
                    'Legal': { w: 816, h: 1344 },
                };
                const toPx = (v: string) => {
                    const num = parseFloat(v);
                    if (v.includes('mm')) return num * 3.7795;
                    if (v.includes('in')) return num * 96;
                    return num;
                };
                const pageDims = pageSizes[config.get<string>('pdf.pageSize', 'A4') || 'A4'] || pageSizes['A4'];
                await page.evaluate(getPageBreakScript(pageDims.h, toPx(marginTop), toPx(marginBottom)));

                progress.report({ increment: 10, message: 'Generating PDF...' });

                const showHeaderFooter = config.get<boolean>('pdf.headerFooter', true);
                // Fixed path so reopening refreshes the same tab
                const tmpPath = path.join(os.tmpdir(), 'markdown-x-preview.pdf');

                await page.pdf({
                    path: tmpPath,
                    format: config.get<string>('pdf.pageSize', 'A4') as any,
                    printBackground: true,
                    margin: {
                        top: showHeaderFooter ? '25mm' : marginTop,
                        right: marginRight,
                        bottom: showHeaderFooter ? '25mm' : marginBottom,
                        left: marginLeft,
                    },
                    displayHeaderFooter: showHeaderFooter,
                    headerTemplate: showHeaderFooter
                        ? `<div style="font-size:9px; width:100%; text-align:center; color:#999;">
                            <span>${title}</span>
                          </div>`
                        : '',
                    footerTemplate: showHeaderFooter
                        ? `<div style="font-size:9px; width:100%; text-align:center; color:#999;">
                            <span class="pageNumber"></span> / <span class="totalPages"></span>
                          </div>`
                        : '',
                });

                progress.report({ increment: 10, message: 'Opening preview...' });

                // Close existing preview tab if open, then reopen
                const uri = vscode.Uri.file(tmpPath);
                for (const tab of vscode.window.tabGroups.all.flatMap(g => g.tabs)) {
                    if (tab.input instanceof vscode.TabInputCustom || tab.input instanceof vscode.TabInputText) {
                        if ((tab.input as any).uri?.fsPath === tmpPath) {
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
                vscode.window.showErrorMessage(`Page preview failed: ${message}`);
            } finally {
                await browser?.close();
            }
        }
    );
}
