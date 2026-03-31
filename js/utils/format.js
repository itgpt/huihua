export function normalizeUrl(url) {
    let processedUrl = (url || '').trim();
    if (!processedUrl) return '';

    // 直接返回用户输入，只去除末尾的斜杠
    // 如果用户填了协议就用用户的，没填也不自动添加
    try {
        // 如果包含协议头，使用URL构造函数规范化
        if (/^https?:\/\//i.test(processedUrl)) {
            const urlObject = new URL(processedUrl);
            let result = urlObject.origin + urlObject.pathname;
            return result.replace(/\/+$/, '');
        } else {
            // 没有协议头，直接返回并去除末尾斜杠
            return processedUrl.replace(/\/+$/, '');
        }
    } catch (e) {
        // 如果解析失败，回退到基本清理
        console.error('URL处理时出错:', processedUrl, e);
        return processedUrl.replace(/\/+$/, '');
    }
}

export function maskApiKey(key) {
    if (!key) return '';
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.slice(0, 4) + '...' + key.slice(-4);
}

// 处理日志内容，避免超长与循环引用
export function safeStringify(obj) {
    const MAX = 1000;
    const seen = new WeakSet();
    return JSON.stringify(obj, (k, v) => {
        if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
        }
        if (k === 'b64_json' && typeof v === 'string') {
            return `[b64_json omitted, length=${v.length}]`;
        }
        if (typeof v === 'string' && v.length > MAX) {
            return v.slice(0, MAX) + `... (长度${v.length})`;
        }
        return v;
    }, 2);
}

// 格式化时间（秒转换为 MM:SS 或 HH:MM:SS）
export function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
