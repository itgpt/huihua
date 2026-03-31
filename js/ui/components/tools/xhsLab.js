import { showSuccess, showError } from '../toast.js';
// GeminiAPI is not exported from gemini.js, so we'll use direct API calls if needed
// import { callGeminiNativeAPI } from '../../../api/gemini.js';

const HISTORY_KEY = 'xhs_lab_history_v1';
const MAX_IMAGES = 9;

const SHOT_STYLES = [
    { from: '#8b5cf6', via: '#ec4899', to: '#f97316' },
    { from: '#60a5fa', via: '#38bdf8', to: '#6366f1' },
    { from: '#34d399', via: '#10b981', to: '#22c55e' },
    { from: '#f59e0b', via: '#f97316', to: '#ef4444' },
    { from: '#22d3ee', via: '#06b6d4', to: '#3b82f6' },
    { from: '#a78bfa', via: '#818cf8', to: '#38bdf8' }
];

const XhsLab = {
    state: {
        isOpen: false,
        sidebarCollapsed: false,
        topic: '',
        imageCount: 4,
        ratio: '3:4',
        quality: '2K',
        history: [],
        refImages: [], // base64 strings
        outline: null, // { id, title, content, shots: [] }
        isGenerating: false,
        provider: 'gemini', // 'gemini' | 'openai'
        selectedModel: 'gemini-1.5-pro'
    },

    elements: {
        modal: null,
        sidebar: null,
        historyList: null,
        topicInput: null,
        fileInput: null,
        refImagesContainer: null,
        contentPreview: null,
        shotGrid: null,
        generateBtn: null,
        providerBtns: null
    },

    init() {
        this.loadHistory();
    },

    cacheElements() {
        this.elements.modal = document.getElementById('xhsLabModal');
        this.elements.sidebar = document.querySelector('.xhs-sidebar');
        this.elements.historyList = document.getElementById('xhsHistoryList');
        this.elements.topicInput = document.getElementById('xhsTopicInput');
        this.elements.fileInput = document.getElementById('xhsFileInput');
        this.elements.refImagesContainer = document.getElementById('xhsRefImages');
        this.elements.contentPreview = document.getElementById('xhsContentPreview');
        this.elements.shotGrid = document.getElementById('xhsShotGrid');
        this.elements.generateBtn = document.getElementById('xhsGenerateBtn');
        this.elements.providerBtns = document.querySelectorAll('.xhs-provider-btn');
    },

    open() {
        this.cacheElements();
        if (!this.elements.modal) return;

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        this.bindEvents();
        this.render();
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
        // Reset sensitive state if needed, but keeping history/input is often better UX
    },

    bindEvents() {
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // Sidebar toggle
        document.getElementById('xhsSidebarToggle')?.addEventListener('click', () => {
            this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
            this.renderSidebar();
        });

        // Close
        document.getElementById('xhsLabCloseBtn')?.addEventListener('click', () => this.close());

        // History Clear
        document.getElementById('xhsHistoryClearBtn')?.addEventListener('click', () => {
            if (confirm('确定清空所有历史记录吗？')) {
                this.state.history = [];
                this.saveHistory();
                this.renderHistory();
            }
        });

        // Input
        this.elements.topicInput?.addEventListener('input', (e) => {
            this.state.topic = e.target.value;
        });

        // Provider switch
        this.elements.providerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.state.provider = e.target.dataset.provider;
                this.renderProviderState();
            });
        });

        // File Upload
        document.getElementById('xhsUploadBtn')?.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput?.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Generate
        this.elements.generateBtn?.addEventListener('click', () => this.generateOutline());

        // Batch Generate (Placeholder)
        document.getElementById('xhsBatchGenerateBtn')?.addEventListener('click', () => {
            if (!this.state.outline?.shots?.length) return;
            showSuccess('批量生图请求已提交（模拟）');
        });

        // Image Count
        document.getElementById('xhsImageCount')?.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (val < 1) val = 1;
            if (val > MAX_IMAGES) val = MAX_IMAGES;
            this.state.imageCount = val;
        });
        
        // Ratio & Quality
        document.getElementById('xhsRatio')?.addEventListener('change', (e) => this.state.ratio = e.target.value);
        document.getElementById('xhsQuality')?.addEventListener('change', (e) => this.state.quality = e.target.value);
    },

    async handleFiles(files) {
        if (!files || files.length === 0) return;
        
        for (const file of Array.from(files)) {
            if (this.state.refImages.length >= MAX_IMAGES) break;
            if (!file.type.startsWith('image/')) continue;

            const base64 = await this.fileToBase64(file);
            if (base64) {
                this.state.refImages.push(base64);
            }
        }
        this.renderRefImages();
        this.elements.fileInput.value = '';
    },

    fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    },

    render() {
        this.renderSidebar();
        this.renderHistory();
        this.renderProviderState();
        this.renderRefImages();
        this.renderContent();
    },

    renderSidebar() {
        if (this.elements.sidebar) {
            this.elements.sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
        }
    },

    renderProviderState() {
        this.elements.providerBtns.forEach(btn => {
            const active = btn.dataset.provider === this.state.provider;
            btn.classList.toggle('active', active);
            // Simple style toggle
            btn.style.backgroundColor = active ? (this.state.provider === 'openai' ? '#2563eb' : '#f59e0b') : '';
            btn.style.color = active ? '#fff' : '';
        });
    },

    renderHistory() {
        if (!this.elements.historyList) return;
        
        if (this.state.history.length === 0) {
            this.elements.historyList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">暂无历史记录</div>';
            return;
        }

        this.elements.historyList.innerHTML = this.state.history.map(item => `
            <div class="history-item ${this.state.outline?.id === item.id ? 'active' : ''}" data-id="${item.id}">
                <div class="font-semibold truncate">${item.title}</div>
                <div class="text-[10px] text-gray-400 mt-1">${item.createdAt}</div>
            </div>
        `).join('');

        this.elements.historyList.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => this.loadHistoryItem(el.dataset.id));
        });
    },

    renderRefImages() {
        if (!this.elements.refImagesContainer) return;
        
        this.elements.refImagesContainer.innerHTML = this.state.refImages.map((src, idx) => `
            <div class="ref-image-item relative w-16 h-16 rounded overflow-hidden border border-white/10 group">
                <img src="${src}" class="w-full h-full object-cover">
                <button class="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onclick="document.dispatchEvent(new CustomEvent('xhs-remove-img', {detail: ${idx}}))">×</button>
            </div>
        `).join('');

        // Event delegation workaround for inline onclick
        if (!this.elements.refImagesContainer.dataset.listening) {
            document.addEventListener('xhs-remove-img', (e) => {
                this.state.refImages.splice(e.detail, 1);
                this.renderRefImages();
            });
            this.elements.refImagesContainer.dataset.listening = 'true';
        }
    },

    renderContent() {
        if (!this.state.outline) {
            if (this.elements.contentPreview) {
                this.elements.contentPreview.innerHTML = '<div class="text-xs text-gray-400">生成方案后在此显示预览</div>';
            }
            if (this.elements.shotGrid) {
                this.elements.shotGrid.innerHTML = '<div class="text-xs text-gray-400 flex items-center justify-center h-full">等待生成...</div>';
            }
            return;
        }

        // Render Text Content
        if (this.elements.contentPreview) {
            this.elements.contentPreview.innerHTML = `
                <div class="font-bold text-lg mb-2 text-gray-900 dark:text-white">${this.state.outline.title}</div>
                <div class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${this.state.outline.content}</div>
            `;
        }

        // Render Shots
        if (this.elements.shotGrid) {
            this.elements.shotGrid.innerHTML = this.state.outline.shots.map((shot, idx) => {
                const style = SHOT_STYLES[shot.styleIndex % SHOT_STYLES.length];
                const gradient = `linear-gradient(135deg, ${style.from}, ${style.via}, ${style.to})`;
                
                return `
                <div class="shot-card bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                    <div class="h-24 w-full" style="background: ${gradient}"></div>
                    <div class="p-3">
                        <div class="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">${shot.title}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">${shot.desc}</div>
                        <div class="bg-gray-50 dark:bg-gray-900/50 p-2 rounded text-[10px] text-gray-400 font-mono mb-2 line-clamp-3">${shot.prompt}</div>
                        <div class="flex gap-2">
                            <button class="flex-1 py-1 text-[10px] border border-gray-200 dark:border-white/10 rounded hover:bg-gray-100 dark:hover:bg-white/5" onclick="navigator.clipboard.writeText('${shot.prompt.replace(/'/g, "\\'")}')">复制 Prompt</button>
                            <button class="flex-1 py-1 text-[10px] border border-gray-200 dark:border-white/10 rounded hover:bg-gray-100 dark:hover:bg-white/5 download-shot" data-idx="${idx}">下载图</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Bind download buttons
            this.elements.shotGrid.querySelectorAll('.download-shot').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    this.downloadShot(this.state.outline.shots[idx]);
                });
            });
        }
    },

    async generateOutline() {
        const topic = this.state.topic.trim();
        if (!topic && this.state.refImages.length === 0) {
            showError('请输入灵感主题或上传参考图');
            return;
        }

        this.state.isGenerating = true;
        this.elements.generateBtn.disabled = true;
        this.elements.generateBtn.textContent = '生成中...';

        try {
            // Construct Prompt
            const prompt = `
你是一位资深的小红书内容策划专家。
请根据主题"${topic}"${this.state.refImages.length ? '以及提供的参考图' : ''}，输出一份完整的小红书内容方案。
要求：
1. 输出 JSON 格式，包含 title (标题), content (正文), shots (分镜头数组)。
2. shots 数组长度为 ${this.state.imageCount}。
3. 每个 shot 包含 title, desc (简述), prompt (AI绘画提示词, 英文)。
4. 画幅比例: ${this.state.ratio}, 画质: ${this.state.quality}。
            `.trim();

            let responseText = '';
            
            // Call API (Simulated if no API key or real call)
            // Here we use GeminiAPI if available, otherwise mock
            if (this.state.provider === 'gemini' && window.GEMINI_API_KEY) {
                // Real call would go here using GeminiAPI.generate
                // For now, we simulate success with a mock response or use a simple generator if available
                await new Promise(r => setTimeout(r, 1500)); // Simulating network
                responseText = this.mockResponse(topic, this.state.imageCount);
            } else {
                // Default mock
                await new Promise(r => setTimeout(r, 1000));
                responseText = this.mockResponse(topic, this.state.imageCount);
            }

            const parsed = JSON.parse(responseText);
            
            // Normalize shots
            const shots = (parsed.shots || []).map((s, i) => ({
                ...s,
                id: Date.now() + i,
                styleIndex: Math.floor(Math.random() * SHOT_STYLES.length)
            }));

            const outline = {
                id: Date.now().toString(),
                title: parsed.title,
                content: parsed.content,
                shots,
                createdAt: new Date().toLocaleString(),
                topic,
                imageCount: this.state.imageCount
            };

            this.state.outline = outline;
            this.state.history.unshift(outline);
            this.saveHistory();
            
            showSuccess('方案生成成功');
        } catch (e) {
            console.error(e);
            showError('生成失败，请重试');
        } finally {
            this.state.isGenerating = false;
            this.elements.generateBtn.disabled = false;
            this.elements.generateBtn.textContent = '生成方案';
            this.render();
        }
    },

    mockResponse(topic, count) {
        return JSON.stringify({
            title: `关于 ${topic || '灵感'} 的绝美笔记`,
            content: `这是为您生成的关于 ${topic || '美好生活'} 的小红书文案。\n\n✨核心亮点：\n1. 氛围感拉满\n2. 实用干货分享\n3. 情绪价值输出\n\n#小红书 #灵感 #${topic || '生活'}`,
            shots: Array.from({ length: count }).map((_, i) => ({
                title: `镜头 ${i + 1}`,
                desc: `展示 ${topic || '主体'} 的细节与氛围`,
                prompt: `High quality photography of ${topic || 'landscape'}, shot ${i + 1}, cinematic lighting, 8k resolution, --ar 3:4`
            }))
        });
    },

    loadHistoryItem(id) {
        const item = this.state.history.find(i => i.id === id);
        if (item) {
            this.state.outline = item;
            this.state.topic = item.topic || '';
            this.state.imageCount = item.imageCount || 4;
            if (this.elements.topicInput) this.elements.topicInput.value = this.state.topic;
            this.render();
        }
    },

    saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(this.state.history.slice(0, 50)));
        } catch (e) { /* ignore */ }
    },

    loadHistory() {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            if (data) this.state.history = JSON.parse(data);
        } catch (e) { /* ignore */ }
    },

    downloadShot(shot) {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        const style = SHOT_STYLES[shot.styleIndex % SHOT_STYLES.length];
        const grd = ctx.createLinearGradient(0, 0, 1080, 1080);
        grd.addColorStop(0, style.from);
        grd.addColorStop(1, style.to);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 1080, 1080);
        
        // Draw text
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 1080-300, 1080, 300);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px sans-serif';
        ctx.fillText(shot.title, 50, 1080-200);
        
        ctx.font = '40px sans-serif';
        ctx.fillText(shot.desc, 50, 1080-120);

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xhs_shot_${shot.id}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }
};

export default XhsLab;
