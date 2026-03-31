import * as vscode from 'vscode';
import { TocItem, parseToc } from './markdownParser';

export { TocItem };

export class TocTreeItem extends vscode.TreeItem {
    constructor(
        public readonly item: TocItem,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(item.text, collapsibleState);
        this.tooltip = `${'#'.repeat(item.level)} ${item.text}`;
        this.description = `Line ${item.line + 1}`;
        this.command = {
            command: 'markdown-x.jumpToHeading',
            title: 'Jump to Heading',
            arguments: [item.line]
        };
        this.iconPath = new vscode.ThemeIcon(`symbol-${getSymbolKind(item.level)}`);
        this.contextValue = `heading-${item.level}`;
    }
}

function getSymbolKind(level: number): string {
    switch (level) {
        case 1: return 'namespace';
        case 2: return 'class';
        case 3: return 'method';
        case 4: return 'property';
        case 5: return 'field';
        case 6: return 'variable';
        default: return 'string';
    }
}

export class TocProvider implements vscode.TreeDataProvider<TocTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TocTreeItem | undefined | null | void> = new vscode.EventEmitter<TocTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TocTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tocItems: TocItem[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateToc(document: vscode.TextDocument): void {
        const maxLevel = vscode.workspace.getConfiguration('markdown-x').get<number>('maxTocLevel', 6);
        this.tocItems = parseToc(document.getText(), maxLevel);
        this.refresh();
    }

    getTreeItem(element: TocTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TocTreeItem): Thenable<TocTreeItem[]> {
        if (!element) {
            return Promise.resolve(
                this.tocItems
                    .filter(item => item.level <= 2)
                    .map(item => new TocTreeItem(
                        item,
                        this.hasChildren(item)
                            ? vscode.TreeItemCollapsibleState.Collapsed
                            : vscode.TreeItemCollapsibleState.None
                    ))
            );
        } else {
            const parentIndex = this.tocItems.findIndex(item =>
                item.line === element.item.line
            );

            if (parentIndex === -1) {
                return Promise.resolve([]);
            }

            const children: TocTreeItem[] = [];
            const parentLevel = element.item.level;

            for (let i = parentIndex + 1; i < this.tocItems.length; i++) {
                const item = this.tocItems[i];
                if (item.level <= parentLevel) break;
                if (item.level === parentLevel + 1) {
                    children.push(new TocTreeItem(
                        item,
                        this.hasChildren(item)
                            ? vscode.TreeItemCollapsibleState.Collapsed
                            : vscode.TreeItemCollapsibleState.None
                    ));
                }
            }

            return Promise.resolve(children);
        }
    }

    private hasChildren(item: TocItem): boolean {
        const index = this.tocItems.findIndex(i => i.line === item.line);
        if (index === -1 || index === this.tocItems.length - 1) return false;
        return this.tocItems[index + 1].level > item.level;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}
