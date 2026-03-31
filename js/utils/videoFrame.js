/**
 * 视频帧处理工具
 */

export const VideoFrameUtils = {
    /**
     * 加载视频并获取元数据
     * @param {string|File} source 视频URL或File对象
     * @returns {Promise<HTMLVideoElement>} 加载完成的视频元素
     */
    loadVideo(source) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous'; // 尝试跨域加载
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';

            let url;
            if (source instanceof File) {
                url = URL.createObjectURL(source);
            } else {
                url = source;
            }

            video.src = url;

            const cleanup = () => {
                video.removeEventListener('loadedmetadata', onLoaded);
                video.removeEventListener('error', onError);
            };

            const onLoaded = () => {
                cleanup();
                resolve(video);
            };

            const onError = (e) => {
                cleanup();
                reject(new Error('视频加载失败'));
            };

            video.addEventListener('loadedmetadata', onLoaded);
            video.addEventListener('error', onError);
            
            // 触发加载
            video.load();
        });
    },

    /**
     * 跳转到指定时间并等待画面就绪
     * @param {HTMLVideoElement} video 视频元素
     * @param {number} time 目标时间(秒)
     * @returns {Promise<void>}
     */
    seekTo(video, time) {
        return new Promise((resolve, reject) => {
            // 检查 duration 是否有效
            if (!isFinite(video.duration) || video.duration <= 0) {
                reject(new Error('视频时长无效'));
                return;
            }
            
            // 检查目标时间是否有效
            if (!isFinite(time) || time < 0) {
                reject(new Error('目标时间无效'));
                return;
            }
            
            if (Math.abs(video.currentTime - time) < 0.1) {
                resolve();
                return;
            }

            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };

            video.addEventListener('seeked', onSeeked);
            video.currentTime = Math.max(0, Math.min(time, video.duration));
        });
    },

    /**
     * 捕获当前帧
     * @param {HTMLVideoElement} video 视频元素
     * @param {string} format 图片格式 ('image/png' | 'image/jpeg')
     * @param {number} quality 图片质量 (0-1)
     * @returns {Promise<{blob: Blob, url: string, width: number, height: number}>}
     */
    captureFrame(video, format = 'image/png', quality = 0.95) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                const url = URL.createObjectURL(blob);
                resolve({
                    blob,
                    url,
                    width: canvas.width,
                    height: canvas.height
                });
            }, format, quality);
        });
    },

    /**
     * 清理资源
     * @param {string} url Blob URL
     */
    revokeUrl(url) {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    },

    /**
     * 格式化时间显示
     * @param {number} seconds 秒数
     * @returns {string} 格式化的时间字符串
     */
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};
