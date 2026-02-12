export class BookmarkExporter {
    constructor() { }

    /**
     * Export the entire bookmark tree as a Netscape HTML string
     * @param {Array} bookmarkTree - The tree from chrome.bookmarks.getTree()
     * @returns {string} The HTML content
     */
    generateHTML(bookmarkTree) {
        const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

        let body = '';
        // The root usually contains "Bookmarks Bar" and "Other Bookmarks" as children
        // We iterate through the top-level nodes
        if (Array.isArray(bookmarkTree)) {
            for (const node of bookmarkTree) {
                body += this._processNode(node, 1);
            }
        } else {
            body += this._processNode(bookmarkTree, 1);
        }

        const footer = `</DL><p>`;
        return header + body + footer;
    }

    _processNode(node, depth) {
        // Skip root folders logic if needed, but Chrome exports usually include them as headers
        // Root node (id:0) usually has no title, its children are Bar (id:1) and Other (id:2)
        if (node.id === '0') {
            let content = '';
            if (node.children) {
                for (const child of node.children) {
                    content += this._processNode(child, depth);
                }
            }
            return content;
        }

        const indent = '    '.repeat(depth);
        let html = '';

        if (node.children) {
            // It's a folder
            const dateAdded = node.dateAdded ? node.dateAdded : 0;
            const dateModified = node.dateGroupModified ? node.dateGroupModified : 0;
            const title = node.title || '(No Title)';

            html += `${indent}<DT><H3 ADD_DATE="${Math.floor(dateAdded / 1000)}" LAST_MODIFIED="${Math.floor(dateModified / 1000)}">${this._escapeHtml(title)}</H3>\n`;
            html += `${indent}<DL><p>\n`;
            for (const child of node.children) {
                html += this._processNode(child, depth + 1);
            }
            html += `${indent}</DL><p>\n`;
        } else {
            // It's a bookmark
            if (node.url) {
                const dateAdded = node.dateAdded ? node.dateAdded : 0;
                const title = node.title || '(No Title)';
                const url = node.url;

                // Chrome's icon attribute logic is complex (getting favicon), we can skip for basic export or just keep basic structure
                html += `${indent}<DT><A HREF="${this._escapeHtml(url)}" ADD_DATE="${Math.floor(dateAdded / 1000)}">${this._escapeHtml(title)}</A>\n`;
            }
        }
        return html;
    }

    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Triggers a browser download of the bookmarks
     */
    async exportAndDownload() {
        return new Promise((resolve, reject) => {
            chrome.bookmarks.getTree((tree) => {
                try {
                    const html = this.generateHTML(tree);
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);

                    const date = new Date();
                    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                    const filename = `bookmarks_backup_${dateStr}.html`;

                    chrome.downloads.download({
                        url: url,
                        filename: filename,
                        saveAs: false // Auto save to default download folder
                    }, (downloadId) => {
                        if (chrome.runtime.lastError) {
                            console.error('Download failed:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            // Wait a bit to ensure it started
                            resolve(downloadId);
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
