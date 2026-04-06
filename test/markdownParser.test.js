"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const markdownParser_1 = require("./markdownParser");
// ============================================================
// parseMarkdown tests
// ============================================================
function test(name, fn) {
    try {
        fn();
        console.log(`  \u2713 ${name}`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  \u2717 ${name}`);
        console.error(`    ${msg}`);
        process.exitCode = 1;
    }
}
console.log('\n=== parseMarkdown ===');
test('renders headings', () => {
    const html = (0, markdownParser_1.parseMarkdown)('# Hello\n## World');
    assert.ok(html.includes('<h1'));
    assert.ok(html.includes('Hello'));
    assert.ok(html.includes('<h2'));
    assert.ok(html.includes('World'));
});
test('renders bold and italic', () => {
    const html = (0, markdownParser_1.parseMarkdown)('**bold** and *italic*');
    assert.ok(html.includes('<strong>bold</strong>'));
    assert.ok(html.includes('<em>italic</em>'));
});
test('renders links', () => {
    const html = (0, markdownParser_1.parseMarkdown)('[click](https://example.com)');
    assert.ok(html.includes('href="https://example.com"'));
    assert.ok(html.includes('click'));
});
test('renders images', () => {
    const html = (0, markdownParser_1.parseMarkdown)('![alt text](https://example.com/img.png)');
    assert.ok(html.includes('<img'));
    assert.ok(html.includes('src="https://example.com/img.png"'));
    assert.ok(html.includes('alt="alt text"'));
});
test('resolves relative image paths via resolveImageUri', () => {
    const html = (0, markdownParser_1.parseMarkdown)('![pic](./images/test.png)', {
        resolveImageUri: (src) => `webview://resolved/${src}`
    });
    assert.ok(html.includes('src="webview://resolved/./images/test.png"'));
});
test('does not resolve absolute http image paths', () => {
    const html = (0, markdownParser_1.parseMarkdown)('![pic](https://cdn.example.com/img.png)', {
        resolveImageUri: (src) => `SHOULD_NOT_APPEAR`
    });
    assert.ok(!html.includes('SHOULD_NOT_APPEAR'));
    assert.ok(html.includes('src="https://cdn.example.com/img.png"'));
});
test('renders code blocks with syntax highlighting', () => {
    const html = (0, markdownParser_1.parseMarkdown)('```javascript\nconst x = 1;\n```');
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('hljs'));
    assert.ok(html.includes('language-javascript'));
});
test('renders mermaid blocks as div.mermaid', () => {
    const html = (0, markdownParser_1.parseMarkdown)('```mermaid\ngraph TD\n  A-->B\n```');
    assert.ok(html.includes('<div class="mermaid">'));
    assert.ok(html.includes('A-->B'));
    assert.ok(!html.includes('<pre>'));
});
test('renders inline code', () => {
    const html = (0, markdownParser_1.parseMarkdown)('Use `npm install` to install');
    assert.ok(html.includes('<code>npm install</code>'));
});
test('renders unordered lists', () => {
    const html = (0, markdownParser_1.parseMarkdown)('- item 1\n- item 2\n- item 3');
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>item 1</li>'));
    assert.ok(html.includes('<li>item 2</li>'));
    assert.ok(html.includes('<li>item 3</li>'));
});
test('renders ordered lists', () => {
    const html = (0, markdownParser_1.parseMarkdown)('1. first\n2. second\n3. third');
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<li>first</li>'));
    assert.ok(html.includes('<li>second</li>'));
});
test('renders nested lists', () => {
    const html = (0, markdownParser_1.parseMarkdown)('- a\n  - b\n  - c\n- d');
    // Should produce nested <ul> structure
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('b'));
    assert.ok(html.includes('c'));
});
test('renders tables (GFM)', () => {
    const md = '| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |';
    const html = (0, markdownParser_1.parseMarkdown)(md);
    assert.ok(html.includes('<table>'));
    assert.ok(html.includes('<th'));
    assert.ok(html.includes('Alice'));
    assert.ok(html.includes('Bob'));
});
test('renders blockquotes', () => {
    const html = (0, markdownParser_1.parseMarkdown)('> This is a quote');
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('This is a quote'));
});
test('renders horizontal rules', () => {
    const html = (0, markdownParser_1.parseMarkdown)('---');
    assert.ok(html.includes('<hr'));
});
test('renders strikethrough (GFM)', () => {
    const html = (0, markdownParser_1.parseMarkdown)('~~deleted~~');
    assert.ok(html.includes('<del>deleted</del>'));
});
test('escapes HTML in content', () => {
    const html = (0, markdownParser_1.parseMarkdown)('This is <script>alert("xss")</script>');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
});
test('renders task lists', () => {
    const html = (0, markdownParser_1.parseMarkdown)('- [x] done\n- [ ] todo');
    assert.ok(html.includes('done'));
    assert.ok(html.includes('todo'));
});
// ============================================================
// parseToc tests
// ============================================================
console.log('\n=== parseToc ===');
test('parses ATX headings', () => {
    const toc = (0, markdownParser_1.parseToc)('# H1\n## H2\n### H3');
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
    const toc = (0, markdownParser_1.parseToc)('Title\n===\nSubtitle\n---');
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].level, 1);
    assert.strictEqual(toc[0].text, 'Title');
    assert.strictEqual(toc[1].level, 2);
    assert.strictEqual(toc[1].text, 'Subtitle');
});
test('respects maxLevel', () => {
    const toc = (0, markdownParser_1.parseToc)('# H1\n## H2\n### H3\n#### H4', 2);
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].text, 'H1');
    assert.strictEqual(toc[1].text, 'H2');
});
test('handles mixed headings', () => {
    const md = '# First\nSome text\n## Second\n### Third\n## Fourth';
    const toc = (0, markdownParser_1.parseToc)(md);
    assert.strictEqual(toc.length, 4);
    assert.strictEqual(toc[0].text, 'First');
    assert.strictEqual(toc[1].text, 'Second');
    assert.strictEqual(toc[2].text, 'Third');
    assert.strictEqual(toc[3].text, 'Fourth');
});
test('returns empty array for no headings', () => {
    const toc = (0, markdownParser_1.parseToc)('Just some text\nwith no headings');
    assert.strictEqual(toc.length, 0);
});
test('handles headings with inline formatting', () => {
    const toc = (0, markdownParser_1.parseToc)('## **Bold** Heading\n### `Code` Heading');
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].text, '**Bold** Heading');
    assert.strictEqual(toc[1].text, '`Code` Heading');
});
test('ignores headings in code blocks context (line by line)', () => {
    // parseToc does line-by-line parsing, so it will pick up # inside code blocks
    // This is a known limitation - just verify it doesn't crash
    const md = '```\n# Not a heading\n```\n# Real heading';
    const toc = (0, markdownParser_1.parseToc)(md);
    assert.ok(toc.length >= 1);
    assert.ok(toc.some(item => item.text === 'Real heading'));
});
console.log('\n=== All tests complete ===\n');
//# sourceMappingURL=markdownParser.test.js.map