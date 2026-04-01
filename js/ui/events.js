import { normalizeUrl } from '../utils/format.js';
import { updateApiKeyStatus, updateApiBaseUrlStatus, updatePromptStatus } from './status.js';
import { showSuccess, showError, showAnnouncement } from './components/toast.js';

export class EventManager {
    constructor(dom, handlers) {
        this.dom = dom;
        this.handlers = handlers;
    }

    bindAll() {
        this.bindApiConfig();
        this.bindPrompt();
        this.bindModelSelection();
        this.bindFileUpload();
        this.bindGenerate();
        this.bindHistory();
        this.bindLogs();
        this.bindWindowEvents();
    }

    bindApiConfig() {
        if (this.dom.apiKey) {
            this.dom.apiKey.addEventListener('change', (e) => {
                const apiKey = e.target.value.trim();
                // 保存到 localStorage
                localStorage.setItem('aiPaintingApiKey', apiKey);
                if (this.handlers.onApiKeyChange) this.handlers.onApiKeyChange(apiKey);
                updateApiKeyStatus(this.dom);
            });
            this.dom.apiKey.addEventListener('input', () => updateApiKeyStatus(this.dom));
        }

        if (this.dom.apiBaseUrl) {
            this.dom.apiBaseUrl.addEventListener('change', (e) => {
                const rawUrl = (e.target.value || '').trim() || 'https://api.wanwuhuanxin.cn';
                const finalUrl = normalizeUrl(rawUrl);
                e.target.value = finalUrl;
                // 保存到 localStorage
                localStorage.setItem('aiPaintingBaseUrl', finalUrl);
                if (this.handlers.onApiBaseUrlChange) this.handlers.onApiBaseUrlChange(finalUrl);
                updateApiBaseUrlStatus(this.dom);
            });
            this.dom.apiBaseUrl.addEventListener('input', () => updateApiBaseUrlStatus(this.dom));
        }
    }

    bindPrompt() {
        if (this.dom.prompt) {
            const autoResizePrompt = () => {
                this.dom.prompt.style.height = 'auto';
                const newHeight = Math.min(Math.max(this.dom.prompt.scrollHeight, 160), 450);
                this.dom.prompt.style.height = `${newHeight}px`;
            };
            this.dom.prompt.addEventListener('input', autoResizePrompt);
            setTimeout(autoResizePrompt, 0);

            this.dom.prompt.addEventListener('input', () => updatePromptStatus(this.dom));
            this.dom.prompt.addEventListener('change', () => updatePromptStatus(this.dom));
        }

        if (this.dom.enablePromptOptimizer) {
            this.dom.enablePromptOptimizer.addEventListener('change', () => {
                if (this.handlers.onOptimizerChange) this.handlers.onOptimizerChange();
            });
        }

        if (this.dom.customOptimizerModelInput) {
            this.dom.customOptimizerModelInput.addEventListener('input', () => {
                if (this.handlers.onOptimizerModelChange) this.handlers.onOptimizerModelChange();
            });
        }

        if (this.dom.promptOptimizerModel) {
            this.dom.promptOptimizerModel.addEventListener('change', () => {
                if (this.handlers.onOptimizerModelSelectChange) this.handlers.onOptimizerModelSelectChange();
            });
        }
    }

    bindModelSelection() {
        const modelTypeRadios = document.querySelectorAll('input[name="modelType"]');
        modelTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (this.handlers.onModelTypeSwitch) this.handlers.onModelTypeSwitch(e.target.value);
            });
        });

        const platformRadios = document.querySelectorAll('input[name="videoPlatform"]');
        platformRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (this.handlers.onVideoPlatformSwitch) this.handlers.onVideoPlatformSwitch(e.target.value);
            });
        });

        // 绘画平台切换事件
        const imagePlatformRadios = document.querySelectorAll('input[name="imagePlatform"]');
        imagePlatformRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (this.handlers.onImagePlatformSwitch) this.handlers.onImagePlatformSwitch(e.target.value);
            });
        });

        const platformSelects = ['sora2ModelSelect', 'grokModelSelect', 'doubaoModelSelect', 'veoModelSelect'];
        platformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', () => {
                    if (this.handlers.onModelChange) this.handlers.onModelChange();
                });
            }
        });

        // 绘画平台模型选择事件
        const imagePlatformSelects = ['openaiModelSelect', 'geminiModelSelect', 'grokImageModelSelect', 'doubaoImageModelSelect'];
        imagePlatformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', () => {
                    if (this.handlers.onImageModelChange) this.handlers.onImageModelChange();
                });
            }
        });

        if (this.dom.imageModels) {
            this.dom.imageModels.addEventListener('change', () => {
                if (this.handlers.onImageModelChange) this.handlers.onImageModelChange();
            });
        }

        if (this.dom.useCustomImageModel) {
            this.dom.useCustomImageModel.addEventListener('change', () => {
                if (this.handlers.onCustomImageModelToggle) this.handlers.onCustomImageModelToggle();
            });
        }

        if (this.dom.customImageModelInput) {
            this.dom.customImageModelInput.addEventListener('input', () => {
                if (this.handlers.onCustomImageModelInput) this.handlers.onCustomImageModelInput();
            });
        }

        if (this.dom.videoModels) { // 注意：这里可能需要检查具体的 select ID
            // 实际上 videoModels 是由 switchVideoPlatform 控制的，这里可能是个统称
            // 原代码中并没有 videoModels 这个 ID，只有各个平台的 select
        }

        if (this.dom.useCustomVideoModel) {
            this.dom.useCustomVideoModel.addEventListener('change', () => {
                if (this.handlers.onCustomVideoModelToggle) this.handlers.onCustomVideoModelToggle();
            });
        }

        if (this.dom.customVideoModelInput) {
            this.dom.customVideoModelInput.addEventListener('input', () => {
                if (this.handlers.onCustomVideoModelInput) this.handlers.onCustomVideoModelInput();
            });
        }

        if (this.dom.n) {
            this.dom.n.addEventListener('change', () => {
                if (this.handlers.onNChange) this.handlers.onNChange();
            });
        }

        if (this.dom.customNInput) {
            this.dom.customNInput.addEventListener('input', () => {
                if (this.handlers.onCustomNInput) this.handlers.onCustomNInput();
            });
        }

        if (this.dom.size) {
            this.dom.size.addEventListener('change', () => {
                if (this.handlers.onSizeChange) this.handlers.onSizeChange();
            });
        }

        if (this.dom.response_format) {
            this.dom.response_format.addEventListener('change', () => {
                if (this.handlers.onFormatChange) this.handlers.onFormatChange();
            });
        }

        if (this.dom.geminiImageSize) {
            this.dom.geminiImageSize.addEventListener('change', () => {
                if (this.handlers.onGeminiSizeChange) this.handlers.onGeminiSizeChange();
            });
        }

        if (this.dom.jimengSeconds) {
            this.dom.jimengSeconds.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }
        if (this.dom.jimengRatio) {
            this.dom.jimengRatio.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }
        if (this.dom.jimengResolution) {
            this.dom.jimengResolution.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }
        if (this.dom.jimengGenerateAudio) {
            this.dom.jimengGenerateAudio.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }
        if (this.dom.jimengWatermark) {
            this.dom.jimengWatermark.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }
        if (this.dom.jimengCameraFixed) {
            this.dom.jimengCameraFixed.addEventListener('change', () => { if (this.handlers.onJimengParamChange) this.handlers.onJimengParamChange(); });
        }

        // Veo 模型选择事件监听
        const veoTypeRadios = document.querySelectorAll('input[name="veoType"]');
        veoTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onVeoSelectionChange) this.handlers.onVeoSelectionChange();
            });
        });

        const veoQualityRadios = document.querySelectorAll('input[name="veoQuality"]');
        veoQualityRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onVeoSelectionChange) this.handlers.onVeoSelectionChange();
            });
        });

        const veoGifModeRadios = document.querySelectorAll('input[name="veoGifMode"]');
        veoGifModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onVeoSelectionChange) this.handlers.onVeoSelectionChange();
            });
        });

        const veoOrientationRadios = document.querySelectorAll('input[name="veoOrientation"]');
        veoOrientationRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onVeoSelectionChange) this.handlers.onVeoSelectionChange();
            });
        });

        // Grok 模型选择事件监听
        const grokModelRadios = document.querySelectorAll('input[name="grokModel"]');
        grokModelRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onGrokSelectionChange) this.handlers.onGrokSelectionChange();
            });
        });

        const grokDurationRadios = document.querySelectorAll('input[name="grokDuration"]');
        grokDurationRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onGrokSelectionChange) this.handlers.onGrokSelectionChange();
            });
        });

        const grokAspectRatioRadios = document.querySelectorAll('input[name="grokAspectRatio"]');
        grokAspectRatioRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onGrokSelectionChange) this.handlers.onGrokSelectionChange();
            });
        });

        // Sora2 模型选择事件监听
        const sora2ModelRadios = document.querySelectorAll('input[name="sora2Model"]');
        sora2ModelRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onSora2SelectionChange) this.handlers.onSora2SelectionChange();
            });
        });

        const sora2SecondsRadios = document.querySelectorAll('input[name="sora2Seconds"]');
        sora2SecondsRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onSora2SelectionChange) this.handlers.onSora2SelectionChange();
            });
        });

        const sora2SizeRadios = document.querySelectorAll('input[name="sora2Size"]');
        sora2SizeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.handlers.onSora2SelectionChange) this.handlers.onSora2SelectionChange();
            });
        });
    }

    bindFileUpload() {
        if (this.dom.imageFile) {
            this.dom.imageFile.addEventListener('change', async (e) => {
                if (this.handlers.onFileSelect) this.handlers.onFileSelect(e);
            });
        }

        if (this.dom.loadUrlsBtn) {
            this.dom.loadUrlsBtn.addEventListener('click', () => {
                if (this.handlers.onLoadUrl) this.handlers.onLoadUrl();
            });
        }

        if (this.dom.imageUrls) {
            const handleUrlInput = () => {
                this.dom.imageUrls.style.height = 'auto';
                this.dom.imageUrls.style.height = `${this.dom.imageUrls.scrollHeight}px`;
                const hasContent = this.dom.imageUrls.value.trim() !== '';
                this.dom.loadUrlsBtn.classList.toggle('active', hasContent);
                this.dom.loadUrlsBtn.disabled = !hasContent;
            };
            this.dom.imageUrls.addEventListener('input', handleUrlInput);
            setTimeout(handleUrlInput, 0);
        }
    }

    bindGenerate() {
        if (this.dom.generateBtn) {
            this.dom.generateBtn.addEventListener('click', () => {
                if (this.handlers.onGenerate) this.handlers.onGenerate();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                if (this.handlers.onGenerate) this.handlers.onGenerate();
            }
        });
    }

    bindHistory() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                if (this.handlers.onHistorySelectAll) this.handlers.onHistorySelectAll(selectAllBtn);
            });
        }

        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                if (this.handlers.onHistoryDeleteSelected) this.handlers.onHistoryDeleteSelected();
            });
        }

        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (this.handlers.onHistoryClearAll) this.handlers.onHistoryClearAll();
            });
        }
    }

    bindLogs() {
        const copyLogsBtn = document.getElementById('copyLogsBtn');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                if (this.handlers.onCopyLogs) this.handlers.onCopyLogs();
            });
        }

        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                if (this.handlers.onClearLogs) this.handlers.onClearLogs();
            });
        }
    }

    bindWindowEvents() {
        window.addEventListener('beforeunload', (e) => {
            if (this.handlers.onBeforeUnload) {
                return this.handlers.onBeforeUnload(e);
            }
        });
    }
}
