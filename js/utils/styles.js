const loadedStylesheets = new Map();

export function loadStylesheet(href) {
    if (loadedStylesheets.has(href)) return loadedStylesheets.get(href);

    const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
        const promise = Promise.resolve(existing);
        loadedStylesheets.set(href, promise);
        return promise;
    }

    const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve(link);
        link.onerror = () => {
            loadedStylesheets.delete(href);
            reject(new Error(`样式加载失败: ${href}`));
        };
        document.head.appendChild(link);
    });

    loadedStylesheets.set(href, promise);
    return promise;
}
