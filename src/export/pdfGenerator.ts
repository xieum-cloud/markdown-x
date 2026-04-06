import * as vscode from 'vscode';
import * as path from 'path';
import puppeteer from 'puppeteer-core';
import { parseMarkdown } from '../markdownParser';
import { getExportHtml } from './printStyles';
import { findChromePath } from './chromeFinder';
import { getPageBreakScript } from './pageBreakProcessor';

export interface PdfOptions {
    outputPath: string;
    title: string;
}

/**
 * Shared PDF generation logic used by both exportPdf and previewPdf.
 * Returns the output path on success, or throws on failure.
 */
export async function generatePdf(
    document: vscode.TextDocument,
    options: PdfOptions,
    progress: vscode.Progress<{ increment?: number; message?: string }>
): Promise<string> {
    const chromePath = findChromePath();
    if (!chromePath) {
        const action = await vscode.window.showErrorMessage(
            'A Chromium-based browser (Chrome, Edge, Brave, Arc) is required.',
            'Download Chrome'
        );
        if (action === 'Download Chrome') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.google.com/chrome/'));
        }
        throw new Error('No Chromium browser found');
    }

    const config = vscode.workspace.getConfiguration('markdown-x');
    const content = document.getText();

    progress.report({ increment: 10, message: 'Parsing markdown...' });
    const htmlContent = parseMarkdown(content);

    const exportHtml = getExportHtml(htmlContent, {
        title: options.title,
        fontSize: config.get<number>('fontSize', 16),
        lineHeight: config.get<number>('lineHeight', 1.6),
        fontFamily: config.get<string>('fontFamily', '') || undefined,
        codeFontFamily: config.get<string>('codeFontFamily', '') || undefined,
        pageSize: config.get<string>('pdf.pageSize', 'A4'),
        margin: config.get<string>('pdf.margin', '20mm'),
        customCss: config.get<string>('customCss', ''),
    });

    progress.report({ increment: 10, message: 'Launching browser...' });

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
    });

    try {
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

        // Parse margins
        const marginStr = config.get<string>('pdf.margin', '20mm') || '20mm';
        const marginParts = marginStr.trim().split(/\s+/);
        const marginTop = marginParts[0];
        const marginRight = marginParts[1] || marginParts[0];
        const marginBottom = marginParts[2] || marginParts[0];
        const marginLeft = marginParts[3] || marginParts[1] || marginParts[0];

        // Page break optimization
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

        await page.pdf({
            path: options.outputPath,
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
                    <span>${options.title}</span>
                  </div>`
                : '',
            footerTemplate: showHeaderFooter
                ? `<div style="font-size:9px; width:100%; text-align:center; color:#999;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                  </div>`
                : '',
        });

        return options.outputPath;
    } finally {
        await browser.close();
    }
}
