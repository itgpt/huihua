import { dataURIToBlob, generateThumbnail } from '../utils/file.js';
import { HISTORY_MAX_ITEMS } from '../config/constants.js';

// 【优化】历史记录图片存储策略：
// 不直接把 AI 生成的原始 base64 大图（可能高达 4-8MB）存入 IndexedDB，
// 而是同时存储原图 Blob（完整数据用于下载）和缩略图（用于历史列表展示）
// 历史列表只加载轻量级缩略图，点击查看大图时再按需加载原图
const THUMBNAIL_MAX_WIDTH = 480;
const THUMBNAIL_MAX_HEIGHT = 360;
const THUMBNAIL_QUALITY = 0.75;

export class HistoryManager {
    constructor(storage, db) {
        this.storage = storage;
        this.db = db;
        this.historyKey = 'aiPaintingHistory';
    }

    async save(imageSrc, originalPrompt, optimizedPrompt, params, callLogs, meta) {
        let storageKey = imageSrc;
        const itemId = Date.now();
        const logKey = `log-${itemId}`;

        // 1. Save image to IndexedDB
        try {
            if (imageSrc && imageSrc.startsWith('data:')) {
                // 【优化】提取 base64 数据部分，生成缩略图存储在独立 key 下
                // 原因：AI 生成的 4K 图片 base64 字符串可达 8MB+，存储和读取都很慢
                // 历史列表只需展示小缩略图，原图 blob 单独存储按需读取
                const base64Data = imageSrc.split(',')[1];
                const mimeType = imageSrc.split(';')[0].split(':')[1] || 'image/png';

                // 存储原图（完整 Blob，供下载/查看大图时使用）
                const originalBlob = dataURIToBlob(imageSrc);
                storageKey = `local-image-${itemId}`;
                await this.db.saveImage(storageKey, originalBlob);

                // 生成并存储缩略图（供历史列表快速展示）
                try {
                    const thumbnailDataUrl = await generateThumbnail(
                        base64Data,
                        THUMBNAIL_MAX_WIDTH,
                        THUMBNAIL_MAX_HEIGHT,
                        THUMBNAIL_QUALITY
                    );
                    const thumbBlob = dataURIToBlob(thumbnailDataUrl);
                    await this.db.saveImage(`thumb-${storageKey}`, thumbBlob);
                } catch (thumbErr) {
                    console.warn('生成缩略图失败，将使用原图作为缩略图:', thumbErr);
                }
            } else if (imageSrc && imageSrc.startsWith('http')) {
                storageKey = imageSrc;
                
                // 检查是否为豆包视频URL（有CORS限制）
                const isDoubaoVideo = imageSrc.includes('volces.com') || imageSrc.includes('doubao-seedance');
                
                if (!isDoubaoVideo) {
                    // 普通图片URL，尝试缓存
                    try {
                        const response = await fetch(imageSrc);
                        const blob = await response.blob();
                        await this.db.saveImage(storageKey, blob);
                    } catch (e) {
                        console.warn('Failed to cache image to IndexedDB:', e);
                    }
                } else {
                    // 豆包视频URL，不尝试缓存（有CORS限制）
                    console.log('[历史记录] 跳过缓存豆包视频URL（CORS限制）:', imageSrc);
                }
            }
        } catch (error) {
            console.error(`缓存图像到 IndexedDB 失败: ${imageSrc}`, error);
        }

        // 2. Save logs to IndexedDB
        try {
            await this.db.saveLogs(logKey, (callLogs || []).slice().reverse());
        } catch (error) {
            console.error(`缓存日志到 IndexedDB 失败 for key: ${logKey}`, error);
        }
        
        const history = this.load();
        const newItem = {
            id: itemId,
            imageData: storageKey, // 对于视频，这里可能会被重写或者增加 videoUrl 字段
            logKey: logKey,
            originalPrompt: originalPrompt,
            optimizedPrompt: optimizedPrompt,
            params: params,
            meta: meta || {},
            timestamp: new Date().toLocaleString('zh-CN')
        };
        
        // 特殊处理视频类型
        if (meta && meta.type === 'video') {
            newItem.type = 'video';
            newItem.videoUrl = imageSrc; // 对于视频，imageSrc 传入的是视频 URL
            newItem.imageData = 'video-direct'; 
        }

        history.unshift(newItem);
        if (history.length > HISTORY_MAX_ITEMS) history.splice(HISTORY_MAX_ITEMS);

        this.storage.setJSON(this.historyKey, history);
        
        return history;
    }

    load() {
        return this.storage.getJSON(this.historyKey, []);
    }

    delete(ids) {
        let history = this.load();
        const newHistory = history.filter(item => !ids.includes(item.id));
        this.storage.setJSON(this.historyKey, newHistory);
        return newHistory;
    }

    clear() {
        this.storage.remove(this.historyKey);
        return [];
    }
}
