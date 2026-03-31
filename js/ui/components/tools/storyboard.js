import { showSuccess, showError } from '../toast.js';
import { ModelSelector } from '../../../models/modelSelector.js';
import { APIClient } from '../../../api/base.js';

const SHOT_COUNT = 9;
const ROLE_STORAGE_KEY = 'storyboard_roles_v1';
const VISION_PROMPT_STORAGE_KEY = 'storyboard_vision_prompt';
const IMAGE_PROMPT_STORAGE_KEY = 'storyboard_image_prompt';
const DEFAULT_VISION_PROMPT = '简短描述画面';
const DEFAULT_IMAGE_PROMPT = 'mappa anime style, {{desc}}';
const NUM_TO_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const Storyboard = {
    state: {
        isOpen: false,
        shots: [],
        roles: [],
        ratio: '1:1',
        scriptText: '',
        isRendering: false,
        outputSize: null,
        visionPrompt: DEFAULT_VISION_PROMPT,
        imagePromptTemplate: DEFAULT_IMAGE_PROMPT,
        dragIndex: null,
        models: {
            vision: null,
            image: null
        }
    },

    elements: {
        modal: null,
        grid: null,
        rolesList: null,
        canvas: null,
        scriptInput: null,
        ratioSelect: null,
        previewBox: null
    },

    init() {
        this.loadLocalData();
        this.resetShots();
    },

    cacheElements() {
        this.elements.modal = document.getElementById('storyboardModal');
        this.elements.grid = document.getElementById('storyboardGrid');
        this.elements.rolesList = document.getElementById('storyboardRolesList');
        this.elements.canvas = document.getElementById('storyboardCanvas');
        this.elements.scriptInput = document.getElementById('storyboardScript');
        this.elements.ratioSelect = document.getElementById('storyboardRatio');
        this.elements.previewBox = document.querySelector('.preview-box');
    },

    open() {
        this.cacheElements();
        if (!this.elements.modal) return;

        this.state.isOpen = true;
        this.elements.modal.style.display = 'flex';
        this.bindEvents();
        this.renderGrid();
        this.renderRoles();
    },

    close() {
        if (!this.elements.modal) return;
        this.state.isOpen = false;
        this.elements.modal.style.display = 'none';
    },

    bindEvents() {
        if (this.elements.modal.dataset.bound) return;
        this.elements.modal.dataset.bound = 'true';

        // 基础操作
        document.getElementById('storyboardCloseBtn')?.addEventListener('click', () => this.close());
        document.getElementById('storyboardClearBtn')?.addEventListener('click', () => this.clearAll());
        document.getElementById('storyboardGenerateBtn')?.addEventListener('click', () => this.generateStoryboard());
        document.getElementById('storyboardDownloadBtn')?.addEventListener('click', () => this.downloadOutput());
        document.getElementById('storyboardCopyScriptBtn')?.addEventListener('click', () => this.copyScript());
        
        // 角色管理
        document.getElementById('storyboardAddRoleBtn')?.addEventListener('click', () => this.addRole());

        // 比例切换
        this.elements.ratioSelect?.addEventListener('change', (e) => {
            this.state.ratio = e.target.value;
        });

        // AI功能
        document.getElementById('storyboardBulkVisionBtn')?.addEventListener('click', () => this.runBulkVision());
        document.getElementById('storyboardBulkImageBtn')?.addEventListener('click', () => this.runBulkImage());
        document.getElementById('storyboardPromptBtn')?.addEventListener('click', () => this.showPromptSettings());
    },

    resetShots() {
        this.state.shots = Array.from({ length: SHOT_COUNT }, (_, idx) => ({
            id: `shot-${idx}`,
            imageUrl: null,
            description: '',
            duration: '',
            dialogues: []
        }));
    },

    loadLocalData() {
        try {
            const roles = localStorage.getItem(ROLE_STORAGE_KEY);
            this.state.roles = roles ? JSON.parse(roles) : [{ id: 'c1', name: '主角' }];
            
            this.state.visionPrompt = localStorage.getItem(VISION_PROMPT_STORAGE_KEY) || DEFAULT_VISION_PROMPT;
            this.state.imagePromptTemplate = localStorage.getItem(IMAGE_PROMPT_STORAGE_KEY) || DEFAULT_IMAGE_PROMPT;
        } catch (e) {
            console.warn('Failed to load storyboard data', e);
        }
    },

    saveLocalData() {
        try {
            localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(this.state.roles));
            localStorage.setItem(VISION_PROMPT_STORAGE_KEY, this.state.visionPrompt);
            localStorage.setItem(IMAGE_PROMPT_STORAGE_KEY, this.state.imagePromptTemplate);
        } catch (e) {
            console.warn('Failed to save storyboard data', e);
        }
    },

    renderGrid() {
        if (!this.elements.grid) return;
        this.elements.grid.innerHTML = '';

        this.state.shots.forEach((shot, idx) => {
            const card = document.createElement('div');
            card.className = 'storyboard-card';
            card.innerHTML = `
                <div class="card-header">
                    <span>镜头${NUM_TO_ZH[idx + 1]}</span>
                    <div class="actions">
                        <span class="idx">#${idx + 1}</span>
                        <button class="btn-icon-sm delete-shot" title="清空">🗑️</button>
                    </div>
                </div>
                <div class="image-area ${shot.imageUrl ? 'has-image' : ''}" data-idx="${idx}">
                    ${shot.imageUrl ? 
                        `<img src="${shot.imageUrl}" alt="Shot ${idx + 1}">
                         <div class="image-actions">
                            <button class="btn-icon-circle download-img">⬇</button>
                            <button class="btn-icon-circle remove-img">×</button>
                         </div>` : 
                        `<div class="placeholder">
                            <span class="icon">🖼️</span>
                            <span>点击上传</span>
                         </div>`
                    }
                    <input type="file" accept="image/*" class="hidden-file-input">
                </div>
                <textarea class="desc-input" placeholder="画面描述...">${shot.description}</textarea>
                <div class="meta-row">
                    <input type="number" class="duration-input" placeholder="时长(s)" value="${shot.duration}" step="0.1">
                </div>
                <div class="dialogue-list">
                    ${this.renderDialogues(shot.dialogues)}
                </div>
                <button class="btn-add-dialogue">+ 台词</button>
            `;

            this.bindCardEvents(card, idx);
            this.elements.grid.appendChild(card);
        });
    },

    renderDialogues(dialogues) {
        if (!dialogues.length) return '<div class="empty-dialogue">暂无台词</div>';
        
        return dialogues.map(line => {
            const roleOptions = this.state.roles.map(r => 
                `<option value="${r.id}" ${r.id === line.roleId ? 'selected' : ''}>${r.name}</option>`
            ).join('');

            return `
                <div class="dialogue-item" data-id="${line.id}">
                    <select class="role-select">${roleOptions}</select>
                    <input type="text" class="dialogue-text" value="${line.text}" placeholder="台词内容">
                    <button class="btn-icon-sm remove-dialogue">×</button>
                </div>
            `;
        }).join('');
    },

    bindCardEvents(card, idx) {
        const shot = this.state.shots[idx];

        // 图片上传
        const imgArea = card.querySelector('.image-area');
        const fileInput = card.querySelector('.hidden-file-input');
        
        imgArea.addEventListener('click', (e) => {
            if (!e.target.closest('button')) fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.setImage(idx, file);
        });

        // 拖拽上传
        imgArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imgArea.classList.add('drag-over');
        });
        imgArea.addEventListener('dragleave', () => imgArea.classList.remove('drag-over'));
        imgArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imgArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) this.setImage(idx, file);
        });

        // 图片操作
        card.querySelector('.download-img')?.addEventListener('click', () => this.downloadShotImage(idx));
        card.querySelector('.remove-img')?.addEventListener('click', () => this.removeShotImage(idx));
        card.querySelector('.delete-shot')?.addEventListener('click', () => this.clearShot(idx));

        // 文本输入
        card.querySelector('.desc-input').addEventListener('input', (e) => {
            shot.description = e.target.value;
        });
        card.querySelector('.duration-input').addEventListener('input', (e) => {
            shot.duration = e.target.value;
        });

        // 台词管理
        card.querySelector('.btn-add-dialogue').addEventListener('click', () => this.addDialogue(idx));
        
        card.querySelectorAll('.dialogue-item').forEach(item => {
            const id = item.dataset.id;
            const line = shot.dialogues.find(d => d.id === id);
            
            item.querySelector('.role-select').addEventListener('change', (e) => {
                line.roleId = e.target.value;
            });
            item.querySelector('.dialogue-text').addEventListener('input', (e) => {
                line.text = e.target.value;
            });
            item.querySelector('.remove-dialogue').addEventListener('click', () => {
                this.removeDialogue(idx, id);
            });
        });
    },

    renderRoles() {
        if (!this.elements.rolesList) return;
        this.elements.rolesList.innerHTML = '';

        if (this.state.roles.length === 0) {
            this.elements.rolesList.innerHTML = '<div class="empty-text">暂无角色</div>';
            return;
        }

        this.state.roles.forEach(role => {
            const div = document.createElement('div');
            div.className = 'role-item';
            div.innerHTML = `
                <input type="text" value="${role.name}" class="role-name-input">
                <button class="btn-icon-sm remove-role">🗑️</button>
            `;

            div.querySelector('.role-name-input').addEventListener('input', (e) => {
                role.name = e.target.value;
                this.saveLocalData();
                this.renderGrid(); // 更新下拉框
            });

            div.querySelector('.remove-role').addEventListener('click', () => this.removeRole(role.id));
            this.elements.rolesList.appendChild(div);
        });
    },

    // 核心逻辑方法
    async setImage(idx, file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.state.shots[idx].imageUrl = e.target.result;
            this.renderGrid();
        };
        reader.readAsDataURL(file);
    },

    removeShotImage(idx) {
        this.state.shots[idx].imageUrl = null;
        this.renderGrid();
    },

    downloadShotImage(idx) {
        const url = this.state.shots[idx].imageUrl;
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = `shot_${idx + 1}.png`;
        a.click();
    },

    clearShot(idx) {
        this.state.shots[idx] = {
            id: `shot-${idx}`,
            imageUrl: null,
            description: '',
            duration: '',
            dialogues: []
        };
        this.renderGrid();
    },

    addRole() {
        this.state.roles.push({
            id: `c${Date.now()}`,
            name: `角色${this.state.roles.length + 1}`
        });
        this.saveLocalData();
        this.renderRoles();
        this.renderGrid();
    },

    removeRole(id) {
        if (confirm('确定删除该角色吗？')) {
            this.state.roles = this.state.roles.filter(r => r.id !== id);
            this.saveLocalData();
            this.renderRoles();
            this.renderGrid();
        }
    },

    addDialogue(idx) {
        if (this.state.roles.length === 0) {
            showError('请先添加角色');
            return;
        }
        this.state.shots[idx].dialogues.push({
            id: Math.random().toString(36).slice(2),
            roleId: this.state.roles[0].id,
            text: ''
        });
        this.renderGrid();
    },

    removeDialogue(shotIdx, lineId) {
        this.state.shots[shotIdx].dialogues = this.state.shots[shotIdx].dialogues.filter(d => d.id !== lineId);
        this.renderGrid();
    },

    // 生成逻辑
    async generateStoryboard() {
        const canvas = this.elements.canvas;
        const ctx = canvas.getContext('2d');
        const [rw, rh] = this.state.ratio.split(':').map(Number);
        
        const cellW = 600;
        const cellH = Math.round(cellW * rh / rw);
        
        canvas.width = cellW * 3;
        canvas.height = cellH * 3;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制图片
        for (let i = 0; i < 9; i++) {
            const shot = this.state.shots[i];
            if (shot.imageUrl) {
                await this.drawImageOnCanvas(ctx, shot.imageUrl, i, cellW, cellH);
            }
        }

        // 生成脚本
        this.generateScript();
        
        document.getElementById('storyboardEmptyPreview').style.display = 'none';
        document.getElementById('storyboardDownloadBtn').disabled = false;
        this.state.outputSize = { w: canvas.width, h: canvas.height };
    },

    drawImageOnCanvas(ctx, url, idx, w, h) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const row = Math.floor(idx / 3);
                const col = idx % 3;
                
                // 保持比例填充
                const scale = Math.max(w / img.width, h / img.height);
                const dw = img.width * scale;
                const dh = img.height * scale;
                const dx = (col * w) + (w - dw) / 2;
                const dy = (row * h) + (h - dh) / 2;

                ctx.save();
                ctx.beginPath();
                ctx.rect(col * w, row * h, w, h);
                ctx.clip();
                ctx.drawImage(img, dx, dy, dw, dh);
                ctx.restore();
                resolve();
            };
            img.src = url;
        });
    },

    generateScript() {
        let script = '';
        let time = 0;

        this.state.shots.forEach((shot, idx) => {
            if (!shot.description && !shot.imageUrl && !shot.dialogues.length) return;

            const duration = parseFloat(shot.duration) || 0;
            script += `[${time.toFixed(1)}s - ${(time + duration).toFixed(1)}s] 镜头${idx + 1}: ${shot.description || '画面'}\n`;
            
            shot.dialogues.forEach(line => {
                const role = this.state.roles.find(r => r.id === line.roleId);
                if (role && line.text) {
                    script += `    ${role.name}: "${line.text}"\n`;
                }
            });
            script += '\n';
            time += duration;
        });

        this.state.scriptText = script;
        this.elements.scriptInput.value = script;
    },

    downloadOutput() {
        if (!this.state.outputSize) return;
        this.elements.canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `storyboard_${Date.now()}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    },

    copyScript() {
        if (!this.state.scriptText) return;
        navigator.clipboard.writeText(this.state.scriptText)
            .then(() => showSuccess('脚本已复制'))
            .catch(() => showError('复制失败'));
    },

    clearAll() {
        if (confirm('确定清空所有内容吗？')) {
            this.resetShots();
            this.state.scriptText = '';
            this.elements.scriptInput.value = '';
            this.state.outputSize = null;
            const ctx = this.elements.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
            document.getElementById('storyboardEmptyPreview').style.display = 'flex';
            document.getElementById('storyboardDownloadBtn').disabled = true;
            this.renderGrid();
        }
    },

    // 预留 AI 接口
    async runBulkVision() {
        showSuccess('AI识图功能即将上线');
    },

    async runBulkImage() {
        showSuccess('AI生图功能即将上线');
    },

    showPromptSettings() {
        const prompt = prompt('请输入AI生图提示词模板 (使用 {{desc}} 代表描述):', this.state.imagePromptTemplate);
        if (prompt !== null) {
            this.state.imagePromptTemplate = prompt;
            this.saveLocalData();
        }
    }
};

export default Storyboard;