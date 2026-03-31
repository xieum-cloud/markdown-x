# Markdown X Phase 2 — 설계서

> 작성일: 2026-03-31
> 버전: 0.2.0

## 1. 개요

### 1.1 목표

Markdown X를 **고품질 문서 뷰어 + 내보내기 도구**로 완성한다.
마크다운으로 작성하되, 최종 산출물은 PDF/Word/HWP 등 공식 문서 포맷으로 배포하는 워크플로우를 지원한다.

### 1.2 핵심 원칙

- **네이티브 품질**: 내보낸 문서가 해당 포맷으로 직접 작성한 것처럼 보여야 한다
- **페이지 인식**: 표, 그림, 코드 블록이 페이지 경계에서 잘리지 않는다
- **뷰어 집중**: 편집 기능은 만들지 않는다

### 1.3 Phase 2 범위

| 기능 | 우선순위 | 설명 |
|------|----------|------|
| 커스텀 CSS / 글꼴 / 폰트 크기 | P0 | 뷰어 스타일 커스터마이징 |
| PDF 내보내기 | P0 | 페이지 인식 레이아웃 |
| Word(.docx) 내보내기 | P1 | 네이티브 Word 품질 |
| HWP(.hwpx) 내보내기 | P1 | 한글 문서 포맷 |
| 인쇄 기능 | P1 | 프리뷰에서 바로 인쇄 |

---

## 2. 커스텀 CSS / 글꼴 / 폰트 크기

### 2.1 설정 항목

```jsonc
// settings.json
{
  // 기존 설정 (유지)
  "markdown-x.fontSize": 16,
  "markdown-x.lineHeight": 1.6,

  // 신규 설정
  "markdown-x.fontFamily": "Pretendard, -apple-system, sans-serif",
  "markdown-x.codeFontFamily": "JetBrains Mono, SF Mono, monospace",
  "markdown-x.customCssPath": "./my-style.css",
  "markdown-x.customCss": "h1 { color: navy; }"
}
```

### 2.2 설정 우선순위

```
1. 기본 테마 CSS (theme-auto/light/dark/sepia)
2. markdown-x.fontFamily / fontSize / lineHeight (설정 값)
3. markdown-x.customCssPath (외부 CSS 파일)
4. markdown-x.customCss (인라인 CSS)
```

뒤에 오는 설정이 앞의 설정을 오버라이드한다.

### 2.3 구현 방식

```
generateHtml()
  ├── 기본 <style> 블록 (기존)
  ├── fontFamily/codeFontFamily → CSS 변수로 주입
  ├── customCssPath → fs.readFileSync()로 읽어서 <style> 블록 추가
  └── customCss → <style> 블록 추가
```

**변경 파일:**
- `src/previewProvider.ts` — `generateHtml()`에 CSS 주입 로직 추가
- `package.json` — `contributes.configuration`에 신규 설정 추가

### 2.4 package.json 설정 스키마

```jsonc
{
  "markdown-x.fontFamily": {
    "type": "string",
    "default": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "description": "본문 글꼴"
  },
  "markdown-x.codeFontFamily": {
    "type": "string",
    "default": "'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace",
    "description": "코드 블록 글꼴"
  },
  "markdown-x.customCssPath": {
    "type": "string",
    "default": "",
    "description": "커스텀 CSS 파일 경로 (워크스페이스 상대 경로)"
  },
  "markdown-x.customCss": {
    "type": "string",
    "default": "",
    "description": "인라인 커스텀 CSS"
  }
}
```

---

## 3. PDF 내보내기

### 3.1 기술 선택

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **Puppeteer** | 정확한 CSS 렌더링, `break-inside: avoid` 지원 | Chromium 번들 ~300MB | ❌ 크기 |
| **Playwright** | Puppeteer보다 빠르고 작은 PDF | 마찬가지로 Chromium 필요 | ❌ 크기 |
| **@pagedjs/pagedjs** | CSS Paged Media 폴리필, 브라우저 내 동작 | 순수 JS, Chromium 불필요 | ⭐ 검토 |
| **시스템 Chrome 활용** | 별도 번들 불필요 | 사용자 환경에 Chrome 필요 | ⭐ 1차 선택 |

**결정: 시스템에 설치된 Chrome/Edge를 활용한 puppeteer-core**

```
npm install puppeteer-core
```

- `puppeteer-core`는 Chromium을 번들하지 않음 (번들 크기 ~2MB)
- 시스템의 Chrome/Edge/Chromium 경로를 자동 탐지
- Chrome이 없는 환경을 위한 폴백 고려

### 3.2 페이지 인식 레이아웃

PDF 내보내기 시 적용할 **인쇄용 CSS**:

```css
@media print {
  /* 페이지 설정 */
  @page {
    size: A4;
    margin: 20mm 15mm;

    @top-center {
      content: string(doc-title);
    }
    @bottom-center {
      content: counter(page) " / " counter(pages);
    }
  }

  /* 표 잘림 방지 */
  table, figure, .mermaid {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* 표가 페이지보다 길 경우 thead 반복 */
  thead {
    display: table-header-group;
  }

  /* 이미지 잘림 방지 */
  img {
    break-inside: avoid;
    page-break-inside: avoid;
    max-height: 80vh;
  }

  /* 코드 블록 잘림 방지 (짧은 경우) */
  pre {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* 긴 코드 블록은 페이지 넘김 허용하되, 최소 3줄 유지 */
  pre code {
    orphans: 3;
    widows: 3;
  }

  /* 헤딩 다음 내용과 분리 방지 */
  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* 라이트박스 숨김 */
  .lightbox { display: none !important; }
}
```

### 3.3 내보내기 흐름

```
사용자: Command Palette → "Markdown X: Export to PDF"
  │
  ├── 1. 현재 마크다운 → HTML 변환 (marked + highlight.js)
  ├── 2. 인쇄용 CSS 적용 (페이지 인식 스타일)
  ├── 3. Mermaid 다이어그램 → SVG 변환 (CDN 로딩 대기)
  ├── 4. KaTeX 수식 렌더링 대기
  ├── 5. puppeteer-core로 Chrome 열기 (headless)
  ├── 6. page.pdf() 호출
  │     - format: 'A4'
  │     - printBackground: true
  │     - displayHeaderFooter: true
  │     - headerTemplate / footerTemplate
  ├── 7. 저장 경로 선택 다이얼로그
  └── 8. 파일 저장 + 완료 알림
```

### 3.4 Chrome 자동 탐지

```typescript
function findChromePath(): string | undefined {
  const platform = process.platform;

  if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    return paths.find(p => fs.existsSync(p));
  }

  if (platform === 'win32') {
    const paths = [
      process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    return paths.find(p => fs.existsSync(p));
  }

  // Linux
  const paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];
  return paths.find(p => fs.existsSync(p));
}
```

### 3.5 PDF 옵션

```jsonc
{
  "markdown-x.pdf.pageSize": {
    "type": "string",
    "default": "A4",
    "enum": ["A4", "A3", "Letter", "Legal"],
    "description": "PDF 페이지 크기"
  },
  "markdown-x.pdf.margin": {
    "type": "string",
    "default": "20mm",
    "description": "PDF 여백 (CSS 형식: '20mm' 또는 '20mm 15mm')"
  },
  "markdown-x.pdf.headerFooter": {
    "type": "boolean",
    "default": true,
    "description": "머리글/바닥글 표시 (제목, 페이지 번호)"
  },
  "markdown-x.pdf.printBackground": {
    "type": "boolean",
    "default": true,
    "description": "배경색/이미지 인쇄"
  }
}
```

---

## 4. Word(.docx) 내보내기

### 4.1 기술 선택

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **docx** (npm) | 네이티브 OOXML, 풍부한 API | 마크다운 직접 변환 필요 | ⭐ |
| **html-to-docx** | HTML → DOCX 직접 변환 | 레이아웃 제어 제한적 | 폴백 |
| **pandoc** | 최고 품질 | 시스템 설치 필요 | ❌ |

**결정: `html-to-docx`를 1차, 부족하면 `docx`로 커스텀**

```
npm install html-to-docx
```

### 4.2 내보내기 흐름

```
사용자: Command Palette → "Markdown X: Export to Word"
  │
  ├── 1. 마크다운 → HTML 변환 (기존 parseMarkdown)
  ├── 2. Mermaid → SVG 인라인 변환
  ├── 3. html-to-docx로 변환
  │     - 페이지 크기, 여백 설정
  │     - 테이블 스타일 매핑
  │     - 이미지 임베딩
  │     - 헤딩 → Word 스타일 (Heading 1, 2, 3...)
  ├── 4. 저장 경로 선택 다이얼로그
  └── 5. 파일 저장 + 완료 알림
```

### 4.3 Word 스타일 매핑

| 마크다운 요소 | Word 스타일 |
|--------------|-------------|
| `# H1` | Heading 1 |
| `## H2` | Heading 2 |
| `### H3` | Heading 3 |
| 본문 | Normal |
| `**bold**` | Bold run |
| `*italic*` | Italic run |
| 코드 블록 | 고정폭 폰트 + 음영 배경 |
| 테이블 | Table Grid 스타일 |
| 이미지 | 인라인 이미지 (원본 크기, max-width 제한) |
| 인용문 | Quote 스타일 + 좌측 테두리 |

### 4.4 페이지 잘림 방지

```typescript
// html-to-docx 옵션
const options = {
  table: { row: { cantSplit: true } },   // 표 행 페이지 분리 금지
  pageBreak: { avoidInsideTable: true },  // 표 내부 페이지 나눔 방지
};
```

---

## 5. HWP(.hwpx) 내보내기

### 5.1 기술 선택

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **kordoc** | Markdown → HWPX 직접 변환 | 제한된 기능 | ⭐ 검토 |
| **HWPX 직접 생성** | 완전한 제어 | 복잡한 OWPML 스펙 | 폴백 |
| **DOCX → HWP 변환** | 간접 경로 | 한컴오피스 필요 | ❌ |

**결정: `kordoc` 우선 검토, 부족하면 HWPX XML 직접 생성**

### 5.2 HWPX 포맷 구조

HWPX는 ZIP 압축된 XML 기반 포맷 (OWPML 표준):

```
document.hwpx (ZIP)
├── META-INF/
│   └── container.xml
├── Contents/
│   ├── content.hpf          (패키지 정보)
│   ├── header.xml           (문서 설정)
│   ├── section0.xml         (본문 내용)
│   └── ...
└── BinData/                  (이미지 등 바이너리)
```

### 5.3 내보내기 흐름

```
사용자: Command Palette → "Markdown X: Export to HWP"
  │
  ├── 1. 마크다운 파싱 (marked 토큰)
  ├── 2. 토큰 → HWPX XML 변환
  │     - 헤딩 → 문단 스타일
  │     - 표 → HWPX 테이블 구조
  │     - 이미지 → BinData 디렉토리
  │     - 코드 블록 → 고정폭 폰트 문단
  ├── 3. XML 파일들을 ZIP으로 압축
  ├── 4. 저장 경로 선택 다이얼로그
  └── 5. .hwpx 확장자로 저장
```

### 5.4 제약 사항

- Mermaid 다이어그램: SVG를 PNG로 변환 후 이미지로 삽입
- KaTeX 수식: 이미지로 변환하거나, HWPX의 수식 기능 활용 (복잡)
- 1차 구현에서는 기본 텍스트/표/이미지/코드 블록에 집중

---

## 6. 인쇄 기능

### 6.1 구현 방식

VSCode Webview에서 `window.print()`는 제한적이므로, **PDF 생성 → 시스템 인쇄**로 처리한다.

```
사용자: Command Palette → "Markdown X: Print"
  │
  ├── 1. PDF 내보내기 로직 재활용 (임시 파일)
  ├── 2. 시스템 기본 PDF 뷰어로 열기
  │     └── vscode.env.openExternal(tempPdfUri)
  └── 3. 사용자가 PDF 뷰어에서 인쇄 (Ctrl+P)
```

또는 Webview에서 인쇄 전용 HTML을 새 창으로 열어 `window.print()` 호출:

```
사용자: Command Palette → "Markdown X: Print"
  │
  ├── 1. 인쇄용 HTML 생성 (인쇄 CSS 적용)
  ├── 2. 임시 HTML 파일 저장
  ├── 3. 시스템 기본 브라우저로 열기
  └── 4. 자동으로 window.print() 호출
```

**결정: 두 가지 모두 지원**
- "Print" → 브라우저 인쇄 (빠름)
- "Export to PDF" → PDF 파일 저장 (보관용)

---

## 7. 커맨드 등록

### 7.1 신규 커맨드

| 커맨드 ID | 타이틀 (en) | 타이틀 (ko) |
|-----------|-------------|-------------|
| `markdown-x.exportPdf` | Export to PDF | PDF로 내보내기 |
| `markdown-x.exportDocx` | Export to Word | Word로 내보내기 |
| `markdown-x.exportHwpx` | Export to HWP | HWP로 내보내기 |
| `markdown-x.print` | Print | 인쇄 |

### 7.2 메뉴 배치

- **에디터 타이틀 바**: 내보내기 드롭다운 버튼 (마크다운 파일일 때)
- **에디터 컨텍스트 메뉴**: "Markdown X" 서브메뉴에 내보내기/인쇄 추가
- **Command Palette**: 모든 커맨드 접근 가능

### 7.3 에디터 타이틀 메뉴

```jsonc
{
  "submenu": [
    {
      "id": "markdown-x.export",
      "label": "Export..."
    }
  ],
  "menus": {
    "markdown-x.export": [
      { "command": "markdown-x.exportPdf" },
      { "command": "markdown-x.exportDocx" },
      { "command": "markdown-x.exportHwpx" },
      { "separator": true },
      { "command": "markdown-x.print" }
    ],
    "editor/title": [
      {
        "submenu": "markdown-x.export",
        "group": "navigation",
        "when": "editorLangId == markdown"
      }
    ]
  }
}
```

---

## 8. 파일 구조 (Phase 2 추가분)

```
src/
├── extension.ts               (커맨드 등록 추가)
├── previewProvider.ts         (커스텀 CSS 주입)
├── markdownParser.ts          (기존 유지)
├── tocProvider.ts             (기존 유지)
├── export/
│   ├── exportPdf.ts           (PDF 내보내기)
│   ├── exportDocx.ts          (Word 내보내기)
│   ├── exportHwpx.ts          (HWP 내보내기)
│   ├── printDocument.ts       (인쇄)
│   ├── chromeFinder.ts        (Chrome 경로 탐지)
│   └── printStyles.ts         (인쇄용 CSS)
└── test/
    └── export.test.ts         (내보내기 테스트)
```

---

## 9. 의존성 추가

| 패키지 | 용도 | 번들 크기 |
|--------|------|-----------|
| `puppeteer-core` | PDF 생성 (시스템 Chrome 활용) | ~2MB |
| `html-to-docx` | Word 변환 | ~500KB |
| `archiver` | HWPX ZIP 생성 | ~200KB |

```bash
npm install puppeteer-core html-to-docx archiver
npm install -D @types/archiver
```

---

## 10. 구현 순서

```
1. 커스텀 CSS / 글꼴 설정 ─────────────── (0.5일)
   └── package.json 설정 + generateHtml 수정

2. 인쇄용 CSS (printStyles.ts) ────────── (0.5일)
   └── 페이지 인식 레이아웃 CSS 작성

3. PDF 내보내기 ───────────────────────── (1일)
   ├── chromeFinder.ts
   ├── exportPdf.ts
   └── 커맨드 등록 + 테스트

4. 인쇄 기능 ─────────────────────────── (0.5일)
   └── PDF 로직 재활용

5. Word 내보내기 ──────────────────────── (1일)
   ├── exportDocx.ts
   └── 스타일 매핑 + 테스트

6. HWP 내보내기 ───────────────────────── (1.5일)
   ├── HWPX XML 구조 구현
   ├── exportHwpx.ts
   └── 테스트

7. 통합 테스트 + 마무리 ──────────────── (0.5일)
```

---

## 11. 보안 고려사항

- **puppeteer-core**: `--no-sandbox` 플래그 사용하지 않음
- **파일 경로**: 사용자 입력 경로 검증 (path traversal 방지)
- **customCssPath**: 워크스페이스 내부 파일만 허용
- **임시 파일**: 내보내기 완료 후 즉시 삭제

---

## 12. 에러 처리

| 상황 | 대응 |
|------|------|
| Chrome 미설치 | "Chrome/Edge를 설치해주세요" 안내 + 다운로드 링크 |
| 내보내기 실패 | 에러 메시지 + 디테일 출력 채널 |
| 대용량 문서 | 프로그레스 바 표시 (`vscode.window.withProgress`) |
| Mermaid 렌더링 타임아웃 | 5초 대기 후 텍스트로 폴백 |
