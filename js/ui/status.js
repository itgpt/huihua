import { isVideoModel } from '../models/modelConfig.js';

export function updateModeIndicator(dom, hasImages, selectedModels) {
    const hasVideoModel = selectedModels.some(model => isVideoModel(model));
    
    if (hasVideoModel) {
        if (hasImages) {
            dom.currentMode.textContent = '视频生成 (已上传参考图片)';
            dom.generateBtnText.textContent = '🎬 生成视频';
            dom.modeIndicator.style.background = '#fff3cd';
            dom.modeIndicator.style.color = '#856404';
        } else {
            dom.currentMode.textContent = '视频生成 (建议上传图片)';
            dom.generateBtnText.textContent = '🎬 生成视频';
            dom.modeIndicator.style.background = '#f8d7da';
            dom.modeIndicator.style.color = '#721c24';
        }
    } else if (hasImages) {
        dom.currentMode.textContent = '图片编辑';
        dom.generateBtnText.textContent = '🖼️ 编辑图片';
        dom.modeIndicator.style.background = '#fff3cd';
        dom.modeIndicator.style.color = '#856404';
    } else {
        dom.currentMode.textContent = '图片生成';
        dom.generateBtnText.textContent = '🎨 生成图片';
        dom.modeIndicator.style.background = '#e9ecef';
        dom.modeIndicator.style.color = '#495057';
    }
}

export function updatePromptStatus(dom) {
    const promptContainer = document.querySelector('.prompt-input-container');
    if (!dom.prompt || !promptContainer) return;
    
    const promptValue = dom.prompt.value.trim();
    
    if (promptValue === '') {
        promptContainer.classList.add('empty');
    } else {
        promptContainer.classList.remove('empty');
    }
}

export function updateApiKeyStatus(dom) {
    const apiKeyContainer = document.getElementById('apiKeyContainer');
    if (!dom.apiKey || !apiKeyContainer) return;
    
    const apiKeyValue = dom.apiKey.value.trim();
    
    if (apiKeyValue === '') {
        apiKeyContainer.classList.add('empty');
    } else {
        apiKeyContainer.classList.remove('empty');
    }
}

export function updateApiBaseUrlStatus(dom) {
    const apiBaseUrlContainer = document.getElementById('apiBaseUrlContainer');
    if (!dom.apiBaseUrl || !apiBaseUrlContainer) return;
    
    const apiBaseUrlValue = dom.apiBaseUrl.value.trim();
    
    if (apiBaseUrlValue === '') {
        apiBaseUrlContainer.classList.add('empty');
    } else {
        apiBaseUrlContainer.classList.remove('empty');
    }
}
