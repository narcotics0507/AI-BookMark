import { AIService } from '../lib/ai_service.js';
import { BookmarkManager } from '../lib/bookmark_manager.js';
import { Logger } from '../lib/logger.js';

console.log('[Background] Service Worker Starting...');
Logger.log('Service Worker Initialized');

// Listen for new bookmarks
// Undo/Correction Data Store
const undoMap = new Map(); // <notificationId, { bookmarkId, originalParentId, movedToId }>

// Smart Debounce Queue: <bookmarkId, { timeoutId, startTime }>
const processingQueue = new Map();
const DEBOUNCE_DELAY = 4000; // 4 seconds

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

// Core Processing Logic (Extracted)
async function processBookmark(id) {
    // Remove from queue processing
    processingQueue.delete(id);

    try {
        // Fetch latest bookmark data (title/url might have changed during debounce)
        const [bookmark] = await new Promise(r => chrome.bookmarks.get(id, r));
        if (!bookmark || !bookmark.url) return;

        // 2. Check Settings
        const config = await chrome.storage.sync.get(['autoCategorize', 'apiProvider', 'apiEndpoint', 'apiKey', 'modelName', 'targetLanguage']);
        if (!config.autoCategorize || !config.apiKey) return;

        Logger.log(`Processing bookmark after debounce: ${bookmark.title}`);

        const ai = new AIService(config);
        const bm = new BookmarkManager();

        // 3. Get Context (Optimized)
        const allPaths = await getFolderContext(bm);
        Logger.log(`Context loaded. Paths length: ${allPaths.length}`);

        // 4. Classify
        const result = await ai.classifyBookmark(bookmark, allPaths);
        Logger.log(`AI suggestion: ${JSON.stringify(result)}`);

        if (result && result.path) {
            let targetPath = result.path;
            const originalParentId = bookmark.parentId;

            // Handle Root Folders in Path
            const [barNode] = await new Promise(r => chrome.bookmarks.get('1', r));
            const [otherNode] = await new Promise(r => chrome.bookmarks.get('2', r));

            let rootId = '1'; // Default
            let relativePath = targetPath;

            if (targetPath.startsWith(barNode.title)) {
                rootId = '1';
                if (targetPath === barNode.title) {
                    relativePath = '';
                } else if (targetPath.startsWith(barNode.title + '/')) {
                    relativePath = targetPath.substring(barNode.title.length + 1);
                }
            } else if (targetPath.startsWith(otherNode.title)) {
                rootId = '2';
                if (targetPath === otherNode.title) {
                    relativePath = '';
                } else if (targetPath.startsWith(otherNode.title + '/')) {
                    relativePath = targetPath.substring(otherNode.title.length + 1);
                }
            }

            // 5. Move
            let targetId = rootId;
            if (relativePath) {
                targetId = await bm.ensureFolder(relativePath, rootId);
            }
            let isSamePath = false;
            // Re-check parent in case user moved it at the very last millisecond
            const [currentBm] = await new Promise(r => chrome.bookmarks.get(id, r));
            if (currentBm.parentId !== originalParentId) {
                Logger.log('Bookmark moved externally during processing. Aborting move.');
                return;
            }

            if (targetId === originalParentId) {
                Logger.log('Target is same as current. No move, but notifying user.');
                isSamePath = true;
            } else {
                await bm.moveBookmark(id, targetId);
                Logger.log(`Moved to ${targetPath} (ID: ${targetId})`);
            }

            // 6. Notify User
            const width = 450;
            const height = 200;
            chrome.windows.create({
                url: `src/options/quick_organize_notify.html?id=${id}&path=${encodeURIComponent(targetPath)}&old=${originalParentId}&same=${isSamePath}&targetId=${targetId}`,
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
        } catch (winErr) { }
    }
}

// 1. On Created -> Start Timer
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    if (!bookmark.url) return; // Ignore folders immediately

    // Check settings early to avoid setting timers unnecessarily?

    Logger.log(`New bookmark created: ${bookmark.title}. Waiting ${DEBOUNCE_DELAY}ms...`);

    const timeoutId = setTimeout(() => processBookmark(id), DEBOUNCE_DELAY);
    processingQueue.set(id, { timeoutId, startTime: Date.now() });
});



// 3. On Moved -> Cancel Timer (User manually filed it)
chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    if (processingQueue.has(id)) {
        const item = processingQueue.get(id);
        clearTimeout(item.timeoutId);
        processingQueue.delete(id);
        Logger.log(`Bookmark ${id} moved manually. Auto-categorization cancelled.`);
    }
});

// 4. On Removed -> Cancel Timer
chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    if (processingQueue.has(id)) {
        const item = processingQueue.get(id);
        clearTimeout(item.timeoutId);
        processingQueue.delete(id);
    }
});
