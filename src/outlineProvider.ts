import * as vscode from 'vscode';
import { parseToc } from './markdownParser';

/**
 * Provides document symbols for the VSCode Outline panel.
 * Shows markdown headings as a hierarchical tree.
 */
export class MarkdownOutlineProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        if (document.languageId !== 'markdown') return [];

        const tocItems = parseToc(document.getText());
        return this.buildHierarchy(tocItems, document);
    }

    private buildHierarchy(
        items: { level: number; text: string; line: number }[],
        document: vscode.TextDocument
    ): vscode.DocumentSymbol[] {
        const root: vscode.DocumentSymbol[] = [];
        const stack: { level: number; symbol: vscode.DocumentSymbol }[] = [];

        for (const item of items) {
            const range = new vscode.Range(
                new vscode.Position(item.line, 0),
                new vscode.Position(item.line, document.lineAt(item.line).text.length)
            );

            const symbolKind = this.getSymbolKind(item.level);
            const symbol = new vscode.DocumentSymbol(
                item.text,
                '',
                symbolKind,
                range,
                range
            );

            // Find parent: pop stack until we find a level less than current
            while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                root.push(symbol);
            } else {
                stack[stack.length - 1].symbol.children.push(symbol);
            }

            stack.push({ level: item.level, symbol });
        }

        return root;
    }

    private getSymbolKind(level: number): vscode.SymbolKind {
        switch (level) {
            case 1: return vscode.SymbolKind.Module;
            case 2: return vscode.SymbolKind.Class;
            case 3: return vscode.SymbolKind.Method;
            case 4: return vscode.SymbolKind.Property;
            case 5: return vscode.SymbolKind.Field;
            case 6: return vscode.SymbolKind.Variable;
            default: return vscode.SymbolKind.String;
        }
    }
}
