import { showSuccess, showError } from '../toast.js';
import { VideoFrameUtils } from '../../../utils/videoFrame.js';
import { formatTime } from '../../../utils/format.js';
import { loadStylesheet } from '../../../utils/styles.js';

const FFMPEG_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js';
const FFMPEG_CORE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js';
const FFMPEG_WASM_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm';
const STYLE_PATHS = ['css/tools/shared.css', 'css/tools/quickTimeline.css'];

let ffmpegModuleLoadPromise = null;

function showExportDialog() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:28px 32px;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">
                <div style="font-size:16px;font-weight:700;margin-bottom:8px;">选择导出格式</div>
                <div style="font-size:13px;color:#666;margin-bottom:24px;">WebM 无需转码，速度快，推荐导入剪映使用</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button id="_exp_mp4" style="padding:12px;border-radius:10px;border:2px solid #6366f1;background:#6366f1;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">
                        🎬 导出 MP4（需转码，较慢）
                    </button>
                    <button id="_exp_webm" style="padding:12px;border-radius:10px;border:2px solid #e9ecef;background:#f8f9fa;color:#333;font-size:14px;font-weight:600;cursor:pointer;">
                        ⚡ 导出 WebM（快速，推荐剪映导入）
                    </button>
                    <button id="_exp_cancel" style="padding:8px;border:none;background:none;color:#999;font-size:13px;cursor:pointer;">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#_exp_mp4').onclick = () => { document.body.removeChild(overlay); resolve('mp4'); };
        overlay.querySelector('#_exp_webm').onclick = () => { document.body.removeChild(overlay); resolve('webm'); };
        overlay.querySelector('#_exp_cancel').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    });
}

function loadFFmpegModule() {
    if (!ffmpegModuleLoadPromise) {
        ffmpegModuleLoadPromise = import(FFMPEG_MODULE_URL).catch((error) => {
            ffmpegModuleLoadPromise = null;
            console.warn('FFmpeg CDN 加载失败:', error);
            throw new Error('FFmpeg CDN 加载失败，请检查网络后重试');
        });
    }

    return ffmpegModuleLoadPromise;
}

async function convertToMp4(webmBlob, onProgress) {
    const { FFmpeg } = await loadFFmpegModule();
    const ffmpeg = new FFmpeg();
    if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
    await ffmpeg.load({
        coreURL: FFMPEG_CORE_URL,
        wasmURL: FFMPEG_WASM_URL,
    });

    const inputName = 'input.webm';
    const outputName = 'output.mp4';
    const arrayBuffer = await webmBlob.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
    await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-movflags', '+faststart', outputName]);
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data.buffer], { type: 'video/mp4' });
}

const DEFAULT_PX_PER_SEC = 24;
const TIMELINE_MIN_CLIP_PX = 40; // 允许更短的片段

const QuickTimeline = {
    state: {
        isOpen: false,
        clips: [], // { id, src, thumbUrl, duration, offset, name }
        
        pxPerSec: DEFAULT_PX_PER_SEC, // 缩放比例
        zoomLevel: 24,
        
        previewMode: 'clip', // 'clip' | 'merged'
        selectedClipId: null,
        
        isPreviewPlaying: false,
        previewTimeSec: 0, // 当前时间轴时间
        
        isMerging: false,
        mergedUrl: null,
        
        dragSourceId: null,
        dragOverId: null
    },

    elements: {
        modal: null,
        timelineScroll: null,
        rulerContainer: null,
        trackContainer: null,
        gridBg: null,
        previewVideo: null,
        fileInput: null,
        playhead: null,
        zoomRange: null
    },

    refs: {
        playRaf: null
    },

    init() {
        // Init
    },

    cacheElements() {
        this.elements.modal = document.getElementById('quickTimelineModal');
        this.elements.timelineScroll = document.getElementById('timelineScroll');
        this.elements.rulerContainer = document.getElementById('timelineRuler');
        this.elements.trackContainer = document.getElementById('timelineTracks');
        this.elements.gridBg = document.querySelector('.timeline-grid-bg');
        this.elements.previewVideo = document.getElementById('timelinePreviewVideo');
        this.elements.fileInput = document.getElementById('timelineFileInput');
        this.elements.mergeBtn = document.getElementById('timelineMergeBtn');
        this.elements.playBtn = document.getElementById('timelinePlayBtn');
        this.elements.timeDisplay = document.getElementById('timelineTimeDisplay');
        this.elements.progressBar = document.getElementById('timelineProgressBar');
        this.elements.playhead = document.getElementById('timelinePlayhead');
        this.elements.zoomRange = document.getElementById('timelineZoomRange');
        this.elements.splitBtn = document.getElementById('timelineSplitBtn');
    },

    async open() {
        await Promise.all(STYLE_PATHS.map(loadStylesheet));
        this.cacheElements();
        if (!this.elements.modal) return;

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        this.bindEvents();
        this.updateZoom(this.state.zoomLevel); // Initialize zoom
        this.render();
        this.updatePreviewSource();
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
        this.pausePreview();
        // 这里不重置数据，保留用户编辑状态，除非显式点击清空
    },

    reset() {
        this.state.clips.forEach(c => {
            if (c.src.startsWith('blob:')) URL.revokeObjectURL(c.src);
        });
        if (this.state.mergedUrl) URL.revokeObjectURL(this.state.mergedUrl);
        
        this.state.clips = [];
        this.state.previewMode = 'clip';
        this.state.selectedClipId = null;
        this.state.isPreviewPlaying = false;
        this.state.previewTimeSec = 0;
        this.state.mergedUrl = null;
        
        this.render();
    },

    bindEvents() {
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // Close
        document.getElementById('timelineCloseBtn')?.addEventListener('click', () => this.close());

        // Add files
        this.elements.fileInput?.addEventListener('change', (e) => this.handleFiles(e.target.files));
        document.getElementById('timelineAddBtn')?.addEventListener('click', () => this.elements.fileInput.click());

        // Clear
        document.getElementById('timelineClearBtn')?.addEventListener('click', () => {
            if (confirm('确定清空时间线吗？')) this.reset();
        });

        // Split
        this.elements.splitBtn?.addEventListener('click', () => this.splitClip());

        // Zoom
        this.elements.zoomRange?.addEventListener('input', (e) => {
            this.updateZoom(parseInt(e.target.value));
        });

        // Merge
        this.elements.mergeBtn?.addEventListener('click', () => this.mergeClips());

        // Preview Controls
        this.elements.playBtn?.addEventListener('click', () => this.togglePlay());
        
        // 后退/前进按钮 - 按帧移动（30fps = 1/30秒）
        const fps = 30;
        const frameTime = 1 / fps;
        document.getElementById('timelineRewindBtn')?.addEventListener('click', () => {
            this.seek(this.state.previewTimeSec - frameTime);
        });
        document.getElementById('timelineForwardBtn')?.addEventListener('click', () => {
            this.seek(this.state.previewTimeSec + frameTime);
        });
        
        // Mute button
        document.getElementById('timelineMuteBtn')?.addEventListener('click', () => {
            if (this.elements.previewVideo) {
                this.elements.previewVideo.muted = !this.elements.previewVideo.muted;
                const btn = document.getElementById('timelineMuteBtn');
                if (btn) btn.textContent = this.elements.previewVideo.muted ? '🔇' : '🔊';
            }
        });
        
        // Fullscreen button
        document.getElementById('timelineFullscreenBtn')?.addEventListener('click', () => {
            const videoArea = this.elements.previewVideo?.parentElement;
            if (!videoArea) return;
            
            if (!document.fullscreenElement) {
                videoArea.requestFullscreen().catch(err => {
                    console.error('全屏失败:', err);
                });
            } else {
                document.exitFullscreen();
            }
        });
        
        this.elements.progressBar?.addEventListener('input', (e) => {
            this.seek(parseFloat(e.target.value));
        });

        // Ruler/Timeline scrubbing - 点击跳转
        if (this.elements.timelineScroll) {
            this.elements.timelineScroll.addEventListener('click', (e) => {
                // 如果点击的是轨道上的片段，已经在片段点击事件处理了
                // 这里处理点击标尺或空白处
                if (e.target.closest('.timeline-clip-item')) return;
                
                const rect = this.elements.trackContainer.getBoundingClientRect();
                // rect.left 已经包含了滚动偏移，直接相减即为相对于内容的坐标
                const clickX = e.clientX - rect.left;
                
                const time = clickX / this.state.pxPerSec;
                this.seek(time);
            });
        }
        
        // Playhead dragging - 让播放头可以拖动
        if (this.elements.playhead) {
            let isDragging = false;
            
            const startDrag = (e) => {
                isDragging = true;
                this.pausePreview(); // 拖动时暂停播放
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            };
            
            const doDrag = (e) => {
                if (!isDragging) return;
                
                const rect = this.elements.trackContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                
                const time = Math.max(0, clickX / this.state.pxPerSec);
                this.seek(time);
                
                e.preventDefault();
            };
            
            const endDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                }
            };
            
            // 播放头拖动事件
            this.elements.playhead.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', endDrag);
            
            // 标尺区域也可以拖动
            if (this.elements.rulerContainer) {
                this.elements.rulerContainer.addEventListener('mousedown', (e) => {
                    startDrag(e);
                    doDrag(e); // 立即跳转到点击位置
                });
            }
        }

        // Mode switch
        document.querySelectorAll('.timeline-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                if (mode === 'merged' && !this.state.mergedUrl) {
                    showError('请先合并视频');
                    return;
                }
                this.state.previewMode = mode;
                this.updatePreviewSource();
                this.render();
            });
        });

        // Video events
        if (this.elements.previewVideo) {
            this.elements.previewVideo.addEventListener('timeupdate', () => {
                if (!this.state.isPreviewPlaying) return; // 只在播放时自动更新，避免 seek 冲突
                
                if (this.state.previewMode === 'merged') {
                    this.state.previewTimeSec = this.elements.previewVideo.currentTime;
                    this.updateUI();
                } else {
                    // Clip mode: video current time is relative to clip
                    // We need to advance global time manually or sync
                    const seg = this.getCurrentSegment();
                    if (seg) {
                        const localTime = this.elements.previewVideo.currentTime;
                        // 计算绝对时间：clip在时间轴的开始 + 当前播放进度
                        // 注意：video.currentTime 包含了 offset，所以要减去 offset
                        // 真实的逻辑是：previewTime = seg.startTime + (video.currentTime - seg.clip.offset)
                        const clipProgress = localTime - seg.clip.offset;
                        
                        if (clipProgress >= seg.duration) {
                            // Clip ended
                            this.playNextClip(seg);
                        } else {
                            this.state.previewTimeSec = seg.startTime + clipProgress;
                            this.updateUI();
                        }
                    }
                }
            });

            this.elements.previewVideo.addEventListener('ended', () => {
                if (this.state.previewMode === 'merged') {
                    this.state.isPreviewPlaying = false;
                    this.renderControls();
                } else {
                    const seg = this.getCurrentSegment();
                    if (seg) this.playNextClip(seg);
                }
            });
        }
        
        // 键盘快捷键 - 左右箭头按帧移动，空格播放/暂停
        document.addEventListener('keydown', (e) => {
            // 只在时间线打开时响应
            if (!this.state.isOpen) return;
            
            // 如果焦点在输入框，不响应
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const fps = 30;
            const frameTime = 1 / fps;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(this.state.previewTimeSec - frameTime);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(this.state.previewTimeSec + frameTime);
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.seek(0);
                    break;
                case 'End':
                    e.preventDefault();
                    this.seek(this.getTotalDuration());
                    break;
                case 'Delete':
                case 'Backspace': {
                    // 删除选中片段
                    if (this.state.selectedClipId) {
                        e.preventDefault();
                        this.state.clips = this.state.clips.filter(c => c.id !== this.state.selectedClipId);
                        this.state.selectedClipId = this.state.clips[0]?.id || null;
                        this.render();
                    }
                    break;
                }
                case 'b':
                case 'B':
                    // Ctrl+B 分割片段
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.splitClip();
                    }
                    break;
                case 'e':
                case 'E':
                    // Ctrl+E 导出
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.mergeClips();
                    }
                    break;
                case 'i':
                case 'I': {
                    // 设入点：把选中片段的 offset 推到当前时间
                    e.preventDefault();
                    const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
                    if (clip) {
                        const newOffset = clip.offset + this.state.previewTimeSec;
                        const newDuration = clip.duration - this.state.previewTimeSec;
                        if (newDuration > 0.1) {
                            clip.offset = newOffset;
                            clip.duration = newDuration;
                            this.render();
                        }
                    }
                    break;
                }
                case 'o':
                case 'O': {
                    // 设出点：把选中片段的 duration 截到当前时间
                    e.preventDefault();
                    const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
                    if (clip) {
                        const newDuration = this.state.previewTimeSec;
                        if (newDuration > 0.1) {
                            clip.duration = newDuration;
                            this.render();
                        }
                    }
                    break;
                }
            }
        });
    },

    updateZoom(val) {
        this.state.zoomLevel = val;
        this.state.pxPerSec = val; // 1s = val px
        
        // 更新网格背景大小 (假设每秒一条线)
        if (this.elements.gridBg) {
            this.elements.gridBg.style.backgroundSize = `${val}px 100%`;
        }
        
        this.render();
    },

    getCurrentSegment() {
        const segments = this.getSegments();
        // 找到包含当前时间的片段
        return segments.find(s => this.state.previewTimeSec >= s.startTime && this.state.previewTimeSec < s.endTime);
    },

    playNextClip(currentSeg) {
        const segments = this.getSegments();
        const idx = segments.findIndex(s => s.clip.id === currentSeg.clip.id);
        if (idx < segments.length - 1) {
            const nextSeg = segments[idx + 1];
            this.state.selectedClipId = nextSeg.clip.id;
            this.state.previewTimeSec = nextSeg.startTime;
            this.updatePreviewSource(true);
        } else {
            this.pausePreview();
            this.state.previewTimeSec = this.getTotalDuration();
            this.updateUI();
        }
    },

    async handleFiles(files) {
        if (!files || files.length === 0) return;

        const newClips = [];
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('video/')) continue;
            
            const src = URL.createObjectURL(file);
            const clip = {
                id: Date.now() + '_' + Math.random().toString(36).slice(2),
                name: file.name,
                src,
                thumbUrl: null,
                duration: 10, // default
                offset: 0 // start from 0
            };

            try {
                const video = await VideoFrameUtils.loadVideo(src);
                if (video.duration && isFinite(video.duration)) {
                    clip.duration = video.duration;
                }
                const frame = await VideoFrameUtils.captureFrame(video);
                if (frame) clip.thumbUrl = frame.url;
            } catch (e) {
                console.warn('Failed to load video metadata', e);
            }

            newClips.push(clip);
        }

        this.state.clips = [...this.state.clips, ...newClips];
        if (!this.state.selectedClipId && newClips.length > 0) {
            this.state.selectedClipId = newClips[0].id;
        }
        
        this.render();
        this.updatePreviewSource();
    },

    removeClip(id) {
        const clip = this.state.clips.find(c => c.id === id);
        this.state.clips = this.state.clips.filter(c => c.id !== id);
        if (this.state.selectedClipId === id) {
            this.state.selectedClipId = this.state.clips.length > 0 ? this.state.clips[0].id : null;
        }
        this.render();
        this.updatePreviewSource();
    },

    splitClip() {
        const seg = this.getCurrentSegment();
        if (!seg) {
            showError('请先选择要分割的时间点');
            return;
        }

        const splitTime = this.state.previewTimeSec;
        const relativeTime = splitTime - seg.startTime;
        
        // 最小分割精度 0.1s
        if (relativeTime < 0.1 || relativeTime > seg.duration - 0.1) {
            showError('分割点太靠近边缘');
            return;
        }

        const originalClip = seg.clip;
        
        // Clip 1: 0 -> relativeTime
        const clip1 = {
            ...originalClip,
            id: originalClip.id + '_1',
            duration: relativeTime,
            // offset unchanged
        };

        // Clip 2: relativeTime -> end
        const clip2 = {
            ...originalClip,
            id: originalClip.id + '_2',
            duration: originalClip.duration - relativeTime,
            offset: originalClip.offset + relativeTime
        };

        // Replace original with clip1, clip2
        const idx = this.state.clips.findIndex(c => c.id === originalClip.id);
        this.state.clips.splice(idx, 1, clip1, clip2);
        
        this.state.selectedClipId = clip2.id;
        this.render();
        showSuccess('已分割');
    },

    getSegments() {
        let tCursor = 0;
        return this.state.clips.map(clip => {
            const widthPx = clip.duration * this.state.pxPerSec;
            const seg = {
                clip,
                duration: clip.duration,
                widthPx,
                startTime: tCursor,
                endTime: tCursor + clip.duration
            };
            tCursor += clip.duration;
            return seg;
        });
    },

    getTotalDuration() {
        const segments = this.getSegments();
        return segments.length > 0 ? segments[segments.length - 1].endTime : 0;
    },

    seek(timeSec) {
        const total = this.getTotalDuration();
        timeSec = Math.max(0, Math.min(timeSec, total));
        this.state.previewTimeSec = timeSec;

        if (this.state.previewMode === 'merged') {
            if (this.elements.previewVideo) this.elements.previewVideo.currentTime = timeSec;
        } else {
            const segments = this.getSegments();
            const seg = segments.find(s => timeSec >= s.startTime && timeSec < s.endTime);
            
            if (seg) {
                // 如果切换了片段
                if (this.state.selectedClipId !== seg.clip.id) {
                    this.state.selectedClipId = seg.clip.id;
                    // Seek video to offset + relative time
                    const relative = timeSec - seg.startTime;
                    this.updatePreviewSource(this.state.isPreviewPlaying, seg.clip.offset + relative);
                } else if (this.elements.previewVideo) {
                    // 同一片段，只调整时间
                    const relative = timeSec - seg.startTime;
                    const targetTime = seg.clip.offset + relative;
                    // 避免频繁设置导致卡顿
                    if (Math.abs(this.elements.previewVideo.currentTime - targetTime) > 0.1) {
                        this.elements.previewVideo.currentTime = targetTime;
                    }
                }
            }
        }
        
        this.updateUI();
    },

    togglePlay() {
        if (this.state.isPreviewPlaying) {
            this.pausePreview();
        } else {
            this.playPreview();
        }
    },

    playPreview() {
        if (!this.elements.previewVideo) return;
        this.state.isPreviewPlaying = true;
        this.renderControls();
        const p = this.elements.previewVideo.play();
        if (p) p.catch(e => {
            if (e.name !== 'AbortError') console.error('Play failed', e);
            this.state.isPreviewPlaying = false;
            this.renderControls();
        });
    },

    pausePreview() {
        if (!this.elements.previewVideo) return;
        this.state.isPreviewPlaying = false;
        const p = this.elements.previewVideo.play();
        if (p) {
            p.then(() => this.elements.previewVideo.pause()).catch(() => {});
        } else {
            this.elements.previewVideo.pause();
        }
        this.renderControls();
    },

    updatePreviewSource(autoPlay = false, startTime = null) {
        if (!this.elements.previewVideo) return;

        let src = '';
        if (this.state.previewMode === 'merged') {
            src = this.state.mergedUrl || '';
        } else {
            const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
            src = clip ? clip.src : '';
        }

        if (this.elements.previewVideo.src !== src) {
            this.elements.previewVideo.src = src;
            this.elements.previewVideo.load();
        }

        if (startTime !== null) {
            this.elements.previewVideo.currentTime = startTime;
        } else if (this.state.previewMode === 'clip') {
            const clip = this.state.clips.find(c => c.id === this.state.selectedClipId);
            if (clip) this.elements.previewVideo.currentTime = clip.offset;
        }

        if (autoPlay) {
            this.playPreview();
        } else {
            this.pausePreview();
        }
    },

    render() {
        this.renderTimeline();
        this.renderControls();
        this.updateUI();
    },

    renderControls() {
        if (this.elements.playBtn) {
            this.elements.playBtn.innerHTML = this.state.isPreviewPlaying 
                ? '⏸' // Pause
                : '▶'; // Play
        }
        
        document.querySelectorAll('.timeline-mode-btn').forEach(btn => {
            const isActive = btn.dataset.mode === this.state.previewMode;
            btn.classList.toggle('active', isActive);
        });

        if (this.elements.mergeBtn) {
            if (this.state.isMerging) {
                this.elements.mergeBtn.textContent = '处理中...';
                this.elements.mergeBtn.disabled = true;
            } else {
                this.elements.mergeBtn.textContent = '合并导出';
                this.elements.mergeBtn.disabled = this.state.clips.length === 0;
            }
        }
    },

    updateUI() {
        // Update Time Display
        const total = this.getTotalDuration();
        const current = this.state.previewTimeSec;
        
        if (this.elements.timeDisplay) {
            this.elements.timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
        }
        
        // Update Progress Bar
        if (this.elements.progressBar) {
            this.elements.progressBar.max = total || 0;
            this.elements.progressBar.value = current || 0;
            
            // 动态更新绿色填充比例
            const percent = total > 0 ? (current / total) * 100 : 0;
            this.elements.progressBar.style.setProperty('--progress', `${percent}%`);
        }

        // Update Playhead Position
        if (this.elements.playhead) {
            const px = current * this.state.pxPerSec;
            this.elements.playhead.style.left = `${px}px`;
        }

        // Scroll Timeline to keep playhead in view
        if (this.state.isPreviewPlaying && this.elements.timelineScroll) {
            const px = current * this.state.pxPerSec;
            const containerWidth = this.elements.timelineScroll.clientWidth;
            const scrollLeft = this.elements.timelineScroll.scrollLeft;
            
            // Auto scroll logic (simple centering)
            if (px > scrollLeft + containerWidth * 0.8) {
                this.elements.timelineScroll.scrollLeft = px - containerWidth * 0.2;
            } else if (px < scrollLeft) {
                this.elements.timelineScroll.scrollLeft = px - containerWidth * 0.2;
            }
        }
        
        // Highlight active clip
        const segments = this.getSegments();
        const seg = segments.find(s => current >= s.startTime && current < s.endTime);
        const activeId = seg ? seg.clip.id : this.state.selectedClipId;
        
        document.querySelectorAll('.timeline-clip-item').forEach(el => {
            if (el.dataset.id === activeId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    },

    renderTimeline() {
        if (!this.elements.trackContainer) return;

        const segments = this.getSegments();
        const totalDuration = this.getTotalDuration();
        const totalPx = totalDuration * this.state.pxPerSec;
        const containerWidth = Math.max(totalPx + 200, this.elements.timelineScroll.clientWidth);
        
        // 1. Render Ruler - 优化版：只显示秒，避免拥挤
        if (this.elements.rulerContainer) {
            this.elements.rulerContainer.style.width = `${containerWidth}px`;
            this.elements.rulerContainer.innerHTML = '';
            
            const pxPerSec = this.state.pxPerSec;
            let step = 1;
            
            // 动态决定文字显示间隔（秒）
            if (pxPerSec < 20) step = 10;      // 极小缩放：每10秒
            else if (pxPerSec < 40) step = 5;  // 小缩放：每5秒
            else if (pxPerSec < 80) step = 2;  // 中等缩放：每2秒
            else step = 1;                     // 大缩放：每秒
            
            const totalSeconds = Math.ceil(totalDuration + 10);
            
            for (let s = 0; s <= totalSeconds; s++) {
                const px = s * pxPerSec;
                const mark = document.createElement('div');
                
                // 标记主刻度（显示文字）和次刻度
                if (s % step === 0) {
                    mark.className = 'ruler-mark ruler-mark-major';
                    mark.style.left = `${px}px`;
                    // 文字居中显示
                    mark.innerHTML = `<span style="position:absolute; transform:translateX(-50%); top:2px; font-weight:600;">${formatTime(s)}</span>`;
                } else {
                    mark.className = 'ruler-mark ruler-mark-minor';
                    mark.style.left = `${px}px`;
                }
                
                this.elements.rulerContainer.appendChild(mark);
            }
        }
        
        // 2. Render Clips
        // Clear existing clips but keep playhead
        const playhead = this.elements.playhead;
        const emptyTip = document.getElementById('timelineEmptyTip');
        this.elements.trackContainer.innerHTML = '';
        this.elements.trackContainer.appendChild(playhead);
        if (segments.length === 0 && emptyTip) this.elements.trackContainer.appendChild(emptyTip);
        
        this.elements.trackContainer.style.width = `${containerWidth}px`;

        segments.forEach(seg => {
            const el = document.createElement('div');
            el.className = `timeline-clip-item ${this.state.selectedClipId === seg.clip.id ? 'active' : ''}`;
            el.style.left = `${seg.startTime * this.state.pxPerSec}px`;
            el.style.width = `${seg.widthPx}px`;
            el.draggable = true;
            el.dataset.id = seg.clip.id;

            // 视频帧序列容器
            const framesContainer = document.createElement('div');
            framesContainer.className = 'clip-frames-container';
            el.appendChild(framesContainer);
            
            // 异步生成帧预览
            this.renderClipFrames(seg.clip, framesContainer, seg.widthPx);

            // 内容覆盖层 (标题等)
            const clipInner = document.createElement('div');
            clipInner.className = 'clip-inner';
            
            clipInner.innerHTML = `
                <div class="clip-label">${seg.clip.name}</div>
                <div class="clip-dur">${formatTime(seg.duration)}</div>
                <button class="clip-del-btn">×</button>
            `;
            
            el.appendChild(clipInner);

            // Click select & seek
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止冒泡，避免触发 timelineScroll 的点击
                
                // 计算点击位置对应的时间并跳转
                const rect = this.elements.trackContainer.getBoundingClientRect();
                const scrollLeft = this.elements.timelineScroll.scrollLeft;
                const clickX = e.clientX - rect.left + scrollLeft;
                const time = Math.max(0, clickX / this.state.pxPerSec);
                
                this.state.selectedClipId = seg.clip.id;
                this.seek(time);
                
                this.updatePreviewSource();
            });

            // Delete
            el.querySelector('.clip-del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeClip(seg.clip.id);
            });

            // Drag & Drop
            el.addEventListener('dragstart', (e) => {
                this.state.dragSourceId = seg.clip.id;
                e.dataTransfer.effectAllowed = 'move';
                el.classList.add('dragging');
            });
            
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                document.querySelectorAll('.timeline-clip-item').forEach(c => c.classList.remove('drag-over'));
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.state.dragSourceId !== seg.clip.id) {
                    el.classList.add('drag-over');
                }
            });

            el.addEventListener('dragleave', () => {
                el.classList.remove('drag-over');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const sourceId = this.state.dragSourceId;
                const targetId = seg.clip.id;
                if (sourceId && sourceId !== targetId) {
                    this.reorderClips(sourceId, targetId);
                }
                this.state.dragSourceId = null;
                this.render();
            });

            this.elements.trackContainer.appendChild(el);
        });

        // Add "Add Block"
        const addBlock = document.createElement('div');
        addBlock.className = 'timeline-add-block';
        addBlock.style.width = '100px';
        addBlock.style.position = 'absolute';
        addBlock.style.left = `${totalPx}px`;
        addBlock.style.top = '0';
        addBlock.innerHTML = '+';
        addBlock.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.trackContainer.appendChild(addBlock);
    },

    reorderClips(fromId, toId) {
        const fromIdx = this.state.clips.findIndex(c => c.id === fromId);
        const toIdx = this.state.clips.findIndex(c => c.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;

        const item = this.state.clips[fromIdx];
        this.state.clips.splice(fromIdx, 1);
        this.state.clips.splice(toIdx, 0, item);
    },

    async renderClipFrames(clip, container, widthPx) {
        if (!clip.src) return;

        // 根据宽度决定生成多少张缩略图，假设每个缩略图约 80px 宽
        const thumbWidth = 80;
        const count = Math.max(1, Math.ceil(widthPx / thumbWidth));
        const timeStep = clip.duration / count;
        
        // 先创建占位符
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'clip-frame-item';
            div.style.width = `${100 / count}%`;
            // 先显示默认封面
            if (clip.thumbUrl) {
                div.style.backgroundImage = `url(${clip.thumbUrl})`;
            }
            container.appendChild(div);
        }
        
        // 创建临时视频元素用于抽帧
        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.src = clip.src;
        
        // 等待加载
        try {
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject();
                // 设置超时防止卡死
                setTimeout(() => resolve(), 2000); 
            });
        } catch (e) {
            console.warn('Video load for frames failed', e);
            return;
        }

        const frames = container.querySelectorAll('.clip-frame-item');
        
        // 逐帧提取
        for (let i = 0; i < count; i++) {
            // 如果容器已经被移除（例如用户关闭了窗口或重绘了），停止处理
            if (!document.body.contains(container)) break;
            
            const time = Math.min(i * timeStep, clip.duration);
            
            try {
                // Seek
                video.currentTime = time;
                await new Promise(resolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    video.addEventListener('seeked', onSeeked);
                });
                
                // Draw to canvas (提高清晰度)
                const canvas = document.createElement('canvas');
                const scale = 200 / video.videoHeight; // 高度固定200px左右，提高清晰度
                canvas.width = video.videoWidth * scale;
                canvas.height = video.videoHeight * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(blob => {
                    if (blob && frames[i]) {
                        const url = URL.createObjectURL(blob);
                        frames[i].style.backgroundImage = `url(${url})`;
                    }
                }, 'image/jpeg', 0.85);
                
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Cleanup
        video.removeAttribute('src');
        video.load();
    },

    async mergeClips() {
        if (this.state.clips.length === 0) return;

        // 让用户选择导出格式
        const choice = await showExportDialog();
        if (!choice) return; // 取消

        this.state.isMerging = true;
        this.renderControls();

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set resolution
            const firstClip = this.state.clips[0];
            const metaVideo = await VideoFrameUtils.loadVideo(firstClip.src);
            canvas.width = metaVideo.videoWidth || 1920;
            canvas.height = metaVideo.videoHeight || 1080;

            const stream = canvas.captureStream(30);

            // 音频：用 AudioContext 把视频音频混入录制流
            const audioCtx = new AudioContext();
            await audioCtx.resume();
            const audioDestination = audioCtx.createMediaStreamDestination();
            stream.addTrack(audioDestination.stream.getAudioTracks()[0]);

            let mimeType = 'video/webm;codecs=vp9,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

            // 设置高码率以接近无损质量 (25Mbps)
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 25000000
            });
            const chunks = [];
            
            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const webmBlob = new Blob(chunks, { type: mimeType });

                if (choice === 'mp4') {
                    try {
                        if (this.elements.mergeBtn) this.elements.mergeBtn.textContent = '转码中 0%';
                        const mp4Blob = await convertToMp4(webmBlob, (pct) => {
                            if (this.elements.mergeBtn) this.elements.mergeBtn.textContent = `转码中 ${pct}%`;
                        });
                        if (this.state.mergedUrl) URL.revokeObjectURL(this.state.mergedUrl);
                        this.state.mergedUrl = URL.createObjectURL(mp4Blob);
                        const a = document.createElement('a');
                        a.href = this.state.mergedUrl;
                        a.download = `merged_${Date.now()}.mp4`;
                        a.click();
                    } catch (e) {
                        console.warn('MP4 转码失败，降级为 WebM:', e);
                        if (this.state.mergedUrl) URL.revokeObjectURL(this.state.mergedUrl);
                        this.state.mergedUrl = URL.createObjectURL(webmBlob);
                        const a = document.createElement('a');
                        a.href = this.state.mergedUrl;
                        a.download = `merged_${Date.now()}.webm`;
                        a.click();
                    }
                } else {
                    // webm 直接下载
                    if (this.state.mergedUrl) URL.revokeObjectURL(this.state.mergedUrl);
                    this.state.mergedUrl = URL.createObjectURL(webmBlob);
                    const a = document.createElement('a');
                    a.href = this.state.mergedUrl;
                    a.download = `merged_${Date.now()}.webm`;
                    a.click();
                }

                this.state.isMerging = false;
                this.state.previewMode = 'merged';
                this.renderControls();
                showSuccess('合并完成');
                this.updatePreviewSource();
            };

            recorder.start();

            const video = document.createElement('video');
            video.muted = false;
            video.playsInline = true;
            video.width = canvas.width;
            video.height = canvas.height;

            // 把视频音频接入 AudioContext，用 GainNode 静音扬声器输出但保留录制
            const mediaSource = audioCtx.createMediaElementSource(video);
            const silentGain = audioCtx.createGain();
            silentGain.gain.value = 0; // 不从扬声器播出
            mediaSource.connect(silentGain);
            silentGain.connect(audioCtx.destination);
            mediaSource.connect(audioDestination);

            // Sequential play and record
            for (const clip of this.state.clips) {
                await new Promise((resolve, reject) => {
                    video.src = clip.src;
                    // 设置起始点
                    video.currentTime = clip.offset;
                    
                    let durationPlayed = 0;
                    let lastTime = performance.now();

                    video.onloadedmetadata = () => {
                        video.currentTime = clip.offset;
                        video.play();
                    };
                    
                    video.onerror = (e) => reject(e);

                    const draw = (now) => {
                        if (video.paused || video.ended) return;
                        
                        const dt = (now - lastTime) / 1000;
                        lastTime = now;
                        durationPlayed += dt;

                        // Check if clip duration reached
                        if (durationPlayed >= clip.duration) {
                            video.pause();
                            resolve();
                            return;
                        }

                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        // Fit containment
                        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
                        const w = video.videoWidth * scale;
                        const h = video.videoHeight * scale;
                        const x = (canvas.width - w) / 2;
                        const y = (canvas.height - h) / 2;
                        
                        ctx.drawImage(video, x, y, w, h);
                        requestAnimationFrame(draw);
                    };
                    
                    video.onplay = () => {
                        lastTime = performance.now();
                        requestAnimationFrame(draw);
                    };
                });
            }

            recorder.stop();
            audioCtx.close();

        } catch (e) {
            console.error('Merge error:', e);
            showError('合并失败: ' + e.message);
            this.state.isMerging = false;
            this.renderControls();
        }
    },

    async addClipFromUrl(url, name = 'video.mp4') {
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const file = new File([blob], name, { type: blob.type || 'video/mp4' });
            await this.handleFiles([file]);
            if (!this.state.isOpen) await this.open();
            showSuccess('已添加到时间线');
        } catch (e) {
            showError('添加失败: ' + e.message);
        }
    }
};

export default QuickTimeline;
