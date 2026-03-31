export class LocalStorageManager {
    get(key, defaultValue = '') {
        return localStorage.getItem(key) || defaultValue;
    }

    set(key, value) {
        localStorage.setItem(key, value);
    }

    remove(key) {
        localStorage.removeItem(key);
    }

    getJSON(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Error parsing JSON from localStorage for key ${key}:`, e);
            return defaultValue;
        }
    }

    setJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error stringifying JSON for localStorage key ${key}:`, e);
        }
    }
}
