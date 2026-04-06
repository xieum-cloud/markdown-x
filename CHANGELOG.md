# Changelog

## 0.1.3 (2026-04-06)

- Performance: debounced preview updates, content-only refresh via postMessage
- Performance: Mermaid diagrams preserved during content updates (no re-render)
- Performance: removed highlight.js auto-detection, cached custom CSS
- Diagram resize toolbar stays visible when switching between diagrams
- Cmd/Ctrl + mouse wheel to adjust font size in preview
- Scroll sync disabled during preview restore to prevent forced scrolling
- Scroll sync paused when preview panel is focused
- Refactored PDF generation into shared pdfGenerator.ts
- Removed dead code: HWP export, TOC provider, stale i18n keys
- Removed unused archiver dependency
- Moved test files to test/ directory

## 0.1.2 (2026-04-03)

- Custom colored toolbar icons (cyan/blue)
- Word export fix (corrupted docx)
- Font/theme settings applied to print and PDF export
- Toolbar cleanup and Mx: prefix for menu items
- Brave/Arc browser support for PDF export

## 0.1.0 (2026-04-01)

First release.

- Markdown preview with side-by-side editing
- PDF export (requires Chrome/Edge/Brave)
- Word (.docx) export
- Print
- PDF page preview in VSCode tab
- Mermaid diagrams with resizable controls
- KaTeX math rendering
- Syntax highlighting for code blocks
- Image lightbox (click to zoom)
- 4 themes: Auto, Light, Dark, Sepia
- Font family and size customization
- Custom CSS support
- Outline navigation (H1-H6)
- Editor-to-preview scroll sync
- English and Korean localization
