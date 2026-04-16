import { DOMManager } from './utils/dom.js';
import { Logger } from './utils/logger.js';
import { ImageCacheDB } from './storage/indexedDB.js';
import { LocalStorageManager } from './storage/localStorage.js';
import { HistoryManager } from './storage/history.js';
import { APIClient } from './api/base.js';
import { ModelSelector } from './models/modelSelector.js';
import { VideoTaskManager } from './models/videoTask.js';
import { Generator } from './core/generator.js';
import { EventManager } from './ui/events.js';
import { HistoryUI } from './ui/history.js';
import { ImagePreviewManager } from './ui/components/imagePreview.js';
import { showAnnouncement, showSuccess, showError } from './ui/components/toast.js';
import { validateInputs } from './core/validator.js';
import { createTaskCard, updateTaskCard } from './ui/components/videoTask.js';
import { updateModeIndicator, updatePromptStatus, updateApiKeyStatus, updateApiBaseUrlStatus } from './ui/status.js';
import { normalizeUrl } from './utils/format.js';
import ApiConfig from './ui/components/apiConfig.js';
import ToolsBar from './ui/components/toolsBar.js';

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
            
            onNChange: () => {},
            onCustomNInput: () => {},
            onSizeChange: () => {},
            onFormatChange: () => {},
            onGeminiSizeChange: () => this.modelSelector.updateAspectRatioOptions(this.modelSelector.getSelectedModels()),
            onJimengParamChange: () => {
                if (this.dom.jimengSeconds) this.storage.set('aiPaintingJimengSeconds', this.dom.jimengSeconds.value);
                if (this.dom.jimengRatio) this.storage.set('aiPaintingJimengRatio', this.dom.jimengRatio.value);
                if (this.dom.jimengResolution) this.storage.set('aiPaintingJimengResolution', this.dom.jimengResolution.value);
                if (this.dom.jimengGenerateAudio) this.storage.set('aiPaintingJimengGenerateAudio', this.dom.jimengGenerateAudio.value);
                if (this.dom.jimengWatermark) this.storage.set('aiPaintingJimengWatermark', this.dom.jimengWatermark.value);
                if (this.dom.jimengCameraFixed) this.storage.set('aiPaintingJimengCameraFixed', this.dom.jimengCameraFixed.value);
            },
            onDoubao20ParamChange: () => {
                // 保存豆包2.0参数到本地存储
                if (this.dom.doubao20Seconds) this.storage.set('doubao20Seconds', this.dom.doubao20Seconds.value);
                if (this.dom.doubao20Ratio) this.storage.set('doubao20Ratio', this.dom.doubao20Ratio.value);
                if (this.dom.doubao20Resolution) this.storage.set('doubao20Resolution', this.dom.doubao20Resolution.value);
                if (this.dom.doubao20GenerateAudio) this.storage.set('doubao20GenerateAudio', this.dom.doubao20GenerateAudio.value);
                if (this.dom.doubao20Watermark) this.storage.set('doubao20Watermark', this.dom.doubao20Watermark.value);
                if (this.dom.doubao20CameraFixed) this.storage.set('doubao20CameraFixed', this.dom.doubao20CameraFixed.value);
                if (this.dom.doubao20WebSearch) this.storage.set('doubao20WebSearch', this.dom.doubao20WebSearch.value);
                if (this.dom.doubao20Mode) this.storage.set('doubao20Mode', this.dom.doubao20Mode.value);
                if (this.dom.doubao20ReferenceType) this.storage.set('doubao20ReferenceType', this.dom.doubao20ReferenceType.value);
                
                // 更新参数可见性
                this.updateDoubao20ParamVisibility();
            },
            
            onVeoSelectionChange: () => {
                this.modelSelector.updateVeoModelSelection();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            
            onGrokSelectionChange: () => {
                this.modelSelector.updateGrokModelSelection();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            
            onSora2SelectionChange: () => {
                this.modelSelector.updateSora2ModelSelection();
                updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
            },
            
            onFileSelect: (e) => this.imagePreviewManager.addFiles(Array.from(e.target.files)),
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
        
        // 绑定调试按钮
        const debugRecheckBtn = document.getElementById('debugRecheckBtn');
        if (debugRecheckBtn) {
            debugRecheckBtn.addEventListener('click', () => {
                console.log('[调试] 点击调试视频任务按钮');
                
                // 1. 直接从LocalStorage读取任务
                console.log('[调试] === 方法1: 直接从LocalStorage读取 ===');
                const localStorageTasks = this.videoTaskManager.debugLocalStorageTasks();
                
                // 2. 通过管理器列出任务
                console.log('[调试] === 方法2: 通过管理器列出 ===');
                const taskList = this.videoTaskManager.listAllTasks();
                
                // 3. 重新查询已完成但未显示视频的任务
                console.log('[调试] === 方法3: 重新查询任务 ===');
                const recheckedCount = this.videoTaskManager.recheckCompletedTasks();
                
                const totalTasks = Math.max(localStorageTasks.length, taskList.length);
                
                if (totalTasks === 0) {
                    console.log('[调试] 没有找到任何视频任务');
                    alert('没有找到任何视频任务。请先生成一个视频。');
                } else if (recheckedCount > 0) {
                    console.log(`[调试] 已重新查询 ${recheckedCount} 个任务`);
                    alert(`找到 ${totalTasks} 个任务，已重新查询 ${recheckedCount} 个已完成但未显示视频的任务，请查看控制台日志。`);
                } else {
                    console.log(`[调试] 找到 ${totalTasks} 个任务，但没有需要重新查询的任务`);
                    alert(`找到 ${totalTasks} 个任务，但没有需要重新查询的任务。`);
                }
            });
        }
    }
    
    updateDoubao20ParamVisibility() {
        // 根据功能模式显示/隐藏相关参数
        if (!this.dom.doubao20Mode) return;
        
        const mode = this.dom.doubao20Mode.value;
        const referenceType = this.dom.doubao20ReferenceType ? this.dom.doubao20ReferenceType.value : 'none';
        
        // 显示提示信息
        let hintText = '';
        switch (mode) {
            case 'text2video':
                hintText = '📝 纯文本生成视频'; break;
            case 'image2video':
                hintText = '🖼️ 基于图片生成视频（需要上传参考图片）'; break;
            case 'video_edit':
                hintText = '✏️ 编辑现有视频（需要上传参考视频）'; break;
            case 'video_extend':
                hintText = '⏱️ 延长视频时长（需要上传参考视频）'; break;
            case 'multimodal':
                hintText = '🎨 多模态参考（图片+视频+音频组合）'; break;
        }
        
        // 更新提示信息
        const hintElement = document.getElementById('doubao20Hint');
        if (!hintElement) {
            // 创建提示元素
            const hint = document.createElement('div');
            hint.id = 'doubao20Hint';
            hint.style.cssText = 'font-size: 0.85rem; color: #718096; margin-top: 8px; padding: 8px; background: #f7fafc; border-radius: 6px;';
            hint.textContent = hintText;
            
            // 插入到参数面板中
            const paramsGroup = document.getElementById('doubao20VideoParamsGroup');
            if (paramsGroup) {
                paramsGroup.insertBefore(hint, paramsGroup.querySelector('.param-grid'));
            }
        } else {
            hintElement.textContent = hintText;
        }
    }

    updateAllStatus() {
        updateApiKeyStatus(this.dom);
        updateApiBaseUrlStatus(this.dom);
        updatePromptStatus(this.dom);
        updateModeIndicator(this.dom, this.imagePreviewManager.getFiles().length > 0, this.modelSelector.getSelectedModels());
        
        // 更新豆包2.0参数可见性
        this.updateDoubao20ParamVisibility();
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

// 添加全局调试函数
window.debugVideoTasks = function() {
    if (app && app.videoTaskManager) {
        console.log('[全局调试] 调用 debugVideoTasks()');
        app.videoTaskManager.listAllTasks();
        app.videoTaskManager.recheckCompletedTasks();
    } else {
        console.error('[全局调试] app 或 videoTaskManager 未初始化');
    }
};

// 手动修复已缓存的任务
window.fixCachedTasks = function() {
    console.log('[修复任务] 开始修复已缓存的任务');
    
    // 获取所有任务
    const data = localStorage.getItem('sora_video_tasks');
    if (!data) {
        console.log('[修复任务] 没有找到任务数据');
        return;
    }
    
    try {
        const parsed = JSON.parse(data);
        const tasks = parsed.tasks || [];
        
        console.log(`[修复任务] 找到 ${tasks.length} 个任务`);
        
        // 查找需要修复的任务（已完成但没有视频URL）
        const tasksToFix = tasks.filter(t => t.status === 'completed' && !t.video_url);
        
        if (tasksToFix.length === 0) {
            console.log('[修复任务] 没有需要修复的任务');
            return;
        }
        
        console.log(`[修复任务] 需要修复 ${tasksToFix.length} 个任务:`);
        tasksToFix.forEach((task, index) => {
            console.log(`[修复任务] ${index + 1}. ${task.id} (${task.model})`);
        });
        
        // 提示用户重新查询
        if (confirm(`发现 ${tasksToFix.length} 个已完成但无视频URL的任务。\n是否重新查询这些任务？`)) {
            tasksToFix.forEach(task => {
                if (window.app && window.app.videoTaskManager) {
                    console.log(`[修复任务] 重新查询任务: ${task.id}`);
                    window.app.videoTaskManager.recheckTaskWithDetails(task.id);
                }
            });
        }
        
    } catch (error) {
        console.error('[修复任务] 修复失败:', error);
    }
};

// 手动测试豆包API响应格式
window.testDoubaoResponseFormat = function() {
    console.log('[豆包格式测试] 测试豆包API响应格式');
    
    // 豆包2.0可能的响应格式示例
    const testResponses = [
        // 格式1: 直接包含video_url
        {
            "id": "task_123",
            "status": "completed",
            "video_url": "https://example.com/video.mp4"
        },
        // 格式2: 嵌套在data中
        {
            "data": {
                "id": "task_123",
                "status": "completed",
                "video_url": "https://example.com/video.mp4"
            }
        },
        // 格式3: 嵌套在data.data中
        {
            "data": {
                "data": {
                    "id": "task_123",
                    "status": "completed",
                    "video_url": "https://example.com/video.mp4"
                }
            }
        },
        // 格式4: 使用result_url
        {
            "data": {
                "id": "task_123",
                "status": "completed",
                "result_url": "https://example.com/video.mp4"
            }
        },
        // 格式5: 在content中
        {
            "data": {
                "data": {
                    "content": {
                        "video_url": "https://example.com/video.mp4"
                    }
                }
            }
        }
    ];
    
    // 导入视频URL提取函数
    import('./js/api/video.js').then(module => {
        testResponses.forEach((response, index) => {
            console.log(`\n[豆包格式测试] 测试格式 ${index + 1}:`);
            console.log('[豆包格式测试] 测试响应:', response);
            const videoUrl = module.extractVideoUrlFromResult(response);
            console.log(`[豆包格式测试] 提取的视频URL: ${videoUrl || 'null'}`);
        });
    }).catch(error => {
        console.error('[豆包格式测试] 导入失败:', error);
    });
};

// 重新查询豆包2.0任务
window.recheckDoubao20Task = function() {
    console.log('[豆包2.0调试] 重新查询豆包2.0任务');
    
    // 获取所有任务
    const data = localStorage.getItem('sora_video_tasks');
    if (!data) {
        console.log('[豆包2.0调试] 没有找到任务数据');
        return;
    }
    
    try {
        const parsed = JSON.parse(data);
        const tasks = parsed.tasks || [];
        
        // 查找豆包2.0任务
        const doubao20Tasks = tasks.filter(t => t.model === 'doubao-seedance-2-0-260128');
        
        if (doubao20Tasks.length === 0) {
            console.log('[豆包2.0调试] 没有找到豆包2.0任务');
            return;
        }
        
        console.log(`[豆包2.0调试] 找到 ${doubao20Tasks.length} 个豆包2.0任务`);
        
        // 重新查询第一个豆包2.0任务
        const task = doubao20Tasks[0];
        console.log(`[豆包2.0调试] 重新查询任务: ${task.id}`);
        
        if (window.app && window.app.videoTaskManager) {
            return window.app.videoTaskManager.recheckTaskWithDetails(task.id);
        } else {
            console.error('[豆包2.0调试] app 或 videoTaskManager 未初始化');
        }
        
    } catch (error) {
        console.error('[豆包2.0调试] 解析数据失败:', error);
    }
};

// 添加详细的任务调试函数
window.debugVideoTasksDetailed = function() {
    console.log('[详细调试] ========== 视频任务详细调试 ==========');
    
    // 1. 检查LocalStorage
    const data = localStorage.getItem('sora_video_tasks');
    if (!data) {
        console.log('[详细调试] LocalStorage中没有找到任务数据');
        return;
    }
    
    try {
        const parsed = JSON.parse(data);
        console.log('[详细调试] 完整数据结构:', parsed);
        
        // 2. 提取任务列表
        const tasks = parsed.tasks || [];
        console.log(`[详细调试] 总共 ${tasks.length} 个任务`);
        
        // 3. 分析每个任务
        tasks.forEach((task, index) => {
            console.log(`\n[详细调试] === 任务 ${index + 1}/${tasks.length} ===`);
            console.log(`[详细调试] 任务ID: ${task.id}`);
            console.log(`[详细调试] 状态: ${task.status}`);
            console.log(`[详细调试] 模型: ${task.model}`);
            console.log(`[详细调试] 进度: ${task.progress}%`);
            console.log(`[详细调试] 视频URL: ${task.video_url || '无'}`);
            console.log(`[详细调试] 提示词: ${task.prompt || '无'}`);
            console.log(`[详细调试] 创建时间: ${task.created_at ? new Date(task.created_at).toLocaleString() : '未知'}`);
            console.log(`[详细调试] 更新时间: ${task.updated_at ? new Date(task.updated_at).toLocaleString() : '未知'}`);
            
            // 检查是否为豆包2.0任务
            if (task.model && task.model.includes('doubao')) {
                console.log(`[详细调试] ✅ 这是豆包模型任务`);
                
                // 检查是否有错误信息
                if (task.error) {
                    console.log(`[详细调试] ❌ 任务有错误:`, task.error);
                }
                
                // 检查是否完成但没有视频URL
                if (task.status === 'completed' && !task.video_url) {
                    console.log(`[详细调试] ⚠️ 任务已完成但没有视频URL，需要重新查询`);
                }
            }
        });
        
        // 4. 统计信息
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const doubaoTasks = tasks.filter(t => t.model && t.model.includes('doubao'));
        const tasksWithoutVideo = tasks.filter(t => t.status === 'completed' && !t.video_url);
        
        console.log(`\n[详细调试] === 统计信息 ===`);
        console.log(`[详细调试] 已完成任务: ${completedTasks.length}/${tasks.length}`);
        console.log(`[详细调试] 豆包任务: ${doubaoTasks.length}/${tasks.length}`);
        console.log(`[详细调试] 已完成但无视频URL: ${tasksWithoutVideo.length}/${tasks.length}`);
        
        if (tasksWithoutVideo.length > 0) {
            console.log(`[详细调试] ⚠️ 发现 ${tasksWithoutVideo.length} 个需要重新查询的任务`);
            tasksWithoutVideo.forEach(task => {
                console.log(`[详细调试] 需要重新查询: ${task.id} (${task.model})`);
            });
        }
        
    } catch (error) {
        console.error('[详细调试] 解析数据失败:', error);
    }
};

// 添加直接检查LocalStorage的函数
window.debugLocalStorage = function() {
    console.log('[全局调试] 直接检查LocalStorage');
    
    // 检查所有可能的任务存储键
    const storageKeys = [
        'sora_video_tasks',
        'video_tasks',
        'doubao_tasks',
        'ai_video_tasks'
    ];
    
    storageKeys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
            console.log(`[全局调试] 找到键: ${key}`);
            try {
                const parsed = JSON.parse(data);
                console.log(`[全局调试] ${key} 内容:`, parsed);
                
                // 处理不同的数据结构
                if (Array.isArray(parsed)) {
                    // 直接是数组
                    console.log(`[全局调试] ${key} 中有 ${parsed.length} 个任务（直接数组）:`);
                    parsed.forEach((task, index) => {
                        console.log(`[全局调试] 任务 ${index + 1}:`, {
                            id: task.id,
                            status: task.status,
                            model: task.model,
                            video_url: task.video_url,
                            prompt: task.prompt
                        });
                    });
                } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
                    // 嵌套在 tasks 字段中
                    console.log(`[全局调试] ${key} 中有 ${parsed.tasks.length} 个任务（嵌套在tasks字段）:`);
                    parsed.tasks.forEach((task, index) => {
                        console.log(`[全局调试] 任务 ${index + 1}:`, {
                            id: task.id,
                            status: task.status,
                            model: task.model,
                            video_url: task.video_url,
                            prompt: task.prompt
                        });
                    });
                    
                    // 显示配置信息
                    if (parsed.config) {
                        console.log(`[全局调试] ${key} 配置:`, parsed.config);
                    }
                } else {
                    console.log(`[全局调试] ${key} 未知数据结构:`, parsed);
                }
            } catch (error) {
                console.error(`[全局调试] 解析 ${key} 失败:`, error);
            }
        } else {
            console.log(`[全局调试] 键 ${key} 不存在或为空`);
        }
    });
};

// 添加测试豆包2.0响应的函数
window.testDoubaoResponse = function(responseJson) {
    console.log('[测试] 测试豆包2.0响应解析');
    try {
        const result = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
        console.log('[测试] 解析后的响应:', result);
        
        // 导入并测试视频URL提取
        import('./js/api/video.js').then(module => {
            const videoUrl = module.extractVideoUrlFromResult(result);
            console.log('[测试] 提取的视频URL:', videoUrl);
            
            if (videoUrl) {
                console.log('[测试] ✅ 成功提取视频URL');
                // 尝试创建视频元素预览
                const video = document.createElement('video');
                video.src = videoUrl;
                video.controls = true;
                video.style.width = '300px';
                video.style.margin = '10px';
                document.body.appendChild(video);
                console.log('[测试] 已添加视频预览到页面');
            } else {
                console.log('[测试] ❌ 未能提取视频URL');
            }
        }).catch(error => {
            console.error('[测试] 导入video.js失败:', error);
        });
    } catch (error) {
        console.error('[测试] JSON解析失败:', error);
    }
};
