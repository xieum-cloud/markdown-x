import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

export interface ParseOptions {
    /** Resolve a relative image path to a displayable URI */
    resolveImageUri?: (relativePath: string) => string;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function parseMarkdown(content: string, opts: ParseOptions = {}): string {
    const renderer = new Renderer();

    // Build heading line map for data-line attributes
    const headingLines: Map<string, number> = new Map();
    const lines = content.split('\n');
    let inFenced = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^(`{3,}|~{3,})/)) { inFenced = !inFenced; continue; }
        if (inFenced) continue;
        const m = line.match(/^(#{1,6})\s+(.+)$/);
        if (m) {
            const key = m[1].length + ':' + m[2].trim();
            if (!headingLines.has(key)) {
                headingLines.set(key, i);
            }
        }
    }
    const headingUsed: Map<string, number> = new Map();

    renderer.heading = (text: string, level: number, _raw: string): string => {
        const key = level + ':' + text;
        const count = headingUsed.get(key) || 0;
        headingUsed.set(key, count + 1);
        // Find the Nth occurrence
        let found = 0;
        let lineNum = 0;
        for (const [k, v] of headingLines) {
            if (k === key) {
                if (found === count) { lineNum = v; break; }
                found++;
            }
        }
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        return `<h${level} id="${id}" data-line="${lineNum}">${text}</h${level}>\n`;
    };

    // Track mermaid-scale comments — next mermaid block uses this scale
    let pendingMermaidScale = '';

    // Handle pagebreak and mermaid-scale comments, sanitize other raw HTML
    renderer.html = (html: string): string => {
        const trimmed = html.trim();
        if (trimmed === '<!-- pagebreak -->') {
            return '<div style="break-before: page; page-break-before: always;"></div>';
        }
        const scaleMatch = trimmed.match(/^<!--\s*mermaid-scale:\s*(\d+)%?\s*-->$/);
        if (scaleMatch) {
            pendingMermaidScale = scaleMatch[1];
            return ''; // consumed, don't render
        }
        return escapeHtml(html);
    };

    renderer.code = (code: string, infostring: string | undefined, _escaped: boolean): string => {
        const lang = (infostring || '').trim();
        if (lang === 'mermaid') {
            const scale = pendingMermaidScale || '100';
            pendingMermaidScale = '';
            return `<div class="mermaid" data-scale="${scale}">${code}</div>`;
        }
        let highlighted: string;
        if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(code, { language: lang }).value;
        } else {
            // Skip expensive auto-detection, use plain text
            highlighted = escapeHtml(code);
        }
        return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>\n`;
    };

    renderer.image = (href: string | null, title: string | null, text: string): string => {
        let src = href || '';
        if (src && !src.match(/^(https?:\/\/|data:)/) && opts.resolveImageUri) {
            src = opts.resolveImageUri(src);
        }
        const titleAttr = title ? ` title="${title}"` : '';
        return `<img src="${src}" alt="${text || ''}"${titleAttr}>`;
    };

    renderer.link = (href: string | null, title: string | null, text: string): string => {
        const safeHref = href || '#';
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${safeHref}"${titleAttr}>${text}</a>`;
    };

    marked.setOptions({
        renderer,
        gfm: true,
        breaks: false,
    });

    return marked.parse(content) as string;
}

export interface TocItem {
    level: number;
    text: string;
    line: number;
}

export function parseToc(content: string, maxLevel: number = 6): TocItem[] {
    const lines = content.split('\n');
    const items: TocItem[] = [];
    let inFencedBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const text = lines[i].trimEnd();

        // Track fenced code blocks (``` or ~~~) and $$ math blocks
        if (text.match(/^(`{3,}|~{3,})/)) {
            inFencedBlock = !inFencedBlock;
            continue;
        }
        if (text.match(/^\$\$\s*$/)) {
            inFencedBlock = !inFencedBlock;
            continue;
        }
        if (inFencedBlock) continue;

        // ATX headings (# Heading)
        const atxMatch = text.match(/^(#{1,6})\s+(.+)$/);
        if (atxMatch) {
            const level = atxMatch[1].length;
            if (level <= maxLevel) {
                items.push({ level, text: atxMatch[2].trim(), line: i });
            }
            continue;
        }

        // Setext headings (Heading\n=== or Heading\n---)
        if (i > 0) {
            const prevText = lines[i - 1].trim();
            if (prevText && !prevText.match(/^(#{1,6})\s/)) {
                if (text.match(/^=+$/)) {
                    items.push({ level: 1, text: prevText, line: i - 1 });
                } else if (text.match(/^-+$/) && text.length >= 2) {
                    items.push({ level: 2, text: prevText, line: i - 1 });
                }
            }
        }
    }

    return items;
}
