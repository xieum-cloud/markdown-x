/**
 * Print-aware CSS for PDF export and printing.
 * Prevents tables, images, and code blocks from splitting across pages.
 */
export function getPrintStyles(): string {
    return `
@media print {
    @page {
        size: A4;
        margin: 20mm 15mm;
    }

    body {
        background: white !important;
        color: #000 !important;
    }

    /* Prevent tables from splitting across pages */
    table, figure, .mermaid {
        break-inside: avoid;
        page-break-inside: avoid;
    }

    /* Repeat table header on each page */
    thead {
        display: table-header-group;
    }

    /* Prevent images from splitting */
    img {
        break-inside: avoid;
        page-break-inside: avoid;
        max-height: 80vh;
    }

    /* Prevent short code blocks from splitting */
    pre {
        break-inside: avoid;
        page-break-inside: avoid;
    }

    /* Keep headings with following content */
    h1, h2, h3, h4, h5, h6 {
        break-after: avoid;
        page-break-after: avoid;
    }

    /* Hide lightbox overlay */
    .lightbox { display: none !important; }

    /* Remove link underlines, show URL */
    a { color: #000 !important; }
}
`;
}

/**
 * Generate full standalone HTML for export (PDF/print).
 * Includes CDN scripts for Mermaid/KaTeX rendering.
 */
export function getExportHtml(
    bodyHtml: string,
    options: {
        title: string;
        fontSize?: number;
        lineHeight?: number;
        fontFamily?: string;
        codeFontFamily?: string;
        pageSize?: string;
        margin?: string;
        customCss?: string;
    }
): string {
    const {
        title,
        fontSize = 16,
        lineHeight = 1.6,
        fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        codeFontFamily = "'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace",
        pageSize = 'A4',
        margin = '20mm',
        customCss = '',
    } = options;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>

<!-- KaTeX -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>

<!-- Mermaid -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

<style>
    @page {
        size: ${pageSize};
        margin: ${margin};
    }

    :root {
        --font-size: ${fontSize}px;
        --line-height: ${lineHeight};
        --font-family: ${fontFamily};
        --code-font-family: ${codeFontFamily};
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: var(--font-family);
        font-size: var(--font-size);
        line-height: var(--line-height);
        color: #24292f;
        background: #fff;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px;
        orphans: 3;
        widows: 3;
    }

    h1, h2, h3, h4, h5, h6 {
        color: #1f2328; margin-top: 1.5em; margin-bottom: 0.5em;
        font-weight: 600; line-height: 1.25;
        break-after: avoid; page-break-after: avoid;
    }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; opacity: 0.7; }

    p { margin-bottom: 1em; }
    a { color: #0969da; text-decoration: none; }

    ul, ol { margin-bottom: 1em; padding-left: 2em; }
    li { margin-bottom: 0.25em; }

    code {
        font-family: var(--code-font-family);
        font-size: 0.85em; background: #f6f8fa;
        padding: 0.2em 0.4em; border-radius: 3px;
    }
    pre {
        background: #f6f8fa; padding: 1em;
        border-radius: 6px; overflow-x: auto; margin-bottom: 1em;
        break-inside: avoid; page-break-inside: avoid;
    }
    pre code { background: none; padding: 0; }

    blockquote {
        background: #f6f8fa; border-left: 4px solid #d0d7de;
        padding: 0.5em 1em; margin-bottom: 1em;
        break-inside: avoid; page-break-inside: avoid;
    }
    blockquote p:last-child { margin-bottom: 0; }
    li { break-inside: avoid; page-break-inside: avoid; }

    table {
        width: 100%; border-collapse: collapse; margin-bottom: 1em;
        break-inside: avoid; page-break-inside: avoid;
    }
    thead { display: table-header-group; }
    th, td { border: 1px solid #d0d7de; padding: 0.5em 1em; text-align: left; }
    th { background: #f6f8fa; font-weight: 600; }

    img {
        max-width: 100%; height: auto; border-radius: 6px;
        break-inside: avoid; page-break-inside: avoid;
    }

    .mermaid {
        text-align: center; margin: 1em 0;
        break-inside: avoid; page-break-inside: avoid;
    }

    hr { border: none; border-top: 1px solid #d0d7de; margin: 2em 0; }

    .task-list-item { list-style-type: none; }
    .task-list-item input { margin-right: 0.5em; }

    del { text-decoration: line-through; color: #888; }

    /* highlight.js */
    .hljs { background: #f6f8fa !important; }
    .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #d73a49; }
    .hljs-string, .hljs-attr { color: #032f62; }
    .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
    .hljs-number, .hljs-literal { color: #005cc5; }
    .hljs-title, .hljs-section { color: #6f42c1; }
    .hljs-type, .hljs-name { color: #22863a; }

    ${customCss}
</style>
</head>
<body>
${bodyHtml}
<script>
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    mermaid.run({ querySelector: '.mermaid' });
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
</script>
</body>
</html>`;
}
