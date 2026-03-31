import { showSuccess, showError } from '../toast.js';

const PROMPT_SOURCES = [
    'https://raw.githubusercontent.com/glidea/banana-prompt-quicker/refs/heads/main/prompts.json',
    'https://cdn.jsdelivr.net/gh/glidea/banana-prompt-quicker@main/prompts.json',
    'https://fastly.jsdelivr.net/gh/glidea/banana-prompt-quicker@main/prompts.json'
];

const CUSTOM_PROMPTS_KEY = 'prompt_library_custom_v1';
const FAVORITES_KEY = 'prompt_library_favorites_v1';

const PromptLibrary = {
    state: {
        isOpen: false,
        items: [],
        customItems: [],
        favorites: new Set(),
        isLoading: false,
        currentPage: 1,
        itemsPerPage: 15,
        filters: {
            search: '',
            category: '全部',
            tab: 'all', // all, recent, favorites, custom, generate, edit
            hideNsfw: true
        }
    },

    elements: {
        modal: null,
        grid: null,
        pagination: null,
        searchInput: null,
        categoryBtn: null,
        categoryMenu: null,
        nsfwBtn: null,
        addBtn: null
    },

    init() {
        this.loadLocalData();
    },

    cacheElements() {
        this.elements.modal = document.getElementById('promptLibraryModal');
        this.elements.grid = document.getElementById('promptGrid');
        this.elements.pagination = document.getElementById('promptPagination');
        this.elements.searchInput = document.getElementById('promptSearchInput');
        this.elements.categoryBtn = document.getElementById('promptCategoryBtn');
        this.elements.categoryMenu = document.getElementById('promptCategoryMenu');
        this.elements.nsfwBtn = document.getElementById('promptNsfwBtn');
    },

    async open() {
        this.cacheElements();
        if (!this.elements.modal) return;

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        this.bindEvents();

        if (this.state.items.length === 0) {
            await this.loadOnlineData();
        }
        
        this.renderList();
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
    },

    bindEvents() {
        // 防止重复绑定
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // 关闭
        document.getElementById('promptLibraryCloseBtn')?.addEventListener('click', () => this.close());

        // 搜索
        this.elements.searchInput?.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value.trim();
            this.state.currentPage = 1;
            this.renderList();
        });

        // 分类菜单
        this.elements.categoryBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.elements.categoryMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            this.elements.categoryMenu?.classList.add('hidden');
        });

        // 绑定分类项点击
        document.querySelectorAll('.prompt-category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const cat = e.target.dataset.category;
                this.setCategory(cat);
                this.elements.categoryMenu.classList.add('hidden');
            });
        });

        // 标签切换
        document.querySelectorAll('.prompt-filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.setTab(tab);
            });
        });

        // NSFW 切换
        this.elements.nsfwBtn?.addEventListener('click', () => {
            this.state.filters.hideNsfw = !this.state.filters.hideNsfw;
            this.updateNsfwBtn();
            this.renderList();
        });
        
        // 新增自定义提示词按钮
        document.getElementById('promptAddBtn')?.addEventListener('click', () => {
            this.addCustomPrompt();
        });
        
        // 分页
        document.getElementById('promptPrevPage')?.addEventListener('click', () => this.prevPage());
        document.getElementById('promptNextPage')?.addEventListener('click', () => this.nextPage());
    },

    async loadOnlineData() {
        this.state.isLoading = true;
        this.renderList(); // 显示 loading

        for (const url of PROMPT_SOURCES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(url, { 
                    cache: 'no-store',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        this.state.items = data;
                        this.state.isLoading = false;
                        this.renderList();
                        return;
                    }
                }
            } catch (e) {
                console.warn(`Failed to load prompts from ${url}:`, e);
            }
        }

        this.state.isLoading = false;
        showError('提示词加载失败，请检查网络');
        this.renderList();
    },

    loadLocalData() {
        try {
            const custom = localStorage.getItem(CUSTOM_PROMPTS_KEY);
            if (custom) {
                this.state.customItems = JSON.parse(custom);
            }
            const favs = localStorage.getItem(FAVORITES_KEY);
            if (favs) {
                this.state.favorites = new Set(JSON.parse(favs));
            }
        } catch (e) {
            console.error('Failed to load local prompts data', e);
        }
    },

    saveLocalData() {
        try {
            localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(this.state.customItems));
            localStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.state.favorites]));
        } catch (e) {
            console.error('Failed to save local prompts data', e);
        }
    },

    setCategory(cat) {
        this.state.filters.category = cat;
        if (this.elements.categoryBtn) {
            this.elements.categoryBtn.innerHTML = `${cat} <span class="icon">▼</span>`;
        }
        this.state.currentPage = 1;
        this.renderList();
    },

    setTab(tab) {
        this.state.filters.tab = tab;
        document.querySelectorAll('.prompt-filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.tab === tab);
        });
        this.state.currentPage = 1;
        this.renderList();
    },

    updateNsfwBtn() {
        if (this.elements.nsfwBtn) {
            this.elements.nsfwBtn.innerHTML = this.state.filters.hideNsfw ? '👁️' : '🙈';
            this.elements.nsfwBtn.title = this.state.filters.hideNsfw ? '显示 NSFW' : '隐藏 NSFW';
        }
    },

    getFilteredItems() {
        const { search, category, tab, hideNsfw } = this.state.filters;
        let allItems = [...this.state.customItems, ...this.state.items];

        return allItems.filter(item => {
            const title = (item.title || '').toLowerCase();
            const prompt = (item.prompt || '').toLowerCase();
            const itemCategory = (item.category || '').toLowerCase();
            const mode = (item.mode || '').toLowerCase();
            const key = this.getItemKey(item);

            // NSFW 过滤
            if (hideNsfw && itemCategory.includes('nsfw')) return false;

            // 搜索过滤
            if (search && !title.includes(search) && !prompt.includes(search) && !itemCategory.includes(search)) return false;

            // 分类过滤
            if (category !== '全部' && !item.category?.includes(category)) return false;

            // Tab 过滤
            if (tab === 'recent') {
                // 简单模拟，或者需要 item 有时间戳
                // 这里暂时返回前 20 个
                // return true; 
            } else if (tab === 'favorites') {
                if (!this.state.favorites.has(key)) return false;
            } else if (tab === 'custom') {
                if (item.source !== 'custom') return false;
            } else if (tab === 'generate') {
                if (mode !== 'generate') return false;
            } else if (tab === 'edit') {
                if (mode !== 'edit') return false;
            }

            return true;
        });
    },

    getItemKey(item) {
        return item.id || `${item.title}|${item.author}`;
    },

    renderList() {
        if (!this.elements.grid) return;

        if (this.state.isLoading) {
            this.elements.grid.innerHTML = '<div class="prompt-loading"><div class="spinner"></div><p>加载中...</p></div>';
            return;
        }

        const filtered = this.getFilteredItems();
        const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const end = start + this.state.itemsPerPage;
        const pageItems = filtered.slice(start, end);

        this.elements.grid.innerHTML = '';

        if (pageItems.length === 0) {
            this.elements.grid.innerHTML = '<div class="prompt-empty">没有找到匹配的提示词</div>';
            this.renderPagination(0);
            return;
        }

        pageItems.forEach(item => {
            const card = this.createCard(item);
            this.elements.grid.appendChild(card);
        });

        this.renderPagination(filtered.length);
    },

    createCard(item) {
        const div = document.createElement('div');
        div.className = 'prompt-card-item';
        const key = this.getItemKey(item);
        const isFav = this.state.favorites.has(key);

        div.innerHTML = `
            <div class="prompt-card-preview">
                ${item.preview ? `<img src="${item.preview}" alt="${item.title}" loading="lazy" class="preview-image">` : '<div class="no-preview">暂无预览</div>'}
                <div class="prompt-card-overlay">
                    <div class="prompt-card-title">${item.title || '未命名'}</div>
                    <div class="prompt-card-tags">
                        ${item.category ? `<span>${item.category}</span>` : ''}
                        ${item.mode ? `<span class="mode">${item.mode === 'generate' ? '文生图' : '编辑'}</span>` : ''}
                    </div>
                </div>
                <button class="prompt-fav-btn ${isFav ? 'active' : ''}" title="收藏">★</button>
            </div>
            <div class="prompt-card-body">
                <div class="prompt-text">${item.prompt}</div>
                <div class="prompt-footer">
                    <span class="author">@${item.author || 'Unknown'}</span>
                    <button class="prompt-copy-btn">复制</button>
                </div>
            </div>
        `;

        // 收藏按钮事件
        div.querySelector('.prompt-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(item, e.target);
        });

        // 复制按钮事件
        div.querySelector('.prompt-copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyPrompt(item.prompt);
        });

        // 图片点击放大事件（新增）
        const previewImg = div.querySelector('.preview-image');
        if (previewImg) {
            previewImg.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('图片被点击，准备显示预览:', item.title);
                this.showImagePreview(item);
            });
            // 添加鼠标样式提示
            previewImg.style.cursor = 'zoom-in';
        }

        // 卡片其他区域点击复制
        const cardBody = div.querySelector('.prompt-card-body');
        if (cardBody) {
            cardBody.addEventListener('click', () => {
                this.copyPrompt(item.prompt);
            });
        }

        return div;
    },

    renderPagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.state.itemsPerPage);
        const pageInfo = document.getElementById('promptPageInfo');
        
        if (pageInfo) {
            pageInfo.textContent = `${this.state.currentPage} / ${totalPages || 1}`;
        }

        const prevBtn = document.getElementById('promptPrevPage');
        const nextBtn = document.getElementById('promptNextPage');

        if (prevBtn) prevBtn.disabled = this.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.state.currentPage >= totalPages;
    },

    prevPage() {
        if (this.state.currentPage > 1) {
            this.state.currentPage--;
            this.renderList();
        }
    },

    nextPage() {
        const total = this.getFilteredItems().length;
        const totalPages = Math.ceil(total / this.state.itemsPerPage);
        if (this.state.currentPage < totalPages) {
            this.state.currentPage++;
            this.renderList();
        }
    },

    toggleFavorite(item, btn) {
        const key = this.getItemKey(item);
        if (this.state.favorites.has(key)) {
            this.state.favorites.delete(key);
            btn.classList.remove('active');
        } else {
            this.state.favorites.add(key);
            btn.classList.add('active');
        }
        this.saveLocalData();
        // 如果当前是在收藏 Tab，刷新列表
        if (this.state.filters.tab === 'favorites') {
            this.renderList();
        }
    },

    copyPrompt(text) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('已复制到剪贴板');
        }).catch(() => {
            showError('复制失败');
        });
    },

    // 添加自定义提示词
    addCustomPrompt() {
        // 打开自定义 Prompt 模态框逻辑
        const modal = document.getElementById('addPromptModal');
        if (!modal) return;

        // 重置表单
        document.getElementById('addPromptTitle').value = '';
        document.getElementById('addPromptContent').value = '';
        document.getElementById('addPromptSubCategory').value = '';
        document.getElementById('addPromptPreviewImg').style.display = 'none';
        document.getElementById('addPromptPreviewImg').src = '';
        document.querySelector('.upload-placeholder').style.display = 'flex';
        document.getElementById('addPromptRemoveImg').style.display = 'none';
        document.getElementById('addPromptFile').value = '';

        modal.style.display = 'flex';

        // 绑定临时事件
        const closeBtn = document.getElementById('addPromptCloseBtn');
        const cancelBtn = document.getElementById('addPromptCancelBtn');
        const saveBtn = document.getElementById('addPromptSaveBtn');
        const backdrop = modal.querySelector('.add-prompt-backdrop');
        const uploadArea = document.getElementById('addPromptUploadArea');
        const fileInput = document.getElementById('addPromptFile');
        const removeImgBtn = document.getElementById('addPromptRemoveImg');

        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        backdrop.onclick = closeModal;

        // 上传图片处理
        uploadArea.onclick = () => fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.getElementById('addPromptPreviewImg');
                    img.src = e.target.result;
                    img.style.display = 'block';
                    document.querySelector('.upload-placeholder').style.display = 'none';
                    removeImgBtn.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };

        removeImgBtn.onclick = (e) => {
            e.stopPropagation();
            const img = document.getElementById('addPromptPreviewImg');
            img.src = '';
            img.style.display = 'none';
            document.querySelector('.upload-placeholder').style.display = 'flex';
            removeImgBtn.style.display = 'none';
            fileInput.value = '';
        };

        saveBtn.onclick = () => {
            const title = document.getElementById('addPromptTitle').value.trim();
            const content = document.getElementById('addPromptContent').value.trim();
            const category = document.getElementById('addPromptCategory').value;
            const subCategory = document.getElementById('addPromptSubCategory').value.trim();
            const mode = document.querySelector('input[name="addPromptMode"]:checked').value;
            const preview = document.getElementById('addPromptPreviewImg').src;

            if (!title) return showError('请输入标题');
            if (!content) return showError('请输入 Prompt 内容');

            const newItem = {
                id: Date.now().toString(),
                title: title,
                prompt: content,
                category: subCategory ? `${category} ${subCategory}` : category,
                mode: mode,
                author: 'Me',
                source: 'custom',
                preview: preview.startsWith('data:') ? preview : null // 实际应用中应该上传图片
            };

            this.state.customItems.unshift(newItem);
            this.saveLocalData();
            this.renderList();
            showSuccess('自定义提示词已添加');
            closeModal();
        };
    },

    // 显示图片预览
    showImagePreview(item) {
        console.log('showImagePreview 被调用:', item);
        
        const modal = document.getElementById('imagePreviewModal');
        const img = document.getElementById('imagePreviewImg');
        const title = document.getElementById('imagePreviewTitle');
        const prompt = document.getElementById('imagePreviewPrompt');
        
        if (!modal || !img) {
            console.error('找不到图片预览模态框元素！');
            return;
        }
        
        // 设置内容
        img.src = item.preview;
        img.alt = item.title || '预览图';
        if (title) title.textContent = item.title || '未命名';
        if (prompt) prompt.textContent = item.prompt;
        
        // 显示模态框
        modal.style.display = 'flex';
        
        // --- 增强的缩放逻辑 ---
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let startX, startY;

        // 重置状态
        img.style.transform = `translate(0px, 0px) scale(1)`;
        img.style.cursor = 'grab';
        img.style.transition = 'transform 0.1s ease-out';
        img.classList.remove('zoomed');

        // 更新变换
        const updateTransform = () => {
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        };

        // 滚轮缩放
        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.min(Math.max(0.1, scale * delta), 10); // 限制缩放范围
            updateTransform();
        };

        // 鼠标按下
        const onMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            img.style.cursor = 'grabbing';
            img.style.transition = 'none'; // 拖拽时移除过渡
        };

        // 鼠标移动 (绑定到 window 以防止脱离)
        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateTransform();
        };

        // 鼠标松开
        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                img.style.cursor = 'grab';
                img.style.transition = 'transform 0.1s ease-out';
            }
        };

        // 绑定事件
        img.onwheel = onWheel;
        img.onmousedown = onMouseDown;
        // 注意：mousemove 和 mouseup 需要绑定到 window，并在关闭时移除
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // 复制按钮逻辑
        const copyBtn = document.getElementById('previewCopyBtn');
        if (copyBtn) {
            const newCopyBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
            newCopyBtn.onclick = () => this.copyPrompt(item.prompt);
        }

        // 关闭事件
        const closeBtn = modal.querySelector('.image-preview-close');
        const backdrop = modal.querySelector('.image-preview-backdrop');
        
        const closeModal = () => {
            console.log('关闭图片预览');
            modal.style.display = 'none';
            // 清理事件监听
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            img.onwheel = null;
            img.onmousedown = null;
            document.removeEventListener('keydown', handleEsc);
        };
        
        // 点击关闭按钮
        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }
        
        // 点击背景关闭
        if (backdrop) {
            backdrop.onclick = closeModal;
        }
        
        // ESC 键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
};

export default PromptLibrary;
