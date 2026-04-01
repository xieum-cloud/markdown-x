# Changelog

## [0.2.0] - 2026-04-01

### Added

- PDF export with page-aware layout (puppeteer-core, system Chrome)
- Word (.docx) export via html-to-docx
- PDF page preview in VSCode tab (100% accurate)
- Print via system browser
- Font family selection (Korean/English presets + custom)
- Font size toolbar (+/- buttons and direct input)
- Custom CSS support (file path + inline)
- Theme selector (Auto/Light/Dark/Sepia)
- Page size (A4/A3/Letter/Legal) and margin settings
- Mermaid diagram hover resize toolbar (30%-200%)
- Diagram scale auto-saved to markdown source (`<!-- mermaid-scale: N% -->`)
- Document outline provider (VSCode Outline panel)
- Page break optimization for long tables (header repeat) and code blocks
- `<!-- pagebreak -->` manual page break support
- orphans/widows control for paragraphs
- esbuild bundling for smaller extension size

### Changed

- Replaced custom regex parser with marked + highlight.js
- Mermaid rendering: startOnLoad replaced with mermaid.run()
- Page preview: simulation replaced with real PDF generation
- TOC tree view replaced with VSCode Outline panel
- H1/H2 border-bottom removed for cleaner look

### Fixed

- acquireVsCodeApi() missing in webview
- XSS prevention via raw HTML escaping
- TOC parsing inside code blocks and math blocks
- Scroll sync infinite loop prevention
- Webview panel restore with content reload
- Mermaid FOUC (flash of unstyled content)

## [0.1.0] - 2026-03-30

### Added

- Basic markdown preview with webview
- TOC sidebar navigation
- 4 themes (Auto/Light/Dark/Sepia)
- Image lightbox
- Mermaid diagram support (CDN)
- KaTeX math rendering (CDN)
- Code syntax highlighting
- Scroll sync (editor to preview)
- i18n (English, Korean)
