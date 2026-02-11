import { BookmarkManager } from '../lib/bookmark_manager.js';

const params = new URLSearchParams(window.location.search);
const bookmarkId = params.get('id');

const bmManager = new BookmarkManager();
let selectedFolderId = null;
let allFolders = [];

async function init() {
    if (!bookmarkId) {
        document.body.innerHTML = '<div style="padding:20px;color:red">缺少书签 ID 参数</div>';
        return;
    }

    // 1. Get Bookmark Info
    try {
        const [bookmark] = await chrome.bookmarks.get(bookmarkId);
        document.getElementById('bm-title').textContent = bookmark.title;
        document.getElementById('bm-url').textContent = bookmark.url;
    } catch (e) {
        document.getElementById('bm-title').textContent = '找不到该书签 (可能已被删除)';
        return;
    }

    // 2. Load Folders
    const tree = await bmManager.getTree();
    // Use flatten but keep structure info? 
    // Actually we just need a searchable list for this "Quick" UI. 
    // A flat list with paths is easiest to search.
    const flat = bmManager.flatten(tree);
    allFolders = flat.filter(item => {
        // Only folders, exclude root if needed (though API might return root)
        // flatten checks for !url usually.
        return !item.url && item.id !== '0';
    });

    renderFolders(allFolders);

    // 3. Bind Events
    document.getElementById('folder-search').addEventListener('input', (e) => {
        filterFolders(e.target.value);
    });

    document.getElementById('btnCancel').onclick = () => window.close();
    document.getElementById('btnMove').onclick = async () => {
        if (!selectedFolderId) return;
        try {
            await bmManager.moveBookmark(bookmarkId, selectedFolderId);
            window.close();
        } catch (e) {
            alert('移动失败: ' + e.message);
        }
    };
}

function renderFolders(folders) {
    const container = document.getElementById('folder-tree');
    container.innerHTML = '';

    folders.forEach(f => {
        const div = document.createElement('div');
        div.className = 'folder-node';
        div.dataset.id = f.id;
        div.dataset.path = f.path.toLowerCase(); // For search

        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.textContent = '📂';

        const name = document.createElement('span');
        name.textContent = f.path; // Or just leaf name? Path is better for context.
        // Let's use simplified display: 
        // If path is long, maybe show "Name (Parent/Grandparent)"?
        // For now, full path is fine.

        div.appendChild(icon);
        div.appendChild(name);

        div.onclick = () => {
            selectFolder(f.id);
        };

        container.appendChild(div);
    });
}

function filterFolders(keyword) {
    const key = keyword.toLowerCase();
    const nodes = document.querySelectorAll('.folder-node');
    nodes.forEach(node => {
        const text = node.dataset.path;
        if (text.includes(key)) {
            node.classList.remove('hidden');
        } else {
            node.classList.add('hidden');
        }
    });
}

function selectFolder(id) {
    selectedFolderId = id;

    // UI Update
    document.querySelectorAll('.folder-node').forEach(n => n.classList.remove('selected'));
    const target = document.querySelector(`.folder-node[data-id="${id}"]`);
    if (target) target.classList.add('selected');

    document.getElementById('btnMove').disabled = false;
}

init();
