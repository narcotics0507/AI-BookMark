import { BookmarkManager } from '../lib/bookmark_manager.js';

const params = new URLSearchParams(window.location.search);
const bookmarkId = params.get('id');
const targetPath = decodeURIComponent(params.get('path') || '');
const reason = decodeURIComponent(params.get('reason') || 'AI Decision');
const errorMsg = decodeURIComponent(params.get('error') || '');
const oldParentId = params.get('old');

const bmManager = new BookmarkManager();

if (errorMsg) {
    // Error State
    document.body.classList.add('error-mode');
    document.querySelector('.message').textContent = '⚠️ 自动分类失败';
    document.getElementById('target-path').textContent = errorMsg;
    document.getElementById('target-path').style.color = '#d32f2f'; // Red
    document.getElementById('target-path').style.fontSize = '0.9rem';
    document.getElementById('ai-reason').style.display = 'none';

    // Hide Undo, Show Settings maybe?
    document.getElementById('btnUndo').style.display = 'none';
    document.getElementById('btnConfirm').textContent = '关闭';
} else {
    // Normal Success State
    document.getElementById('target-path').textContent = targetPath;
    document.getElementById('ai-reason').textContent = `💡 ${reason}`;
}

// Auto-close timer (5 seconds)
setTimeout(() => {
    // Error mode specific logic is handled above by checking errorMsg
    // But we might want the timer to still work (auto close error msg).
    // Yes, keep timer.

    // If error, maybe change timer color?
    if (errorMsg) {
        document.getElementById('timer-bar').style.background = '#d32f2f';
    }
}, 100);

const autoClose = setTimeout(() => {
    window.close();
}, 5000);

// Stop timer on hover
document.body.addEventListener('mouseenter', () => clearTimeout(autoClose));
// Restart on leave? Maybe just stay open if hovered.

// Undo
document.getElementById('btnUndo').onclick = async () => {
    try {
        await bmManager.moveBookmark(bookmarkId, oldParentId);
        window.close();
    } catch (e) {
        alert('撤销失败: ' + e.message);
    }
};

// Change (Open Full Editor)
document.getElementById('btnChange').onclick = () => {
    // Open the bigger editor window
    const width = 500;
    const height = 600;
    chrome.windows.create({
        url: `src/options/quick_organize.html?id=${bookmarkId}`,
        type: 'popup',
        width: width,
        height: height,
        focused: true
    });
    window.close();
};

// Confirm (Close directly)
document.getElementById('btnConfirm').onclick = () => {
    window.close();
};
