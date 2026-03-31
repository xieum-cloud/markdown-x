import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import archiver from 'archiver';
import { marked, Token } from 'marked';

/**
 * Export markdown to HWPX (Hangul Word Processor XML format).
 * HWPX is a ZIP-based OWPML standard supported by Hancom Office 2021+.
 */
export async function exportHwpx(document: vscode.TextDocument): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting to HWP...',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 20, message: 'Parsing markdown...' });

            const config = vscode.workspace.getConfiguration('markdown-x');
            const content = document.getText();
            const title = path.basename(document.fileName, path.extname(document.fileName));
            const fontFamily = config.get<string>('fontFamily', '') || '맑은 고딕';
            const fontSize = config.get<number>('fontSize', 16);

            // Parse markdown to tokens
            const tokens = marked.lexer(content);

            progress.report({ increment: 30, message: 'Building HWPX...' });

            // Generate HWPX XML content
            const sectionXml = buildSectionXml(tokens, fontFamily, fontSize);
            const headerXml = buildHeaderXml(fontFamily);
            const contentHpf = buildContentHpf(title);
            const containerXml = buildContainerXml();
            const mimetypeFile = 'application/hwp+zip';

            // Save dialog
            const defaultUri = vscode.Uri.file(
                path.join(path.dirname(document.fileName), `${title}.hwpx`)
            );
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: { 'HWP Document': ['hwpx'] },
            });

            if (!saveUri) return;

            progress.report({ increment: 30, message: 'Packaging...' });

            try {
                await createHwpxZip(saveUri.fsPath, {
                    mimetype: mimetypeFile,
                    containerXml,
                    contentHpf,
                    headerXml,
                    sectionXml,
                });

                progress.report({ increment: 20, message: 'Done!' });
                vscode.window.showInformationMessage(`HWP exported: ${path.basename(saveUri.fsPath)}`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`HWP export failed: ${message}`);
            }
        }
    );
}

// ============================================================
// HWPX XML Generators
// ============================================================

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fontSizeToHwp(px: number): number {
    // HWPX uses hundredths of a point (1pt = 100 units)
    // 16px ≈ 12pt → 1200 units
    return Math.round((px * 0.75) * 100);
}

function buildSectionXml(tokens: Token[], fontFamily: string, fontSize: number): string {
    const hpSize = fontSizeToHwp(fontSize);
    let paragraphs = '';

    for (const token of tokens) {
        switch (token.type) {
            case 'heading': {
                const headingSizes: Record<number, number> = {
                    1: fontSizeToHwp(fontSize * 2),
                    2: fontSizeToHwp(fontSize * 1.5),
                    3: fontSizeToHwp(fontSize * 1.25),
                    4: hpSize,
                    5: fontSizeToHwp(fontSize * 0.875),
                    6: fontSizeToHwp(fontSize * 0.85),
                };
                const size = headingSizes[token.depth] || hpSize;
                paragraphs += `
      <hp:p>
        <hp:run>
          <hp:rPr><hp:sz val="${size}" /><hp:b /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
          <hp:t>${escapeXml(token.text)}</hp:t>
        </hp:run>
      </hp:p>`;
                break;
            }
            case 'paragraph': {
                paragraphs += `
      <hp:p>
        <hp:run>
          <hp:rPr><hp:sz val="${hpSize}" /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
          <hp:t>${escapeXml(token.text)}</hp:t>
        </hp:run>
      </hp:p>`;
                break;
            }
            case 'code': {
                const codeLines = token.text.split('\n');
                for (const line of codeLines) {
                    paragraphs += `
      <hp:p>
        <hp:run>
          <hp:rPr><hp:sz val="${fontSizeToHwp(fontSize * 0.85)}" /><hp:rFonts hangul="Courier New" latin="Courier New" /></hp:rPr>
          <hp:t>${escapeXml(line)}</hp:t>
        </hp:run>
      </hp:p>`;
                }
                break;
            }
            case 'blockquote': {
                const bqText = token.raw.replace(/^>\s?/gm, '').trim();
                paragraphs += `
      <hp:p>
        <hp:pPr><hp:paraMrg left="800" /></hp:pPr>
        <hp:run>
          <hp:rPr><hp:sz val="${hpSize}" /><hp:i /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
          <hp:t>${escapeXml(bqText)}</hp:t>
        </hp:run>
      </hp:p>`;
                break;
            }
            case 'list': {
                for (const item of token.items) {
                    const bullet = token.ordered ? `${item.raw.match(/^\d+/)?.[0] || '1'}.` : '•';
                    paragraphs += `
      <hp:p>
        <hp:pPr><hp:paraMrg left="400" /></hp:pPr>
        <hp:run>
          <hp:rPr><hp:sz val="${hpSize}" /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
          <hp:t>${escapeXml(bullet + ' ' + item.text)}</hp:t>
        </hp:run>
      </hp:p>`;
                }
                break;
            }
            case 'hr': {
                paragraphs += `
      <hp:p>
        <hp:run>
          <hp:rPr><hp:sz val="${hpSize}" /></hp:rPr>
          <hp:t>────────────────────────────────</hp:t>
        </hp:run>
      </hp:p>`;
                break;
            }
            case 'table': {
                if (token.header && token.rows) {
                    const cols = token.header.length;
                    // Table header
                    let tableRows = '<hp:tr>';
                    for (const cell of token.header) {
                        tableRows += `
            <hp:tc>
              <hp:p>
                <hp:run>
                  <hp:rPr><hp:sz val="${hpSize}" /><hp:b /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
                  <hp:t>${escapeXml(cell.text)}</hp:t>
                </hp:run>
              </hp:p>
            </hp:tc>`;
                    }
                    tableRows += '</hp:tr>';
                    // Table body
                    for (const row of token.rows) {
                        tableRows += '<hp:tr>';
                        for (const cell of row) {
                            tableRows += `
            <hp:tc>
              <hp:p>
                <hp:run>
                  <hp:rPr><hp:sz val="${hpSize}" /><hp:rFonts hangul="${fontFamily}" latin="${fontFamily}" /></hp:rPr>
                  <hp:t>${escapeXml(cell.text)}</hp:t>
                </hp:run>
              </hp:p>
            </hp:tc>`;
                        }
                        tableRows += '</hp:tr>';
                    }
                    paragraphs += `
      <hp:tbl cols="${cols}">
        ${tableRows}
      </hp:tbl>`;
                }
                break;
            }
            case 'space':
                paragraphs += `\n      <hp:p />`;
                break;
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2016/paragraph">
  <hp:secPr>
    <hp:pgSz w="59528" h="84188" />
    <hp:pgMrg top="4252" right="4252" bottom="4252" left="4252" header="1417" footer="1417" />
  </hp:secPr>
  ${paragraphs}
</hp:sec>`;
}

function buildHeaderXml(fontFamily: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<hp:head xmlns:hp="http://www.hancom.co.kr/hwpml/2016/paragraph">
  <hp:fontfaces>
    <hp:fontface name="${fontFamily}" type="hangul" />
    <hp:fontface name="${fontFamily}" type="latin" />
    <hp:fontface name="Courier New" type="latin" />
  </hp:fontfaces>
</hp:head>`;
}

function buildContentHpf(title: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.hancom.co.kr/hwpml/2016/opf" version="1.0">
  <opf:metadata>
    <opf:title>${escapeXml(title)}</opf:title>
    <opf:language>ko</opf:language>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/xml" />
    <opf:item id="section0" href="section0.xml" media-type="application/xml" />
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0" />
  </opf:spine>
</opf:package>`;
}

function buildContainerXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwp+opf" />
  </rootfiles>
</container>`;
}

// ============================================================
// ZIP Packager
// ============================================================

interface HwpxFiles {
    mimetype: string;
    containerXml: string;
    contentHpf: string;
    headerXml: string;
    sectionXml: string;
}

function createHwpxZip(outputPath: string, files: HwpxFiles): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);

        // mimetype must be first and uncompressed
        archive.append(files.mimetype, { name: 'mimetype', store: true });
        archive.append(files.containerXml, { name: 'META-INF/container.xml' });
        archive.append(files.contentHpf, { name: 'Contents/content.hpf' });
        archive.append(files.headerXml, { name: 'Contents/header.xml' });
        archive.append(files.sectionXml, { name: 'Contents/section0.xml' });

        archive.finalize();
    });
}
