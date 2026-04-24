import { showFullImage, showFullVideo } from './components/modal.js';
import { showError, showSuccess } from './components/toast.js';
import { safeStringify } from '../utils/format.js';
import { HISTORY_PER_PAGE } from '../config/constants.js';
import QuickTimeline from './components/tools/quickTimeline.js';

function normalizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return '';

    let normalized = url.trim();
    while (/^data:[^,]+,data:/i.test(normalized)) {
        normalized = normalized.slice(normalized.indexOf(',') + 1);
    }
    return normalized;
}

export class HistoryUI {
    constructor(dom, historyManager) {
        this.dom = dom;
        this.historyManager = historyManager;
        this.currentPage = 1;
        this.cachedHistory = [];
    }

    display(history) {
        this.cachedHistory = history;
        this.renderPage(this.currentPage);
    }

    renderPage(page) {
        this.currentPage = page;
        this.dom.historyGrid.innerHTML = '';
        
        const startIndex = (page - 1) * HISTORY_PER_PAGE;
        const endIndex = startIndex + HISTORY_PER_PAGE;
        const pageItems = this.cachedHistory.slice(startIndex, endIndex);
        
        pageItems.forEach(item => {
            const historyItem = this.createHistoryItem(item);
            this.dom.historyGrid.appendChild(historyItem);
        });

        this.renderPaginationControls();
        this.loadHistoryImages();
    }

    createHistoryItem(item) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const isVideo = item.type === 'video';
        const mediaUrl = normalizeMediaUrl(isVideo ? item.videoUrl : (item.imageData || item.imageUrl || ''));
        const thumbnailDataUrl = normalizeMediaUrl(item.thumbnailDataUrl || '');
        const originalPrompt = item.originalPrompt || item.prompt || '无提示词';
        const optimizedPrompt = item.optimizedPrompt || '';
        const modelName = (item.params && item.params.model) || (item.meta && item.meta.model) || '未知';
        const logKey = item.logKey || '';
        const promptTextLimit = 60;
        const isLongPrompt = originalPrompt.length > promptTextLimit || optimizedPrompt;

        let promptContent;
        if (isLongPrompt) {
            const summary = originalPrompt.length > promptTextLimit
                ? originalPrompt.substring(0, promptTextLimit).replace(/\s+$/, '') + '...'
                : originalPrompt;
            
            promptContent = `
                <div class="prompt-summary" style="display: block;">
                    <strong>原始提示词:</strong> ${summary}
                    <a href="#" class="prompt-toggle" data-action="expand">展开</a>
                </div>
                <div class="prompt-full" style="display:none;">
                    <strong>原始提示词:</strong> ${originalPrompt}
                    ${optimizedPrompt ? `<br><strong>优化后提示词</strong> ${optimizedPrompt}` : ''}
                    <br><a href="#" class="prompt-toggle" data-action="collapse">收起</a>
                </div>
            `;
        } else {
            promptContent = `<strong>原始提示词:</strong> ${originalPrompt}`;
        }

        let mediaElement;
        if (isVideo) {
            if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:')) {
                mediaElement = `
                    <div class="history-video-thumbnail" style="position: relative; cursor: pointer;">
                        <img src="${thumbnailDataUrl}" alt="视频缩略图" style="width: 100%; height: 150px; object-fit: cover; border-radius: 12px; display: block;">
                        <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 3px;">
                            <span style="font-size: 8px;">▶</span> VIDEO
                        </div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.8);">
                            <span style="font-size: 24px; color: white; margin-left: 3px;">▶</span>
                        </div>
                    </div>
                `;
            } else {
                mediaElement = `
                    <div class="history-video-thumbnail" style="position: relative; cursor: pointer; background: #000; border-radius: 12px;">
                        <video src="${mediaUrl}#t=0.1" style="width: 100%; height: 150px; object-fit: cover; border-radius: 12px; display: block;" muted preload="metadata" playsinline></video>
                        <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 3px;">
                            <span style="font-size: 8px;">▶</span> VIDEO
                        </div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.8);">
                            <span style="font-size: 24px; color: white; margin-left: 3px;">▶</span>
                        </div>
                    </div>
                `;
            }
        } else {
            mediaElement = `<img data-src="${mediaUrl}" alt="历史图片" class="history-image">`;
        }

        historyItem.innerHTML = `
            <input type="checkbox" class="history-item-checkbox" data-id="${item.id}">
            ${mediaElement}
            <div class="history-prompt">
                <strong>请求模型：${modelName}</strong>${isVideo ? ' 🎬' : ''}<br>
                ${promptContent}
            </div>
            <div class="history-time">${item.timestamp}</div>
            <div class="history-logs">
                <details data-log-key="${logKey}">
                    <summary>📜 调用日志</summary>
                    <pre>点击展开...</pre>
                </details>
            </div>
        `;

        // 绑定事件
        const checkbox = historyItem.querySelector('.history-item-checkbox');
        checkbox.addEventListener('change', () => this.toggleSelection(checkbox));

        const detailsElement = historyItem.querySelector('details');
        detailsElement.addEventListener('toggle', (event) => {
            if (event.target.open) {
                this.loadHistoryLogOnClick(event.target);
            }
        });

        // 提示词展开/收起
        const promptToggles = historyItem.querySelectorAll('.prompt-toggle');
        promptToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const promptContainer = historyItem.querySelector('.history-prompt');
                const summaryView = promptContainer.querySelector('.prompt-summary');
                const fullView = promptContainer.querySelector('.prompt-full');
                
                if (toggle.dataset.action === 'expand') {
                    summaryView.style.display = 'none';
                    fullView.style.display = 'block';
                } else {
                    summaryView.style.display = 'block';
                    fullView.style.display = 'none';
                }
            });
        });

        // 点击条目选中（排除交互元素）
        historyItem.addEventListener('click', (e) => {
            if (e.target.matches('input, a, img, details, summary, pre, video, .history-video-thumbnail *')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
            this.toggleSelection(checkbox);
        });

        // 媒体点击事件
        if (isVideo) {
            const thumbnail = historyItem.querySelector('.history-video-thumbnail');
            if (thumbnail) {
                thumbnail.addEventListener('click', () => showFullVideo(mediaUrl));
            }
            // 添加到时间线按钮
            const timelineBtn = document.createElement('button');
            timelineBtn.className = 'btn btn-sm btn-light';
            timelineBtn.style.cssText = 'margin-top: 6px; width: 100%; font-size: 12px;';
            timelineBtn.textContent = '🎞️ 添加到时间线';
            timelineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                QuickTimeline.addClipFromUrl(mediaUrl, `history_video_${item.id}.mp4`);
            });
            historyItem.querySelector('.history-video-thumbnail').after(timelineBtn);
        } else {
            const img = historyItem.querySelector('.history-image');
            if (img) {
                img.addEventListener('click', async () => {
                    // 【优化】点击查看大图时，从 IndexedDB 读取原图（非缩略图）
                    // dataset.originalKey 由 _loadSingleHistoryImage 写入
                    const originalKey = img.dataset.originalKey || mediaUrl;
                    if (originalKey && originalKey.startsWith('local-image-')) {
                        try {
                            const originalBlob = await this.historyManager.db.getImage(originalKey);
                            if (originalBlob) {
                                const originalObjectUrl = URL.createObjectURL(originalBlob);
                                showFullImage(originalObjectUrl, null);
                                // 延迟释放，等 modal 渲染完成后再 revoke
                                setTimeout(() => URL.revokeObjectURL(originalObjectUrl), 60000);
                                return;
                            }
                        } catch (e) {
                            console.warn('加载原图失败，降级使用已加载图:', e);
                        }
                    }
                    showFullImage(mediaUrl, this.historyManager.db);
                });
            }
        }

        return historyItem;
    }

    renderPaginationControls() {
        const oldControls = document.querySelector('.pagination-controls');
        if (oldControls) oldControls.remove();

        const totalPages = Math.ceil(this.cachedHistory.length / HISTORY_PER_PAGE);
        if (totalPages <= 1) return;

        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '上一页';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.onclick = () => this.renderPage(this.currentPage - 1);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '下一页';
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.onclick = () => this.renderPage(this.currentPage + 1);

        const info = document.createElement('span');
        info.className = 'page-info';
        info.textContent = `第 ${this.currentPage} / ${totalPages} 页 (共 ${this.cachedHistory.length} 条)`;

        paginationContainer.appendChild(prevBtn);
        paginationContainer.appendChild(info);
        paginationContainer.appendChild(nextBtn);

        this.dom.historyGrid.parentNode.appendChild(paginationContainer);
    }

    toggleSelection(checkbox) {
        const item = checkbox.closest('.history-item');
        if (item) {
            item.classList.toggle('selected', checkbox.checked);
        }
    }

    selectAll(btn) {
        const checkboxes = document.querySelectorAll('.history-item-checkbox');
        if (checkboxes.length === 0) return;

        const allCurrentlyChecked = Array.from(checkboxes).every(cb => cb.checked);
        const shouldCheck = !allCurrentlyChecked;

        checkboxes.forEach(cb => {
            if (cb.checked !== shouldCheck) {
                cb.checked = shouldCheck;
                this.toggleSelection(cb);
            }
        });

        if (btn) {
            btn.textContent = shouldCheck ? '取消全选' : '全部选中';
        }
    }

    deleteSelected() {
        const selectedIds = Array.from(document.querySelectorAll('.history-item-checkbox:checked'))
                                 .map(cb => parseInt(cb.dataset.id, 10));

        if (selectedIds.length === 0) {
            showError('请先选择要删除的历史记录');
            return;
        }

        if (confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) {
            const newHistory = this.historyManager.delete(selectedIds);
            this.display(newHistory);
            showSuccess('选中的历史记录已删除');
        }
    }

    clear() {
        if (confirm('确定要清空所有历史记录吗？')) {
            const newHistory = this.historyManager.clear();
            this.display(newHistory);
            showSuccess('历史记录已清空');
        }
    }

    async loadHistoryLogOnClick(detailsElement) {
        if (detailsElement.dataset.logLoaded === 'true') return;

        const logKey = detailsElement.dataset.logKey;
        const preElement = detailsElement.querySelector('pre');
        if (!logKey) {
            preElement.textContent = '无日志记录';
            detailsElement.dataset.logLoaded = 'true';
            return;
        }
        
        preElement.textContent = '正在加载...';

        try {
            const logs = await this.historyManager.db.getLogs(logKey);
            if (logs && logs.length > 0) {
                const logsText = logs.map(log => {
                    const header = `[${log.time}] [${log.level}] ${log.message}`;
                    if (log.data !== undefined) {
                        const dataStr = typeof log.data === 'string' ? log.data : safeStringify(log.data);
                        return `${header}\n${dataStr}`;
                    }
                    return header;
                }).join('\n');
                preElement.textContent = logsText;
            } else {
                preElement.textContent = '无法加载日志或日志为空';
            }
        } catch (error) {
            console.error(`Failed to load logs for key ${logKey}`, error);
            preElement.textContent = '加载日志时出错';
        } finally {
            detailsElement.dataset.logLoaded = 'true';
        }
    }

    loadHistoryImages() {
        const images = document.querySelectorAll('.history-image[data-src]');
        if (images.length === 0) return;

        // 【优化】使用 IntersectionObserver 实现图片懒加载
        // 原因：历史记录可能有数十张图，串行 for-of await 会逐一阻塞，
        // 而一次性并行 Promise.all 会同时读取 IndexedDB 和解码所有图片，造成卡顿
        // IntersectionObserver 仅在图片进入视口时才触发加载，大幅减少首屏压力
        if (!this._historyImgObserver) {
            this._historyImgObserver = new IntersectionObserver(
                (entries) => {
                    // 每批最多并发 4 张，避免 IndexedDB 事务拥堵
                    const visible = entries.filter(e => e.isIntersecting).map(e => e.target);
                    this._loadImageBatch(visible);
                },
                { rootMargin: '300px 0px' } // 提前 300px 预加载，滚动体验更流畅
            );
        }

        images.forEach(img => {
            this._historyImgObserver.observe(img);
        });
    }

    async _loadImageBatch(imgs) {
        // 分批并发加载，每批 4 张，防止同时解码过多图片占满内存
        const BATCH_SIZE = 4;
        for (let i = 0; i < imgs.length; i += BATCH_SIZE) {
            const batch = imgs.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(img => this._loadSingleHistoryImage(img)));
        }
    }

    async _loadSingleHistoryImage(img) {
        const keyOrUrl = img.dataset.src;
        if (!keyOrUrl) return;

        this._historyImgObserver && this._historyImgObserver.unobserve(img);

        try {
            // 【优化】优先加载缩略图（thumb-xxx），缩略图比原图小 5-20 倍
            // 若缩略图不存在（旧历史记录）则降级读取原图
            let blob = null;
            if (keyOrUrl.startsWith('local-image-')) {
                blob = await this.historyManager.db.getImage(`thumb-${keyOrUrl}`);
            }
            if (!blob) {
                blob = await this.historyManager.db.getImage(keyOrUrl);
            }

            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                img.src = objectUrl;
                // 保留原图 key 供点击放大时使用（加载原图）
                img.dataset.originalKey = keyOrUrl;
            } else if (keyOrUrl.startsWith('data:') || keyOrUrl.startsWith('http')) {
                img.src = normalizeMediaUrl(keyOrUrl);
            } else {
                img.alt = '图片加载失败';
                console.warn(`在IndexedDB中找不到键的图像: ${keyOrUrl}`);
            }
        } catch (error) {
            console.error(`从IndexedDB加载图像失败: ${keyOrUrl}`, error);
            img.alt = '图片加载失败';
        }
    }
}
