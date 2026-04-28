export async function showFullImage(imageSrc, db) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center;
        z-index: 1000; cursor: pointer;
    `;
    const img = document.createElement('img');

    // 尝试从 IndexedDB 加载大图
    try {
        if (db) {
            const cachedBlob = await db.getImage(imageSrc);
            if (cachedBlob) {
                img.src = URL.createObjectURL(cachedBlob);
            } else if (imageSrc.startsWith('data:') || imageSrc.startsWith('http')) {
                img.src = imageSrc;
            } else {
                img.alt = "图片加载失败";
                console.error(`无法加载全尺寸图片: ${imageSrc}`);
            }
        } else {
             img.src = imageSrc;
        }
    } catch (error) {
        img.src = imageSrc; // 回退
        console.error(`加载全尺寸图片时出错: ${imageSrc}`, error);
    }

    img.style.cssText = `
        max-width: 90%; max-height: 90%; border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;
    modal.appendChild(img);
    document.body.appendChild(modal);
    modal.onclick = () => {
        // 释放可能创建的 Object URL
        if (img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
        document.body.removeChild(modal);
    };
}

export function bindVideoLoadFallback(video, videoUrl, options = {}) {
    if (!video) return;

    const {
        onError,
        onRetry,
    } = options;

    video.addEventListener('error', () => {
        if (typeof onError === 'function') {
            onError();
            return;
        }

        const container = video.parentElement;
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px; align-items:center; justify-content:center; color:#fff; text-align:center; padding:24px; max-width:420px;">
                <div style="font-size:16px; font-weight:600;">视频加载失败</div>
                <div style="font-size:13px; line-height:1.6; color:rgba(255,255,255,0.8);">当前浏览器连接被中断，可以重试，或在新标签页直接打开视频地址。</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    <button type="button" data-action="retry-video" style="padding:8px 14px; border:none; border-radius:8px; background:#4f46e5; color:#fff; cursor:pointer;">重试</button>
                    <button type="button" data-action="open-video" style="padding:8px 14px; border:1px solid rgba(255,255,255,0.25); border-radius:8px; background:rgba(255,255,255,0.08); color:#fff; cursor:pointer;">新标签打开</button>
                </div>
            </div>
        `;

        const retryBtn = container.querySelector('[data-action="retry-video"]');
        const openBtn = container.querySelector('[data-action="open-video"]');

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (typeof onRetry === 'function') {
                    onRetry();
                    return;
                }
                window.location.reload();
            });
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                window.open(videoUrl, '_blank');
            });
        }
    }, { once: true });
}

export function showFullVideo(videoUrl) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center;
        z-index: 1000; cursor: pointer; padding: 20px;
    `;
    
    const video = document.createElement('video');
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.cssText = `
        max-width: 90%; max-height: 90%; border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;

    bindVideoLoadFallback(video, videoUrl);
    
    modal.appendChild(video);
    document.body.appendChild(modal);
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            video.pause();
            document.body.removeChild(modal);
        }
    };
}
