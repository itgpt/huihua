import { loadStylesheet } from '../../../utils/styles.js';

const STYLE_PATHS = ['css/tools/shared.css', 'css/tools/imageSlicer.css'];

const ImageSlicer = {
    state: {
        isOpen: false,
        imageSrc: null,
        naturalSize: null,
        mode: 'h', // 'h' | 'v'
        lines: [],
        forceSquare: false,
        bgColor: '#ffffff',
        isProcessing: false,
        results: [],
        dragging: null
    },

    elements: {
        modal: null,
        fileInput: null,
        imageBox: null,
        image: null,
        resultsContainer: null,
        bgColorInput: null
    },

    init() {
        // 预留
    },

    cacheElements() {
        this.elements.modal = document.getElementById('imageSlicerModal');
        this.elements.fileInput = document.getElementById('slicerFileInput');
        this.elements.imageBox = document.getElementById('slicerImageBox');
        this.elements.image = document.getElementById('slicerImage');
        this.elements.resultsContainer = document.getElementById('slicerResults');
        this.elements.bgColorInput = document.getElementById('slicerBgColor');
    },

    async open() {
        await Promise.all(STYLE_PATHS.map(loadStylesheet));
        this.cacheElements();
        if (!this.elements.modal) return;

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        this.bindEvents();
        this.reset();
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
        this.reset();
    },

    reset() {
        if (this.state.imageSrc) URL.revokeObjectURL(this.state.imageSrc);
        this.resetResults();
        this.state.imageSrc = null;
        this.state.naturalSize = null;
        this.state.lines = [];
        this.state.results = [];
        this.state.dragging = null;
        
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.image) {
            this.elements.image.src = '';
            this.elements.image.style.display = 'none';
        }
        document.getElementById('slicerEmptyState').style.display = 'flex';
        this.renderLines();
    },

    resetResults() {
        this.state.results.forEach(item => URL.revokeObjectURL(item.url));
        this.state.results = [];
        if (this.elements.resultsContainer) {
            this.elements.resultsContainer.innerHTML = '<div class="slicer-results-empty">暂无结果，点击生成切片</div>';
        }
    },

    bindEvents() {
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // 关闭
        document.getElementById('slicerCloseBtn')?.addEventListener('click', () => this.close());

        // 上传
        document.getElementById('slicerUploadBtn')?.addEventListener('click', () => this.elements.fileInput?.click());
        this.elements.fileInput?.addEventListener('change', (e) => this.handleFile(e.target.files?.[0]));

        // 模式切换
        document.querySelectorAll('.slicer-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.setMode(mode);
            });
        });

        // 1:1 补全
        document.getElementById('slicerForceSquare')?.addEventListener('change', (e) => {
            this.state.forceSquare = e.target.checked;
            document.getElementById('slicerBgColorWrap').style.display = e.target.checked ? 'inline-block' : 'none';
        });

        this.elements.bgColorInput?.addEventListener('input', (e) => {
            this.state.bgColor = e.target.value;
        });

        // 清空辅助线
        document.getElementById('slicerClearBtn')?.addEventListener('click', () => {
            this.state.lines = [];
            this.renderLines();
        });

        // 生成切片
        document.getElementById('slicerGenerateBtn')?.addEventListener('click', () => this.generateSlices());

        // 一键下载
        document.getElementById('slicerDownloadAllBtn')?.addEventListener('click', () => this.downloadAll());

        // 画布点击 (添加线)
        this.elements.imageBox?.addEventListener('mousedown', (e) => this.handleCanvasClick(e));

        // 拖拽逻辑 (全局)
        window.addEventListener('mousemove', (e) => this.handleDragMove(e));
        window.addEventListener('mouseup', () => this.handleDragEnd());
    },

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        
        if (this.state.imageSrc) URL.revokeObjectURL(this.state.imageSrc);
        const url = URL.createObjectURL(file);
        this.state.imageSrc = url;
        
        if (this.elements.image) {
            this.elements.image.onload = () => {
                this.state.naturalSize = {
                    w: this.elements.image.naturalWidth,
                    h: this.elements.image.naturalHeight
                };
                document.getElementById('slicerEmptyState').style.display = 'none';
                this.elements.image.style.display = 'block';
            };
            this.elements.image.src = url;
        }
        
        this.state.lines = [];
        this.resetResults();
        this.renderLines();
    },

    setMode(mode) {
        this.state.mode = mode;
        document.querySelectorAll('.slicer-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    },

    handleCanvasClick(e) {
        if (!this.state.imageSrc || !this.elements.imageBox) return;
        if (e.target.closest('.slice-line-handle')) return; // 如果点击的是手柄，不添加新线

        const rect = this.elements.imageBox.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 确保在图片区域内
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

        const percent = this.state.mode === 'h' 
            ? (y / rect.height) * 100 
            : (x / rect.width) * 100;

        const newLine = {
            id: Math.random().toString(36).slice(2),
            type: this.state.mode,
            percent: Math.max(0, Math.min(100, percent))
        };

        this.state.lines.push(newLine);
        this.renderLines();
    },

    handleDragMove(e) {
        if (!this.state.dragging || !this.elements.imageBox) return;
        e.preventDefault();

        const rect = this.elements.imageBox.getBoundingClientRect();
        let percent;

        if (this.state.dragging.type === 'h') {
            percent = ((e.clientY - rect.top) / rect.height) * 100;
        } else {
            percent = ((e.clientX - rect.left) / rect.width) * 100;
        }

        this.state.dragging.percent = Math.max(0, Math.min(100, percent));
        this.renderLines();
    },

    handleDragEnd() {
        this.state.dragging = null;
    },

    renderLines() {
        const container = document.getElementById('slicerLinesLayer');
        if (!container) return;
        container.innerHTML = '';

        this.state.lines.forEach(line => {
            const el = document.createElement('div');
            el.className = `slice-line ${line.type}`;
            
            if (line.type === 'h') {
                el.style.top = `${line.percent}%`;
            } else {
                el.style.left = `${line.percent}%`;
            }

            // 删除按钮
            const delBtn = document.createElement('div');
            delBtn.className = 'slice-line-handle';
            delBtn.innerHTML = '×';
            delBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                // 仅删除
                this.state.lines = this.state.lines.filter(l => l.id !== line.id);
                this.renderLines();
            });

            // 拖拽手柄区域
            el.addEventListener('mousedown', (e) => {
                if (e.target === delBtn) return;
                this.state.dragging = line;
            });

            el.appendChild(delBtn);
            container.appendChild(el);
        });
    },

    async generateSlices() {
        if (!this.state.imageSrc || !this.state.naturalSize) return;
        this.state.isProcessing = true;
        this.resetResults();

        // 排序并去重
        const hLines = this.state.lines
            .filter(l => l.type === 'h')
            .map(l => l.percent)
            .sort((a, b) => a - b);
        
        const vLines = this.state.lines
            .filter(l => l.type === 'v')
            .map(l => l.percent)
            .sort((a, b) => a - b);

        // 添加边界
        const hStops = [0, ...hLines, 100];
        const vStops = [0, ...vLines, 100];

        const { w, h } = this.state.naturalSize;
        const results = [];

        for (let i = 0; i < hStops.length - 1; i++) {
            for (let j = 0; j < vStops.length - 1; j++) {
                const y0 = (hStops[i] / 100) * h;
                const y1 = (hStops[i+1] / 100) * h;
                const x0 = (vStops[j] / 100) * w;
                const x1 = (vStops[j+1] / 100) * w;

                const sliceW = Math.max(1, x1 - x0);
                const sliceH = Math.max(1, y1 - y0);

                const canvas = document.createElement('canvas');
                
                if (this.state.forceSquare) {
                    const maxDim = Math.max(sliceW, sliceH);
                    canvas.width = maxDim;
                    canvas.height = maxDim;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = this.state.bgColor;
                    ctx.fillRect(0, 0, maxDim, maxDim);
                    
                    const dx = (maxDim - sliceW) / 2;
                    const dy = (maxDim - sliceH) / 2;
                    
                    ctx.drawImage(this.elements.image, x0, y0, sliceW, sliceH, dx, dy, sliceW, sliceH);
                } else {
                    canvas.width = sliceW;
                    canvas.height = sliceH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(this.elements.image, x0, y0, sliceW, sliceH, 0, 0, sliceW, sliceH);
                }

                await new Promise(resolve => {
                    canvas.toBlob(blob => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            results.push({
                                url,
                                width: canvas.width,
                                height: canvas.height,
                                name: `slice_${i}_${j}.png`
                            });
                        }
                        resolve();
                    });
                });
            }
        }

        this.state.results = results;
        this.renderResults();
        this.state.isProcessing = false;
    },

    renderResults() {
        if (!this.elements.resultsContainer) return;
        this.elements.resultsContainer.innerHTML = '';
        
        if (this.state.results.length === 0) {
            this.elements.resultsContainer.innerHTML = '<div class="slicer-results-empty">暂无结果</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'slicer-grid';

        this.state.results.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'slicer-item';
            div.innerHTML = `
                <img src="${item.url}" alt="${item.name}">
                <div class="slicer-item-info">
                    <span>${Math.round(item.width)}×${Math.round(item.height)}</span>
                    <button class="slicer-download-btn" title="下载">⬇</button>
                </div>
            `;
            
            div.querySelector('.slicer-download-btn').addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = item.url;
                a.download = item.name;
                a.click();
            });

            grid.appendChild(div);
        });

        this.elements.resultsContainer.appendChild(grid);
    },

    downloadAll() {
        if (this.state.results.length === 0) return;
        
        this.state.results.forEach(item => {
            const a = document.createElement('a');
            a.href = item.url;
            a.download = item.name;
            a.click();
        });
    }
};

export default ImageSlicer;
