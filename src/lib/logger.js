export class Logger {
    static async log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        console.log(entry);

        // Save to storage for viewing in Options page
        try {
            const data = await chrome.storage.local.get({ systemLogs: [] });
            let logs = data.systemLogs || [];
            logs.unshift(entry);
            if (logs.length > 50) logs = logs.slice(0, 50); // Keep last 50
            await chrome.storage.local.set({ systemLogs: logs });
        } catch (e) {
            // Ignore storage errors
        }
    }

    static async error(message) {
        await this.log(message, 'error');
    }
}
