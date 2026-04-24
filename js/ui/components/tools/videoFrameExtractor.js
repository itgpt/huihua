import { VideoFrameUtils } from '../../../utils/videoFrame.js';
import { loadStylesheet } from '../../../utils/styles.js';
import { showSuccess, showError } from '../toast.js';

const STYLE_PATHS = ['css/tools/shared.css', 'css/tools/videoFrameExtractor.css'];

const VideoFrameExtractor = {
    // 状态
    state: {
        isOpen: false,
        videoUrl: null,
        duration: null,
        videoElement: null,
        collageGrid: 3,
        collageFilled: 0,
        isRendering: false,
        collageCanvas: null,
        firstFrame: null,
        lastFrame: null
    },

    // DOM 元素缓存
    elements: {
        modal: null,
        fileInput: null,
        urlInput: null,
        videoPreview: null,
        collageCanvas: null,
        firstFrameImg: null,
        lastFrameImg: null,
        collageProgress: null
    },

    init() {
        console.log('[VideoFrameExtractor] 初始化...');
        // 确保模态框事件绑定
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        this.elements.modal = document.getElementById('videoFrameModal');
        this.elements.fileInput = document.getElementById('videoFrameFileInput');
        this.elements.urlInput = document.getElementById('videoFrameUrlInput');
        this.elements.videoPreview = document.getElementById('videoFramePreview');
        this.elements.collageCanvas = document.getElementById('collageCanvas');
        this.elements.firstFrameImg = document.getElementById('firstFramePreviewImg');
        this.elements.lastFrameImg = document.getElementById('lastFramePreviewImg');
        this.elements.collageProgress = document.getElementById('collageProgress');
        
        // 绑定 Canvas context
        if (this.elements.collageCanvas) {
            this.state.collageCanvas = this.elements.collageCanvas;
        }
    },

    bindEvents() {
        if (!this.elements.modal) return;
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // 关闭按钮
        document.getElementById('videoFrameCloseBtn')?.addEventListener('click', () => this.close());
        
        // 文件上传
        this.elements.fileInput?.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        document.getElementById('videoFrameUploadBtn')?.addEventListener('click', () => this.elements.fileInput?.click());
        
        // URL 加载
        document.getElementById('videoFrameLoadBtn')?.addEventListener('click', () => this.loadVideoFromUrl());
        this.elements.urlInput?.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') this.loadVideoFromUrl();
        });

        // 提取帧操作
        document.getElementById('captureFirstFrameBtn')?.addEventListener('click', () => this.captureFrame('first'));
        document.getElementById('captureLastFrameBtn')?.addEventListener('click', () => this.captureFrame('last'));
        document.getElementById('captureCollageBtn')?.addEventListener('click', () => this.captureCollage());
        document.getElementById('clearLastFrameBtn')?.addEventListener('click', () => this.clearLastFrame());

        // 下载操作
        document.getElementById('downloadFirstFrameBtn')?.addEventListener('click', () => this.downloadFrame('first'));
        document.getElementById('downloadLastFrameBtn')?.addEventListener('click', () => this.downloadFrame('last'));
        document.getElementById('downloadCollageBtn')?.addEventListener('click', () => this.downloadCollage());

        // 宫格切换
        document.querySelectorAll('.grid-option').forEach(btn => {
            btn.addEventListener('click', (evt) => {
                const n = parseInt(evt.target.dataset.grid);
                this.setGrid(n);
            });
        });
    },

    async open(videoUrl = null) {
        await Promise.all(STYLE_PATHS.map(loadStylesheet));
        this.cacheElements();
        if (!this.elements.modal) {
            console.error('VideoFrameModal element not found!');
            return;
        }

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        
        // 如果之前没有视频，重置
        if (!this.state.videoUrl) {
            this.reset();
        }

        if (videoUrl) {
            this.loadVideo(videoUrl);
        }
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
        // 关闭时不清理视频，保留缓存以便下次快速打开
        this.clearResults();
    },

    reset() {
        // 完全重置，清理所有资源（包括视频）
        if (this.state.videoUrl) {
            VideoFrameUtils.revokeUrl(this.state.videoUrl);
        }
        if (this.state.firstFrame) VideoFrameUtils.revokeUrl(this.state.firstFrame.url);
        if (this.state.lastFrame) VideoFrameUtils.revokeUrl(this.state.lastFrame.url);

        this.state.videoUrl = null;
        this.state.duration = null;
        this.state.videoElement = null;
        this.state.collageFilled = 0;
        this.state.isRendering = false;
        this.state.firstFrame = null;
        this.state.lastFrame = null;

        // 重置 UI - 移除事件监听器避免触发错误
        if (this.elements.videoPreview) {
            this.elements.videoPreview.onloadedmetadata = null;
            this.elements.videoPreview.onerror = null;
            this.elements.videoPreview.pause();
            this.elements.videoPreview.src = '';
            // 不调用 load()，避免触发 error 事件
        }
        if (this.elements.urlInput) this.elements.urlInput.value = '';
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        
        this.clearResults();
        this.updateUI();
        this.clearCollage();
        this.switchView('frames');
    },

    clearResults() {
        // 只清理提取结果，保留视频缓存
        if (this.state.firstFrame) VideoFrameUtils.revokeUrl(this.state.firstFrame.url);
        if (this.state.lastFrame) VideoFrameUtils.revokeUrl(this.state.lastFrame.url);
        
        this.state.firstFrame = null;
        this.state.lastFrame = null;
        this.state.collageFilled = 0;
        
        // 隐藏下载按钮和预览图
        if (this.elements.firstFrameImg) {
            this.elements.firstFrameImg.style.display = 'none';
            this.elements.firstFrameImg.src = '';
        }
        if (this.elements.lastFrameImg) {
            this.elements.lastFrameImg.style.display = 'none';
            this.elements.lastFrameImg.src = '';
        }
        const firstFrameActions = document.getElementById('firstFrameActions');
        const lastFrameActions = document.getElementById('lastFrameActions');
        const firstFrameEmpty = document.getElementById('firstFrameEmpty');
        const lastFrameEmpty = document.getElementById('lastFrameEmpty');
        
        if (firstFrameActions) firstFrameActions.style.display = 'none';
        if (lastFrameActions) lastFrameActions.style.display = 'none';
        if (firstFrameEmpty) firstFrameEmpty.style.display = 'flex';
        if (lastFrameEmpty) lastFrameEmpty.style.display = 'flex';
        
        this.clearCollage();
    },

    async loadVideo(source) {
        try {
            // 注意：VideoFrameUtils.loadVideo 返回的是新创建的 video 元素，不是 DOM 中的预览元素
            // 这里我们直接用 preview 元素来播放，方便用户操作
            let url;
            if (source instanceof File) {
                url = URL.createObjectURL(source);
            } else {
                url = source;
            }
            
            this.state.videoUrl = url;
            if (this.elements.videoPreview) {
                // 设置 crossOrigin 以避免 Canvas 污染问题
                this.elements.videoPreview.crossOrigin = 'anonymous';
                this.elements.videoPreview.src = url;
                this.elements.videoPreview.load(); // 必须重新加载
            }
            
            // 获取时长
            this.elements.videoPreview.onloadedmetadata = () => {
                this.state.duration = this.elements.videoPreview.duration;
                // 检查时长限制
                if (this.state.duration > 60) {
                    showSuccess('视频较长，请耐心等待');
                }
                const durationDisplay = document.getElementById('videoFrameDuration');
                if (durationDisplay) {
                    durationDisplay.textContent = `时长: ${this.state.duration.toFixed(1)}s`;
                }
            };

            this.elements.videoPreview.onerror = () => {
                showError('视频加载失败，请检查格式');
            };

        } catch (e) {
            console.error(e);
            showError('加载视频失败');
        }
    },

    loadVideoFromUrl() {
        const url = this.elements.urlInput.value.trim();
        if (url) {
            this.loadVideo(url);
        }
    },

    handleFileUpload(files) {
        if (files && files.length > 0) {
            this.loadVideo(files[0]);
        }
    },

    async captureFrame(type) {
        if (!this.elements.videoPreview || !this.state.videoUrl) return;
        
        const video = this.elements.videoPreview;
        
        // 检查视频是否已加载元数据
        if (!isFinite(video.duration) || video.duration <= 0) {
            showError('视频尚未加载完成，请稍候');
            return;
        }
        
        // 记录当前播放状态
        const wasPlaying = !video.paused;
        if (wasPlaying) video.pause();

        // 尾帧时间设置为 duration - 0.1 秒，避免超出范围
        const time = type === 'first' ? 0 : Math.max(0, video.duration - 0.1);
        
        try {
            // 如果是首/尾帧，先跳转
            if (type === 'first' || type === 'last') {
                await VideoFrameUtils.seekTo(video, time);
                // 等待一小段时间确保帧渲染完成
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 捕获
            const frame = await VideoFrameUtils.captureFrame(video);
            
            if (type === 'first') {
                if (this.state.firstFrame) VideoFrameUtils.revokeUrl(this.state.firstFrame.url);
                this.state.firstFrame = frame;
                if (this.elements.firstFrameImg) {
                    this.elements.firstFrameImg.src = frame.url;
                    this.elements.firstFrameImg.style.display = 'block';
                }
                document.getElementById('firstFrameActions').style.display = 'flex';
                document.getElementById('firstFrameEmpty').style.display = 'none';
            } else {
                if (this.state.lastFrame) VideoFrameUtils.revokeUrl(this.state.lastFrame.url);
                this.state.lastFrame = frame;
                if (this.elements.lastFrameImg) {
                    this.elements.lastFrameImg.src = frame.url;
                    this.elements.lastFrameImg.style.display = 'block';
                }
                document.getElementById('lastFrameActions').style.display = 'flex';
                document.getElementById('lastFrameEmpty').style.display = 'none';
            }
            
            // 切换到结果视图
            this.switchView('frames');
            
        } catch (e) {
            console.error(e);
            showError('提取帧失败');
        }
    },

    async captureCollage() {
        if (!this.elements.videoPreview || !this.state.videoUrl) return;
        if (this.state.isRendering) return;

        const total = this.state.collageGrid * this.state.collageGrid;
        if (this.state.collageFilled >= total) {
            showError('宫格已满，请先下载或切换宫格');
            return;
        }

        this.state.isRendering = true;
        this.switchView('collage');

        try {
            const video = this.elements.videoPreview;
            video.pause(); // 必须暂停才能捕获准确帧
            
            const canvas = this.elements.collageCanvas;
            const ctx = canvas.getContext('2d');
            
            // 初始化 Canvas 尺寸（如果是第一帧）
            if (this.state.collageFilled === 0) {
                const baseW = 1200;
                // 如果视频还没加载元数据，这里的尺寸可能不对
                // 应该尽量等待 loadedmetadata，但用户操作时通常已经加载了
                const aspect = video.videoHeight / video.videoWidth || 9/16; 
                const cellW = Math.round(baseW / this.state.collageGrid);
                const cellH = Math.round(cellW * aspect);
                
                canvas.width = cellW * this.state.collageGrid;
                canvas.height = cellH * this.state.collageGrid;
                
                // 填充白色背景
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const idx = this.state.collageFilled;
            const grid = this.state.collageGrid;
            const cellW = canvas.width / grid;
            const cellH = canvas.height / grid;
            const col = idx % grid;
            const row = Math.floor(idx / grid);
            const x = col * cellW;
            const y = row * cellH;

            // 计算绘制尺寸（保持比例填充）
            // 重新获取宽高，防止初始化时为0
            const vw = video.videoWidth || 1;
            const vh = video.videoHeight || 1;
            
            const scale = Math.max(cellW / vw, cellH / vh);
            const drawW = vw * scale;
            const drawH = vh * scale;
            const dx = x + (cellW - drawW) / 2;
            const dy = y + (cellH - drawH) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, cellW, cellH);
            ctx.clip();
            ctx.drawImage(video, dx, dy, drawW, drawH);
            ctx.restore();

            // 绘制序号或时间戳（可选）
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x + 4, y + 4, 40, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText(VideoFrameUtils.formatTime(video.currentTime), x + 8, y + 18);

            this.state.collageFilled++;
            this.updateUI();

        } catch (e) {
            console.error(e);
            showError('抽帧失败');
        } finally {
            this.state.isRendering = false;
        }
    },

    clearLastFrame() {
        if (this.state.collageFilled <= 0) return;
        
        const idx = this.state.collageFilled - 1;
        const canvas = this.elements.collageCanvas;
        const ctx = canvas.getContext('2d');
        const grid = this.state.collageGrid;
        
        const cellW = canvas.width / grid;
        const cellH = canvas.height / grid;
        const col = idx % grid;
        const row = Math.floor(idx / grid);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
        
        this.state.collageFilled--;
        this.updateUI();
    },

    clearCollage() {
        if (!this.elements.collageCanvas) return;
        const ctx = this.elements.collageCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.elements.collageCanvas.width, this.elements.collageCanvas.height);
        // 不重置宽高，保留上次布局，或者重置？
        // 重置为0比较保险，防止残留
        this.elements.collageCanvas.width = 0; 
        this.elements.collageCanvas.height = 0;
        this.state.collageFilled = 0;
        this.updateUI();
    },

    setGrid(n) {
        if (this.state.collageGrid === n) return;
        this.state.collageGrid = n;
        this.clearCollage();
        
        // 更新 UI 状态
        document.querySelectorAll('.grid-option').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.grid) === n);
        });
    },

    switchView(view) {
        const framesResult = document.getElementById('framesResult');
        const collageResult = document.getElementById('collageResult');
        const title = document.getElementById('resultPanelTitle');
        
        if (view === 'frames') {
            if (framesResult) framesResult.style.display = 'flex'; // block -> flex for layout
            if (collageResult) collageResult.style.display = 'none';
            if (title) title.textContent = '提取结果 (首/尾帧)';
        } else {
            if (framesResult) framesResult.style.display = 'none';
            if (collageResult) collageResult.style.display = 'flex'; // block -> flex
            if (title) title.textContent = '提取结果 (宫格拼贴)';
        }
    },

    downloadFrame(type) {
        const frame = type === 'first' ? this.state.firstFrame : this.state.lastFrame;
        if (!frame) return;
        
        const a = document.createElement('a');
        a.href = frame.url;
        a.download = `frame_${type}_${Date.now()}.png`;
        a.click();
    },

    downloadCollage() {
        if (this.state.collageFilled === 0 || !this.elements.collageCanvas) return;
        
        this.elements.collageCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `collage_${this.state.collageGrid}x${this.state.collageGrid}_${Date.now()}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    },

    updateUI() {
        if (this.elements.collageProgress) {
            const total = this.state.collageGrid * this.state.collageGrid;
            this.elements.collageProgress.textContent = `已填充 ${this.state.collageFilled}/${total}`;
        }
    }
};

export default VideoFrameExtractor;
