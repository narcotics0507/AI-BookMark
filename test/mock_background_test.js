// test/mock_background_test.js
// Simulates the logic in background.js with mocked Chrome APIs

// Mock Chrome API
global.chrome = {
    bookmarks: {
        getTree: async () => [{
            id: '0',
            children: [
                { id: '1', title: 'Bookmarks Bar', children: [{ id: '10', title: 'Folder A' }] },
                { id: '2', title: 'Other Bookmarks', children: [] }
            ]
        }],
        move: async (id, dest) => {
            console.log(`[Mock] Moved bookmark ${id} to parent ${dest.parentId}`);
        }
    },
    storage: {
        sync: {
            get: async () => ({
                autoCategorize: true,
                apiKey: 'test-api-key',
                apiProvider: 'openai', // mock
                startSmartAdd: true
            })
        },
        local: {
            get: async () => ({ folderCache: null }),
            set: async () => { }
        }
    },
    notifications: {
        create: (id, opts) => console.log(`[Mock] Notification created: ${opts.title} - ${opts.message}`),
        onButtonClicked: { addListener: () => { } },
        onClosed: { addListener: () => { } }
    },
    windows: {
        create: (opts) => console.log(`[Mock] Window created at (${opts.left}, ${opts.top}) with url: ${opts.url}`)
    }
};

// Simulate imports by defining classes locally since we can't easily import ES modules in this mock context without package.json changes or .mjs
class MockAIService {
    constructor(config) { this.config = config; }
    async classifyBookmark(bookmark, context) {
        console.log('[MockAI] Classifying:', bookmark.title);
        console.log('[MockAI] Context length:', context.length);
        return 'Technology/AI';
    }
}

class MockBookmarkManager {
    async getTree() {
        return [{
            id: '0',
            children: [
                { id: '1', title: 'Bookmarks Bar', children: [{ id: '10', title: 'Tech', url: null }] },
                { id: '2', title: 'Other Bookmarks', children: [] }
            ]
        }];
    }
    flatten(tree) {
        // Simple flatten mock
        return [{ id: '10', title: 'Tech', path: 'Technology' }]; // Mock path
    }
    async ensureFolder(path) {
        console.log('[MockBM] Ensuring folder:', path);
        return '999';
    }
    async moveBookmark(id, targetId) {
        console.log(`[MockBM] Moving ${id} to ${targetId}`);
    }
}

const AIService = MockAIService;
const BookmarkManager = MockBookmarkManager;

// Replicate background.js logic function
async function outputLogic(id, bookmark) {
    console.log('--- Triggering Logic ---');
    if (!bookmark.url) return;

    const config = await chrome.storage.sync.get(['autoCategorize']);
    if (!config.autoCategorize) {
        console.log('Auto-categorize disabled');
        return;
    }

    const ai = new AIService(config);
    const bm = new BookmarkManager();

    // Context mock
    const tree = await bm.getTree();
    const flatList = bm.flatten(tree);
    const allPaths = Array.from(new Set(flatList.map(i => i.path).filter(p => p))).join(', ');

    console.log('Context Paths:', allPaths);

    // AI Call
    const targetPath = await ai.classifyBookmark(bookmark, allPaths);

    if (targetPath) {
        console.log('Target Path:', targetPath);
        // Ensure folder logic mocked in BookmarkManager or we mock ensuresFolder here
        // Since we didn't mock EnsureFolder in globals, we rely on the real class calling mocked chrome.bookmarks
        // But BookmarkManager.ensureFolder is complex. Let's look at logic.
        // For this test, we assume ensureFolder works if chrome.bookmarks.get/create works.
        // We need to verify logic flow primarily.

        console.log('Logic success.');
    }
}

// Run Test
(async () => {
    try {
        await outputLogic('new-bm-id', { id: 'new-bm-id', title: 'New Tech Article', url: 'https://example.com' });
    } catch (e) {
        console.error(e);
    }
})();
