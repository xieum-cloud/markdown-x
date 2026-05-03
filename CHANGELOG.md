# Changelog

## 0.1.8 (2026-04-24)

- Reliable auto-refresh: mermaid diagrams update correctly when source is edited, added, removed, or reordered (was previously index-based and could misalign)
- In-preview search (Cmd/Ctrl+F): live highlight, Enter / Shift+Enter to navigate, ESC to close
- Remove manual "Refresh Preview" command — auto-refresh handles all cases now

## 0.1.7 (2026-04-22)

- Fix blank preview after VS Code restart when only preview panel remained
- Add "Configure Keyboard Shortcuts..." command for easy key binding management
- Restrict toolbar buttons to markdown editor / preview panel (hide on Claude chat and other tabs)
- Harden lightbox CSS against host style interference
- Handle file:// protocol in image paths

## 0.1.6 (2026-04-08)

- Fix image loading for files outside document directory (workspace-wide resource access)

## 0.1.5 (2026-04-07)

- Explorer context menu: right-click .md file to open preview
- Multiple independent preview panels (one per file)
- Per-file scroll sync and document change tracking

## 0.1.4 (2026-04-06)

- Fix scroll jump when switching files during preview
- Fix diagram scale not applied in production build
- Fix mermaid toolbar scope issue on content update

## 0.1.3 (2026-04-06)

- Preview performance improvements
- Diagram resize toolbar fix
- Cmd/Ctrl + scroll to resize font
- Scroll sync improvements
- Code cleanup and refactoring

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
