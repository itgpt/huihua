import { isGemini25Flash, isGemini31FlashImage, isGemini3ProImage, isGeminiModel } from './modelConfig.js';
import { GEMINI_25_FLASH_ASPECTS, GEMINI_3_PRO_ASPECTS } from '../config/constants.js';

export class ModelSelector {
    constructor(dom) {
        this.dom = dom;
    }

    getSelectedModels() {
        const models = [];
        
        // 检查当前选择的模型类型
        const modelTypeRadios = document.querySelectorAll('input[name="modelType"]');
        let selectedType = null;
        modelTypeRadios.forEach(radio => {
            if (radio.checked) selectedType = radio.value;
        });
        
        if (selectedType === 'image') {
            // 获取绘画模型 - 从当前显示的平台选择器中获取
            const imagePlatformRadios = document.querySelectorAll('input[name="imagePlatform"]');
            let selectedImagePlatform = null;
            imagePlatformRadios.forEach(radio => {
                if (radio.checked) selectedImagePlatform = radio.value;
            });
            
            if (selectedImagePlatform) {
                const selectId = selectedImagePlatform === 'openai' ? 'openaiModelSelect' :
                                selectedImagePlatform === 'gemini' ? 'geminiModelSelect' :
                                selectedImagePlatform === 'grok' ? 'grokImageModelSelect' :
                                selectedImagePlatform === 'doubao' ? 'doubaoImageModelSelect' : null;
                
                const select = document.getElementById(selectId);
                if (select) {
                    const selectedValues = Array.from(select.selectedOptions).map(o => o.value);
                    models.push(...selectedValues);
                }
            }
            
            if (this.dom.useCustomImageModel && this.dom.useCustomImageModel.checked) {
                const customImage = this.dom.customImageModelInput ? this.dom.customImageModelInput.value.trim() : '';
                if (customImage) {
                    models.push(customImage);
                }
            }
        } else if (selectedType === 'video') {
            // 获取视频模型 - 从当前显示的平台选择器中获取
            const platformRadios = document.querySelectorAll('input[name="videoPlatform"]');
            let selectedPlatform = null;
            platformRadios.forEach(radio => {
                if (radio.checked) selectedPlatform = radio.value;
            });
            
            if (selectedPlatform) {
                const selectId = selectedPlatform + 'ModelSelect';
                const select = document.getElementById(selectId);
                if (select && select.value) {
                    models.push(select.value);
                }
            }
            
            // 自定义视频模型
            if (this.dom.useCustomVideoModel && this.dom.useCustomVideoModel.checked) {
                const customVideo = this.dom.customVideoModelInput ? this.dom.customVideoModelInput.value.trim() : '';
                if (customVideo) {
                    models.push(customVideo);
                }
            }
        }
        
        return Array.from(new Set(models)); // 去重
    }

    // 模型类型切换函数
    switchModelType(type, uploadedFilesCount) {
        const imageSection = document.getElementById('imageModelSection');
        const videoSection = document.getElementById('videoModelSection');
        
        if (type === 'image') {
            imageSection.style.display = 'block';
            videoSection.style.display = 'none';
            this.clearVideoModelSelection();
        } else if (type === 'video') {
            imageSection.style.display = 'none';
            videoSection.style.display = 'block';
            this.clearImageModelSelection();
        }
        
        this.updateParamVisibility();
        // 注意：updateModeIndicator 需要在外部调用，或者传入回调
        this.save();
    }

    // 视频平台切换函数
    switchVideoPlatform(platform) {
        const allPlatforms = ['grokModels', 'doubaoModels', 'veoModels'];
        allPlatforms.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        const targetId = platform + 'Models';
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.style.display = 'block';
        }
        
        if (this.dom.useCustomVideoModel) {
            this.dom.useCustomVideoModel.checked = false;
            this.ensureCustomVideoModelVisibility();
        }
        if (this.dom.customVideoModelInput) {
            this.dom.customVideoModelInput.value = '';
        }
        
        this.save();
        this.updateParamVisibility();
    }

    // 绘画平台切换函数
    switchImagePlatform(platform) {
        const allPlatforms = ['openaiModels', 'geminiModels', 'grokImageModels', 'doubaoImageModels'];
        allPlatforms.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        const targetId = platform === 'openai' ? 'openaiModels' :
                        platform === 'gemini' ? 'geminiModels' :
                        platform === 'grok' ? 'grokImageModels' :
                        platform === 'doubao' ? 'doubaoImageModels' : null;
        
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.style.display = 'block';
        }
        
        if (this.dom.useCustomImageModel) {
            this.dom.useCustomImageModel.checked = false;
            this.ensureCustomImageModelVisibility();
        }
        if (this.dom.customImageModelInput) {
            this.dom.customImageModelInput.value = '';
        }
        
        this.save();
        this.updateParamVisibility();
    }

    // 更新 Veo 模型选择
    updateVeoModelSelection() {
        const veoTypeRadios = document.querySelectorAll('input[name="veoType"]');
        const veoQualityRadios = document.querySelectorAll('input[name="veoQuality"]');
        const veoGifModeRadios = document.querySelectorAll('input[name="veoGifMode"]');
        const veoOrientationRadios = document.querySelectorAll('input[name="veoOrientation"]');
        
        let selectedType = null;
        let selectedQuality = null;
        let selectedGifMode = null;
        let selectedOrientation = null;
        
        veoTypeRadios.forEach(radio => {
            if (radio.checked) selectedType = radio.value;
        });
        veoQualityRadios.forEach(radio => {
            if (radio.checked) selectedQuality = radio.value;
        });
        veoGifModeRadios.forEach(radio => {
            if (radio.checked) selectedGifMode = radio.value;
        });
        veoOrientationRadios.forEach(radio => {
            if (radio.checked) selectedOrientation = radio.value;
        });
        
        // 根据选择显示/隐藏相应的选项组
        const qualityGroup = document.getElementById('veoQualityGroup');
        const gifModeGroup = document.getElementById('veoGifModeGroup');
        
        if (selectedType === 'gif') {
            if (qualityGroup) qualityGroup.style.display = 'none';
            if (gifModeGroup) gifModeGroup.style.display = 'block';
        } else {
            if (qualityGroup) qualityGroup.style.display = 'block';
            if (gifModeGroup) gifModeGroup.style.display = 'none';
        }
        
        // 构建模型名称
        let modelName = 'veo3.1';
        
        // 添加方向
        if (selectedOrientation) {
            modelName += `-${selectedOrientation}`;
        }
        
        // 根据类型添加后缀
        if (selectedType === 'frame2video') {
            modelName += '-fl';
        } else if (selectedType === 'gif') {
            if (selectedGifMode === 'frame') {
                modelName += '-fl';
            }
            modelName += '-gif';
        }
        
        // 添加画质（仅对非GIF类型，且非普通画质）
        if (selectedType !== 'gif' && selectedQuality && selectedQuality !== 'standard') {
            modelName += `-${selectedQuality}`;
        }
        
        // 更新显示和隐藏的input
        const displayElement = document.getElementById('veoModelDisplay');
        const selectElement = document.getElementById('veoModelSelect');
        
        if (displayElement) {
            displayElement.textContent = modelName;
        }
        if (selectElement) {
            selectElement.value = modelName;
        }
        
        // 保存选择状态
        this.save();
    }

    // 更新 Grok 模型选择
    updateGrokModelSelection() {
        const grokModelRadios = document.querySelectorAll('input[name="grokModel"]');
        const grokDurationRadios = document.querySelectorAll('input[name="grokDuration"]');
        const grokAspectRatioRadios = document.querySelectorAll('input[name="grokAspectRatio"]');

        let selectedModel = 'grok-video';
        let selectedDuration = '10';
        let selectedAspectRatio = '16:9';

        grokModelRadios.forEach(radio => {
            if (radio.checked) selectedModel = radio.value;
        });
        grokDurationRadios.forEach(radio => {
            if (radio.checked) selectedDuration = radio.value;
        });
        grokAspectRatioRadios.forEach(radio => {
            if (radio.checked) selectedAspectRatio = radio.value;
        });

        // 更新显示元素
        const displayElement = document.getElementById('grokModelDisplay');
        const durationDisplay = document.getElementById('grokDurationDisplay');
        const aspectRatioDisplay = document.getElementById('grokAspectRatioDisplay');
        const selectElement = document.getElementById('grokModelSelect');
        const durationSelectElement = document.getElementById('grokDurationSelect');
        const aspectRatioSelectElement = document.getElementById('grokAspectRatioSelect');

        if (displayElement) displayElement.textContent = selectedModel;
        if (durationDisplay) durationDisplay.textContent = selectedDuration + '秒';
        if (aspectRatioDisplay) aspectRatioDisplay.textContent = selectedAspectRatio;
        if (selectElement) selectElement.value = selectedModel;
        if (durationSelectElement) durationSelectElement.value = selectedDuration;
        if (aspectRatioSelectElement) aspectRatioSelectElement.value = selectedAspectRatio;

        // 保存选择状态
        this.save();
    }

    clearImageModelSelection() {
        // 清除所有平台的模型选择
        const platformSelects = ['openaiModelSelect', 'geminiModelSelect', 'grokImageModelSelect', 'doubaoImageModelSelect'];
        platformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                Array.from(select.options).forEach(opt => opt.selected = false);
            }
        });
        
        const imagePlatformRadios = document.querySelectorAll('input[name="imagePlatform"]');
        imagePlatformRadios.forEach(radio => radio.checked = false);
        
        const allPlatforms = ['openaiModels', 'geminiModels', 'grokImageModels', 'doubaoImageModels'];
        allPlatforms.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        if (this.dom.useCustomImageModel) {
            this.dom.useCustomImageModel.checked = false;
            this.ensureCustomImageModelVisibility();
        }
        if (this.dom.customImageModelInput) {
            this.dom.customImageModelInput.value = '';
        }
    }

    clearVideoModelSelection() {
        const platformSelects = ['grokModelSelect', 'doubaoModelSelect', 'veoModelSelect'];
        platformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) select.value = '';
        });
        
        const platformRadios = document.querySelectorAll('input[name="videoPlatform"]');
        platformRadios.forEach(radio => radio.checked = false);
        
        const allPlatforms = ['grokModels', 'doubaoModels', 'veoModels'];
        allPlatforms.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        if (this.dom.useCustomVideoModel) {
            this.dom.useCustomVideoModel.checked = false;
            this.ensureCustomVideoModelVisibility();
        }
        if (this.dom.customVideoModelInput) {
            this.dom.customVideoModelInput.value = '';
        }
    }

    ensureCustomImageModelVisibility() {
        if (this.dom.useCustomImageModel && this.dom.customImageModelInput) {
            this.dom.customImageModelInput.style.display = this.dom.useCustomImageModel.checked ? 'block' : 'none';
        }
    }

    ensureCustomVideoModelVisibility() {
        if (this.dom.useCustomVideoModel && this.dom.customVideoModelInput) {
            this.dom.customVideoModelInput.style.display = this.dom.useCustomVideoModel.checked ? 'block' : 'none';
        }
    }

    updateAspectRatioOptions(models) {
        const hasGemini25Flash = models.some(m => isGemini25Flash(m));
        const hasGemini31Flash = models.some(m => isGemini31FlashImage(m));
        const hasGemini3Pro = models.some(m => isGemini3ProImage(m));
        
        if (!this.dom.size) return;
        
        const currentValue = this.dom.size.value;
        
        if (hasGemini25Flash) {
            this.dom.size.innerHTML = GEMINI_25_FLASH_ASPECTS.map(aspect =>
                `<option value="${aspect.value}">${aspect.label} (${aspect.resolution})</option>`
            ).join('');
            
            if (GEMINI_25_FLASH_ASPECTS.some(a => a.value === currentValue)) {
                this.dom.size.value = currentValue;
            } else {
                this.dom.size.value = '1:1';
            }
        } else if (hasGemini3Pro || hasGemini31Flash) {
            // Gemini 3 Pro 和 Gemini 3.1 Flash 都支持 1K/2K/4K
            const imageSize = this.dom.geminiImageSize ? this.dom.geminiImageSize.value : '1K';
            this.dom.size.innerHTML = GEMINI_3_PRO_ASPECTS.map(aspect => {
                const resolution = aspect.resolutions[imageSize];
                return `<option value="${aspect.value}">${aspect.label} (${resolution})</option>`;
            }).join('');
            
            if (GEMINI_3_PRO_ASPECTS.some(a => a.value === currentValue)) {
                this.dom.size.value = currentValue;
            } else {
                this.dom.size.value = '1:1';
            }
        } else {
            this.dom.size.innerHTML = `
                <option value="1:1">1:1 方形</option>
                <option value="16:9">16:9 横向</option>
                <option value="9:16">9:16 纵向</option>
                <option value="4:3">4:3 横向</option>
                <option value="3:4">3:4 纵向</option>
                <option value="3:2">3:2 横向</option>
                <option value="2:3">2:3 纵向</option>
                <option value="5:4">5:4 横向</option>
                <option value="4:5">4:5 纵向</option>
                <option value="21:9">21:9 超宽</option>
            `;
            this.dom.size.value = currentValue || '1:1';
        }
    }

    updateJimengResolutionOptions(is10ProModel) {
        if (!this.dom.jimengResolution) return;
        
        const currentValue = this.dom.jimengResolution.value;
        
        if (is10ProModel) {
            this.dom.jimengResolution.innerHTML = `
                <option value="480p">480p 标清</option>
                <option value="720p">720p 高清</option>
                <option value="1080p">1080p 全高清</option>
            `;
            this.dom.jimengResolution.value = currentValue === '1080p' || currentValue === '720p' || currentValue === '480p' ? currentValue : '1080p';
        } else {
            this.dom.jimengResolution.innerHTML = `
                <option value="480p">480p 标清</option>
                <option value="720p">720p 高清</option>
            `;
            this.dom.jimengResolution.value = currentValue === '480p' ? '480p' : '720p';
        }
    }

    updateParamVisibility() {
        const models = this.getSelectedModels();
        const modelTypeRadios = document.querySelectorAll('input[name="modelType"]');
        let selectedType = null;
        modelTypeRadios.forEach(radio => {
            if (radio.checked) selectedType = radio.value;
        });
        
        if (!selectedType) {
            if (this.dom.geminiResolutionGroup) this.dom.geminiResolutionGroup.style.display = 'none';
            if (this.dom.sizeParamGroup) this.dom.sizeParamGroup.style.display = 'none';
            if (this.dom.responseFormatGroup) this.dom.responseFormatGroup.style.display = 'none';
            if (this.dom.jimengVideoParamsGroup) this.dom.jimengVideoParamsGroup.style.display = 'none';
            const nGroup = document.querySelector('#n')?.closest('.input-group');
            if (nGroup) nGroup.style.display = 'none';
            return;
        }
        
        if (selectedType === 'video') {
            if (this.dom.geminiResolutionGroup) this.dom.geminiResolutionGroup.style.display = 'none';
            
            const hasJimeng15Model = models.some(m => m === 'doubao-seedance-1-5-pro-251215');
            const hasJimeng10Model = models.some(m => m === 'doubao-seedance-1-0-pro-250528');
            const hasJimengModel = hasJimeng15Model || hasJimeng10Model;
            
            if (hasJimengModel) {
                if (this.dom.sizeParamGroup) this.dom.sizeParamGroup.style.display = 'none';
                if (this.dom.responseFormatGroup) this.dom.responseFormatGroup.style.display = 'none';
                
                const nGroup = document.querySelector('#n')?.closest('.input-group');
                if (nGroup) nGroup.style.display = 'block';
                
                if (this.dom.jimengVideoParamsGroup) {
                    this.dom.jimengVideoParamsGroup.style.display = 'block';
                    if (this.dom.jimengResolution) {
                        this.updateJimengResolutionOptions(hasJimeng10Model);
                        if (hasJimeng10Model) this.dom.jimengResolution.value = '1080p';
                    }
                }
            } else {
                if (this.dom.sizeParamGroup) this.dom.sizeParamGroup.style.display = 'none';
                if (this.dom.responseFormatGroup) this.dom.responseFormatGroup.style.display = 'none';
                if (this.dom.jimengVideoParamsGroup) this.dom.jimengVideoParamsGroup.style.display = 'none';
                
                const nGroup = document.querySelector('#n')?.closest('.input-group');
                if (nGroup) nGroup.style.display = 'block';
            }
            return;
        }

        // 绘画模型
        const hasGemini25Flash = models.some(m => isGemini25Flash(m));
        const hasGemini31Flash = models.some(m => isGemini31FlashImage(m));
        const hasGemini3Pro = models.some(m => isGemini3ProImage(m));
        const hasGeminiModel = hasGemini25Flash || hasGemini31Flash || hasGemini3Pro || models.some(m => isGeminiModel(m));

        if (this.dom.jimengVideoParamsGroup) {
            this.dom.jimengVideoParamsGroup.style.display = 'none';
        }

        if (this.dom.geminiResolutionGroup && this.dom.geminiImageSize) {
            // Gemini 3 Pro 和 Gemini 3.1 Flash 都支持 1K/2K/4K
            if (hasGemini3Pro || hasGemini31Flash) {
                this.dom.geminiResolutionGroup.style.display = 'block';
                this.dom.geminiImageSize.innerHTML = `
                    <option value="1K">1K - 标准</option>
                    <option value="2K">2K - 高清</option>
                    <option value="4K">4K - 超清</option>
                `;
                const savedSize = localStorage.getItem('aiPaintingGeminiImageSize') || '1K';
                this.dom.geminiImageSize.value = savedSize;
            } else if (hasGemini25Flash) {
                this.dom.geminiResolutionGroup.style.display = 'block';
                this.dom.geminiImageSize.innerHTML = `
                    <option value="1K">1K - 标准</option>
                `;
                this.dom.geminiImageSize.value = '1K';
            } else {
                this.dom.geminiResolutionGroup.style.display = 'none';
            }
        }

        if (this.dom.sizeParamGroup) {
            this.dom.sizeParamGroup.style.display = 'block';
            this.updateAspectRatioOptions(models);
        }

        if (this.dom.responseFormatGroup) {
            this.dom.responseFormatGroup.style.display = hasGeminiModel ? 'none' : 'block';
        }
        
        const nGroup = document.querySelector('#n')?.closest('.input-group');
        if (nGroup) nGroup.style.display = 'block';
    }

    save() {
        // 保存模型类型选择
        const modelTypeRadios = document.querySelectorAll('input[name="modelType"]');
        modelTypeRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingModelType', radio.value);
            }
        });
        
        // 保存绘画平台选择
        const imagePlatformRadios = document.querySelectorAll('input[name="imagePlatform"]');
        imagePlatformRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingImagePlatform', radio.value);
            }
        });
        
        // 保存各绘画平台的模型选择
        const imagePlatformSelects = [
            { id: 'openaiModelSelect', key: 'openaiModelSelect' },
            { id: 'geminiModelSelect', key: 'geminiModelSelect' },
            { id: 'grokImageModelSelect', key: 'grokImageModelSelect' },
            { id: 'doubaoImageModelSelect', key: 'doubaoImageModelSelect' }
        ];
        imagePlatformSelects.forEach(({ id, key }) => {
            const select = document.getElementById(id);
            if (select) {
                const selectedValues = Array.from(select.selectedOptions).map(o => o.value);
                localStorage.setItem('aiPainting' + key, JSON.stringify(selectedValues));
            }
        });
        
        if (this.dom.customImageModelInput) {
            localStorage.setItem('aiPaintingCustomImageModel', this.dom.customImageModelInput.value.trim());
        }
        if (this.dom.useCustomImageModel) {
            localStorage.setItem('aiPaintingUseCustomImageModel', this.dom.useCustomImageModel.checked);
        }
        
        // 保存视频平台选择
        const platformRadios = document.querySelectorAll('input[name="videoPlatform"]');
        platformRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingVideoPlatform', radio.value);
            }
        });
        
        // 保存各平台的模型选择
        const platformSelects = ['grokModelSelect', 'doubaoModelSelect', 'veoModelSelect'];
        platformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select && select.value) {
                localStorage.setItem('aiPainting' + id, select.value);
            }
        });
        
        // 保存 Veo 模型的选择状态
        const veoTypeRadios = document.querySelectorAll('input[name="veoType"]');
        veoTypeRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingVeoType', radio.value);
            }
        });
        
        const veoQualityRadios = document.querySelectorAll('input[name="veoQuality"]');
        veoQualityRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingVeoQuality', radio.value);
            }
        });
        
        const veoGifModeRadios = document.querySelectorAll('input[name="veoGifMode"]');
        veoGifModeRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingVeoGifMode', radio.value);
            }
        });
        
        const veoOrientationRadios = document.querySelectorAll('input[name="veoOrientation"]');
        veoOrientationRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingVeoOrientation', radio.value);
            }
        });
        
        // 保存 Grok 模型的选择状态
        const grokModelRadios = document.querySelectorAll('input[name="grokModel"]');
        grokModelRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingGrokModel', radio.value);
            }
        });

        const grokSecondsRadios = document.querySelectorAll('input[name="grokSeconds"]');
        grokSecondsRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingGrokSeconds', radio.value);
            }
        });

        const grokResolutionRadios = document.querySelectorAll('input[name="grokResolution"]');
        grokResolutionRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingGrokResolution', radio.value);
            }
        });

        const grokAspectRatioRadios = document.querySelectorAll('input[name="grokAspectRatio"]');
        grokAspectRatioRadios.forEach(radio => {
            if (radio.checked) {
                localStorage.setItem('aiPaintingGrokAspectRatio', radio.value);
            }
        });

        if (this.dom.customVideoModelInput) {
            localStorage.setItem('aiPaintingCustomVideoModel', this.dom.customVideoModelInput.value.trim());
        }
        if (this.dom.useCustomVideoModel) {
            localStorage.setItem('aiPaintingUseCustomVideoModel', this.dom.useCustomVideoModel.checked);
        }
    }

    restore() {
        // 恢复模型类型选择
        const savedModelType = localStorage.getItem('aiPaintingModelType');
        if (savedModelType) {
            const modelTypeRadios = document.querySelectorAll('input[name="modelType"]');
            modelTypeRadios.forEach(radio => {
                if (radio.value === savedModelType) {
                    radio.checked = true;
                }
            });
            // 显示对应的模型区域
            this.switchModelType(savedModelType, 0);
        }
        
        // 恢复绘画平台选择
        const savedImagePlatform = localStorage.getItem('aiPaintingImagePlatform');
        if (savedImagePlatform) {
            const imagePlatformRadios = document.querySelectorAll('input[name="imagePlatform"]');
            imagePlatformRadios.forEach(radio => {
                if (radio.value === savedImagePlatform) {
                    radio.checked = true;
                }
            });
            // 显示对应的平台模型
            this.switchImagePlatform(savedImagePlatform);
        }
        
        // 恢复各绘画平台的模型选择
        const imagePlatformSelects = [
            { id: 'openaiModelSelect', key: 'openaiModelSelect' },
            { id: 'geminiModelSelect', key: 'geminiModelSelect' },
            { id: 'grokImageModelSelect', key: 'grokImageModelSelect' },
            { id: 'doubaoImageModelSelect', key: 'doubaoImageModelSelect' }
        ];
        imagePlatformSelects.forEach(({ id, key }) => {
            const select = document.getElementById(id);
            if (select) {
                const savedValues = JSON.parse(localStorage.getItem('aiPainting' + key) || '[]');
                Array.from(select.options).forEach(opt => {
                    opt.selected = savedValues.includes(opt.value);
                });
            }
        });
        
        if (this.dom.customImageModelInput) {
            this.dom.customImageModelInput.value = localStorage.getItem('aiPaintingCustomImageModel') || '';
        }
        if (this.dom.useCustomImageModel) {
            this.dom.useCustomImageModel.checked = localStorage.getItem('aiPaintingUseCustomImageModel') === 'true';
            this.ensureCustomImageModelVisibility();
        }
        
        // 恢复视频平台选择
        let savedVideoPlatform = localStorage.getItem('aiPaintingVideoPlatform');
        const validVideoPlatforms = ['grok', 'doubao', 'veo'];
        if (savedVideoPlatform && !validVideoPlatforms.includes(savedVideoPlatform)) {
            savedVideoPlatform = 'grok';
            localStorage.setItem('aiPaintingVideoPlatform', savedVideoPlatform);
        }
        if (savedVideoPlatform) {
            const platformRadios = document.querySelectorAll('input[name="videoPlatform"]');
            platformRadios.forEach(radio => {
                if (radio.value === savedVideoPlatform) {
                    radio.checked = true;
                }
            });
            // 显示对应的平台模型
            this.switchVideoPlatform(savedVideoPlatform);
        }
        
        // 恢复各平台的模型选择
        const platformSelects = ['grokModelSelect', 'doubaoModelSelect', 'veoModelSelect'];
        platformSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const savedValue = localStorage.getItem('aiPainting' + id);
                if (savedValue) {
                    select.value = savedValue;
                }
            }
        });
        
        // 恢复 Veo 模型的选择状态
        const savedVeoType = localStorage.getItem('aiPaintingVeoType') || 'text2video';
        const veoTypeRadios = document.querySelectorAll('input[name="veoType"]');
        veoTypeRadios.forEach(radio => {
            if (radio.value === savedVeoType) {
                radio.checked = true;
            }
        });
        
        const savedVeoQuality = localStorage.getItem('aiPaintingVeoQuality') || '4k';
        const veoQualityRadios = document.querySelectorAll('input[name="veoQuality"]');
        veoQualityRadios.forEach(radio => {
            if (radio.value === savedVeoQuality) {
                radio.checked = true;
            }
        });
        
        const savedVeoGifMode = localStorage.getItem('aiPaintingVeoGifMode') || 'text';
        const veoGifModeRadios = document.querySelectorAll('input[name="veoGifMode"]');
        veoGifModeRadios.forEach(radio => {
            if (radio.value === savedVeoGifMode) {
                radio.checked = true;
            }
        });
        
        const savedVeoOrientation = localStorage.getItem('aiPaintingVeoOrientation') || 'landscape';
        const veoOrientationRadios = document.querySelectorAll('input[name="veoOrientation"]');
        veoOrientationRadios.forEach(radio => {
            if (radio.value === savedVeoOrientation) {
                radio.checked = true;
            }
        });
        
        // 恢复 Grok 模型的选择状态
        const savedGrokModel = localStorage.getItem('aiPaintingGrokModel') || 'grok-imagine-0.9';
        const grokModelRadios = document.querySelectorAll('input[name="grokModel"]');
        grokModelRadios.forEach(radio => {
            if (radio.value === savedGrokModel) {
                radio.checked = true;
            }
        });

        const savedGrokSeconds = localStorage.getItem('aiPaintingGrokSeconds') || '6';
        const grokSecondsRadios = document.querySelectorAll('input[name="grokSeconds"]');
        grokSecondsRadios.forEach(radio => {
            if (radio.value === savedGrokSeconds) {
                radio.checked = true;
            }
        });

        const savedGrokResolution = localStorage.getItem('aiPaintingGrokResolution') || '480p';
        const grokResolutionRadios = document.querySelectorAll('input[name="grokResolution"]');
        grokResolutionRadios.forEach(radio => {
            if (radio.value === savedGrokResolution) {
                radio.checked = true;
            }
        });

        const savedGrokAspectRatio = localStorage.getItem('aiPaintingGrokAspectRatio') || '16:9';
        const grokAspectRatioRadios = document.querySelectorAll('input[name="grokAspectRatio"]');
        grokAspectRatioRadios.forEach(radio => {
            if (radio.value === savedGrokAspectRatio) {
                radio.checked = true;
            }
        });

        // 如果是 veo 平台，更新模型选择
        if (savedVideoPlatform === 'veo') {
            this.updateVeoModelSelection();
        }
        
        // 如果是 grok 平台，更新模型选择
        if (savedVideoPlatform === 'grok') {
            this.updateGrokModelSelection();
        }
        
        if (this.dom.customVideoModelInput) {
            this.dom.customVideoModelInput.value = localStorage.getItem('aiPaintingCustomVideoModel') || '';
        }
        if (this.dom.useCustomVideoModel) {
            this.dom.useCustomVideoModel.checked = localStorage.getItem('aiPaintingUseCustomVideoModel') === 'true';
            this.ensureCustomVideoModelVisibility();
        }
    }
}
