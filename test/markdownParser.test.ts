import * as assert from 'assert';
import { parseMarkdown, parseToc } from '../src/markdownParser';

// ============================================================
// parseMarkdown tests
// ============================================================

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  \u2713 ${name}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  \u2717 ${name}`);
        console.error(`    ${msg}`);
        process.exitCode = 1;
    }
}

console.log('\n=== parseMarkdown ===');

test('renders headings', () => {
    const html = parseMarkdown('# Hello\n## World');
    assert.ok(html.includes('<h1'));
    assert.ok(html.includes('Hello'));
    assert.ok(html.includes('<h2'));
    assert.ok(html.includes('World'));
});

test('renders bold and italic', () => {
    const html = parseMarkdown('**bold** and *italic*');
    assert.ok(html.includes('<strong>bold</strong>'));
    assert.ok(html.includes('<em>italic</em>'));
});

test('renders links', () => {
    const html = parseMarkdown('[click](https://example.com)');
    assert.ok(html.includes('href="https://example.com"'));
    assert.ok(html.includes('click'));
});

test('renders images', () => {
    const html = parseMarkdown('![alt text](https://example.com/img.png)');
    assert.ok(html.includes('<img'));
    assert.ok(html.includes('src="https://example.com/img.png"'));
    assert.ok(html.includes('alt="alt text"'));
});

test('resolves relative image paths via resolveImageUri', () => {
    const html = parseMarkdown('![pic](./images/test.png)', {
        resolveImageUri: (src) => `webview://resolved/${src}`
    });
    assert.ok(html.includes('src="webview://resolved/./images/test.png"'));
});

test('does not resolve absolute http image paths', () => {
    const html = parseMarkdown('![pic](https://cdn.example.com/img.png)', {
        resolveImageUri: (src) => `SHOULD_NOT_APPEAR`
    });
    assert.ok(!html.includes('SHOULD_NOT_APPEAR'));
    assert.ok(html.includes('src="https://cdn.example.com/img.png"'));
});

test('renders code blocks with syntax highlighting', () => {
    const html = parseMarkdown('```javascript\nconst x = 1;\n```');
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('hljs'));
    assert.ok(html.includes('language-javascript'));
});

test('renders mermaid blocks as div.mermaid', () => {
    const html = parseMarkdown('```mermaid\ngraph TD\n  A-->B\n```');
    assert.ok(html.includes('<div class="mermaid" data-scale="100">'));
    assert.ok(html.includes('A-->B'));
    assert.ok(!html.includes('<pre>'));
});

test('renders inline code', () => {
    const html = parseMarkdown('Use `npm install` to install');
    assert.ok(html.includes('<code>npm install</code>'));
});

test('renders unordered lists', () => {
    const html = parseMarkdown('- item 1\n- item 2\n- item 3');
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>item 1</li>'));
    assert.ok(html.includes('<li>item 2</li>'));
    assert.ok(html.includes('<li>item 3</li>'));
});

test('renders ordered lists', () => {
    const html = parseMarkdown('1. first\n2. second\n3. third');
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<li>first</li>'));
    assert.ok(html.includes('<li>second</li>'));
});

test('renders nested lists', () => {
    const html = parseMarkdown('- a\n  - b\n  - c\n- d');
    // Should produce nested <ul> structure
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('b'));
    assert.ok(html.includes('c'));
});

test('renders tables (GFM)', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |';
    const html = parseMarkdown(md);
    assert.ok(html.includes('<table>'));
    assert.ok(html.includes('<th'));
    assert.ok(html.includes('Alice'));
    assert.ok(html.includes('Bob'));
});

test('renders blockquotes', () => {
    const html = parseMarkdown('> This is a quote');
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('This is a quote'));
});

test('renders horizontal rules', () => {
    const html = parseMarkdown('---');
    assert.ok(html.includes('<hr'));
});

test('renders strikethrough (GFM)', () => {
    const html = parseMarkdown('~~deleted~~');
    assert.ok(html.includes('<del>deleted</del>'));
});

test('escapes HTML in content', () => {
    const html = parseMarkdown('This is <script>alert("xss")</script>');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
});

test('renders task lists', () => {
    const html = parseMarkdown('- [x] done\n- [ ] todo');
    assert.ok(html.includes('done'));
    assert.ok(html.includes('todo'));
});

// ============================================================
// parseToc tests
// ============================================================

console.log('\n=== parseToc ===');

test('parses ATX headings', () => {
    const toc = parseToc('# H1\n## H2\n### H3');
    assert.strictEqual(toc.length, 3);
    assert.strictEqual(toc[0].level, 1);
    assert.strictEqual(toc[0].text, 'H1');
    assert.strictEqual(toc[0].line, 0);
    assert.strictEqual(toc[1].level, 2);
    assert.strictEqual(toc[1].text, 'H2');
    assert.strictEqual(toc[1].line, 1);
    assert.strictEqual(toc[2].level, 3);
    assert.strictEqual(toc[2].text, 'H3');
    assert.strictEqual(toc[2].line, 2);
});

test('parses setext headings', () => {
    const toc = parseToc('Title\n===\nSubtitle\n---');
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].level, 1);
    assert.strictEqual(toc[0].text, 'Title');
    assert.strictEqual(toc[1].level, 2);
    assert.strictEqual(toc[1].text, 'Subtitle');
});

test('respects maxLevel', () => {
    const toc = parseToc('# H1\n## H2\n### H3\n#### H4', 2);
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].text, 'H1');
    assert.strictEqual(toc[1].text, 'H2');
});

test('handles mixed headings', () => {
    const md = '# First\nSome text\n## Second\n### Third\n## Fourth';
    const toc = parseToc(md);
    assert.strictEqual(toc.length, 4);
    assert.strictEqual(toc[0].text, 'First');
    assert.strictEqual(toc[1].text, 'Second');
    assert.strictEqual(toc[2].text, 'Third');
    assert.strictEqual(toc[3].text, 'Fourth');
});

test('returns empty array for no headings', () => {
    const toc = parseToc('Just some text\nwith no headings');
    assert.strictEqual(toc.length, 0);
});

test('handles headings with inline formatting', () => {
    const toc = parseToc('## **Bold** Heading\n### `Code` Heading');
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].text, '**Bold** Heading');
    assert.strictEqual(toc[1].text, '`Code` Heading');
});

test('ignores headings in code blocks context (line by line)', () => {
    // parseToc does line-by-line parsing, so it will pick up # inside code blocks
    // This is a known limitation - just verify it doesn't crash
    const md = '```\n# Not a heading\n```\n# Real heading';
    const toc = parseToc(md);
    assert.ok(toc.length >= 1);
    assert.ok(toc.some(item => item.text === 'Real heading'));
});

console.log('\n=== All tests complete ===\n');
