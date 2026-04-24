import { showFullImage } from './components/modal.js';
import { showError } from './components/toast.js';

function normalizeImageSrc(src, mimeType = 'image/png') {
    if (!src || typeof src !== 'string') return '';

    let normalized = src.trim();
    while (/^data:[^,]+,data:/i.test(normalized)) {
        normalized = normalized.slice(normalized.indexOf(',') + 1);
    }

    if (normalized.startsWith('data:') || /^https?:\/\//i.test(normalized) || normalized.startsWith('blob:')) {
        return normalized;
    }

    return `data:${mimeType};base64,${normalized}`;
}

function imageResultToSrc(item) {
    if (!item) return '';
    if (item.b64_json) {
        return normalizeImageSrc(item.b64_json, item.mimeType || item.mime_type || 'image/png');
    }
    return normalizeImageSrc(item.url || item.image_url || '');
}

export function displayImageResults(dom, result, originalPrompt, optimizedPrompt, params) {
    const dataArr = Array.isArray(result?.data) ? result.data : [];
    if (dataArr.length === 0) return;

    // --- 结果分组逻辑 ---
    const groupId = `result-group-${params.model.replace(/[^a-zA-Z0-9]/g, '-')}`;
    let resultGroupContainer = document.getElementById(groupId);
    let imagesGrid;

    if (!resultGroupContainer) {
        resultGroupContainer = document.createElement('div');
        resultGroupContainer.id = groupId;
        resultGroupContainer.style.marginBottom = '25px';
        resultGroupContainer.style.border = '1px solid #e9ecef';
        resultGroupContainer.style.borderRadius = '12px';
        resultGroupContainer.style.padding = '15px';
        resultGroupContainer.style.background = '#fff';

        const modelBar = document.createElement('div');
        modelBar.style.cssText = `
            background:#f8fafc; color:#475569; padding:10px 15px; border-radius:10px;
            margin-bottom:12px; text-align:left; font-size:13px; font-weight:600; border: 1px solid #e2e8f0;
            display: inline-block;
        `;
        modelBar.textContent = `✨ 模型: ${params.model}`;

        const promptInfo = document.createElement('div');
        promptInfo.className = 'result-prompt-info';
        promptInfo.innerHTML = `
            <strong>原始提示词:</strong> ${originalPrompt}<br>
            <strong>优化后提示词:</strong> ${optimizedPrompt}
        `;
        
        resultGroupContainer.appendChild(modelBar);
        resultGroupContainer.appendChild(promptInfo);

        imagesGrid = document.createElement('div');
        imagesGrid.className = 'image-grid-container';
        imagesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        `;
        resultGroupContainer.appendChild(imagesGrid);
        dom.resultImages.appendChild(resultGroupContainer);
    } else {
        imagesGrid = resultGroupContainer.querySelector('.image-grid-container');
    }

    const newImageCells = [];

    dataArr.forEach((item) => {
        const imageSrc = imageResultToSrc(item);

        if (!imageSrc) return;

        // 创建单个图片及其控件的容器
        const imageCell = document.createElement('div');
        imageCell.style.textAlign = 'center';
        imageCell.style.position = 'relative';

        const img = document.createElement('img');
        // 【优化】大图懒解码：loading=lazy 让浏览器推迟视口外图片的网络/解码开销
        // decoding=async 让图片解码在后台线程进行，不阻塞主线程渲染
        img.loading = 'lazy';
        img.decoding = 'async';
        img.className = 'generated-image';
        img.style.maxHeight = 'none';
        img.style.marginBottom = '10px';

        // 【优化】对 base64 大图使用 IntersectionObserver 延迟赋值 src
        // 原因：直接将 data:image/png;base64,... 字符串赋给 img.src，浏览器会立即解码并
        // 将整个 base64 数据驻留内存；多张大图同时触发会占满主线程，造成页面卡死
        if (imageSrc.startsWith('data:')) {
            img.dataset.lazySrc = imageSrc;
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1px 透明占位
            img.style.minHeight = '120px';
            img.style.background = 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)';
            _observeLazyImage(img);
        } else {
            img.src = imageSrc;
        }
        img.onclick = () => showFullImage(imageSrc);

        const btnBar = document.createElement('div');
        btnBar.style.display = 'flex';
        btnBar.style.gap = '10px';
        btnBar.style.justifyContent = 'center';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-light btn-result-action';
        downloadBtn.textContent = '⬇️ 下载';
        downloadBtn.onclick = () => downloadImage(imageSrc, `ai_painting_${Date.now()}.png`);

        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-light btn-result-action';
        openBtn.textContent = '↗️ 原图';
        openBtn.onclick = () => {
            if (imageSrc.startsWith('data:')) {
                const newTab = window.open();
                newTab.document.write(`<body style="margin:0; background:#f0f2f5; display:flex; justify-content:center; align-items:center; min-height:100vh;"><img src="${imageSrc}" style="max-width:100%; max-height:100vh; height:auto; object-fit:contain;"></body>`);
                newTab.document.title = "图片预览";
            } else {
                window.open(imageSrc, '_blank');
            }
        };
        btnBar.appendChild(openBtn);
        btnBar.appendChild(downloadBtn);
        
        imageCell.appendChild(img);
        imageCell.appendChild(btnBar);
        
        if (/^https?:\/\//.test(imageSrc)) {
            const warning = document.createElement('div');
            warning.style.cssText = `font-size: 11px; color: #dc3545; text-align: center; margin-top: 6px; font-weight: 500;`;
            warning.textContent = '⚠️ 临时链接, 请注意保存';
            imageCell.appendChild(warning);
        }
        
        newImageCells.push(imageCell);
    });

    const firstExistingCell = imagesGrid.firstChild;
    newImageCells.forEach((imageCell) => {
        imagesGrid.insertBefore(imageCell, firstExistingCell);
    });

    // 调整网格样式
    const imageCount = imagesGrid.children.length;
    const allImages = imagesGrid.querySelectorAll('.generated-image');

    if (imageCount === 1) {
        imagesGrid.style.display = 'block';
        allImages.forEach(img => {
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.maxHeight = 'none';
            img.style.objectFit = 'contain';
        });
    } else {
        imagesGrid.style.display = 'grid';
        imagesGrid.style.justifyContent = 'initial';
        imagesGrid.style.gridTemplateColumns = '';
        allImages.forEach(img => {
            img.style.maxHeight = 'none';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.objectFit = 'contain';
        });
    }
}

export function createImageGeneratingPlaceholder(dom, modelName, originalPrompt, optimizedPrompt, taskId) {
    const groupId = `result-group-${modelName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    let resultGroupContainer = document.getElementById(groupId);
    let imagesGrid;
    
    if (!resultGroupContainer) {
        resultGroupContainer = document.createElement('div');
        resultGroupContainer.id = groupId;
        resultGroupContainer.style.marginBottom = '25px';
        resultGroupContainer.style.border = '1px solid #e9ecef';
        resultGroupContainer.style.borderRadius = '12px';
        resultGroupContainer.style.padding = '15px';
        resultGroupContainer.style.background = '#fff';

        const modelBar = document.createElement('div');
        modelBar.style.cssText = `
            background:#f8fafc; color:#475569; padding:10px 15px; border-radius:10px;
            margin-bottom:12px; text-align:left; font-size:13px; font-weight:600; border: 1px solid #e2e8f0;
            display: inline-block;
        `;
        modelBar.textContent = `✨ 模型: ${modelName}`;

        const promptInfo = document.createElement('div');
        promptInfo.className = 'result-prompt-info';
        promptInfo.innerHTML = `
            <strong>原始提示词:</strong> ${originalPrompt}<br>
            <strong>优化后提示词:</strong> ${optimizedPrompt}
        `;
        
        resultGroupContainer.appendChild(modelBar);
        resultGroupContainer.appendChild(promptInfo);

        imagesGrid = document.createElement('div');
        imagesGrid.className = 'image-grid-container';
        imagesGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        `;
        resultGroupContainer.appendChild(imagesGrid);
        dom.resultImages.appendChild(resultGroupContainer);
    } else {
        imagesGrid = resultGroupContainer.querySelector('.image-grid-container');
    }
    
    const placeholderCard = document.createElement('div');
    placeholderCard.className = 'image-placeholder-card';
    placeholderCard.setAttribute('data-task-id', taskId);
    placeholderCard.style.cssText = `
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    placeholderCard.innerHTML = `
        <div class="task-loading-placeholder">
            <div class="loading-spinner"></div>
            <p style="margin-top: 15px; margin-bottom: 8px;">🎨 图片生成中...</p>
            <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.8); text-align: center; margin-top: 8px; font-weight: 500;">
                📦 ${modelName}
            </div>
        </div>
    `;
    
    imagesGrid.insertBefore(placeholderCard, imagesGrid.firstChild);
}

export function removeImageGeneratingPlaceholder(taskId) {
    const placeholder = document.querySelector(`.image-placeholder-card[data-task-id="${taskId}"]`);
    if (placeholder) {
        placeholder.remove();
    }
}

async function downloadImage(imageSrc, filename) {
    try {
        if (imageSrc.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const res = await fetch(imageSrc, { mode: 'cors' });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        showError('下载失败，已为您在新标签页打开图片');
        window.open(imageSrc, '_blank');
    }
}

// 【优化】全局共享的 IntersectionObserver，用于 base64 大图懒加载
// 当图片进入视口时才将真实 base64 src 赋给 img，避免页面初始化时一次性解码所有大图
let _lazyImageObserver = null;
function _observeLazyImage(img) {
    if (!_lazyImageObserver) {
        _lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const lazySrc = target.dataset.lazySrc;
                    if (lazySrc) {
                        target.src = lazySrc;
                        target.style.minHeight = '';
                        target.style.background = '';
                        delete target.dataset.lazySrc;
                    }
                    _lazyImageObserver.unobserve(target);
                }
            });
        }, { rootMargin: '200px 0px' }); // 提前 200px 开始加载，体验更流畅
    }
    _lazyImageObserver.observe(img);
}
