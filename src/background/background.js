import { AIService } from '../lib/ai_service.js';
import { BookmarkManager } from '../lib/bookmark_manager.js';
import { Logger } from '../lib/logger.js';

console.log('[Background] Service Worker Starting...');
Logger.log('Service Worker Initialized');

// Listen for new bookmarks
// Undo/Correction Data Store
const undoMap = new Map(); // <notificationId, { bookmarkId, originalParentId, movedToId }>

// Cache for folder structure to speed up AI context
let folderCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

async function getFolderContext(bm) {
    const now = Date.now();
    if (folderCache && (now - lastCacheTime < CACHE_TTL)) {
        return folderCache;
    }

    const tree = await bm.getTree();
    const flatList = bm.flatten(tree);
    const allPaths = Array.from(new Set(flatList.map(i => i.path).filter(p => p))).join(', ');

    folderCache = allPaths;
    lastCacheTime = now;
    return allPaths;
}

// Listen for new bookmarks
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    // 1. Basic checks
    if (!bookmark.url) return; // Ignore folders

    // 2. Check Settings
    const config = await chrome.storage.sync.get(['autoCategorize', 'apiProvider', 'apiEndpoint', 'apiKey', 'modelName', 'targetLanguage']);
    if (!config.autoCategorize || !config.apiKey) return;

    Logger.log(`New bookmark detected: ${bookmark.title}`);

    // Debounce check (optional, but good for imports)
    // For now, let's process one by one. If import happens, this might spam.
    // Ideally user shouldn't enabling auto-cat during import.


    try {
        const ai = new AIService(config);
        const bm = new BookmarkManager();

        // 3. Get Context (Optimized)
        const allPaths = await getFolderContext(bm);
        Logger.log(`Context loaded. Paths length: ${allPaths.length}`);

        // 4. Classify
        const result = await ai.classifyBookmark(bookmark, allPaths);
        Logger.log(`AI suggestion: ${JSON.stringify(result)}`);

        if (result && result.path) {
            const targetPath = result.path;
            const reason = result.reason;
            const originalParentId = bookmark.parentId;

            // 5. Move
            const targetId = await bm.ensureFolder(targetPath, '1'); // '1' is bookmarks bar usually
            if (targetId === originalParentId) {
                Logger.log('Target is same as current. No move.');
                return;
            }

            await bm.moveBookmark(id, targetId);
            Logger.log(`Moved to ${targetPath} (ID: ${targetId})`);

            // 6. Notify User (Top-Right Popup Window)
            // Calculate position: Top-Right of screen
            // Note: system.display API needs permission, we'll just guess user wants it top-right.
            // Chrome windows origin is top-left.

            // We can't easily get screen width in Service Worker without 'system.display'.
            // Compromise: Use a sensible default like "Left: very large number" which Chrome might clamp,
            // or just use 0,0 (Top Left) or ask user to position it.
            // Actually, 'left' max value usually clamps to right edge. let's try 9999.
            // Wait, chrome.windows.create 'left' logic:

            // Let's use a conservative small popup.
            const width = 450;
            const height = 200;

            // Try to position top-right. 
            // Assuming 1920x1080, left=1500. 
            // Chrome might handle out-of-bounds by clamping.
            chrome.windows.create({
                url: `src/options/quick_organize_notify.html?id=${id}&path=${encodeURIComponent(targetPath)}&old=${originalParentId}`,
                type: 'popup',
                width: width,
                height: height,
                left: 2000,
                top: 50,
                focused: true
            });
        } else {
            Logger.log('AI returned no path.');
        }
    } catch (e) {
        Logger.error(`Auto-categorize failed: ${e.message}`);

        // Notify User of Error
        try {
            chrome.windows.create({
                url: `src/options/quick_organize_notify.html?error=${encodeURIComponent(e.message)}&id=${id}`,
                type: 'popup',
                width: 450,
                height: 200,
                left: 2000,
                top: 50,
                focused: true
            });
        } catch (winErr) {
            Logger.error(`Failed to show error popup: ${winErr.message}`);
        }
    }
});
// Note: Notification listeners removed as we switched to Window UI
