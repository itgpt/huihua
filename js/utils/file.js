export async function uploadToCatbox(file) {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '12h');
    formData.append('fileToUpload', file, file.name);
    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error(`Catbox upload failed: ${response.status}`);
    const url = (await response.text()).trim();
    if (!url.startsWith('http')) throw new Error(`Catbox returned invalid URL: ${url}`);
    return url;
}

export function dataURIToBlob(dataURI) {
    const splitDataURI = dataURI.split(',');
    const byteString = splitDataURI[0].indexOf('base64') >= 0 ? atob(splitDataURI[1]) : decodeURI(splitDataURI[1]);
    const mimeString = splitDataURI[0].split(':')[1].split(';')[0];
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++)
        ia[i] = byteString.charCodeAt(i);
    return new Blob([ia], { type: mimeString });
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 从 base64 生成缩略图
// 【优化】使用 createImageBitmap 替代 new Image()
// 原因：new Image() + onload 在主线程同步解码大图，期间页面无法响应用户交互
// createImageBitmap 支持在后台线程解码图像，并且内置了缩放参数，
// 减少一次完整解码 + Canvas 缩放的开销，直接以目标尺寸解码
export async function generateThumbnail(base64Data, maxWidth = 400, maxHeight = 300, quality = 0.7) {
    try {
        // 将 base64 转为 Blob，避免将超长字符串作为 img.src 的 data URI
        const byteCharacters = atob(base64Data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'image/png' });

        // createImageBitmap 在浏览器后台线程解码，不阻塞主线程
        // resizeWidth/Height 让浏览器直接以目标尺寸解码，省去 Canvas 二次缩放
        const fullBitmap = await createImageBitmap(blob);
        
        let width = fullBitmap.width;
        let height = fullBitmap.height;
        if (width > maxWidth) { height = Math.round((maxWidth / width) * height); width = maxWidth; }
        if (height > maxHeight) { width = Math.round((maxHeight / height) * width); height = maxHeight; }

        // 使用目标尺寸重新解码（更高效）
        const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'medium' });
        fullBitmap.close(); // 释放第一次解码占用的内存

        // OffscreenCanvas 在非主线程执行绘制（支持时），避免 Layout/Paint 开销
        let canvas;
        if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(width, height);
        } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close(); // 及时释放 ImageBitmap 内存

        if (canvas instanceof OffscreenCanvas) {
            const canvasBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(canvasBlob);
            });
        } else {
            return canvas.toDataURL('image/jpeg', quality);
        }
    } catch (err) {
        // 降级方案：createImageBitmap 不支持时回退到传统方式
        console.warn('createImageBitmap 不支持，降级使用 Image 元素:', err);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > maxWidth) { height = Math.round((maxWidth / width) * height); width = maxWidth; }
                if (height > maxHeight) { width = Math.round((maxHeight / height) * width); height = maxHeight; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = `data:image/png;base64,${base64Data}`;
        });
    }
}
