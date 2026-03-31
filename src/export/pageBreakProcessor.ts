/**
 * JavaScript code to run inside Puppeteer page.evaluate()
 * before generating PDF. Handles:
 * 1. Split long tables: clone thead into each chunk
 * 2. Split long code blocks: add "(continued)" labels
 * 3. Measure and insert explicit page breaks where needed
 */
export function getPageBreakScript(pageHeightPx: number, marginTopPx: number, marginBottomPx: number): string {
    const contentHeight = pageHeightPx - marginTopPx - marginBottomPx;

    return `
    (function() {
        const CONTENT_HEIGHT = ${contentHeight};
        const SAFETY_MARGIN = 40; // px buffer to avoid edge cases
        const PAGE_CONTENT = CONTENT_HEIGHT - SAFETY_MARGIN;

        // ============================================================
        // 1. Split long tables: chunk rows + repeat thead
        // ============================================================
        document.querySelectorAll('table').forEach(table => {
            if (table.offsetHeight <= PAGE_CONTENT) return; // fits on one page

            const thead = table.querySelector('thead');
            if (!thead) return; // no header to repeat

            const tbody = table.querySelector('tbody');
            if (!tbody) return;

            const rows = Array.from(tbody.querySelectorAll('tr'));
            const theadHeight = thead.offsetHeight;
            const maxRowsHeight = PAGE_CONTENT - theadHeight - 40;

            // Split rows into chunks that fit on a page
            const chunks = [];
            let currentChunk = [];
            let currentHeight = 0;

            rows.forEach(row => {
                const rowHeight = row.offsetHeight;
                if (currentHeight + rowHeight > maxRowsHeight && currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentHeight = 0;
                }
                currentChunk.push(row);
                currentHeight += rowHeight;
            });
            if (currentChunk.length > 0) chunks.push(currentChunk);

            if (chunks.length <= 1) return; // no need to split

            // Replace original table with chunked tables
            const parent = table.parentNode;
            chunks.forEach((chunk, i) => {
                if (i > 0) {
                    // Page break before continuation
                    const br = document.createElement('div');
                    br.style.breakBefore = 'page';
                    br.style.pageBreakBefore = 'always';
                    parent.insertBefore(br, table);

                    // "continued" label
                    const label = document.createElement('p');
                    label.style.cssText = 'font-size:10px; color:#888; margin-bottom:4px; font-style:italic;';
                    label.textContent = '(continued)';
                    parent.insertBefore(label, table);
                }

                const newTable = document.createElement('table');
                newTable.style.cssText = table.style.cssText;
                newTable.className = table.className;

                // Clone thead
                const newThead = thead.cloneNode(true);
                newTable.appendChild(newThead);

                // Add rows
                const newTbody = document.createElement('tbody');
                chunk.forEach(row => newTbody.appendChild(row.cloneNode(true)));
                newTable.appendChild(newTbody);

                parent.insertBefore(newTable, table);
            });

            // Remove original table
            parent.removeChild(table);
        });

        // ============================================================
        // 2. Split long code blocks
        // ============================================================
        document.querySelectorAll('pre').forEach(pre => {
            if (pre.offsetHeight <= PAGE_CONTENT) return;

            const code = pre.querySelector('code');
            if (!code) return;

            const lines = code.innerHTML.split('\\n');
            const lineHeight = pre.offsetHeight / Math.max(lines.length, 1);
            const linesPerPage = Math.floor((PAGE_CONTENT - 60) / lineHeight); // 60px for padding+label

            if (linesPerPage < 5) return; // too few lines per page

            const chunks = [];
            for (let i = 0; i < lines.length; i += linesPerPage) {
                chunks.push(lines.slice(i, i + linesPerPage));
            }

            if (chunks.length <= 1) return;

            const parent = pre.parentNode;
            const lang = code.className || '';

            chunks.forEach((chunk, i) => {
                if (i > 0) {
                    const br = document.createElement('div');
                    br.style.breakBefore = 'page';
                    br.style.pageBreakBefore = 'always';
                    parent.insertBefore(br, pre);

                    const label = document.createElement('p');
                    label.style.cssText = 'font-size:10px; color:#888; margin-bottom:4px; font-style:italic;';
                    label.textContent = '(continued)';
                    parent.insertBefore(label, pre);
                }

                const newPre = document.createElement('pre');
                const newCode = document.createElement('code');
                newCode.className = lang;
                newCode.innerHTML = chunk.join('\\n');
                newPre.appendChild(newCode);
                newPre.style.cssText = 'break-inside: auto; page-break-inside: auto;'; // allow this chunk to be printed
                parent.insertBefore(newPre, pre);
            });

            parent.removeChild(pre);
        });
    })();
    `;
}
