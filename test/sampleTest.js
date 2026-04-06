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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const markdownParser_1 = require("./markdownParser");
const samplePath = path.join(__dirname, '..', 'sample', 'demo.md');
const content = fs.readFileSync(samplePath, 'utf-8');
// ============================================================
// 1. TOC 파싱 테스트
// ============================================================
console.log('=== TOC Parsing ===\n');
const toc = (0, markdownParser_1.parseToc)(content);
toc.forEach(item => {
    const indent = '  '.repeat(item.level - 1);
    console.log(`${indent}${'#'.repeat(item.level)} ${item.text}  (line ${item.line + 1})`);
});
console.log(`\nTotal headings: ${toc.length}`);
// ============================================================
// 2. HTML 렌더링 테스트
// ============================================================
console.log('\n=== HTML Rendering ===\n');
const html = (0, markdownParser_1.parseMarkdown)(content);
const checks = [
    // [label, pattern, description]
    ['H1', /<h1.*?>.*?Markdown X Demo Document.*?<\/h1>/s, '최상위 제목'],
    ['H2', /<h2/g, '섹션 제목 (h2)'],
    ['H3', /<h3/g, '서브섹션 제목 (h3)'],
    ['Bold', /<strong>/, '굵은 글씨'],
    ['Italic', /<em>/, '기울임 글씨'],
    ['Strikethrough', /<del>/, '취소선'],
    ['Link', /<a href="https:\/\/github\.com"/, '외부 링크'],
    ['Inline Code', /<code>console\.log/, '인라인 코드'],
    ['Code Block (JS)', /language-javascript/, 'JavaScript 코드 블록'],
    ['Code Block (Python)', /language-python/, 'Python 코드 블록'],
    ['Code Block (TS)', /language-typescript/, 'TypeScript 코드 블록'],
    ['Code Block (SQL)', /language-sql/, 'SQL 코드 블록'],
    ['Code Block (Bash)', /language-bash/, 'Bash 코드 블록'],
    ['Code Block (JSON)', /language-json/, 'JSON 코드 블록'],
    ['Code Block (CSS)', /language-css/, 'CSS 코드 블록'],
    ['Syntax Highlight', /class="hljs/, 'highlight.js 적용'],
    ['Mermaid Flowchart', /<div class="mermaid">[\s\S]*?flowchart/, 'Mermaid 플로우차트'],
    ['Mermaid Sequence', /<div class="mermaid">[\s\S]*?sequenceDiagram/, 'Mermaid 시퀀스'],
    ['Mermaid Class', /<div class="mermaid">[\s\S]*?classDiagram/, 'Mermaid 클래스'],
    ['Mermaid State', /<div class="mermaid">[\s\S]*?stateDiagram/, 'Mermaid 상태'],
    ['Mermaid Gantt', /<div class="mermaid">[\s\S]*?gantt/, 'Mermaid 간트'],
    ['Mermaid Pie', /<div class="mermaid">[\s\S]*?pie/, 'Mermaid 파이'],
    ['Mermaid ER', /<div class="mermaid">[\s\S]*?erDiagram/, 'Mermaid ER'],
    ['PlantUML (as code)', /language-plantuml/, 'PlantUML 코드 블록'],
    ['Table', /<table>/, '테이블'],
    ['Table Header', /<th/, '테이블 헤더'],
    ['Table Cell', /<td/, '테이블 셀'],
    ['Unordered List', /<ul>/, '비순서 리스트'],
    ['Ordered List', /<ol>/, '순서 리스트'],
    ['Task List', /type="checkbox"/, '체크박스'],
    ['Blockquote', /<blockquote>/, '인용문'],
    ['Horizontal Rule', /<hr/, '수평선'],
    ['Image', /<img.*?src=/, '이미지'],
    ['XSS Escaped', '&lt;script&gt;', 'XSS 이스케이프'],
    ['No Raw Script', 'no-raw-script', 'Raw <script> 태그 없음'],
    ['KaTeX Inline', /\$E = mc\^2\$/, 'KaTeX 인라인 (텍스트 보존)'],
    ['KaTeX Block', /\$\$/, 'KaTeX 블록 (텍스트 보존)'],
];
let passed = 0;
let failed = 0;
for (const [label, pattern, desc] of checks) {
    let ok;
    if (label === 'No Raw Script') {
        // Special: should NOT contain unescaped <script>
        ok = !/<script>/.test(html);
    }
    else if (typeof pattern === 'string') {
        ok = html.includes(pattern);
    }
    else {
        ok = pattern.test(html);
    }
    if (ok) {
        console.log(`  \u2713 ${label}: ${desc}`);
        passed++;
    }
    else {
        console.error(`  \u2717 ${label}: ${desc}`);
        failed++;
    }
}
// Count specific elements
const h2Count = (html.match(/<h2/g) || []).length;
const h3Count = (html.match(/<h3/g) || []).length;
const tableCount = (html.match(/<table>/g) || []).length;
const mermaidCount = (html.match(/<div class="mermaid">/g) || []).length;
const codeBlockCount = (html.match(/<pre><code/g) || []).length;
console.log('\n=== Element Counts ===');
console.log(`  H2 headings:    ${h2Count}`);
console.log(`  H3 headings:    ${h3Count}`);
console.log(`  Tables:         ${tableCount}`);
console.log(`  Mermaid blocks: ${mermaidCount}`);
console.log(`  Code blocks:    ${codeBlockCount}`);
console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===`);
if (failed > 0) {
    process.exitCode = 1;
}
// Write HTML output for manual inspection
const outputPath = path.join(__dirname, '..', 'sample', 'demo-output.html');
const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Markdown X Demo Output</title>
<!-- Mermaid for diagrams -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<!-- KaTeX for math -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         max-width: 900px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #24292f; }
  h1, h2, h3 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
  code { font-family: 'SF Mono', Monaco, monospace; font-size: 0.85em; background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { border: 1px solid #d0d7de; padding: 0.5em 1em; text-align: left; }
  th { background: #f6f8fa; }
  blockquote { border-left: 4px solid #d0d7de; padding: 0.5em 1em; margin: 0 0 1em 0; background: #f6f8fa; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 2em 0; }
  .mermaid { text-align: center; margin: 1em 0; padding: 1em; background: #f0f0f0; border-radius: 6px; }
  a { color: #0969da; }
  .hljs-keyword { color: #d73a49; } .hljs-string { color: #032f62; }
  .hljs-comment { color: #6a737d; font-style: italic; } .hljs-number { color: #005cc5; }
  .hljs-title { color: #6f42c1; } .hljs-type { color: #22863a; }
  .hljs-built_in { color: #d73a49; } .hljs-attr { color: #032f62; }
  .hljs-literal { color: #005cc5; } .hljs-section { color: #6f42c1; }
  .hljs-name { color: #22863a; }
  del { text-decoration: line-through; color: #888; }
</style>
</head>
<body>
${html}
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
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
fs.writeFileSync(outputPath, fullHtml, 'utf-8');
console.log(`\nHTML output saved to: sample/demo-output.html`);
console.log('Open it in a browser to visually inspect the rendering.');
//# sourceMappingURL=sampleTest.js.map