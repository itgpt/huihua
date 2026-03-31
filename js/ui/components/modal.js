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
    video.style.cssText = `
        max-width: 90%; max-height: 90%; border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;
    
    modal.appendChild(video);
    document.body.appendChild(modal);
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            video.pause();
            document.body.removeChild(modal);
        }
    };
}
