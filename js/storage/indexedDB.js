export class ImageCacheDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ImageCacheDB', 2); // DB version increased
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'url' });
                }
                if (!db.objectStoreNames.contains('logs')) {
                    db.createObjectStore('logs', { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async saveImage(url, blob) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = store.put({ url, blob });
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveLogs(id, logs) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['logs'], 'readwrite');
            const store = transaction.objectStore('logs');
            const request = store.put({ id, logs });
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getLogs(id) {
        if (!this.db) return null;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['logs'], 'readonly');
            const store = transaction.objectStore('logs');
            const request = store.get(id);
            request.onsuccess = () => {
                resolve(request.result ? request.result.logs : null);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getImage(url) {
        if (!this.db) return null;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.get(url);
            request.onsuccess = () => {
                resolve(request.result ? request.result.blob : null);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }
}
