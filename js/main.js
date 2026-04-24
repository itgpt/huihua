import { DOMManager } from './utils/dom.js';
import { Logger } from './utils/logger.js';
import { ImageCacheDB } from './storage/indexedDB.js';
import { LocalStorageManager } from './storage/localStorage.js';
import { HistoryManager } from './storage/history.js';
import { APIClient } from './api/base.js';
import { ModelSelector } from './models/modelSelector.js';
import { VideoTaskManager } from './models/videoTask.js';
import { Generator } from './core/generator.js?v=timeline-preview-fit-20260424';
import { EventManager } from './ui/events.js';
import { HistoryUI } from './ui/history.js?v=timeline-preview-fit-20260424';
import { ImagePreviewManager } from './ui/components/imagePreview.js';
import { showAnnouncement, showSuccess, showError } from './ui/components/toast.js';
import { validateInputs } from './core/validator.js';
import { createTaskCard, updateTaskCard } from './ui/components/videoTask.js';
import { updateModeIndicator, updatePromptStatus, updateApiKeyStatus, updateApiBaseUrlStatus } from './ui/status.js';
import { normalizeUrl } from './utils/format.js';
import ApiConfig from './ui/components/apiConfig.js';
import ToolsBar from './ui/components/toolsBar.js?v=timeline-preview-fit-20260424';

class App {
    constructor() {
        this.dom = new DOMManager();
        this.logger = null;
        this.storage = new LocalStorageManager();
        this.db = new ImageCacheDB();
        this.historyManager = null;
        this.modelSelector = null;
        this.videoTaskManager = null;
        this.generator = null;
        this.eventManager = null;
        this.historyUI = null;
        this.imagePreviewManager = null;
    }

    async init() {
        // 初始化 DOM
        this.dom.init();
        
        // 初始化日志
        this.logger = new Logger(this.dom.liveLogs);
        
        // 初始化数据库
        await this.db.init();
        
        // 初始化历史记录管理器
        this.historyManager = new HistoryManager(this.storage, this.db);
        
        // 初始化模型选择器
        this.modelSelector = new ModelSelector(this.dom);
        
        // 初始化API配置折叠
        ApiConfig.init();
        
        // 初始化工具栏
        ToolsBar.init();
        
        // 加载配置
        this.restoreConfig();
        
        // 重新检查API配置状态（因为restoreConfig可能从localStorage恢复了令牌）
        ApiConfig.checkConfigStatus();
        
        // 初始化 API 客户端
        const apiKey = this.dom.apiKey.value.trim();
        const baseUrl = normalizeUrl(this.dom.apiBaseUrl.value.trim());
        const apiClient = new APIClient(baseUrl, apiKey);
        
        // 初始化视频任务管理器
        this.videoTaskManager = new VideoTaskManager(this.dom, apiClient, this.logger, this.storage);
        
        // 初始化图片预览管理器
        this.imagePreviewManager = new ImagePreviewManager(this.dom, (hasImages) => {
            updateModeIndicator(this.dom, hasImages, this.modelSelector.getSelectedModels());
        });
        
        // 初始化生成器
        this.generator = new Generator(
            this.dom, 
            apiClient, 
            this.modelSelector, 
            this.historyManager, 
            this.videoTaskManager, 
            this.logger,
            this.imagePreviewManager
        );
        
        // 初始化历史记录 UI
        this.historyUI = new HistoryUI(this.dom, this.historyManager);
        
        // 绑定视频任务管理器 UI 回调
        this.bindVideoTaskManagerCallbacks();
        
        // 绑定事件
        this.bindEvents(apiClient);
        
        // 加载历史记录
        const history = this.historyManager.load();
        this.historyUI.display(history);
        
        // 恢复视频任务
        this.videoTaskManager.loadTasks();
        
        // 初始化状态显示
        this.updateAllStatus();
        
        // 显示公告
        showAnnouncement();
        
        // 暴露全局实例供调试
        window.app = this;
        window.videoTaskManager = this.videoTaskManager;
    }
    
    restoreConfig() {
        // 恢复 API 配置
        const apiKey = this.storage.get('aiPaintingApiKey');
        if (apiKey) this.dom.apiKey.value = apiKey;
        
        const baseUrl = this.storage.get('aiPaintingBaseUrl');
        if (baseUrl) this.dom.apiBaseUrl.value = baseUrl;
        
        // 解析 URL 配置
        this.parseUrlConfig();
        
        // 恢复模型选择配置
        this.modelSelector.restore();
        
        // 恢复其他配置
        // 提示词优化开关
        const optimizerEnabled = this.storage.get('enablePromptOptimizer') === 'true';
        if (this.dom.enablePromptOptimizer) {
            this.dom.enablePromptOptimizer.checked = optimizerEnabled;
            if (this.dom.optimizerModelGroup) this.dom.optimizerModelGroup.style.display = optimizerEnabled ? 'block' : 'none';
            if (this.dom.optimizerSystemPromptGroup) this.dom.optimizerSystemPromptGroup.style.display = optimizerEnabled ? 'block' : 'none';
        }
        
        // 恢复优化器模型
        const optimizerModel = this.storage.get('aiPaintingOptimizerModel') || 'gpt-5-chat';
        if (this.dom.promptOptimizerModel) this.dom.promptOptimizerModel.value = optimizerModel;
        const customOptimizer = this.storage.get('aiPaintingCustomOptimizerModel');
        if (this.dom.customOptimizerModelInput && customOptimizer) this.dom.customOptimizerModelInput.value = customOptimizer;
        if (optimizerModel === '__custom__' && this.dom.customOptimizerModelInput) {
            this.dom.customOptimizerModelInput.style.display = 'block';
        }
        
        // 恢复 N
        const nValue = this.storage.get('aiPaintingN') || '1';
        if (this.dom.n) this.dom.n.value = nValue;
        const customN = this.storage.get('aiPaintingCustomN');
        if (this.dom.customNInput && customN) this.dom.customNInput.value = customN;
        if (nValue === '__custom__' && this.dom.customNInput) {
            this.dom.customNInput.style.display = 'block';
        }
        
        // 恢复 Size 和 Format
        const size = this.storage.get('aiPaintingSize') || '1:1';
        if (this.dom.size) this.dom.size.value = size;
        const format = this.storage.get('aiPaintingResponseFormat') || 'url';
        if (this.dom.response_format) this.dom.response_format.value = format;
        
        // 恢复 Gemini 分辨率
        const geminiSize = this.storage.get('aiPaintingGeminiImageSize') || '1K';
        if (this.dom.geminiImageSize) this.dom.geminiImageSize.value = geminiSize;
        
        // 恢复即梦参数
        const jimengSeconds = this.storage.get('aiPaintingJimengSeconds') || '12';
        if (this.dom.jimengSeconds) this.dom.jimengSeconds.value = jimengSeconds;
        const jimengRatio = this.storage.get('aiPaintingJimengRatio') || '16:9';
        if (this.dom.jimengRatio) this.dom.jimengRatio.value = jimengRatio;
        const jimengResolution = this.storage.get('aiPaintingJimengResolution') || '1080p';
        if (this.dom.jimengResolution) this.dom.jimengResolution.value = jimengResolution;
        const jimengGenerateAudio = this.storage.get('aiPaintingJimengGenerateAudio') || 'false';
        if (this.dom.jimengGenerateAudio) this.dom.jimengGenerateAudio.value = jimengGenerateAudio;
        const jimengWatermark = this.storage.get('aiPaintingJimengWatermark') || 'false';
        if (this.dom.jimengWatermark) this.dom.jimengWatermark.value = jimengWatermark;
        const jimengCameraFixed = this.storage.get('aiPaintingJimengCameraFixed') || 'false';
        if (this.dom.jimengCameraFixed) this.dom.jimengCameraFixed.value = jimengCameraFixed;
        
        // 更新 UI 状态
        this.modelSelector.updateParamVisibility();
    }
    
    parseUrlConfig() {
        try {
            const hash = window.location.hash;
            const cleanHash = hash.replace(/^#\/?\??/, '');
            
            if (cleanHash) {
                const params = new URLSearchParams(cleanHash);
                const settingsParam = params.get('settings');
                
                if (settingsParam) {
                    const decodedSettings = decodeURIComponent(settingsParam);
                    const settings = JSON.parse(decodedSettings);
                    
                    if (settings.key && settings.key !== '{key}') {
                        this.dom.apiKey.value = settings.key;
                        this.storage.set('aiPaintingApiKey', settings.key);
                    }
                    if (settings.url) {
                        const finalUrl = normalizeUrl(settings.url);
                        this.dom.apiBaseUrl.value = finalUrl;
                        this.storage.set('aiPaintingBaseUrl', finalUrl);
                    }
                    
                    showSuccess('服务端API设置成功！');
                    history.pushState("", document.title, window.location.pathname + window.location.search);
                }
            }
        } catch (error) {
            console.error('从URL解析配置时出错:', error);
            showError('解析URL配置失败', error.message);
        }
    }
    
    bindVideoTaskManagerCallbacks() {
        this.videoTaskManager.onTaskCreate = (task) => {
            const container = document.getElementById('videoTasksContainer');
            const list = document.getElementById('videoTasksList');
            
            if (!container || !list) return;
            
            // 检查是否已存在
            if (list.querySelector(`[data-task-id="${task.id}"]`)) return;
            
            container.style.display = 'block';
            
            const card = createTaskCard(task, {
                onRemove: (taskId) => {
                    this.videoTaskManager.removeTask(taskId);
                    this.videoTaskManager.saveTasks();
                    showSuccess('任务已移除');
                }
            });
            
            list.insertBefore(card, list.firstChild);
            
            // 自动滚动到最左侧
            const scrollContainer = container.querySelector('.video-tasks-scroll');
            if (scrollContainer) {
                scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
            }
            
            this.updateVideoTaskCount();
        };
        
        this.videoTaskManager.onTaskUpdate = (task) => {
            const card = document.querySelector(`.video-task-card[data-task-id="${task.id}"]`);
            if (card) {
                updateTaskCard(card, task, {
                    onRemove: (taskId) => {
                        this.videoTaskManager.removeTask(taskId);
                        this.videoTaskManager.saveTasks();
                        showSuccess('任务已移除');
                    }
                });
            }
            this.updateVideoTaskCount();
        };
        
        this.videoTaskManager.onTaskRemove = (taskId) => {
            const card = document.querySelector(`.video-task-card[data-task-id="${taskId}"]`);
            if (card) {
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    card.remove();
                    this.updateVideoTaskCount();
                    
                    const list = document.getElementById('videoTasksList');
                    if (list && list.children.length === 0) {
                        const container = document.getElementById('videoTasksContainer');
                        if (container) container.style.display = 'none';
                    }
                }, 300);
            }
        };
        
        // 🔥 新增：监听任务完成事件，保存到灵感档案
        this.videoTaskManager.onTaskCompleted = (taskId, result) => {
            const task = this.videoTaskManager.getTask(taskId);
            if (task && task.video_url) {
                const meta = {
                    model: task.model,
                    mode: 'video',
                    type: 'video',
                    taskId: taskId
                };
                
                // 这里调用 historyManager 保存视频记录
                // 注意：这里需要构造符合 save 方法参数的结构
                // 为了兼容，我们将 imageSrc 设为 video_url
                this.historyManager.save(
                    task.video_url, 
                    task.prompt, 
                    task.optimizedPrompt, 
                    { model: task.model }, 
                    [], // 此时可能无法获取完整日志，暂传空数组
                    meta
                ).then(() => {
                    this.logger.append('success', '✅ 视频已自动保存到灵感档案');
                    // 刷新历史记录展示
                    this.historyUI.display(this.historyManager.load());
                });
            }
        };
    }
    
    updateVideoTaskCount() {
        const tasksInProgressElement = document.getElementById('tasksInProgress');
        if (!tasksInProgressElement) return;
        
        const inProgressCount = this.videoTaskManager.getAllTasks().filter(
            t => t.status === 'queued' || t.status === 'in_progress'
        ).length;
        
        tasksInProgressElement.textContent = inProgressCount;
    }
    
    bindEvents(apiClient) {
        this.eventManager = new EventManager(this.dom, {
            onApiKeyChange: (key) => apiClient.apiKey = key,
            onApiBaseUrlChange: (url) => apiClient.baseUrl = url,
            
            onOptimizerChange: () => {
                const enabled = this.dom.enablePromptOptimizer.checked;
                if (this.dom.optimizerModelGroup) this.dom.optimizerModelGroup.style.display = enabled ? 'block' : 'none';
                if (this.dom.optimizerSystemPromptGroup) this.dom.optimizerSystemPromptGroup.style.display = enabled ? 'block' : 'none';
                this.storage.set('enablePromptOptimizer', enabled);
            },
            onOptimizerModelChange: () => {
                if (this.dom.customOptimizerModelInput) {
                    this.storage.set('aiPaintingCustomOptimizerModel', this.dom.customOptimizerModelInput.value);
                }
            },
            onOptimizerModelSelectChange: () => {
                if (this.dom.promptOptimizerModel) {
                    const value = this.dom.promptOptimizerModel.value;
                    this.storage.set('aiPaintingOptimizerModel', value);
                    
                    if (this.dom.customOptimizerModelInput) {
                        this.dom.customOptimizerModelInput.style.display = (value === '__custom__') ? 'block' : 'none';
                    }
                }
            },
            
            onModelTypeSwitch: (type) => {
                this.modelSelector.switchModelType(type, this.imagePreviewManager.getFiles().length);
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onVideoPlatformSwitch: (platform) => {
                this.modelSelector.switchVideoPlatform(platform);
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onImagePlatformSwitch: (platform) => {
                this.modelSelector.switchImagePlatform(platform);
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onModelChange: () => {
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onImageModelChange: () => {
                this.modelSelector.save();
                this.modelSelector.updateParamVisibility();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onCustomImageModelToggle: () => {
                this.modelSelector.ensureCustomImageModelVisibility();
                this.modelSelector.save();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onCustomImageModelInput: () => {
                this.modelSelector.save();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onCustomVideoModelToggle: () => {
                this.modelSelector.ensureCustomVideoModelVisibility();
                this.modelSelector.save();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            onCustomVideoModelInput: () => {
                this.modelSelector.save();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            
            onGeminiSizeChange: () => this.modelSelector.updateAspectRatioOptions(this.modelSelector.getSelectedModels()),
            onJimengParamChange: () => {
                if (this.dom.jimengSeconds) this.storage.set('aiPaintingJimengSeconds', this.dom.jimengSeconds.value);
                if (this.dom.jimengRatio) this.storage.set('aiPaintingJimengRatio', this.dom.jimengRatio.value);
                if (this.dom.jimengResolution) this.storage.set('aiPaintingJimengResolution', this.dom.jimengResolution.value);
                if (this.dom.jimengGenerateAudio) this.storage.set('aiPaintingJimengGenerateAudio', this.dom.jimengGenerateAudio.value);
                if (this.dom.jimengWatermark) this.storage.set('aiPaintingJimengWatermark', this.dom.jimengWatermark.value);
                if (this.dom.jimengCameraFixed) this.storage.set('aiPaintingJimengCameraFixed', this.dom.jimengCameraFixed.value);
            },
            
            onVeoSelectionChange: () => {
                this.modelSelector.updateVeoModelSelection();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            
            onGrokSelectionChange: () => {
                this.modelSelector.updateGrokModelSelection();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },            onFileSelect: (e) => this.imagePreviewManager.addFiles(Array.from(e.target.files)),
            onLoadUrl: () => this.imagePreviewManager.loadImagesFromUrls(),
            
            onGenerate: async () => {
                const apiKey = this.dom.apiKey.value.trim();
                const prompt = this.dom.prompt.value.trim();
                const models = this.modelSelector.getSelectedModels();
                const imageFiles = this.imagePreviewManager.getFiles();
                
                if (validateInputs(apiKey, prompt, models, imageFiles)) {
                    await this.generator.generate();
                    // 重新加载历史记录以显示最新条目
                    this.historyUI.display(this.historyManager.load());
                }
            },
            
            onHistorySelectAll: (btn) => this.historyUI.selectAll(btn),
            onHistoryDeleteSelected: () => this.historyUI.deleteSelected(),
            onHistoryClearAll: () => this.historyUI.clear(),
            
            onCopyLogs: () => this.logger.copy(),
            onClearLogs: () => this.logger.clear(),
            
            onBeforeUnload: () => {
                const tasks = this.videoTaskManager.getAllTasks();
                const hasInProgress = tasks.some(t => t.status === 'in_progress' || t.status === 'queued');
                if (hasInProgress) {
                    this.videoTaskManager.saveTasks();
                    return '还有视频正在生成中，确定要离开吗？';
                }
            }
        });
        
        this.eventManager.bindAll();
    }
    
    updateAllStatus() {
        updateApiKeyStatus(this.dom);
        updateApiBaseUrlStatus(this.dom);
        updatePromptStatus(this.dom);
        updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
    }
}

// 启动应用
const app = new App();
// 等待 DOM 加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
