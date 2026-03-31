# Markdown X

Ultimate Markdown Viewer for VSCode with high-quality document export.

Markdown X is a **viewer-focused** extension. It does not add editing features -- it renders your markdown beautifully and exports it to PDF, Word, and HWP with page-aware layout.

## Features

### Preview

- **Real-time preview** with side-by-side editing
- **Syntax highlighting** for 20+ languages (server-side via highlight.js)
- **Mermaid diagrams** -- flowchart, sequence, class, state, gantt, pie, ER
- **KaTeX math** -- inline `$E=mc^2$` and block `$$...$$`
- **Image lightbox** -- click to zoom, ESC to close
- **Scroll sync** -- editor and preview scroll together
- **4 themes** -- Auto (follows VS Code), Light, Dark, Sepia

### Page Preview

- **Page boundary overlay** -- toggle to see where pages break
- **Page gap visualization** -- Word-like page layout view
- **Split detection** -- highlights elements that span page boundaries
  - Green left border: auto-fixed by CSS at export
  - Yellow left border: too tall, will be split with smart handling

### Export

- **PDF** -- via system Chrome/Edge (puppeteer-core, no bundled Chromium)
  - Page-aware layout: tables, images, code blocks avoid splitting
  - Long tables: auto-split with repeated headers
  - Long code blocks: auto-split with "(continued)" labels
  - Header/footer with title and page numbers
  - Configurable page size (A4, A3, Letter, Legal) and margins
- **Word (.docx)** -- via html-to-docx
- **HWP (.hwpx)** -- native HWPX/OWPML XML generation
- **Print** -- opens in system browser with auto-print

### Customization

- **Font family** -- choose from preset Korean/English fonts or enter custom
- **Font size** -- adjustable via toolbar (+/-) or settings (10-32px)
- **Theme** -- Auto, Light, Dark, Sepia
- **Custom CSS** -- external CSS file or inline CSS
- **Code font** -- separate font setting for code blocks
- **Page size and margins** -- for PDF export and page preview

### Diagram Controls

- **Hover to resize** -- floating toolbar appears on mermaid diagrams
- **Scale 30%-200%** with +/- buttons
- **Reset** to original size

### TOC Navigation

- **Sidebar tree view** -- auto-generated from headings (H1-H6)
- **Click to jump** -- navigates editor to heading position
- **Configurable depth** -- set max heading level to display

## Commands

| Command | Description |
| ------- | ----------- |
| `Markdown X: Open Preview` | Open preview to the side |
| `Markdown X: Refresh Preview` | Force refresh preview |
| `Markdown X: Export to PDF` | Export as PDF with page-aware layout |
| `Markdown X: Export to Word` | Export as .docx |
| `Markdown X: Export to HWP` | Export as .hwpx |
| `Markdown X: Print` | Open in browser for printing |
| `Markdown X: Toggle Page Preview` | Show/hide page boundaries |
| `Markdown X: Change Font` | Select font family |
| `Markdown X: Change Theme` | Select preview theme |
| `Markdown X: Change Page Size` | Select page size |
| `Markdown X: Change Page Margin` | Select page margins |
| `Markdown X: Increase/Decrease Font Size` | Adjust font size by 2px |

## Settings

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `markdown-x.theme` | `auto` | Preview theme |
| `markdown-x.fontSize` | `16` | Font size (px) |
| `markdown-x.lineHeight` | `1.6` | Line height |
| `markdown-x.fontFamily` | system | Body font family |
| `markdown-x.codeFontFamily` | monospace | Code block font |
| `markdown-x.enableMermaid` | `true` | Enable Mermaid diagrams |
| `markdown-x.enableImageLightbox` | `true` | Enable image click-to-zoom |
| `markdown-x.enableScrollSync` | `true` | Enable scroll sync |
| `markdown-x.maxTocLevel` | `6` | Max heading level in TOC |
| `markdown-x.customCssPath` | | Path to custom CSS file |
| `markdown-x.customCss` | | Inline custom CSS |
| `markdown-x.pdf.pageSize` | `A4` | PDF page size |
| `markdown-x.pdf.margin` | `20mm` | PDF margins |
| `markdown-x.pdf.headerFooter` | `true` | Show header/footer in PDF |

## Page Break Handling

Markdown X automatically prevents content from splitting across pages during PDF export:

| Element | Size | Handling |
| ------- | ---- | -------- |
| Table, code, image | Fits on page | `break-inside: avoid` (CSS) |
| Heading | Any | `break-after: avoid` -- stays with next content |
| Paragraph | Any | `orphans: 3; widows: 3` -- min 3 lines at break |
| Long table | Exceeds page | Auto-split with repeated header rows |
| Long code block | Exceeds page | Auto-split with "(continued)" label |
| Manual break | User-defined | `<!-- pagebreak -->` in markdown |

## Requirements

- **VSCode** 1.74+
- **Chrome, Edge, or Chromium** -- required for PDF export (auto-detected)

## Internationalization

- English (default)
- Korean (ko)

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npx ts-node src/markdownParser.test.ts

# Debug: press F5 in VSCode
```

## Project Structure

```text
src/
  extension.ts            Entry point, command registration
  previewProvider.ts       Webview preview panel
  markdownParser.ts        Markdown parser (marked + highlight.js)
  tocProvider.ts           TOC sidebar tree view
  export/
    exportPdf.ts           PDF export (puppeteer-core)
    exportDocx.ts          Word export (html-to-docx)
    exportHwpx.ts          HWP export (HWPX XML)
    printDocument.ts       Print via browser
    printStyles.ts         Export HTML template + print CSS
    chromeFinder.ts        System Chrome/Edge detection
    pageBreakProcessor.ts  Long table/code auto-split for PDF
```

## License

MIT

## Author

ilovecorea (<xieum@icloud.com>)
